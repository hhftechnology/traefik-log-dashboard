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
    // Stop existing tail if any
    if (this.tail) {
      this.tail.unwatch();
    }

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      throw new Error(`Log file not found: ${filePath}`);
    }

    // Start tailing the file
    this.tail = new Tail(filePath, {
      fromBeginning: false,
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

    // Process existing file content
    await this.processExistingFile(filePath);
  }

  async processExistingFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      // Process last 1000 lines for initial data
      const lastLines = lines.slice(-1000);
      for (const line of lastLines) {
        await this.parseLine(line, false); // Don't emit events for initial load
      }
    } catch (error) {
      console.error('Error processing existing file:', error);
    }
  }

  async parseLine(line, emit = true) {
    try {
      const log = JSON.parse(line);
      
      // Extract relevant fields
      const parsedLog = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: log.time || new Date().toISOString(),
        clientIP: this.extractIP(log.ClientAddr || log.request_ClientAddr || ''),
        method: log.RequestMethod || log.request_method || 'GET',
        path: log.RequestPath || log.request_path || '',
        status: parseInt(log.DownstreamStatus || log.downstream_status || 0),
        responseTime: parseFloat(log.Duration || log.duration || 0) * 1000, // Convert to ms
        serviceName: log.ServiceName || log.service_name || 'unknown',
        routerName: log.RouterName || log.router_name || 'unknown',
        host: log.RequestHost || log.request_host || '',
        userAgent: log['request_User-Agent'] || log.user_agent || '',
        size: parseInt(log.DownstreamContentSize || log.downstream_content_size || 0),
        country: null,
        city: null
      };

      // Get geolocation (with caching)
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

      // Update stats
      this.updateStats(parsedLog);

      // Add to logs array
      this.logs.unshift(parsedLog);
      if (this.logs.length > this.maxLogs) {
        this.logs.pop();
      }

      // Emit event for real-time updates
      if (emit) {
        this.emit('newLog', parsedLog);
      }

    } catch (error) {
      console.error('Error parsing log line:', error, line);
    }
  }

  extractIP(clientAddr) {
    // Extract IP from "IP:Port" format
    const match = clientAddr.match(/^(\d+\.\d+\.\d+\.\d+):\d+$/);
    return match ? match[1] : clientAddr;
  }

  updateStats(log) {
    this.stats.totalRequests++;

    // Status codes
    const statusGroup = Math.floor(log.status / 100) * 100;
    this.stats.statusCodes[log.status] = (this.stats.statusCodes[log.status] || 0) + 1;

    if (statusGroup === 200) this.stats.requests2xx++;
    else if (statusGroup === 400) this.stats.requests4xx++;
    else if (statusGroup === 500) this.stats.requests5xx++;

    // Services
    this.stats.services[log.serviceName] = (this.stats.services[log.serviceName] || 0) + 1;

    // Routers
    this.stats.routers[log.routerName] = (this.stats.routers[log.routerName] || 0) + 1;

    // Methods
    this.stats.methods[log.method] = (this.stats.methods[log.method] || 0) + 1;

    // Top IPs
    this.stats.topIPs[log.clientIP] = (this.stats.topIPs[log.clientIP] || 0) + 1;

    // Countries
    if (log.country) {
      this.stats.countries[log.country] = (this.stats.countries[log.country] || 0) + 1;
    }

    // Calculate average response time
    const totalResponseTime = this.logs.reduce((acc, l) => acc + l.responseTime, 0);
    this.stats.avgResponseTime = this.logs.length > 0 ? totalResponseTime / this.logs.length : 0;

    // Calculate requests per second
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
    // Get top 10 IPs
    const topIPs = Object.entries(this.stats.topIPs)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));

    // Get top countries
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

  async getLogs({ page = 1, limit = 100, filters = {} }) {
    let filteredLogs = [...this.logs];

    // Apply filters
    if (filters.service) {
      filteredLogs = filteredLogs.filter(log => log.serviceName === filters.service);
    }
    if (filters.status) {
      filteredLogs = filteredLogs.filter(log => log.status === parseInt(filters.status));
    }
    if (filters.router) {
      filteredLogs = filteredLogs.filter(log => log.routerName === filters.router);
    }

    // Pagination
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