"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const db_1 = require("./db");
const config_1 = require("./config");
const agents_1 = __importDefault(require("./routes/agents"));
const alerts_1 = __importDefault(require("./routes/alerts"));
const location_1 = __importDefault(require("./routes/location"));
const proxy_1 = __importDefault(require("./routes/proxy"));
const mobile_1 = __importStar(require("./routes/mobile"));
const repository_1 = require("./alerts/repository");
const scheduler_1 = require("./alerts/scheduler");
const health_1 = require("./health");
const app = (0, express_1.default)();
const PORT = parseInt(process.env.DASHBOARD_PORT || process.env.PORT || '3000', 10);
const DIST_DIR = path_1.default.resolve(__dirname, '../dist');
const DATA_DIR = process.env.DATA_DIR || '/data';
// Ensure data directory exists for SQLite
if (!fs_1.default.existsSync(DATA_DIR)) {
    fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
}
// Initialize DB and sync env agents
(0, db_1.getDB)();
(0, db_1.syncEnvAgents)();
(0, repository_1.initAlertingSchema)();
console.log('[server] Database initialized, env agents synced');
const runtimeConfigJSON = JSON.stringify(config_1.runtimeConfig);
// --- Middleware ---
app.use(express_1.default.json());
app.get('/health', health_1.health);
// --- API Routes (before static files) ---
// Dashboard agent management API
app.use('/api/dashboard/agents', agents_1.default);
app.use('/api/dashboard/alerts', alerts_1.default);
// Runtime config endpoint
app.get('/api/dashboard-config', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json(config_1.runtimeConfig);
});
app.get('/api/dashboard-config.json', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json(config_1.runtimeConfig);
});
// Local GeoIP lookup endpoints
app.use('/api/location', location_1.default);
// Mobile API (read-only, API key auth)
app.use('/api/mobile', mobile_1.default);
app.use('/api/mobile/location', mobile_1.requireMobileApiKey, location_1.default);
// Agent API proxy (logs and system)
app.use(proxy_1.default);
// --- Static files ---
// Generate runtime-config.js for the SPA
app.get('/runtime-config.js', (_req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(`window.__DASHBOARD_CONFIG__ = ${runtimeConfigJSON};`);
});
// Serve static build assets with immutable caching
app.use('/assets', express_1.default.static(path_1.default.join(DIST_DIR, 'assets'), {
    maxAge: '1y',
    immutable: true,
}));
// Serve other static files
app.use(express_1.default.static(DIST_DIR, {
    index: false, // We handle index.html via SPA fallback
}));
// --- SPA Fallback ---
app.get('*', (_req, res) => {
    const indexPath = path_1.default.join(DIST_DIR, 'index.html');
    if (fs_1.default.existsSync(indexPath)) {
        res.sendFile(indexPath);
    }
    else {
        res.status(404).send('Dashboard not built. Run npm run build first.');
    }
});
// --- Start ---
app.listen(PORT, '0.0.0.0', () => {
    (0, scheduler_1.startAlertScheduler)();
    console.log(`[server] Dashboard server running on port ${PORT}`);
    console.log(`[server] Serving static files from ${DIST_DIR}`);
    console.log(`[server] Data directory: ${DATA_DIR}`);
});
