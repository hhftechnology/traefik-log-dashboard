"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.omitBlankToken = omitBlankToken;
const express_1 = require("express");
const auth_1 = require("../auth");
const proxy_allowlist_1 = require("../proxy-allowlist");
const db_1 = require("../db");
const router = (0, express_1.Router)();
router.use(auth_1.requireDashboardAuth);
function omitBlankToken(updates) {
    if (updates.token !== '') {
        return updates;
    }
    const next = { ...updates };
    delete next.token;
    return next;
}
function rejectWhenEnvOnly(res) {
    if (!(0, db_1.isEnvOnlyAgentsMode)()) {
        return false;
    }
    res.status(403).json({
        error: 'Agent mutations are disabled in env-only mode',
        hint: 'Set DASHBOARD_AGENTS_ENV_ONLY=false to manage agents via UI/API',
    });
    return true;
}
// GET /api/dashboard/agents — list all agents
router.get('/', (_req, res) => {
    const agents = (0, db_1.getAllAgents)().map(db_1.serializeAgent);
    res.json(agents);
});
// POST /api/dashboard/agents — add agent
router.post('/', (req, res) => {
    if (rejectWhenEnvOnly(res)) {
        return;
    }
    const { name, url, configuredUrl, token, location, description, tags } = req.body;
    if (!name || !url) {
        res.status(400).json({ error: 'name and url are required' });
        return;
    }
    if (!(0, proxy_allowlist_1.isAllowedProxyTarget)(configuredUrl || url)) {
        res.status(400).json({ error: 'agent url is not in DASHBOARD_PROXY_ALLOWLIST' });
        return;
    }
    const agent = (0, db_1.addAgent)({
        name,
        url,
        configured_url: configuredUrl,
        token: token || '',
        location: location || 'on-site',
        description,
        tags,
    });
    res.status(201).json((0, db_1.serializeAgent)(agent));
});
// PATCH /api/dashboard/agents — update agent
router.patch('/', (req, res) => {
    if (rejectWhenEnvOnly(res)) {
        return;
    }
    const { id, ...rawUpdates } = req.body;
    const updates = omitBlankToken(rawUpdates);
    if (!id) {
        res.status(400).json({ error: 'id is required' });
        return;
    }
    const nextUrl = typeof updates.url === 'string' ? updates.url : undefined;
    const nextConfigured = typeof updates.configuredUrl === 'string'
        ? updates.configuredUrl
        : typeof updates.configured_url === 'string'
            ? updates.configured_url
            : undefined;
    if ((nextUrl || nextConfigured) && !(0, proxy_allowlist_1.isAllowedProxyTarget)(nextConfigured || nextUrl || '')) {
        res.status(400).json({ error: 'agent url is not in DASHBOARD_PROXY_ALLOWLIST' });
        return;
    }
    const updated = (0, db_1.updateAgent)(id, updates);
    if (!updated) {
        res.status(404).json({ error: 'Agent not found' });
        return;
    }
    res.json((0, db_1.serializeAgent)(updated));
});
// DELETE /api/dashboard/agents?id=xxx — delete agent
router.delete('/', (req, res) => {
    if (rejectWhenEnvOnly(res)) {
        return;
    }
    const id = req.query.id;
    if (!id) {
        res.status(400).json({ error: 'id query param is required' });
        return;
    }
    const deleted = (0, db_1.deleteAgent)(id);
    if (!deleted) {
        res.status(404).json({ error: 'Agent not found or is env-protected' });
        return;
    }
    res.json({ success: true });
});
// GET /api/dashboard/agents/selected — get selected agent
router.get('/selected', (_req, res) => {
    const agent = (0, db_1.getSelectedAgent)();
    if (!agent) {
        res.json(null);
        return;
    }
    res.json((0, db_1.serializeAgent)(agent));
});
// POST /api/dashboard/agents/selected — set selected agent
router.post('/selected', (req, res) => {
    const { id } = req.body;
    if (id) {
        const agent = (0, db_1.getAgentById)(id);
        if (!agent) {
            res.status(404).json({ error: 'Agent not found' });
            return;
        }
    }
    (0, db_1.setSelectedAgentId)(id || null);
    res.json({ success: true });
});
// POST /api/dashboard/agents/check-status — server-side status check
router.post('/check-status', async (req, res) => {
    const { id } = req.body;
    if (!id) {
        res.status(400).json({ error: 'id is required' });
        return;
    }
    const agent = (0, db_1.getAgentById)(id);
    if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
    }
    const agentUrl = (agent.configured_url || agent.url).replace(/\/+$/, '');
    if (!(0, proxy_allowlist_1.isAllowedProxyTarget)(agentUrl)) {
        res.status(403).json({ error: 'agent url is not in DASHBOARD_PROXY_ALLOWLIST' });
        return;
    }
    // Update to checking
    (0, db_1.updateAgent)(id, { status: 'checking' });
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const headers = { 'Content-Type': 'application/json' };
        if (agent.token) {
            headers['Authorization'] = `Bearer ${agent.token}`;
        }
        const response = await fetch(`${agentUrl}/api/logs/status`, {
            headers,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        let isOnline = response.ok;
        if (!isOnline && response.status === 404) {
            // Compatibility fallback for agents that don't expose /api/logs/status.
            const resourcesResponse = await fetch(`${agentUrl}/api/system/resources`, {
                headers,
                signal: controller.signal,
            });
            isOnline = resourcesResponse.ok;
        }
        (0, db_1.updateAgent)(id, {
            status: isOnline ? 'online' : 'offline',
            last_seen: isOnline ? new Date().toISOString() : undefined,
        });
        res.json({ online: isOnline });
    }
    catch (error) {
        (0, db_1.updateAgent)(id, { status: 'offline' });
        res.json({ online: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
// POST /api/dashboard/agents/import — bulk import from localStorage migration
router.post('/import', (req, res) => {
    if (rejectWhenEnvOnly(res)) {
        return;
    }
    const { agents } = req.body;
    if (!Array.isArray(agents)) {
        res.status(400).json({ error: 'agents array is required' });
        return;
    }
    const disallowed = agents.some((agent) => {
        if (!agent || typeof agent !== 'object') {
            return true;
        }
        const record = agent;
        const target = typeof record.configuredUrl === 'string' && record.configuredUrl
            ? record.configuredUrl
            : typeof record.url === 'string'
                ? record.url
                : '';
        return !(0, proxy_allowlist_1.isAllowedProxyTarget)(target);
    });
    if (disallowed) {
        res.status(400).json({ error: 'agent url is not in DASHBOARD_PROXY_ALLOWLIST' });
        return;
    }
    const imported = (0, db_1.bulkImportAgents)(agents);
    res.json({ imported });
});
exports.default = router;
