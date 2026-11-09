import { Request, Response, Router } from 'express';
import { requireAlertsMutationAuth } from '../alerts-auth';
import { getAgentById, getAllAgents } from '../db';
import {
  createAlertRule,
  createAlertWebhook,
  deleteAlertRule,
  deleteAlertWebhook,
  getAlertNotificationStats,
  getAlertRuleByID,
  getAlertWebhookByID,
  listAlertNotificationHistory,
  listAlertRules,
  listAlertWebhooks,
  updateAlertRule,
  updateAlertWebhook,
} from '../alerts/repository';
import { sendWebhookNotification } from '../alerts/notifications';
import { AlertParameterConfig, AlertRule, AlertWebhook } from '../alerts/types';
import { runAlertSchedulerCycle } from '../alerts/scheduler';

const router = Router();
const SCHEDULE_TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ALLOWED_INTERVALS = new Set(['5m', '15m', '30m', '1h', '6h', '12h', '24h']);
const ALLOWED_PARAMETERS = new Set<AlertParameterConfig['parameter']>([
  'top_ips',
  'top_locations',
  'top_routes',
  'top_status_codes',
  'top_user_agents',
  'top_routers',
  'top_services',
  'top_hosts',
  'error_rate',
  'response_time',
  'request_count',
  'request_rate',
  'parser_unknown_ratio',
  'parser_error_ratio',
  'top_request_addresses',
  'top_client_ips',
]);

interface ValidationResult<T> {
  ok: boolean;
  error?: string;
  value?: T;
}

function isWebhookType(value: unknown): value is AlertWebhook['type'] {
  return value === 'discord' || value === 'telegram' || value === 'webhook';
}

function isTriggerType(value: unknown): value is AlertRule['trigger_type'] {
  return value === 'interval' || value === 'threshold' || value === 'daily_summary';
}

function isConditionOperator(value: unknown): value is AlertRule['condition_operator'] {
  return value === 'any' || value === 'all';
}

function isScheduleTimeUTC(value: unknown): value is string {
  return typeof value === 'string' && SCHEDULE_TIME_REGEX.test(value);
}

function validateWebhookPayload(payload: unknown): ValidationResult<Omit<AlertWebhook, 'id' | 'created_at' | 'updated_at'>> {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Invalid webhook payload' };
  }

  const parsed = payload as Record<string, unknown>;
  const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
  const type = parsed.type;
  const url = typeof parsed.url === 'string' ? parsed.url.trim() : '';

  if (!name) {
    return { ok: false, error: 'name is required' };
  }

  if (!isWebhookType(type)) {
    return { ok: false, error: 'type must be discord, telegram, or webhook' };
  }

  if (!url) {
    return { ok: false, error: 'url is required' };
  }

  try {
    const parsedURL = new URL(url);
    if (!['http:', 'https:'].includes(parsedURL.protocol)) {
      return { ok: false, error: 'webhook url must use http or https' };
    }
  } catch {
    return { ok: false, error: 'url must be a valid URL' };
  }

  return {
    ok: true,
    value: {
      name,
      type,
      url,
      enabled: parsed.enabled !== false,
      description: typeof parsed.description === 'string' ? parsed.description.trim() : undefined,
    },
  };
}

function normalizeParameters(input: unknown): ValidationResult<AlertParameterConfig[]> {
  if (!Array.isArray(input)) {
    return { ok: true, value: [] };
  }

  const parsedParameters: AlertParameterConfig[] = [];

  for (const entry of input.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))) {
    if (!ALLOWED_PARAMETERS.has(entry.parameter as AlertParameterConfig['parameter'])) {
      return { ok: false, error: `Unsupported alert parameter: ${String(entry.parameter)}` };
    }

    parsedParameters.push({
      parameter: entry.parameter as AlertParameterConfig['parameter'],
      enabled: entry.enabled !== false,
      limit: typeof entry.limit === 'number' ? entry.limit : undefined,
      threshold: typeof entry.threshold === 'number' ? entry.threshold : undefined,
    });
  }

  return { ok: true, value: parsedParameters };
}

function validateRulePayload(payload: unknown): ValidationResult<Omit<AlertRule, 'id' | 'created_at' | 'updated_at' | 'last_triggered_at' | 'last_evaluated_at'>> {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Invalid alert rule payload' };
  }

  const parsed = payload as Record<string, unknown>;
  const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';

  if (!name) {
    return { ok: false, error: 'name is required' };
  }

  if (!isTriggerType(parsed.trigger_type)) {
    return { ok: false, error: 'trigger_type must be interval, threshold, or daily_summary' };
  }

  const webhookIDs = Array.isArray(parsed.webhook_ids)
    ? parsed.webhook_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];

  if (webhookIDs.length === 0) {
    return { ok: false, error: 'At least one webhook must be selected' };
  }

  const normalizedParameters = normalizeParameters(parsed.parameters);
  if (!normalizedParameters.ok || !normalizedParameters.value) {
    return { ok: false, error: normalizedParameters.error };
  }

  const parameters = normalizedParameters.value;
  const enabledParameters = parameters.filter((parameter) => parameter.enabled);
  if (enabledParameters.length === 0) {
    return { ok: false, error: 'At least one parameter must be enabled' };
  }

  if (parsed.trigger_type === 'threshold') {
    const thresholdParameters = enabledParameters.filter((parameter) => typeof parameter.threshold === 'number');
    if (thresholdParameters.length === 0) {
      return { ok: false, error: 'Threshold alerts require at least one threshold parameter' };
    }
  }

  const requestedWindowMinutes =
    typeof parsed.snapshot_window_minutes === 'number' && parsed.snapshot_window_minutes > 0
      ? Math.floor(parsed.snapshot_window_minutes)
      : undefined;

  let snapshotWindowMinutes = requestedWindowMinutes
    ?? (parsed.trigger_type === 'daily_summary' ? 24 * 60 : 5);

  if (parsed.trigger_type === 'daily_summary' && snapshotWindowMinutes < 60) {
    snapshotWindowMinutes = 24 * 60;
  }

  const conditionOperator = isConditionOperator(parsed.condition_operator)
    ? parsed.condition_operator
    : 'any';

  if (parsed.trigger_type === 'interval' && !ALLOWED_INTERVALS.has(String(parsed.interval || ''))) {
    return { ok: false, error: 'interval must be one of 5m, 15m, 30m, 1h, 6h, 12h, or 24h' };
  }

  if (parsed.trigger_type === 'daily_summary') {
    const scheduleTime = parsed.schedule_time_utc ?? DEFAULT_SCHEDULE_TIME;
    if (!isScheduleTimeUTC(scheduleTime)) {
      return { ok: false, error: 'schedule_time_utc must be HH:mm in UTC' };
    }
  }

  const agentID = typeof parsed.agent_id === 'string' && parsed.agent_id.trim().length > 0
    ? parsed.agent_id.trim()
    : undefined;

  if (agentID && !getAgentById(agentID)) {
    return { ok: false, error: `Agent not found: ${agentID}` };
  }

  const existingWebhookIDs = new Set(listAlertWebhooks().map((webhook) => webhook.id));
  const unknownWebhookID = webhookIDs.find((webhookID) => !existingWebhookIDs.has(webhookID));
  if (unknownWebhookID) {
    return { ok: false, error: `Webhook not found: ${unknownWebhookID}` };
  }

  return {
    ok: true,
    value: {
      name,
      description: typeof parsed.description === 'string' ? parsed.description.trim() : undefined,
      enabled: parsed.enabled !== false,
      agent_id: agentID,
      webhook_ids: webhookIDs,
      trigger_type: parsed.trigger_type,
      interval: typeof parsed.interval === 'string' ? parsed.interval as AlertRule['interval'] : undefined,
      schedule_time_utc: isScheduleTimeUTC(parsed.schedule_time_utc)
        ? parsed.schedule_time_utc
        : parsed.trigger_type === 'daily_summary'
          ? DEFAULT_SCHEDULE_TIME
          : undefined,
      snapshot_window_minutes: snapshotWindowMinutes,
      condition_operator: conditionOperator,
      parameters,
    },
  };
}

const DEFAULT_SCHEDULE_TIME = '09:00';

router.use(requireAlertsMutationAuth);

router.get('/webhooks', (_req: Request, res: Response) => {
  res.json(listAlertWebhooks());
});

router.post('/webhooks', (req: Request, res: Response) => {
  const validation = validateWebhookPayload(req.body);
  if (!validation.ok || !validation.value) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const created = createAlertWebhook(validation.value);
  res.status(201).json(created);
});

router.patch('/webhooks', (req: Request, res: Response) => {
  const { id, ...updates } = req.body as { id?: string } & Record<string, unknown>;

  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  const existing = getAlertWebhookByID(id);
  if (!existing) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }

  const merged = {
    ...existing,
    ...updates,
  };

  const validation = validateWebhookPayload(merged);
  if (!validation.ok || !validation.value) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const updated = updateAlertWebhook({
    id,
    updates: validation.value,
  });

  res.json(updated);
});

router.delete('/webhooks', (req: Request, res: Response) => {
  const id = req.query.id as string | undefined;

  if (!id) {
    res.status(400).json({ error: 'id query param is required' });
    return;
  }

  const deleted = deleteAlertWebhook(id);
  if (!deleted) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }

  res.json({ success: true });
});

router.post('/webhooks/test', async (req: Request, res: Response) => {
  const { id } = req.body as { id?: string };

  let webhook: AlertWebhook | null = null;

  if (id) {
    webhook = getAlertWebhookByID(id);
    if (!webhook) {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }
  } else {
    const validation = validateWebhookPayload(req.body);
    if (!validation.ok || !validation.value) {
      res.status(400).json({ error: validation.error });
      return;
    }

    webhook = {
      id: 'test-webhook',
      ...validation.value,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const result = await sendWebhookNotification({
    webhook,
    title: 'Test Notification',
    message: 'This is a test notification from Traefik Log Dashboard alerts API.',
    metadata: {
      source: 'dashboard-alerts-test',
    },
  });

  if (!result.success) {
    res.status(502).json({ success: false, error: result.error });
    return;
  }

  res.json({ success: true });
});

router.get('/rules', (_req: Request, res: Response) => {
  res.json(listAlertRules());
});

router.post('/rules', (req: Request, res: Response) => {
  const validation = validateRulePayload(req.body);
  if (!validation.ok || !validation.value) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const created = createAlertRule(validation.value);
  res.status(201).json(created);
});

router.patch('/rules', (req: Request, res: Response) => {
  const { id, ...updates } = req.body as { id?: string } & Record<string, unknown>;

  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  const existing = getAlertRuleByID(id);
  if (!existing) {
    res.status(404).json({ error: 'Alert rule not found' });
    return;
  }

  const validation = validateRulePayload({
    ...existing,
    ...updates,
    parameters: updates.parameters ?? existing.parameters,
  });

  if (!validation.ok || !validation.value) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const updated = updateAlertRule({
    id,
    updates: {
      ...validation.value,
      parameters: validation.value.parameters,
    },
  });

  res.json(updated);
});

router.delete('/rules', (req: Request, res: Response) => {
  const id = req.query.id as string | undefined;

  if (!id) {
    res.status(400).json({ error: 'id query param is required' });
    return;
  }

  const deleted = deleteAlertRule(id);
  if (!deleted) {
    res.status(404).json({ error: 'Alert rule not found' });
    return;
  }

  res.json({ success: true });
});

router.post('/rules/test', async (req: Request, res: Response) => {
  const { id } = req.body as { id?: string };

  if (!id || typeof id !== 'string') {
    res.status(400).json({ error: 'id is required' });
    return;
  }

  const rule = getAlertRuleByID(id);
  if (!rule) {
    res.status(404).json({ error: 'Alert rule not found' });
    return;
  }

  const webhooks = rule.webhook_ids
    .map((webhookID) => getAlertWebhookByID(webhookID))
    .filter((webhook): webhook is AlertWebhook => Boolean(webhook && webhook.enabled));

  if (webhooks.length === 0) {
    res.status(400).json({ error: 'No enabled webhooks configured for this rule' });
    return;
  }

  const agent = rule.agent_id ? getAgentById(rule.agent_id) : getAllAgents()[0];

  const payload = {
    alert_rule_id: rule.id,
    alert_rule_name: rule.name,
    trigger_type: 'test',
    agent_id: agent?.id,
    agent_name: agent?.name,
    timestamp: new Date().toISOString(),
    metrics: {
      request_count: 120,
      request_rate: 2.5,
      error_rate: 1.2,
      response_time: {
        average: 135,
        p95: 290,
        p99: 490,
      },
    },
  };

  const results = await Promise.allSettled(
    webhooks.map((webhook) => sendWebhookNotification({
      webhook,
      title: `[TEST] ${rule.name}`,
      message: 'Test alert triggered from dashboard API.',
      metadata: payload,
    })),
  );

  const failed = results.filter(
    (result) => result.status === 'fulfilled' && !result.value.success,
  ).length;

  if (failed > 0) {
    res.status(502).json({ success: false, error: `${failed} webhook notifications failed` });
    return;
  }

  res.json({ success: true });
});

router.get('/history', (req: Request, res: Response) => {
  const requestedLimit = Number(req.query.limit ?? 100);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(500, requestedLimit)) : 100;
  res.json(listAlertNotificationHistory(limit));
});

router.get('/stats', (_req: Request, res: Response) => {
  res.json(getAlertNotificationStats());
});

router.post('/run', async (_req: Request, res: Response) => {
  const result = await runAlertSchedulerCycle();
  if (result.errors.length > 0 && result.started && !result.skipped) {
    res.status(500).json({ success: false, ...result });
    return;
  }

  if (result.skipped) {
    res.status(409).json({ success: false, ...result });
    return;
  }

  res.json({ success: true, ...result });
});

export default router;
