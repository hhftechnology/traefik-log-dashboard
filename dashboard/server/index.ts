import express from 'express';
import path from 'path';
import fs from 'fs';
import { getDB, syncEnvAgents } from './db';
import { runtimeConfig } from './config';
import agentRoutes from './routes/agents';
import alertRoutes from './routes/alerts';
import locationRoutes from './routes/location';
import proxyRoutes from './routes/proxy';
import mobileRoutes, { requireMobileApiKey } from './routes/mobile';
import { initAlertingSchema } from './alerts/repository';
import { startAlertScheduler } from './alerts/scheduler';

const app = express();
const PORT = parseInt(process.env.DASHBOARD_PORT || process.env.PORT || '3000', 10);
const DIST_DIR = path.resolve(__dirname, '../dist');
const DATA_DIR = process.env.DATA_DIR || '/data';

// Ensure data directory exists for SQLite
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize DB and sync env agents
getDB();
syncEnvAgents();
initAlertingSchema();
console.log('[server] Database initialized, env agents synced');

const runtimeConfigJSON = JSON.stringify(runtimeConfig);

// --- Middleware ---

app.use(express.json());

// --- API Routes (before static files) ---

// Dashboard agent management API
app.use('/api/dashboard/agents', agentRoutes);
app.use('/api/dashboard/alerts', alertRoutes);

// Runtime config endpoint
app.get('/api/dashboard-config', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json(runtimeConfig);
});

app.get('/api/dashboard-config.json', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json(runtimeConfig);
});

// Local GeoIP lookup endpoints
app.use('/api/location', locationRoutes);

// Mobile API (read-only, API key auth)
app.use('/api/mobile', mobileRoutes);
app.use('/api/mobile/location', requireMobileApiKey, locationRoutes);

// Agent API proxy (logs and system)
app.use(proxyRoutes);

// --- Static files ---

// Generate runtime-config.js for the SPA
app.get('/runtime-config.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.send(`window.__DASHBOARD_CONFIG__ = ${runtimeConfigJSON};`);
});

// Serve static build assets with immutable caching
app.use('/assets', express.static(path.join(DIST_DIR, 'assets'), {
  maxAge: '1y',
  immutable: true,
}));

// Serve other static files
app.use(express.static(DIST_DIR, {
  index: false, // We handle index.html via SPA fallback
}));

// --- SPA Fallback ---

app.get('*', (_req, res) => {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Dashboard not built. Run npm run build first.');
  }
});

// --- Start ---

app.listen(PORT, '0.0.0.0', () => {
  startAlertScheduler();
  console.log(`[server] Dashboard server running on port ${PORT}`);
  console.log(`[server] Serving static files from ${DIST_DIR}`);
  console.log(`[server] Data directory: ${DATA_DIR}`);
});
