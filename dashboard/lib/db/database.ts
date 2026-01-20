// dashboard/lib/db/database.ts
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { Agent, AgentUpdate } from '../types/agent';
import { Webhook, WebhookUpdate, AlertRule, AlertRuleUpdate, NotificationHistory } from '../types/alerting';
import { MetricSnapshot, StoredSnapshot } from '../types/metrics-snapshot';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'agents.db');

let db: Database.Database | null = null;

/**
 * Initialize SQLite database with agents table
 */
export function initDatabase(): Database.Database {
  if (db) return db;

  // Ensure data directory exists
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Enable connection pooling and performance optimizations
  db = new Database(DB_PATH, {
    fileMustExist: false,
  });

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  // Optimize for concurrent reads/writes
  db.pragma('synchronous = NORMAL');
  // Increase cache size (10MB)
  db.pragma('cache_size = -10000');
  // Enable memory-mapped I/O for better performance
  db.pragma('mmap_size = 30000000000');
  // Set busy timeout to 5 seconds for better concurrency
  db.pragma('busy_timeout = 5000');

  // Create agents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      token TEXT NOT NULL,
      location TEXT NOT NULL CHECK(location IN ('on-site', 'off-site')),
      number INTEGER NOT NULL,
      status TEXT CHECK(status IN ('online', 'offline', 'checking')),
      last_seen TEXT,
      description TEXT,
      tags TEXT,
      source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('env', 'manual')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_agents_source ON agents(source);
    CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

    CREATE TABLE IF NOT EXISTS selected_agent (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      agent_id TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Webhooks table
    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('discord', 'telegram')),
      url TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks(enabled);
    CREATE INDEX IF NOT EXISTS idx_webhooks_type ON webhooks(type);

    -- Alert Rules table
    CREATE TABLE IF NOT EXISTS alert_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      agent_id TEXT,
      webhook_ids TEXT NOT NULL,
      trigger_type TEXT NOT NULL CHECK(trigger_type IN ('interval', 'threshold', 'event')),
      interval TEXT CHECK(interval IN ('5m', '15m', '30m', '1h', '6h', '12h', '24h')),
      parameters TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);
    CREATE INDEX IF NOT EXISTS idx_alert_rules_agent ON alert_rules(agent_id);
    CREATE INDEX IF NOT EXISTS idx_alert_rules_trigger ON alert_rules(trigger_type);

    -- Notification History table
    CREATE TABLE IF NOT EXISTS notification_history (
      id TEXT PRIMARY KEY,
      alert_rule_id TEXT NOT NULL,
      webhook_id TEXT NOT NULL,
      agent_id TEXT,
      status TEXT NOT NULL CHECK(status IN ('success', 'failed')),
      error_message TEXT,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (alert_rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE,
      FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notification_history_alert ON notification_history(alert_rule_id);
    CREATE INDEX IF NOT EXISTS idx_notification_history_webhook ON notification_history(webhook_id);
    CREATE INDEX IF NOT EXISTS idx_notification_history_status ON notification_history(status);
    CREATE INDEX IF NOT EXISTS idx_notification_history_created ON notification_history(created_at);

    -- Metric Snapshots table
    CREATE TABLE IF NOT EXISTS metric_snapshots (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      window_start TEXT NOT NULL,
      window_end TEXT NOT NULL,
      interval TEXT NOT NULL CHECK(interval IN ('5m', '15m', '30m', '1h', '6h', '12h', '24h')),
      log_count INTEGER NOT NULL,
      metrics TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_metric_snapshots_agent ON metric_snapshots(agent_id);
    CREATE INDEX IF NOT EXISTS idx_metric_snapshots_interval ON metric_snapshots(interval);
    CREATE INDEX IF NOT EXISTS idx_metric_snapshots_timestamp ON metric_snapshots(timestamp);
    CREATE INDEX IF NOT EXISTS idx_metric_snapshots_window ON metric_snapshots(agent_id, interval, window_start);
  `);

  return db;
}

/**
 * Get database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * Sync environment variable agents to database
 */
export function syncEnvAgents(): void {
  const db = getDatabase();
  
  const envUrl = process.env.AGENT_API_URL;
  const envToken = process.env.AGENT_API_TOKEN;
  
  if (!envUrl || !envToken) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('No environment agents to sync');
    }
    return;
  }

  const existing = db.prepare(`
    SELECT id FROM agents WHERE source = 'env' LIMIT 1
  `).get();

  const envAgent: Partial<Agent> = {
    id: 'agent-env-001',
    name: process.env.AGENT_NAME || 'Environment Agent',
    url: envUrl,
    token: envToken,
    location: 'on-site',
    number: 1,
    status: 'checking',
  };

  if (existing) {
    db.prepare(`
      UPDATE agents 
      SET name = ?, url = ?, token = ?, updated_at = CURRENT_TIMESTAMP
      WHERE source = 'env'
    `).run(envAgent.name, envAgent.url, envAgent.token);
    
    if (process.env.NODE_ENV === 'development') {
      console.warn('Updated environment agent in database');
    }
  } else {
    db.prepare(`
      INSERT INTO agents (id, name, url, token, location, number, status, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'env')
    `).run(
      envAgent.id,
      envAgent.name,
      envAgent.url,
      envAgent.token,
      envAgent.location,
      envAgent.number,
      envAgent.status
    );
    
    if (process.env.NODE_ENV === 'development') {
      console.warn('Added environment agent to database');
    }
  }
}

/**
 * Get all agents from database
 */
export function getAllAgents(): Agent[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM agents ORDER BY number ASC
  `).all() as Array<Record<string, unknown>>;

  return rows.map(row => ({
    id: row.id as string,
    name: row.name as string,
    url: row.url as string,
    token: row.token as string,
    location: row.location as 'on-site' | 'off-site',
    number: row.number as number,
    status: row.status as 'online' | 'offline' | 'checking',
    lastSeen: row.last_seen ? new Date(row.last_seen as string) : undefined,
    description: row.description as string | undefined,
    tags: row.tags ? JSON.parse(row.tags as string) : undefined,
  }));
}

/**
 * Get agent by ID
 */
export function getAgentById(id: string): Agent | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT * FROM agents WHERE id = ?
  `).get(id) as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    id: row.id as string,
    name: row.name as string,
    url: row.url as string,
    token: row.token as string,
    location: row.location as 'on-site' | 'off-site',
    number: row.number as number,
    status: row.status as 'online' | 'offline' | 'checking',
    lastSeen: row.last_seen ? new Date(row.last_seen as string) : undefined,
    description: row.description as string | undefined,
    tags: row.tags ? JSON.parse(row.tags as string) : undefined,
  };
}

/**
 * Add new agent to database
 */
export function addAgent(agent: Omit<Agent, 'id' | 'number'>): Agent {
  const db = getDatabase();
  
  const result = db.prepare(`
    SELECT COALESCE(MAX(number), 0) + 1 as next_number FROM agents
  `).get() as { next_number: number };
  
  const nextNumber = result.next_number;
  const newAgent: Agent = {
    ...agent,
    id: `agent-${String(nextNumber).padStart(3, '0')}`,
    number: nextNumber,
    status: 'checking',
  };

  db.prepare(`
    INSERT INTO agents (id, name, url, token, location, number, status, description, tags, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')
  `).run(
    newAgent.id,
    newAgent.name,
    newAgent.url,
    newAgent.token,
    newAgent.location,
    newAgent.number,
    newAgent.status,
    newAgent.description || null,
    newAgent.tags ? JSON.stringify(newAgent.tags) : null
  );

  return newAgent;
}

/**
 * Update agent in database
 * FIX: Handle lastSeen as both Date objects and ISO strings
 */
export function updateAgent(id: string, updates: AgentUpdate): void {
  const db = getDatabase();
  
  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    sets.push('name = ?');
    values.push(updates.name);
  }
  if (updates.url !== undefined) {
    sets.push('url = ?');
    values.push(updates.url);
  }
  if (updates.token !== undefined) {
    sets.push('token = ?');
    values.push(updates.token);
  }
  if (updates.location !== undefined) {
    sets.push('location = ?');
    values.push(updates.location);
  }
  if (updates.status !== undefined) {
    sets.push('status = ?');
    values.push(updates.status);
  }
  if (updates.lastSeen !== undefined) {
    sets.push('last_seen = ?');
    // FIX: Handle both Date objects and ISO strings
    if (updates.lastSeen instanceof Date) {
      values.push(updates.lastSeen.toISOString());
    } else if (typeof updates.lastSeen === 'string') {
      values.push(updates.lastSeen);
    } else if (updates.lastSeen === null) {
      values.push(null);
    }
  }
  if (updates.description !== undefined) {
    sets.push('description = ?');
    values.push(updates.description);
  }
  if (updates.tags !== undefined) {
    sets.push('tags = ?');
    values.push(JSON.stringify(updates.tags));
  }

  if (sets.length === 0) return;

  sets.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  db.prepare(`
    UPDATE agents SET ${sets.join(', ')} WHERE id = ?
  `).run(...values);
}

/**
 * Delete agent from database
 */
export function deleteAgent(id: string): void {
  const db = getDatabase();
  
  const agent = db.prepare(`SELECT source FROM agents WHERE id = ?`).get(id) as { source?: string } | undefined;
  if (agent?.source === 'env') {
    throw new Error('Cannot delete environment-sourced agents');
  }

  db.prepare(`DELETE FROM agents WHERE id = ?`).run(id);
}

/**
 * Get selected agent ID
 */
export function getSelectedAgentId(): string | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT agent_id FROM selected_agent WHERE id = 1
  `).get() as { agent_id: string } | undefined;

  return row?.agent_id || null;
}

/**
 * Set selected agent ID
 */
export function setSelectedAgentId(agentId: string): void {
  const db = getDatabase();
  
  db.prepare(`
    INSERT INTO selected_agent (id, agent_id, updated_at)
    VALUES (1, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET 
      agent_id = excluded.agent_id,
      updated_at = CURRENT_TIMESTAMP
  `).run(agentId);
}

/**
 * Get selected agent with fallback
 */
export function getSelectedAgent(): Agent | null {
  const selectedId = getSelectedAgentId();
  
  if (selectedId) {
    const agent = getAgentById(selectedId);
    if (agent) return agent;
  }

  const agents = getAllAgents();
  if (agents.length > 0) {
    setSelectedAgentId(agents[0].id);
    return agents[0];
  }

  return null;
}

// ==================== WEBHOOKS CRUD ====================

/**
 * Get all webhooks
 */
export function getAllWebhooks(): Webhook[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM webhooks ORDER BY created_at DESC
  `).all() as Array<Record<string, unknown>>;

  return rows.map(row => ({
    id: row.id as string,
    name: row.name as string,
    type: row.type as 'discord' | 'telegram',
    url: row.url as string,
    enabled: Boolean(row.enabled),
    description: row.description as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }));
}

/**
 * Get webhook by ID
 */
export function getWebhookById(id: string): Webhook | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT * FROM webhooks WHERE id = ?
  `).get(id) as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as 'discord' | 'telegram',
    url: row.url as string,
    enabled: Boolean(row.enabled),
    description: row.description as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

/**
 * Add new webhook
 */
export function addWebhook(webhook: Omit<Webhook, 'id' | 'created_at' | 'updated_at'>): Webhook {
  const db = getDatabase();

  const id = `webhook-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO webhooks (id, name, type, url, enabled, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    webhook.name,
    webhook.type,
    webhook.url,
    webhook.enabled ? 1 : 0,
    webhook.description || null,
    now,
    now
  );

  return {
    id,
    ...webhook,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Update webhook
 */
export function updateWebhook(id: string, updates: WebhookUpdate): void {
  const db = getDatabase();

  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    sets.push('name = ?');
    values.push(updates.name);
  }
  if (updates.type !== undefined) {
    sets.push('type = ?');
    values.push(updates.type);
  }
  if (updates.url !== undefined) {
    sets.push('url = ?');
    values.push(updates.url);
  }
  if (updates.enabled !== undefined) {
    sets.push('enabled = ?');
    values.push(updates.enabled ? 1 : 0);
  }
  if (updates.description !== undefined) {
    sets.push('description = ?');
    values.push(updates.description);
  }

  if (sets.length === 0) return;

  sets.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  db.prepare(`
    UPDATE webhooks SET ${sets.join(', ')} WHERE id = ?
  `).run(...values);
}

/**
 * Delete webhook
 */
export function deleteWebhook(id: string): void {
  const db = getDatabase();
  db.prepare(`DELETE FROM webhooks WHERE id = ?`).run(id);
}

/**
 * Get enabled webhooks
 */
export function getEnabledWebhooks(): Webhook[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM webhooks WHERE enabled = 1 ORDER BY created_at DESC
  `).all() as Array<Record<string, unknown>>;

  return rows.map(row => ({
    id: row.id as string,
    name: row.name as string,
    type: row.type as 'discord' | 'telegram',
    url: row.url as string,
    enabled: Boolean(row.enabled),
    description: row.description as string | undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }));
}

// ==================== ALERT RULES CRUD ====================

/**
 * Get all alert rules
 */
export function getAllAlertRules(): AlertRule[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM alert_rules ORDER BY created_at DESC
  `).all() as Array<Record<string, unknown>>;

  return rows.map(row => ({
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    enabled: Boolean(row.enabled),
    agent_id: row.agent_id as string | undefined,
    webhook_ids: JSON.parse(row.webhook_ids as string) as string[],
    trigger_type: row.trigger_type as 'interval' | 'threshold' | 'event',
    interval: row.interval as '5m' | '15m' | '30m' | '1h' | '6h' | '12h' | '24h' | undefined,
    parameters: JSON.parse(row.parameters as string),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }));
}

/**
 * Get alert rule by ID
 */
export function getAlertRuleById(id: string): AlertRule | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT * FROM alert_rules WHERE id = ?
  `).get(id) as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    enabled: Boolean(row.enabled),
    agent_id: row.agent_id as string | undefined,
    webhook_ids: JSON.parse(row.webhook_ids as string) as string[],
    trigger_type: row.trigger_type as 'interval' | 'threshold' | 'event',
    interval: row.interval as '5m' | '15m' | '30m' | '1h' | '6h' | '12h' | '24h' | undefined,
    parameters: JSON.parse(row.parameters as string),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

/**
 * Add new alert rule
 */
export function addAlertRule(rule: Omit<AlertRule, 'id' | 'created_at' | 'updated_at'>): AlertRule {
  const db = getDatabase();

  const id = `alert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO alert_rules (id, name, description, enabled, agent_id, webhook_ids, trigger_type, interval, parameters, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    rule.name,
    rule.description || null,
    rule.enabled ? 1 : 0,
    rule.agent_id || null,
    JSON.stringify(rule.webhook_ids),
    rule.trigger_type,
    rule.interval || null,
    JSON.stringify(rule.parameters),
    now,
    now
  );

  return {
    id,
    ...rule,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Update alert rule
 */
export function updateAlertRule(id: string, updates: AlertRuleUpdate): void {
  const db = getDatabase();

  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    sets.push('name = ?');
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    sets.push('description = ?');
    values.push(updates.description);
  }
  if (updates.enabled !== undefined) {
    sets.push('enabled = ?');
    values.push(updates.enabled ? 1 : 0);
  }
  if (updates.agent_id !== undefined) {
    sets.push('agent_id = ?');
    values.push(updates.agent_id);
  }
  if (updates.webhook_ids !== undefined) {
    sets.push('webhook_ids = ?');
    values.push(JSON.stringify(updates.webhook_ids));
  }
  if (updates.trigger_type !== undefined) {
    sets.push('trigger_type = ?');
    values.push(updates.trigger_type);
  }
  if (updates.interval !== undefined) {
    sets.push('interval = ?');
    values.push(updates.interval);
  }
  if (updates.parameters !== undefined) {
    sets.push('parameters = ?');
    values.push(JSON.stringify(updates.parameters));
  }

  if (sets.length === 0) return;

  sets.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  db.prepare(`
    UPDATE alert_rules SET ${sets.join(', ')} WHERE id = ?
  `).run(...values);
}

/**
 * Delete alert rule
 */
export function deleteAlertRule(id: string): void {
  const db = getDatabase();
  db.prepare(`DELETE FROM alert_rules WHERE id = ?`).run(id);
}

/**
 * Get enabled alert rules
 */
export function getEnabledAlertRules(): AlertRule[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM alert_rules WHERE enabled = 1 ORDER BY created_at DESC
  `).all() as Array<Record<string, unknown>>;

  return rows.map(row => ({
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    enabled: Boolean(row.enabled),
    agent_id: row.agent_id as string | undefined,
    webhook_ids: JSON.parse(row.webhook_ids as string) as string[],
    trigger_type: row.trigger_type as 'interval' | 'threshold' | 'event',
    interval: row.interval as '5m' | '15m' | '30m' | '1h' | '6h' | '12h' | '24h' | undefined,
    parameters: JSON.parse(row.parameters as string),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }));
}

// ==================== NOTIFICATION HISTORY ====================

/**
 * Add notification history entry
 */
export function addNotificationHistory(
  entry: Omit<NotificationHistory, 'id' | 'created_at'>
): NotificationHistory {
  const db = getDatabase();

  const id = `notification-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO notification_history (id, alert_rule_id, webhook_id, agent_id, status, error_message, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    entry.alert_rule_id,
    entry.webhook_id,
    entry.agent_id || null,
    entry.status,
    entry.error_message || null,
    entry.payload,
    now
  );

  return {
    id,
    ...entry,
    created_at: now,
  };
}

/**
 * Get notification history with pagination
 */
export function getNotificationHistory(limit: number = 100, offset: number = 0): NotificationHistory[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM notification_history
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as Array<Record<string, unknown>>;

  return rows.map(row => ({
    id: row.id as string,
    alert_rule_id: row.alert_rule_id as string,
    webhook_id: row.webhook_id as string,
    agent_id: row.agent_id as string | undefined,
    status: row.status as 'success' | 'failed',
    error_message: row.error_message as string | undefined,
    payload: row.payload as string,
    created_at: row.created_at as string,
  }));
}

/**
 * Get notification history for a specific alert rule
 */
export function getNotificationHistoryByAlertRule(
  alertRuleId: string,
  limit: number = 50
): NotificationHistory[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM notification_history
    WHERE alert_rule_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(alertRuleId, limit) as Array<Record<string, unknown>>;

  return rows.map(row => ({
    id: row.id as string,
    alert_rule_id: row.alert_rule_id as string,
    webhook_id: row.webhook_id as string,
    agent_id: row.agent_id as string | undefined,
    status: row.status as 'success' | 'failed',
    error_message: row.error_message as string | undefined,
    payload: row.payload as string,
    created_at: row.created_at as string,
  }));
}

/**
 * Clean up old notification history (older than specified days)
 */
export function cleanupNotificationHistory(daysToKeep: number = 30): number {
  const db = getDatabase();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = db.prepare(`
    DELETE FROM notification_history
    WHERE created_at < ?
  `).run(cutoffDate.toISOString());

  return result.changes;
}

// ==================== METRIC SNAPSHOTS ====================

/**
 * Save a metric snapshot
 */
export function saveMetricSnapshot(snapshot: MetricSnapshot): StoredSnapshot {
  const db = getDatabase();

  const stored: StoredSnapshot = {
    id: snapshot.id,
    agent_id: snapshot.agent_id,
    agent_name: snapshot.agent_name,
    timestamp: snapshot.timestamp,
    window_start: snapshot.window_start,
    window_end: snapshot.window_end,
    interval: snapshot.interval,
    log_count: snapshot.log_count,
    metrics: JSON.stringify(snapshot.metrics),
    created_at: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO metric_snapshots (id, agent_id, agent_name, timestamp, window_start, window_end, interval, log_count, metrics, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    stored.id,
    stored.agent_id,
    stored.agent_name,
    stored.timestamp,
    stored.window_start,
    stored.window_end,
    stored.interval,
    stored.log_count,
    stored.metrics,
    stored.created_at
  );

  return stored;
}

/**
 * Get the latest snapshot for an agent and interval
 */
export function getLatestSnapshot(agentId: string, interval: string): MetricSnapshot | null {
  const db = getDatabase();

  const row = db.prepare(`
    SELECT * FROM metric_snapshots
    WHERE agent_id = ? AND interval = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `).get(agentId, interval) as StoredSnapshot | undefined;

  if (!row) return null;

  return {
    id: row.id,
    agent_id: row.agent_id,
    agent_name: row.agent_name,
    timestamp: row.timestamp,
    window_start: row.window_start,
    window_end: row.window_end,
    interval: row.interval as '5m' | '15m' | '30m' | '1h' | '6h' | '12h' | '24h',
    log_count: row.log_count,
    metrics: JSON.parse(row.metrics),
  };
}

/**
 * Get snapshots for an agent within a time range
 */
export function getSnapshotsByTimeRange(
  agentId: string,
  interval: string,
  startTime: string,
  endTime: string
): MetricSnapshot[] {
  const db = getDatabase();

  const rows = db.prepare(`
    SELECT * FROM metric_snapshots
    WHERE agent_id = ? AND interval = ? AND timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp DESC
  `).all(agentId, interval, startTime, endTime) as StoredSnapshot[];

  return rows.map(row => ({
    id: row.id,
    agent_id: row.agent_id,
    agent_name: row.agent_name,
    timestamp: row.timestamp,
    window_start: row.window_start,
    window_end: row.window_end,
    interval: row.interval as '5m' | '15m' | '30m' | '1h' | '6h' | '12h' | '24h',
    log_count: row.log_count,
    metrics: JSON.parse(row.metrics),
  }));
}

/**
 * Clean up old snapshots (older than specified days)
 */
export function cleanupOldSnapshots(daysToKeep: number = 7): number {
  const db = getDatabase();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const result = db.prepare(`
    DELETE FROM metric_snapshots
    WHERE created_at < ?
  `).run(cutoffDate.toISOString());

  return result.changes;
}

/**
 * Get snapshot count for an agent
 */
export function getSnapshotCount(agentId: string): number {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM metric_snapshots WHERE agent_id = ?
  `).get(agentId) as { count: number };

  return result.count;
}

// Initialize database and sync env agents on module load
if (typeof window === 'undefined') {
  initDatabase();
  syncEnvAgents();
}