import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { LogParser } from './logParser.js';
import { setupWebSocket } from './websocket.js';
import { getGeoCacheStats } from './geoLocation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());

// Initialize log parser
const logParser = new LogParser();

// Setup WebSocket
setupWebSocket(wss, logParser);

// API Routes
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await logParser.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/logs', async (req, res) => {
  try {
    const { page = 1, limit = 100, service, status, router, hideUnknown, hidePrivateIPs } = req.query;
    const logs = await logParser.getLogs({
      page: parseInt(page),
      limit: parseInt(limit),
      filters: { 
        service, 
        status, 
        router,
        hideUnknown: hideUnknown === 'true',
        hidePrivateIPs: hidePrivateIPs === 'true'
      }
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/services', async (req, res) => {
  try {
    const services = await logParser.getServices();
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/routers', async (req, res) => {
  try {
    const routers = await logParser.getRouters();
    res.json(routers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/geo-stats', async (req, res) => {
  try {
    const geoStats = await logParser.getGeoStats();
    res.json(geoStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/geo-processing-status', async (req, res) => {
  try {
    const stats = await logParser.getStats();
    const cacheStats = getGeoCacheStats();
    
    res.json({
      geoProcessingRemaining: stats.geoProcessingRemaining || 0,
      cachedLocations: cacheStats.keys,
      cacheStats: cacheStats.stats,
      retryQueueLength: cacheStats.retryQueueLength || 0,
      totalCountries: Object.keys(stats.countries).length,
      isProcessing: logParser.isProcessingGeo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/set-log-file', async (req, res) => {
  try {
    const { filePath } = req.body;
    await logParser.setLogFile(filePath);
    res.json({ success: true, message: 'Log file set successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/set-log-files', async (req, res) => {
  try {
    const { filePaths } = req.body;
    await logParser.setLogFiles(filePaths);
    res.json({ success: true, message: 'Log files set successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start watching log file if provided via environment variable
  const logFile = process.env.TRAEFIK_LOG_FILE || '/logs/traefik.log';
  
  // Check if multiple log files are specified (comma-separated)
  if (logFile.includes(',')) {
    const logFiles = logFile.split(',').map(f => f.trim());
    logParser.setLogFiles(logFiles).catch(console.error);
  } else {
    logParser.setLogFile(logFile).catch(console.error);
  }
});