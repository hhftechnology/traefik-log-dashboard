"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDB = getDB;
exports.getAllAgents = getAllAgents;
exports.getAgentById = getAgentById;
exports.addAgent = addAgent;
exports.updateAgent = updateAgent;
exports.deleteAgent = deleteAgent;
exports.getSelectedAgentId = getSelectedAgentId;
exports.setSelectedAgentId = setSelectedAgentId;
exports.getSelectedAgent = getSelectedAgent;
exports.isEnvOnlyAgentsMode = isEnvOnlyAgentsMode;
exports.syncEnvAgents = syncEnvAgents;
exports.bulkImportAgents = bulkImportAgents;
exports.serializeAgent = serializeAgent;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = process.env.DATA_DIR || '/data';
const DB_PATH = path_1.default.join(DATA_DIR, 'dashboard.db');
let db;
function getDB() {
    if (!db) {
        db = new better_sqlite3_1.default(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        initSchema();
    }
    return db;
}
function initSchema() {
    const d = getDB();
    d.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      configured_url TEXT,
      token TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'user',
      location TEXT NOT NULL DEFAULT 'on-site',
      number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'checking',
      description TEXT,
      tags TEXT,
      last_seen TEXT
    );

    CREATE TABLE IF NOT EXISTS selected_agent (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      agent_id TEXT,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
    );

    INSERT OR IGNORE INTO selected_agent (id, agent_id) VALUES (1, NULL);
  `);
}
// --- Agent CRUD ---
function getAllAgents() {
    return getDB().prepare('SELECT * FROM agents ORDER BY number ASC').all();
}
function getAgentById(id) {
    return getDB().prepare('SELECT * FROM agents WHERE id = ?').get(id);
}
function addAgent(agent) {
    const d = getDB();
    const maxRow = d.prepare('SELECT MAX(number) as maxNum FROM agents').get();
    const nextNumber = (maxRow?.maxNum ?? 0) + 1;
    const id = `agent-${String(nextNumber).padStart(3, '0')}`;
    const stmt = d.prepare(`
    INSERT INTO agents (id, name, url, configured_url, token, source, location, number, status, description, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'checking', ?, ?)
  `);
    stmt.run(id, agent.name, agent.url, agent.configured_url ?? null, agent.token ?? '', agent.source ?? 'user', agent.location ?? 'on-site', nextNumber, agent.description ?? null, agent.tags ? JSON.stringify(agent.tags) : null);
    return getAgentById(id);
}
function updateAgent(id, updates) {
    const existing = getAgentById(id);
    if (!existing)
        return null;
    // Don't allow updating env agents' core fields
    if (existing.source === 'env') {
        // Only allow status and last_seen updates for env agents
        const allowed = ['status', 'last_seen'];
        const filtered = {};
        for (const key of allowed) {
            if (key in updates)
                filtered[key] = updates[key];
        }
        if (Object.keys(filtered).length === 0)
            return existing;
        updates = filtered;
    }
    const setClauses = [];
    const values = [];
    const columnMap = {
        name: 'name',
        url: 'url',
        configuredUrl: 'configured_url',
        configured_url: 'configured_url',
        token: 'token',
        location: 'location',
        status: 'status',
        description: 'description',
        tags: 'tags',
        lastSeen: 'last_seen',
        last_seen: 'last_seen',
    };
    for (const [key, val] of Object.entries(updates)) {
        const col = columnMap[key];
        if (!col)
            continue;
        setClauses.push(`${col} = ?`);
        if (col === 'tags' && Array.isArray(val)) {
            values.push(JSON.stringify(val));
        }
        else if (val instanceof Date) {
            values.push(val.toISOString());
        }
        else {
            values.push(val ?? null);
        }
    }
    if (setClauses.length === 0)
        return existing;
    values.push(id);
    getDB().prepare(`UPDATE agents SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
    return getAgentById(id) ?? null;
}
function deleteAgent(id) {
    const existing = getAgentById(id);
    if (!existing || existing.source === 'env')
        return false;
    const result = getDB().prepare('DELETE FROM agents WHERE id = ? AND source != ?').run(id, 'env');
    // If deleted agent was selected, clear selection
    if (result.changes > 0) {
        const selected = getSelectedAgentId();
        if (selected === id) {
            setSelectedAgentId(null);
        }
    }
    return result.changes > 0;
}
// --- Selected Agent ---
function getSelectedAgentId() {
    const row = getDB().prepare('SELECT agent_id FROM selected_agent WHERE id = 1').get();
    return row?.agent_id ?? null;
}
function setSelectedAgentId(agentId) {
    getDB().prepare('UPDATE selected_agent SET agent_id = ? WHERE id = 1').run(agentId);
}
function getSelectedAgent() {
    const selectedId = getSelectedAgentId();
    const agents = getAllAgents();
    if (selectedId) {
        const found = agents.find(a => a.id === selectedId);
        if (found)
            return found;
    }
    // Fallback to first agent
    return agents[0] ?? null;
}
// --- Env Agent Sync ---
function normalizeAgentID(raw, fallback) {
    const normalized = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
    if (!normalized) {
        return fallback;
    }
    return normalized.startsWith('agent-env-') ? normalized : `agent-env-${normalized}`;
}
function normalizeAgentURL(raw) {
    return raw.trim().replace(/\/+$/, '');
}
function parseLocation(raw) {
    return raw === 'off-site' ? 'off-site' : 'on-site';
}
function parseTags(raw) {
    if (Array.isArray(raw)) {
        const tags = raw.filter((tag) => typeof tag === 'string' && tag.trim().length > 0);
        return tags.length > 0 ? tags : undefined;
    }
    if (typeof raw === 'string') {
        const tags = raw
            .split(',')
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0);
        return tags.length > 0 ? tags : undefined;
    }
    return undefined;
}
function parseIndexedEnvAgents() {
    const indexes = new Set();
    const matcher = /^AGENT_(\d+)_URL$/;
    for (const key of Object.keys(process.env)) {
        const match = key.match(matcher);
        if (match) {
            indexes.add(Number(match[1]));
        }
    }
    const parsedAgents = [];
    const orderedIndexes = [...indexes]
        .filter((index) => Number.isFinite(index) && index > 0)
        .sort((a, b) => a - b);
    for (const index of orderedIndexes) {
        const url = normalizeAgentURL(process.env[`AGENT_${index}_URL`] || '');
        if (!url) {
            continue;
        }
        const name = (process.env[`AGENT_${index}_NAME`] || `Agent ${index}`).trim() || `Agent ${index}`;
        const id = normalizeAgentID(process.env[`AGENT_${index}_ID`] || '', `agent-env-${index}`);
        const token = process.env[`AGENT_${index}_TOKEN`] || '';
        const location = parseLocation(process.env[`AGENT_${index}_LOCATION`]);
        const description = process.env[`AGENT_${index}_DESCRIPTION`]?.trim() || undefined;
        const tags = parseTags(process.env[`AGENT_${index}_TAGS`]);
        parsedAgents.push({
            id,
            name,
            url,
            token,
            location,
            description,
            tags,
        });
    }
    return parsedAgents;
}
function parseJSONEnvAgents() {
    const raw = process.env.DASHBOARD_AGENTS_JSON || process.env.DASHBOARD_AGENTS || '';
    if (!raw.trim()) {
        return [];
    }
    try {
        const payload = JSON.parse(raw);
        if (!Array.isArray(payload)) {
            return [];
        }
        const parsedAgents = [];
        payload.forEach((entry, index) => {
            if (!entry || typeof entry !== 'object') {
                return;
            }
            const parsed = entry;
            const url = normalizeAgentURL(typeof parsed.url === 'string' ? parsed.url : '');
            if (!url) {
                return;
            }
            const fallbackID = `agent-env-json-${index + 1}`;
            const id = normalizeAgentID(typeof parsed.id === 'string' ? parsed.id : '', fallbackID);
            const name = (typeof parsed.name === 'string' ? parsed.name : `Env Agent ${index + 1}`).trim() || `Env Agent ${index + 1}`;
            const token = typeof parsed.token === 'string' ? parsed.token : '';
            const location = parseLocation(parsed.location);
            const description = typeof parsed.description === 'string' ? parsed.description.trim() : undefined;
            const tags = parseTags(parsed.tags);
            parsedAgents.push({
                id,
                name,
                url,
                token,
                location,
                description,
                tags,
            });
        });
        return parsedAgents;
    }
    catch (error) {
        console.error('[db] Failed to parse DASHBOARD_AGENTS_JSON:', error);
        return [];
    }
}
function parseLegacyDefaultEnvAgent() {
    const url = normalizeAgentURL(process.env.AGENT_API_URL || process.env.AGENT_URL || '');
    const token = process.env.AGENT_API_TOKEN || process.env.AGENT_TOKEN || '';
    if (!url && !token) {
        return [];
    }
    return [{
            id: 'agent-env-default',
            name: (process.env.AGENT_NAME || 'Default Agent').trim() || 'Default Agent',
            url,
            token,
            location: parseLocation(process.env.AGENT_LOCATION),
            description: process.env.AGENT_DESCRIPTION?.trim() || undefined,
            tags: parseTags(process.env.AGENT_TAGS),
        }];
}
function parseConfiguredEnvAgents() {
    const indexed = parseIndexedEnvAgents();
    if (indexed.length > 0) {
        return indexed;
    }
    const fromJSON = parseJSONEnvAgents();
    if (fromJSON.length > 0) {
        return fromJSON;
    }
    return parseLegacyDefaultEnvAgent();
}
function isEnvOnlyAgentsMode() {
    const raw = (process.env.DASHBOARD_AGENTS_ENV_ONLY || '').trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}
function syncEnvAgents() {
    const envAgents = parseConfiguredEnvAgents();
    const d = getDB();
    const configuredIDs = new Set(envAgents.map((agent) => agent.id));
    const existingEnvAgents = d
        .prepare(`SELECT id FROM agents WHERE source = 'env'`)
        .all();
    for (const row of existingEnvAgents) {
        if (!configuredIDs.has(row.id)) {
            d.prepare('DELETE FROM agents WHERE id = ? AND source = ?').run(row.id, 'env');
        }
    }
    envAgents.forEach((agent, index) => {
        const existing = getAgentById(agent.id);
        if (existing) {
            d.prepare(`
        UPDATE agents
        SET name = ?, url = ?, configured_url = ?, token = ?, source = 'env', location = ?, number = ?, description = ?, tags = ?
        WHERE id = ?
      `).run(agent.name, agent.url || existing.url, agent.url || existing.configured_url, agent.token, agent.location, index, agent.description ?? null, agent.tags ? JSON.stringify(agent.tags) : null, agent.id);
            return;
        }
        d.prepare(`
      INSERT INTO agents (id, name, url, configured_url, token, source, location, number, status, description, tags)
      VALUES (?, ?, ?, ?, ?, 'env', ?, ?, 'checking', ?, ?)
    `).run(agent.id, agent.name, agent.url, agent.url, agent.token, agent.location, index, agent.description ?? null, agent.tags ? JSON.stringify(agent.tags) : null);
    });
    const selected = getSelectedAgentId();
    const selectedExists = selected ? Boolean(getAgentById(selected)) : false;
    if (!selected || !selectedExists) {
        if (envAgents.length > 0) {
            setSelectedAgentId(envAgents[0].id);
            return;
        }
        const firstAvailable = getAllAgents()[0];
        setSelectedAgentId(firstAvailable?.id ?? null);
    }
}
// --- Bulk import (for localStorage migration) ---
function bulkImportAgents(agents) {
    const d = getDB();
    let imported = 0;
    const insert = d.prepare(`
    INSERT OR IGNORE INTO agents (id, name, url, configured_url, token, source, location, number, status, description, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'checking', ?, ?)
  `);
    const txn = d.transaction(() => {
        for (const agent of agents) {
            // Skip env agents — they're managed by syncEnvAgents
            if (agent.source === 'env' || agent.id?.startsWith('agent-env-'))
                continue;
            const maxRow = d.prepare('SELECT MAX(number) as maxNum FROM agents').get();
            const nextNumber = (maxRow?.maxNum ?? 0) + 1;
            const id = agent.id || `agent-${String(nextNumber).padStart(3, '0')}`;
            const result = insert.run(id, agent.name, agent.url, agent.configuredUrl ?? null, agent.token ?? '', 'user', agent.location ?? 'on-site', agent.number ?? nextNumber, agent.description ?? null, agent.tags ? JSON.stringify(agent.tags) : null);
            if (result.changes > 0)
                imported++;
        }
    });
    txn();
    return imported;
}
// --- Serialize for API response ---
function serializeAgent(row) {
    return {
        id: row.id,
        name: row.name,
        url: row.url,
        configuredUrl: row.configured_url ?? undefined,
        tokenSet: row.token.length > 0,
        source: row.source,
        location: row.location,
        number: row.number,
        status: row.status,
        description: row.description ?? undefined,
        tags: row.tags ? JSON.parse(row.tags) : undefined,
        lastSeen: row.last_seen ?? undefined,
    };
}
