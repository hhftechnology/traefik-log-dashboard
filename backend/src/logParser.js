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
      throw new Error(`Log file not found: ${filePath}`);
    }

    this.tail = new Tail(filePath, {
      fromBeginning: true, // Read from the beginning to get all logs
      follow: true,
      logger: console
    });

    this.tail.on('line', async (line) => {
      await this.parseLine(line);
    });

    this.tail.on('error', (error) => {
      console.error('Tail error:', error);
      this.emit('error', error);
    });
  }

  async parseLine(line, emit = true) {
    try {
      const log = JSON.parse(line);
      
      const parsedLog = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: log.time || new Date().toISOString(),
        clientIP: this.extractIP(log.ClientAddr || log.request_ClientAddr || ''),
        method: log.RequestMethod || log.request_method || 'GET',
        path: log.RequestPath || log.request_path || '',
        status: parseInt(log.DownstreamStatus || log.downstream_status || 0),
        responseTime: parseFloat(log.Duration || log.duration || 0) * 1000,
        serviceName: log.ServiceName || log.service_name || 'unknown',
        routerName: log.RouterName || log.router_name || 'unknown',
        host: log.RequestHost || log.request_host || '',
        userAgent: log['request_User-Agent'] || log.user_agent || '',
        size: parseInt(log.DownstreamContentSize || log.downstream_content_size || 0),
        country: null,
        city: null
      };

      if (parsedLog.clientIP) {
        const geoData = await getGeoLocation(parsedLog.clientIP);
        if (geoData) {
          parsedLog.country = geoData.country;
          parsedLog.city = geoData.city;
          parsedLog.countryCode = geoData.countryCode;
          parsedLog.lat = geoData.lat;
          parsedLog.lon = geoData.lon;
        }
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
      // It's possible that some lines in the log are not valid JSON.
      // We'll log the error but continue processing.
      console.error('Error parsing log line:', error, line);
    }
  }

  extractIP(clientAddr) {
    const match = clientAddr.match(/^(\d+\.\d+\.\d+\.\d+):\d+$/);
    return match ? match[1] : clientAddr;
  }

  updateStats(log) {
    this.stats.totalRequests++;

    const statusGroup = Math.floor(log.status / 100) * 100;
    this.stats.statusCodes[log.status] = (this.stats.statusCodes[log.status] || 0) + 1;

    if (statusGroup === 200) this.stats.requests2xx++;
    else if (statusGroup === 400) this.stats.requests4xx++;
    else if (statusGroup === 500) this.stats.requests5xx++;

    this.stats.services[log.serviceName] = (this.stats.services[log.serviceName] || 0) + 1;
    this.stats.routers[log.routerName] = (this.stats.routers[log.routerName] || 0) + 1;
    this.stats.methods[log.method] = (this.stats.methods[log.method] || 0) + 1;
    this.stats.topIPs[log.clientIP] = (this.stats.topIPs[log.clientIP] || 0) + 1;

    if (log.country) {
      this.stats.countries[log.country] = (this.stats.countries[log.country] || 0) + 1;
    }

    const totalResponseTime = this.logs.reduce((acc, l) => acc + l.responseTime, 0);
    this.stats.avgResponseTime = this.logs.length > 0 ? totalResponseTime / this.logs.length : 0;

    const now = Date.now();
    if (now - this.lastTimestamp >= 1000) {
      this.stats.requestsPerSecond = this.requestsInLastSecond;
      this.requestsInLastSecond = 1;
      this.lastTimestamp = now;
    } else {
      this.requestsInLastSecond++;
    }
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
