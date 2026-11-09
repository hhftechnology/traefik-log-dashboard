"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeProxyTarget = void 0;
exports.getAgentIDFromRequest = getAgentIDFromRequest;
const express_1 = require("express");
const http_proxy_middleware_1 = require("http-proxy-middleware");
const db_1 = require("../db");
const proxy_allowlist_1 = require("../proxy-allowlist");
Object.defineProperty(exports, "normalizeProxyTarget", { enumerable: true, get: function () { return proxy_allowlist_1.normalizeProxyTarget; } });
const router = (0, express_1.Router)();
function getAgentIDFromRequest(req) {
    const raw = req.header('x-agent-id');
    if (!raw) {
        return '';
    }
    return raw.trim();
}
function resolveProxyAgent(req, res, next) {
    const agentID = getAgentIDFromRequest(req);
    if (!agentID) {
        res.status(400).json({
            error: 'Missing agent id',
            message: 'X-Agent-Id header is required',
        });
        return;
    }
    const agent = (0, db_1.getAgentById)(agentID);
    if (!agent) {
        res.status(404).json({
            error: 'Agent not found',
            message: `Agent ${agentID} does not exist`,
        });
        return;
    }
    const target = (0, proxy_allowlist_1.normalizeProxyTarget)(agent.configured_url || agent.url);
    if (!(0, proxy_allowlist_1.isAllowedProxyTarget)(target)) {
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
    router.use(basePath, resolveProxyAgent, (0, http_proxy_middleware_1.createProxyMiddleware)({
        router: (req) => {
            const target = req.proxyAgent?.target;
            if (!target || !(0, proxy_allowlist_1.isAllowedProxyTarget)(target)) {
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
                const originalUrl = req.originalUrl;
                if (originalUrl) {
                    proxyReq.path = originalUrl;
                }
                const token = req.proxyAgent?.token || '';
                if (token) {
                    proxyReq.setHeader('Authorization', `Bearer ${token}`);
                }
                else {
                    proxyReq.removeHeader('Authorization');
                }
            },
            error: (err, req, res) => {
                const agentID = req.proxyAgent?.id || 'unknown';
                console.error(`Proxy error: ${err.message}`);
                if (res && 'writeHead' in res) {
                    res.status(502).json({
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
    }));
}
exports.default = router;
