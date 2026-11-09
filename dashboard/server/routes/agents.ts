import { Router, Request, Response } from 'express';
import { requireDashboardAuth } from '../auth';
import { isAllowedProxyTarget } from '../proxy-allowlist';
import {
  getAllAgents,
  getAgentById,
  addAgent,
  updateAgent,
  deleteAgent,
  getSelectedAgent,
  setSelectedAgentId,
  bulkImportAgents,
  isEnvOnlyAgentsMode,
  serializeAgent,
} from '../db';

const router = Router();

router.use(requireDashboardAuth);

export function omitBlankToken(updates: Record<string, unknown>): Record<string, unknown> {
  if (updates.token !== '') {
    return updates;
  }
  const next = { ...updates };
  delete next.token;
  return next;
}

function rejectWhenEnvOnly(res: Response): boolean {
  if (!isEnvOnlyAgentsMode()) {
    return false;
  }

  res.status(403).json({
    error: 'Agent mutations are disabled in env-only mode',
    hint: 'Set DASHBOARD_AGENTS_ENV_ONLY=false to manage agents via UI/API',
  });
  return true;
}

// GET /api/dashboard/agents — list all agents
router.get('/', (_req: Request, res: Response) => {
  const agents = getAllAgents().map(serializeAgent);
  res.json(agents);
});

// POST /api/dashboard/agents — add agent
router.post('/', (req: Request, res: Response) => {
  if (rejectWhenEnvOnly(res)) {
    return;
  }

  const { name, url, configuredUrl, token, location, description, tags } = req.body;

  if (!name || !url) {
    res.status(400).json({ error: 'name and url are required' });
    return;
  }

  if (!isAllowedProxyTarget(configuredUrl || url)) {
    res.status(400).json({ error: 'agent url is not in DASHBOARD_PROXY_ALLOWLIST' });
    return;
  }

  const agent = addAgent({
    name,
    url,
    configured_url: configuredUrl,
    token: token || '',
    location: location || 'on-site',
    description,
    tags,
  });

  res.status(201).json(serializeAgent(agent));
});

// PATCH /api/dashboard/agents — update agent
router.patch('/', (req: Request, res: Response) => {
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
  if ((nextUrl || nextConfigured) && !isAllowedProxyTarget(nextConfigured || nextUrl || '')) {
    res.status(400).json({ error: 'agent url is not in DASHBOARD_PROXY_ALLOWLIST' });
    return;
  }

  const updated = updateAgent(id, updates);
  if (!updated) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  res.json(serializeAgent(updated));
});

// DELETE /api/dashboard/agents?id=xxx — delete agent
router.delete('/', (req: Request, res: Response) => {
  if (rejectWhenEnvOnly(res)) {
    return;
  }

  const id = req.query.id as string;

  if (!id) {
    res.status(400).json({ error: 'id query param is required' });
    return;
  }

  const deleted = deleteAgent(id);
  if (!deleted) {
    res.status(404).json({ error: 'Agent not found or is env-protected' });
    return;
  }

  res.json({ success: true });
});

// GET /api/dashboard/agents/selected — get selected agent
router.get('/selected', (_req: Request, res: Response) => {
  const agent = getSelectedAgent();
  if (!agent) {
    res.json(null);
    return;
  }
  res.json(serializeAgent(agent));
});

// POST /api/dashboard/agents/selected — set selected agent
router.post('/selected', (req: Request, res: Response) => {
  const { id } = req.body;

  if (id) {
    const agent = getAgentById(id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
  }

  setSelectedAgentId(id || null);
  res.json({ success: true });
});

// POST /api/dashboard/agents/check-status — server-side status check
router.post('/check-status', async (req: Request, res: Response) => {
  const { id } = req.body;

  if (!id) {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  const agent = getAgentById(id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const agentUrl = (agent.configured_url || agent.url).replace(/\/+$/, '');
  if (!isAllowedProxyTarget(agentUrl)) {
    res.status(403).json({ error: 'agent url is not in DASHBOARD_PROXY_ALLOWLIST' });
    return;
  }

  // Update to checking
  updateAgent(id, { status: 'checking' });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
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

    updateAgent(id, {
      status: isOnline ? 'online' : 'offline',
      last_seen: isOnline ? new Date().toISOString() : undefined,
    });

    res.json({ online: isOnline });
  } catch (error) {
    updateAgent(id, { status: 'offline' });
    res.json({ online: false, error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// POST /api/dashboard/agents/import — bulk import from localStorage migration
router.post('/import', (req: Request, res: Response) => {
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
    const record = agent as { url?: unknown; configuredUrl?: unknown };
    const target = typeof record.configuredUrl === 'string' && record.configuredUrl
      ? record.configuredUrl
      : typeof record.url === 'string'
        ? record.url
        : '';
    return !isAllowedProxyTarget(target);
  });
  if (disallowed) {
    res.status(400).json({ error: 'agent url is not in DASHBOARD_PROXY_ALLOWLIST' });
    return;
  }

  const imported = bulkImportAgents(agents);
  res.json({ imported });
});

export default router;
