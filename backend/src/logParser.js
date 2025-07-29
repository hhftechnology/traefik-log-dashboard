import { Tail } from 'tail';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import { getGeoLocation } from './geoLocation.js';

// A simple queue with a delay to process log lines and avoid API rate limiting.
class StaggeredQueue {
  constructor(processFn, delay = 50) {
    this.queue = [];
    this.processing = false;
    this.processFn = processFn;
    this.delay = delay;
  }

  add(item) {
    this.queue.push(item);
    if (!this.processing) {
      this.processNext();
    }
  }

  async processNext() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const item = this.queue.shift();
    await this.processFn(item);

    // Wait for the delay before processing the next item
    setTimeout(() => this.processNext(), this.delay);
  }
}


export class LogParser extends EventEmitter {
  constructor() {
    super();
    this.logs = [];
    this.maxLogs = 10000;
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
    
    // Initialize the queue to process log lines with a delay of 50ms (~20 req/sec)
    this.lineQueue = new StaggeredQueue(line => this.parseLine(line, true), 50);
  }

  async setLogFile(filePath) {
    if (this.tail) {
      this.tail.unwatch();
    }

    try {
      await fs.access(filePath);
      console.log(`Log file found: ${filePath}. Tailing from the beginning.`);
    } catch (error) {
      console.error(`Log file not found, will watch for its creation: ${filePath}`);
    }

    this.tail = new Tail(filePath, {
      fromBeginning: true, // Read the entire file from the start
      follow: true,
      logger: console
    });

    this.tail.on('line', (line) => {
      // Add each line to the queue instead of processing it immediately
      this.lineQueue.add(line);
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
        clientIP: this.extractIP(log.ClientAddr || ''),
        method: log.RequestMethod || 'GET',
        path: log.RequestPath || '',
        status: parseInt(log.DownstreamStatus || 0),
        responseTime: parseFloat(log.Duration || 0) / 1e6, // Convert nanoseconds to ms
        serviceName: log.ServiceName || 'unknown',
        routerName: log.RouterName || 'unknown',
        host: log.RequestHost || '',
        userAgent: log['request_User-Agent'] || '',
        size: parseInt(log.DownstreamContentSize || 0),
        country: null,
        city: null,
        countryCode: null
      };

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
      // Log errors for non-JSON lines but don't crash
      console.error('Could not parse log line as JSON:', line);
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

    if (log.serviceName && log.serviceName !== 'unknown') {
      this.stats.services[log.serviceName] = (this.stats.services[log.serviceName] || 0) + 1;
    }
    if (log.routerName && log.routerName !== 'unknown') {
      this.stats.routers[log.routerName] = (this.stats.routers[log.routerName] || 0) + 1;
    }
    this.stats.methods[log.method] = (this.stats.methods[log.method] || 0) + 1;
    
    if (log.clientIP && log.clientIP !== 'unknown') {
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
