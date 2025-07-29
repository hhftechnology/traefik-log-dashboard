import { Tail } from 'tail';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import { getGeoLocation } from './geoLocation.js';

export class LogParser extends EventEmitter {
  constructor() {
    super();
    this.logs = [];
    this.maxLogs = 10000; // Keep last 10k logs in memory
    this.tail = null;
    this.stats = {
      totalRequests: 0,
      statusCodes: {},
      services: {},
      routers: {},
      methods: {},
      avgResponseTime: 0,
      requests5xx: 0,
      requests4xx: 0,
      requests2xx: 0,
      requestsPerSecond: 0,
      topIPs: {},
      countries: {}
    };
    this.lastTimestamp = Date.now();
    this.requestsInLastSecond = 0;
  }

  async setLogFile(filePath) {
    if (this.tail) {
      this.tail.unwatch();
    }

    try {
      await fs.access(filePath);
    } catch (error) {
      console.error(`Log file not found, will watch for its creation: ${filePath}`);
    }

    // Process recent history first to populate the dashboard without hitting rate limits
    await this.processExistingFile(filePath);

    // Now, tail the file for new lines
    this.tail = new Tail(filePath, {
      fromBeginning: false,
      follow: true,
      logger: console
    });

    this.tail.on('line', async (line) => {
      await this.parseLine(line, true);
    });

    this.tail.on('error', (error) => {
      console.error('Tail error:', error);
      this.emit('error', error);
    });
  }

  async processExistingFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      const recentLines = lines.slice(-1000);
      console.log(`Processing ${recentLines.length} recent log entries...`);

      for (const line of recentLines) {
        await this.parseLine(line, false); // Don't emit 'newLog' for each historical entry
        // Stagger the API calls to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50)); // ~20 req/sec
      }
      console.log('Finished processing recent log entries.');
    } catch (error) {
      if (error.code !== 'ENOENT') { // Ignore "file not found" as it might be created later
        console.error('Error processing existing log file:', error);
      }
    }
  }

  async parseLine(line, emit = true) {
    try {
      const log = JSON.parse(line);
      
      const parsedLog = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: log.time || new Date().toISOString(),
        clientIP: this.extractIP(log.ClientAddr || ''),
        method: log.RequestMethod || 'GET',
        path: log.RequestPath || '',
        status: parseInt(log.DownstreamStatus || 0),
        responseTime: parseFloat(log.Duration || 0), // Duration is in nanoseconds
        serviceName: log.ServiceName || 'unknown',
        routerName: log.RouterName || 'unknown',
        host: log.RequestHost || '',
        userAgent: log['request_User-Agent'] || '',
        size: parseInt(log.DownstreamContentSize || 0),
      };

      // Convert responseTime from nanoseconds to milliseconds
      parsedLog.responseTime = parsedLog.responseTime / 1e6;

      const geoData = await getGeoLocation(parsedLog.clientIP);
      if (geoData) {
        parsedLog.country = geoData.country;
        parsedLog.city = geoData.city;
        parsedLog.countryCode = geoData.countryCode;
      }

      this.updateStats(parsedLog);

      this.logs.unshift(parsedLog);
      if (this.logs.length > this.maxLogs) {
        this.logs.pop();
      }

      if (emit) {
        this.emit('newLog', parsedLog);
      }

    } catch (error) {
      console.error('Error parsing log line:', line, error);
    }
  }

  extractIP(clientAddr) {
    if (!clientAddr) return 'unknown';
    return clientAddr.split(':')[0];
  }

  updateStats(log) {
    this.stats.totalRequests++;

    const statusGroup = Math.floor(log.status / 100);
    this.stats.statusCodes[log.status] = (this.stats.statusCodes[log.status] || 0) + 1;

    if (statusGroup === 2) this.stats.requests2xx++;
    else if (statusGroup === 4) this.stats.requests4xx++;
    else if (statusGroup === 5) this.stats.requests5xx++;

    if (log.serviceName !== 'unknown') {
      this.stats.services[log.serviceName] = (this.stats.services[log.serviceName] || 0) + 1;
    }
    if (log.routerName !== 'unknown') {
      this.stats.routers[log.routerName] = (this.stats.routers[log.routerName] || 0) + 1;
    }
    this.stats.methods[log.method] = (this.stats.methods[log.method] || 0) + 1;
    
    if (log.clientIP !== 'unknown') {
        this.stats.topIPs[log.clientIP] = (this.stats.topIPs[log.clientIP] || 0) + 1;
    }

    if (log.country) {
      this.stats.countries[log.country] = (this.stats.countries[log.country] || 0) + 1;
    }

    const totalResponseTime = this.logs.reduce((acc, l) => acc + l.responseTime, 0) + log.responseTime;
    this.stats.avgResponseTime = totalResponseTime / (this.logs.length + 1);

    const now = Date.now();
    if (now - this.lastTimestamp >= 1000) {
      this.stats.requestsPerSecond = this.requestsInLastSecond;
      this.requestsInLastSecond = 0;
      this.lastTimestamp = now;
    }
    this.requestsInLastSecond++;
  }

  async getStats() {
    const topIPs = Object.entries(this.stats.topIPs)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));

    const topCountries = Object.entries(this.stats.countries)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([country, count]) => ({ country, count }));

    return {
      ...this.stats,
      topIPs,
      topCountries,
      avgResponseTime: Math.round(this.stats.avgResponseTime * 100) / 100
    };
  }

  async getLogs({ page = 1, limit = 50, filters = {} }) {
    let filteredLogs = [...this.logs];

    if (filters.service) {
      filteredLogs = filteredLogs.filter(log => log.serviceName === filters.service);
    }
    if (filters.status) {
      filteredLogs = filteredLogs.filter(log => log.status === parseInt(filters.status));
    }
    if (filters.router) {
      filteredLogs = filteredLogs.filter(log => log.routerName === filters.router);
    }

    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedLogs = filteredLogs.slice(start, end);

    return {
      logs: paginatedLogs,
      total: filteredLogs.length,
      page,
      totalPages: Math.ceil(filteredLogs.length / limit)
    };
  }

  async getServices() {
    return Object.keys(this.stats.services).sort();
  }

  async getRouters() {
    return Object.keys(this.stats.routers).sort();
  }

  async getGeoStats() {
    const countries = Object.entries(this.stats.countries)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);

    return { countries };
  }
}
