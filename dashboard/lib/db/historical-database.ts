// Historical Data Database Module
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import {
  HistoricalConfig,
  HistoricalDataEntry,
  HistoricalDataQuery,
  HistoricalMetrics,
} from '../types/historical';
import { DashboardMetrics } from '../types';

const HISTORICAL_DB_PATH = process.env.HISTORICAL_DB_PATH || path.join(process.cwd(), 'data', 'historical.db');

let historicalDb: Database.Database | null = null;

/**
 * Initialize historical data SQLite database
 */
export function initHistoricalDatabase(): Database.Database {
  if (historicalDb) return historicalDb;

  // Ensure data directory exists
  const dir = path.dirname(HISTORICAL_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  historicalDb = new Database(HISTORICAL_DB_PATH, {
    fileMustExist: false,
  });

  // Enable WAL mode for better concurrency
  historicalDb.pragma('journal_mode = WAL');
  historicalDb.pragma('synchronous = NORMAL');
  historicalDb.pragma('cache_size = -10000');
  historicalDb.pragma('mmap_size = 30000000000');
  historicalDb.pragma('busy_timeout = 5000');

  // Create tables
  historicalDb.exec(`
    -- Configuration table
    CREATE TABLE IF NOT EXISTS historical_config (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      enabled INTEGER NOT NULL DEFAULT 0,
      retention_days INTEGER NOT NULL DEFAULT 90,
      archive_interval INTEGER NOT NULL DEFAULT 60,
      db_path TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Historical data table
    CREATE TABLE IF NOT EXISTS historical_data (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      total_requests INTEGER NOT NULL,
      error_rate REAL NOT NULL,
      avg_response_time REAL NOT NULL,
      p95_response_time REAL NOT NULL,
      p99_response_time REAL NOT NULL,
      status_2xx INTEGER NOT NULL,
      status_3xx INTEGER NOT NULL,
      status_4xx INTEGER NOT NULL,
      status_5xx INTEGER NOT NULL,
      top_ips TEXT,
      top_locations TEXT,
      top_routes TEXT,
      top_status_codes TEXT,
      top_routers TEXT,
      top_services TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_historical_agent ON historical_data(agent_id);
    CREATE INDEX IF NOT EXISTS idx_historical_timestamp ON historical_data(timestamp);
    CREATE INDEX IF NOT EXISTS idx_historical_created ON historical_data(created_at);
    CREATE INDEX IF NOT EXISTS idx_historical_agent_timestamp ON historical_data(agent_id, timestamp);

    -- Initialize default config if not exists
    INSERT OR IGNORE INTO historical_config (id, enabled, retention_days, archive_interval)
    VALUES (1, 0, 90, 60);
  `);

  return historicalDb;
}

/**
 * Get historical database instance
 */
export function getHistoricalDatabase(): Database.Database {
  if (!historicalDb) {
    return initHistoricalDatabase();
  }
  return historicalDb;
}

// ==================== CONFIGURATION ====================

/**
 * Get historical data configuration
 */
export function getHistoricalConfig(): HistoricalConfig {
  const db = getHistoricalDatabase();
  const row = db.prepare(`
    SELECT * FROM historical_config WHERE id = 1
  `).get() as Record<string, unknown> | undefined;

  if (!row) {
    return {
      enabled: false,
      retention_days: 30,
      archive_interval: 60,
      db_path: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return {
    enabled: Boolean(row.enabled),
    retention_days: row.retention_days as number,
    archive_interval: row.archive_interval as number,
    db_path: row.db_path as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

/**
 * Update historical data configuration
 */
export function updateHistoricalConfig(updates: Partial<HistoricalConfig>): void {
  const db = getHistoricalDatabase();

  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.enabled !== undefined) {
    sets.push('enabled = ?');
    values.push(updates.enabled ? 1 : 0);
  }
  if (updates.retention_days !== undefined) {
    sets.push('retention_days = ?');
    values.push(updates.retention_days);
  }
  if (updates.archive_interval !== undefined) {
    sets.push('archive_interval = ?');
    values.push(updates.archive_interval);
  }
  if (updates.db_path !== undefined) {
    sets.push('db_path = ?');
    values.push(updates.db_path);
  }

  if (sets.length === 0) return;

  sets.push('updated_at = CURRENT_TIMESTAMP');

  db.prepare(`
    UPDATE historical_config SET ${sets.join(', ')} WHERE id = 1
  `).run(...values);
}

// ==================== HISTORICAL DATA ====================

/**
 * Add historical data entry
 */
export function addHistoricalData(
  agentId: string,
  metrics: DashboardMetrics
): HistoricalDataEntry {
  const db = getHistoricalDatabase();

  const id = `hist-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const timestamp = new Date().toISOString();

  // Calculate metrics
  const totalRequests = metrics.requests?.total || 0;
  const errorRate = metrics.statusCodes?.errorRate || 0;
  const avgResponseTime = metrics.responseTime?.average || 0;
  const p95ResponseTime = metrics.responseTime?.p95 || 0;
  const p99ResponseTime = metrics.responseTime?.p99 || 0;
  const status2xx = metrics.statusCodes?.status2xx || 0;
  const status3xx = metrics.statusCodes?.status3xx || 0;
  const status4xx = metrics.statusCodes?.status4xx || 0;
  const status5xx = metrics.statusCodes?.status5xx || 0;

  // Serialize top metrics
  const topIps = JSON.stringify(metrics.topClientIPs?.slice(0, 10) || []);
  const topLocations = JSON.stringify(metrics.geoLocations?.slice(0, 10) || []);
  const topRoutes = JSON.stringify(metrics.topRoutes?.slice(0, 10) || []);
  const topStatusCodes = JSON.stringify(
    Object.entries({
      '2xx': status2xx,
      '3xx': status3xx,
      '4xx': status4xx,
      '5xx': status5xx,
    }).map(([status, count]) => ({ status, count }))
  );
  const topRouters = JSON.stringify(metrics.routers?.slice(0, 10) || []);
  const topServices = JSON.stringify(metrics.backends?.slice(0, 10) || []);

  db.prepare(`
    INSERT INTO historical_data (
      id, agent_id, timestamp,
      total_requests, error_rate, avg_response_time, p95_response_time, p99_response_time,
      status_2xx, status_3xx, status_4xx, status_5xx,
      top_ips, top_locations, top_routes, top_status_codes, top_routers, top_services,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    id, agentId, timestamp,
    totalRequests, errorRate, avgResponseTime, p95ResponseTime, p99ResponseTime,
    status2xx, status3xx, status4xx, status5xx,
    topIps, topLocations, topRoutes, topStatusCodes, topRouters, topServices
  );

  const row = db.prepare(`SELECT * FROM historical_data WHERE id = ?`).get(id) as Record<string, unknown> | undefined;

  if (!row) {
    throw new Error('Failed to retrieve inserted historical data');
  }

  return {
    id: row.id as string,
    agent_id: row.agent_id as string,
    timestamp: row.timestamp as string,
    total_requests: row.total_requests as number,
    error_rate: row.error_rate as number,
    avg_response_time: row.avg_response_time as number,
    p95_response_time: row.p95_response_time as number,
    p99_response_time: row.p99_response_time as number,
    status_2xx: row.status_2xx as number,
    status_3xx: row.status_3xx as number,
    status_4xx: row.status_4xx as number,
    status_5xx: row.status_5xx as number,
    top_ips: row.top_ips as string,
    top_locations: row.top_locations as string,
    top_routes: row.top_routes as string,
    top_status_codes: row.top_status_codes as string,
    top_routers: row.top_routers as string,
    top_services: row.top_services as string,
    created_at: row.created_at as string,
  };
}

/**
 * Query historical data
 */
export function queryHistoricalData(query: HistoricalDataQuery): HistoricalMetrics[] {
  const db = getHistoricalDatabase();

  let sql = 'SELECT * FROM historical_data WHERE 1=1';
  const params: unknown[] = [];

  if (query.agent_id) {
    sql += ' AND agent_id = ?';
    params.push(query.agent_id);
  }

  if (query.start_date) {
    sql += ' AND timestamp >= ?';
    params.push(query.start_date);
  }

  if (query.end_date) {
    sql += ' AND timestamp <= ?';
    params.push(query.end_date);
  }

  sql += ' ORDER BY timestamp DESC';

  if (query.limit) {
    sql += ' LIMIT ?';
    params.push(query.limit);
  }

  if (query.offset) {
    sql += ' OFFSET ?';
    params.push(query.offset);
  }

  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

  return rows.map(row => ({
    timestamp: row.timestamp as string,
    total_requests: row.total_requests as number,
    error_rate: row.error_rate as number,
    avg_response_time: row.avg_response_time as number,
    p95_response_time: row.p95_response_time as number,
    p99_response_time: row.p99_response_time as number,
    status_2xx: row.status_2xx as number,
    status_3xx: row.status_3xx as number,
    status_4xx: row.status_4xx as number,
    status_5xx: row.status_5xx as number,
    top_ips: row.top_ips ? JSON.parse(row.top_ips as string) : undefined,
    top_locations: row.top_locations ? JSON.parse(row.top_locations as string) : undefined,
    top_routes: row.top_routes ? JSON.parse(row.top_routes as string) : undefined,
    top_status_codes: row.top_status_codes ? JSON.parse(row.top_status_codes as string) : undefined,
    top_routers: row.top_routers ? JSON.parse(row.top_routers as string) : undefined,
    top_services: row.top_services ? JSON.parse(row.top_services as string) : undefined,
  }));
}

/**
 * Get historical data statistics
 */
export function getHistoricalStats(agentId?: string): {
  total_entries: number;
  oldest_entry: string | null;
  newest_entry: string | null;
  db_size_bytes: number;
} {
  const db = getHistoricalDatabase();

  let sql = 'SELECT COUNT(*) as count, MIN(timestamp) as oldest, MAX(timestamp) as newest FROM historical_data';
  const params: unknown[] = [];

  if (agentId) {
    sql += ' WHERE agent_id = ?';
    params.push(agentId);
  }

  const result = db.prepare(sql).get(...params) as Record<string, unknown> | undefined;
  
  if (!result) {
    return {
      total_entries: 0,
      oldest_entry: null,
      newest_entry: null,
      db_size_bytes: 0,
    };
  }

  // Get database file size
  let dbSize = 0;
  try {
    const stats = fs.statSync(HISTORICAL_DB_PATH);
    dbSize = stats.size;
  } catch (error) {
    console.error('Failed to get database size:', error);
  }

  return {
    total_entries: (result.count as number) || 0,
    oldest_entry: (result.oldest as string) || null,
    newest_entry: (result.newest as string) || null,
    db_size_bytes: dbSize,
  };
}

/**
 * Clean up old historical data based on retention policy
 */
export function cleanupHistoricalData(): number {
  const db = getHistoricalDatabase();
  const config = getHistoricalConfig();

  if (!config.enabled) {
    return 0;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.retention_days);

  const result = db.prepare(`
    DELETE FROM historical_data WHERE timestamp < ?
  `).run(cutoffDate.toISOString());

  // Vacuum database to reclaim space
  db.exec('VACUUM');

  return result.changes;
}

/**
 * Delete all historical data for a specific agent
 */
export function deleteAgentHistoricalData(agentId: string): number {
  const db = getHistoricalDatabase();

  const result = db.prepare(`
    DELETE FROM historical_data WHERE agent_id = ?
  `).run(agentId);

  return result.changes;
}

/**
 * Export historical data to JSON
 */
export function exportHistoricalData(query: HistoricalDataQuery): string {
  const data = queryHistoricalData(query);
  return JSON.stringify(data, null, 2);
}

// Initialize historical database on module load
if (typeof window === 'undefined') {
  initHistoricalDatabase();
}
