import crypto from 'crypto';
import { NextFunction, Request, Response, Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { DBAgent, getAllAgents, getAgentById, getSelectedAgent, serializeAgent } from '../db';
import {
  getAlertNotificationStats,
  listAlertNotificationHistory,
  listAlertRules,
  listAlertWebhooks,
} from '../alerts/repository';
import { runtimeConfig } from '../config';
import { getAgentIDFromRequest, normalizeProxyTarget } from './proxy';
import { resolveLocationsBatch, normalizeIPAddress, GEOIP_CACHE_MAX_ENTRIES } from './location';

const router = Router();

// --- Auth middleware ---

export function requireMobileApiKey(req: Request, res: Response, next: NextFunction): void {
  // Mobile app uses browser-style `fetch()` to a user-provided absolute URL.
  // Those requests commonly trigger CORS preflight `OPTIONS`, so we must
  // respond with CORS headers even before validating the API key.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-API-Key, Authorization, X-Agent-Id',
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method?.toUpperCase() === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const configuredKey = process.env.MOBILE_API_KEY;
  if (!configuredKey) {
    res.status(503).json({
      error: 'Mobile API disabled',
      message: 'MOBILE_API_KEY environment variable is not configured',
    });
    return;
  }

  const headerKey =
    req.header('x-api-key') ||
    req.header('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';

  if (!headerKey) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing API key. Provide via X-API-Key header or Authorization: Bearer header.',
    });
    return;
  }

  const keyBuffer = Buffer.from(headerKey);
  const configuredBuffer = Buffer.from(configuredKey);
  const maxLen = Math.max(keyBuffer.length, configuredBuffer.length, 1);
  const paddedKey = Buffer.alloc(maxLen);
  const paddedConfigured = Buffer.alloc(maxLen);
  keyBuffer.copy(paddedKey);
  configuredBuffer.copy(paddedConfigured);

  if (!crypto.timingSafeEqual(paddedKey, paddedConfigured) || keyBuffer.length !== configuredBuffer.length) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
    return;
  }

  next();
}

router.use(requireMobileApiKey);

// --- Helpers ---

function extractClientIp(log: Record<string, unknown>): string {
  return (typeof log.ClientHost === 'string' && log.ClientHost) ||
    (typeof log.ClientAddr === 'string' && log.ClientAddr) ||
    '';
}

function serializeAgentForMobile(row: DBAgent) {
  return serializeAgent(row);
}

// --- Dashboard-local endpoints ---

// List all agents (tokens stripped)
router.get('/agents', (_req, res) => {
  try {
    const agents = getAllAgents().map(serializeAgentForMobile);
    res.json(agents);
  } catch (err) {
    console.error('[mobile] Error listing agents:', err);
    res.status(500).json({ error: 'Internal error', message: 'Failed to list agents' });
  }
});

// Single agent detail (token stripped)
router.get('/agents/:id', (req, res) => {
  try {
    const agent = getAgentById(req.params.id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found', message: `Agent ${req.params.id} does not exist` });
      return;
    }
    res.json(serializeAgentForMobile(agent));
  } catch (err) {
    console.error('[mobile] Error getting agent:', err);
    res.status(500).json({ error: 'Internal error', message: 'Failed to get agent' });
  }
});

// Alert rules
router.get('/alerts/rules', (_req, res) => {
  try {
    res.json(listAlertRules());
  } catch (err) {
    console.error('[mobile] Error listing alert rules:', err);
    res.status(500).json({ error: 'Internal error', message: 'Failed to list alert rules' });
  }
});

// Alert webhooks
router.get('/alerts/webhooks', (_req, res) => {
  try {
    res.json(listAlertWebhooks());
  } catch (err) {
    console.error('[mobile] Error listing webhooks:', err);
    res.status(500).json({ error: 'Internal error', message: 'Failed to list webhooks' });
  }
});

// Notification history (paginated)
router.get('/alerts/history', (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit), 10) || 50, 1), 500);
    res.json(listAlertNotificationHistory(limit));
  } catch (err) {
    console.error('[mobile] Error listing notification history:', err);
    res.status(500).json({ error: 'Internal error', message: 'Failed to list notification history' });
  }
});

// Alert stats
router.get('/alerts/stats', (_req, res) => {
  try {
    res.json(getAlertNotificationStats());
  } catch (err) {
    console.error('[mobile] Error getting alert stats:', err);
    res.status(500).json({ error: 'Internal error', message: 'Failed to get alert stats' });
  }
});

// Runtime dashboard config
router.get('/config', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json(runtimeConfig);
});

// Aggregated overview for mobile home screen
router.get('/overview', (_req, res) => {
  try {
    const agents = getAllAgents();
    const selectedAgent = getSelectedAgent();
    const rules = listAlertRules();
    const stats = getAlertNotificationStats();

    const onlineCount = agents.filter((a) => a.status === 'online').length;
    const offlineCount = agents.filter((a) => a.status === 'offline').length;

    res.json({
      agent: selectedAgent
        ? {
            id: selectedAgent.id,
            name: selectedAgent.name,
            status: selectedAgent.status,
            lastSeen: selectedAgent.last_seen ?? undefined,
          }
        : null,
      agents_summary: {
        total: agents.length,
        online: onlineCount,
        offline: offlineCount,
      },
      alerts_summary: {
        total_rules: rules.length,
        enabled_rules: rules.filter((r) => r.enabled).length,
        recent_notifications_24h: stats.last24h,
        failed_notifications_24h: stats.failed,
      },
    });
  } catch (err) {
    console.error('[mobile] Error building overview:', err);
    res.status(500).json({ error: 'Internal error', message: 'Failed to build overview' });
  }
});

// --- Agent-proxied endpoints ---

interface ProxyAgentContext {
  id: string;
  target: string;
  token: string;
}

type ProxyRequest = Request & {
  proxyAgent?: ProxyAgentContext;
};

interface CachedGeoResponse {
  stats: Array<{ country: string; count: number; percentage: number }>;
  locations: Array<{ ip: string; country: string; city?: string; latitude?: number; longitude?: number; count: number }>;
  hasGeoData: boolean;
  resolverStatus: string;
  cacheStats: { size: number; maxEntries: number };
}

const MOBILE_GEO_CACHE_TTL_MS = 20_000;
const MOBILE_GEO_CACHE_MAX_SIZE = 500;
const mobileGeoCache = new Map<string, { expiresAt: number; value: CachedGeoResponse }>();

function cleanupGeoCache(): void {
  const now = Date.now();
  for (const [key, entry] of mobileGeoCache) {
    if (entry.expiresAt <= now) {
      mobileGeoCache.delete(key);
    }
  }
}

function geoCacheSet(key: string, value: CachedGeoResponse): void {
  // Refresh insertion order on update
  mobileGeoCache.delete(key);
  mobileGeoCache.set(key, { expiresAt: Date.now() + MOBILE_GEO_CACHE_TTL_MS, value });
  // Evict oldest (first inserted) entries when over max size
  while (mobileGeoCache.size > MOBILE_GEO_CACHE_MAX_SIZE) {
    const oldest = mobileGeoCache.keys().next().value;
    if (oldest !== undefined) mobileGeoCache.delete(oldest);
    else break;
  }
}

setInterval(cleanupGeoCache, 60_000);

function resolveProxyAgent(req: ProxyRequest, res: Response, next: NextFunction): void {
  const agentID = getAgentIDFromRequest(req);
  if (!agentID) {
    res.status(400).json({
      error: 'Missing agent id',
      message: 'X-Agent-Id header is required',
    });
    return;
  }

  const agent = getAgentById(agentID);
  if (!agent) {
    res.status(404).json({
      error: 'Agent not found',
      message: `Agent ${agentID} does not exist`,
    });
    return;
  }

  req.proxyAgent = {
    id: agent.id,
    target: normalizeProxyTarget(agent.configured_url || agent.url),
    token: agent.token || '',
  };

  next();
}

// Mobile Geo aggregation endpoint
router.get('/agents/:id/geo', async (req, res) => {
  try {
    cleanupGeoCache();
    const agentId = String(req.params.id);
    const now = Date.now();
    const cached = mobileGeoCache.get(agentId);
    if (cached && cached.expiresAt > now) {
      res.json(cached.value);
      return;
    }

    const agent = getAgentById(agentId);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found', message: `Agent ${agentId} does not exist` });
      return;
    }
    const target = normalizeProxyTarget(agent.configured_url || agent.url);
    const token = agent.token || '';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    let logRes: globalThis.Response;
    try {
      logRes = await fetch(`${target}/api/logs/access?lines=1000`, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        res.status(504).json({ error: 'Agent timeout', message: 'Agent did not respond within 10 seconds' });
        return;
      }
      throw err;
    }

    if (!logRes.ok) {
      res.status(logRes.status).json({ error: 'Failed to fetch logs', message: `HTTP ${logRes.status}` });
      return;
    }

    const logsData = (await logRes.json()) as { logs: Array<Record<string, unknown>> };
    const logs = logsData.logs || [];

    const ipsToLookup: string[] = [];
    for (const log of logs) {
      const rawIp = extractClientIp(log);
      if (rawIp) ipsToLookup.push(rawIp);
    }

    const locations = await resolveLocationsBatch(ipsToLookup);
    const locationMap = new Map(locations.map(loc => [loc.ipAddress, loc]));

    const countryMap = new Map<string, number>();
    const ipAggMap = new Map<string, { ip: string; country: string; city?: string; latitude?: number; longitude?: number; count: number }>();

    for (const log of logs) {
      const rawIp = extractClientIp(log);
      const normalizedIP = normalizeIPAddress(rawIp);

      let country = 'Unknown';
      let loc: ReturnType<typeof locationMap.get> | undefined;

      if (normalizedIP) {
        loc = locationMap.get(normalizedIP);
        if (loc?.country && loc.country !== 'Private') {
          country = loc.country;
        }
      }

      countryMap.set(country, (countryMap.get(country) || 0) + 1);

      if (normalizedIP) {
        const existing = ipAggMap.get(normalizedIP);
        if (existing) {
          existing.count++;
        } else {
          ipAggMap.set(normalizedIP, {
            ip: normalizedIP,
            country,
            city: loc?.city,
            latitude: loc?.latitude,
            longitude: loc?.longitude,
            count: 1,
          });
        }
      }
    }

    const ipLocations = [...ipAggMap.values()]
      .filter((l) => l.country !== 'Unknown')
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    const total = logs.length || 1;
    const stats = [...countryMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([country, count]) => ({
        country,
        count,
        percentage: Math.round((count / total) * 1000) / 10,
      }));

    const payload: CachedGeoResponse = {
      stats,
      locations: ipLocations,
      hasGeoData: stats.some((s) => s.country !== 'Unknown'),
      resolverStatus: 'Processed by Dashboard API',
      cacheStats: { size: locations.length, maxEntries: GEOIP_CACHE_MAX_ENTRIES },
    };

    geoCacheSet(agentId, payload);
    res.json(payload);
  } catch (err) {
    console.error('[mobile] Error aggregating geo data:', err);
    res.status(500).json({ error: 'Internal error', message: 'Failed to aggregate geo data' });
  }
});

// Proxy /api/mobile/logs/* -> agent /api/logs/*
// Proxy /api/mobile/system/* -> agent /api/system/*
const proxyPaths = ['/logs', '/system'];

for (const basePath of proxyPaths) {
  router.use(
    basePath,
    resolveProxyAgent,
    createProxyMiddleware({
      router: (req) => {
        const target = (req as ProxyRequest).proxyAgent?.target;
        if (!target) {
          console.warn('[mobile] Proxy router: proxyAgent.target missing, using fallback. This should not happen if resolveProxyAgent runs first.');
          return 'http://localhost:5000';
        }
        return target;
      },
      changeOrigin: true,
      on: {
        proxyReq: (proxyReq, req) => {
          // Rewrite path: /api/mobile/logs/access -> /api/logs/access
          const originalUrl = (req as ProxyRequest).originalUrl;
          if (originalUrl) {
            proxyReq.path = originalUrl.replace('/api/mobile/', '/api/');
          }

          const token = (req as ProxyRequest).proxyAgent?.token || '';
          if (token) {
            proxyReq.setHeader('Authorization', `Bearer ${token}`);
          } else {
            proxyReq.removeHeader('Authorization');
          }
        },
        error: (err, req, res) => {
          const agentID = (req as ProxyRequest).proxyAgent?.id || 'unknown';
          const payload = { error: 'Agent unreachable', agentId: agentID, message: err.message };
          console.error(`[mobile] Proxy error: ${err.message}`);
          if (res && typeof (res as any).json === 'function' && typeof (res as any).status === 'function') {
            (res as Response).status(502).json(payload);
          } else if (res && typeof (res as any).writeHead === 'function') {
            (res as import('http').ServerResponse).writeHead(502, { 'Content-Type': 'application/json' });
            (res as import('http').ServerResponse).end(JSON.stringify(payload));
          }
        },
      },
      // SSE/streaming support
      timeout: 3600000,
      proxyTimeout: 3600000,
    }),
  );
}

export default router;
