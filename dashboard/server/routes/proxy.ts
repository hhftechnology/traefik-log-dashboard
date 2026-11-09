import { NextFunction, Request, Response, Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { getAgentById } from '../db';
import { isAllowedProxyTarget, normalizeProxyTarget } from '../proxy-allowlist';

export { normalizeProxyTarget };

const router = Router();

interface ProxyAgentContext {
  id: string;
  target: string;
  token: string;
}

type ProxyRequest = Request & {
  proxyAgent?: ProxyAgentContext;
};

export function getAgentIDFromRequest(req: Request): string {
  const raw = req.header('x-agent-id');
  if (!raw) {
    return '';
  }
  return raw.trim();
}

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

  const target = normalizeProxyTarget(agent.configured_url || agent.url);
  if (!isAllowedProxyTarget(target)) {
    res.status(403).json({
      error: 'Proxy target is not allowed',
      message: 'The agent URL is not in DASHBOARD_PROXY_ALLOWLIST.',
    });
    return;
  }

  req.proxyAgent = {
    id: agent.id,
    target,
    token: agent.token || '',
  };

  next();
}

// Proxy /api/logs/* and /api/system/* to the requested agent.
// /api/location/* is handled locally by dashboard/server/routes/location.ts
const proxyPaths = ['/api/logs', '/api/system'];

for (const basePath of proxyPaths) {
  router.use(
    basePath,
    resolveProxyAgent,
    createProxyMiddleware({
      router: (req) => {
        const target = (req as ProxyRequest).proxyAgent?.target;
        if (!target || !isAllowedProxyTarget(target)) {
          throw new Error('Proxy target is not allowed');
        }
        return target;
      },
      changeOrigin: true,
      on: {
        proxyReq: (proxyReq, req) => {
          // Express strips the mount prefix from req.url when using
          // router.use(basePath, ...). Restore the full path so the
          // agent receives the correct URL (e.g. /api/logs/access
          // instead of just /access).
          const originalUrl = (req as ProxyRequest).originalUrl;
          if (originalUrl) {
            proxyReq.path = originalUrl;
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
          console.error(`Proxy error: ${err.message}`);
          if (res && 'writeHead' in res) {
            (res as Response).status(502).json({
              error: 'Agent unreachable',
              agentId: agentID,
              message: err.message,
            });
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
