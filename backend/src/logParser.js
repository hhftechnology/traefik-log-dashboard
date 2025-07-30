import { Tail } from 'tail';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import { getGeoLocation } from './geoLocation.js';

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
      countries: {},
      topRouters: {},
      topRequestAddrs: {},
      topRequestHosts: {}
    };
    this.lastTimestamp = Date.now();
    this.requestsInLastSecond = 0;
  }

  async setLogFile(filePath) {
    if (this.tail) {
      this.tail.unwatch();
    }

    // Pre-cache all unique IPs from the log file to avoid rate-limiting during processing.
    await this.preCacheGeoLocations(filePath);

    // Now that IPs are cached, we can tail the file and process lines quickly.
    this.tail = new Tail(filePath, {
      fromBeginning: true,
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

  async preCacheGeoLocations(filePath) {
    console.log('Starting geolocation pre-caching...');
    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        console.log('Log path is a directory, skipping pre-caching');
        return;
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      const ipSet = new Set();
      const ipRegex = /"ClientAddr":"([^"]+)"/;

      for (const line of lines.slice(-1000)) { // Only process last 1000 lines for pre-caching
        try {
            const match = line.match(ipRegex);
            if (match && match[1]) {
              const ip = this.extractIP(match[1]);
              if (ip !== 'unknown' && !this.isPrivateIP(ip)) {
                ipSet.add(ip);
              }
            }
        } catch (e) {
            // Ignore lines that are not valid JSON
        }
      }

      const uniqueIPs = Array.from(ipSet);
      console.log(`Found ${uniqueIPs.length} unique public IP addresses to geolocate.`);

      // Batch process IPs to respect rate limits
      const batchSize = 40; // Stay under 45/min rate limit
      for (let i = 0; i < uniqueIPs.length; i += batchSize) {
        const batch = uniqueIPs.slice(i, i + batchSize);
        await Promise.all(batch.map(ip => getGeoLocation(ip)));
        console.log(`Pre-cached ${Math.min(i + batchSize, uniqueIPs.length)} of ${uniqueIPs.length} IPs`);
        
        // Wait 60 seconds between batches to respect rate limit
        if (i + batchSize < uniqueIPs.length) {
          await new Promise(resolve => setTimeout(resolve, 60000));
        }
      }

      console.log('Finished geolocation pre-caching.');

    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error during geo pre-caching:', error);
      } else {
        console.log('Log file not found for pre-caching, will proceed with tailing.');
      }
    }
  }

  isPrivateIP(ip) {
    const parts = ip.split('.');
    return (
      ip === '127.0.0.1' ||
      ip === 'localhost' ||
      (parts[0] === '10') ||
      (parts[0] === '172' && parseInt(parts[1]) >= 16 && parseInt(parts[1]) <= 31) ||
      (parts[0] === '192' && parts[1] === '168')
    );
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
        requestAddr: log.RequestAddr || '',  // New field
        requestHost: log.RequestHost || '',  // Explicit field for RequestHost
        userAgent: log['request_User-Agent'] || '',
        size: parseInt(log.DownstreamContentSize || 0),
        country: null,
        city: null,
        countryCode: null,
        lat: null,
        lon: null
      };

      // This call should now be fast because of pre-caching
      const geoData = await getGeoLocation(parsedLog.clientIP);
      if (geoData) {
        parsedLog.country = geoData.country;
        parsedLog.city = geoData.city;
        parsedLog.countryCode = geoData.countryCode;
        parsedLog.lat = geoData.lat;
        parsedLog.lon = geoData.lon;
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
      // It's common for log files to have non-JSON lines, so we'll just log a warning.
      // console.warn('Could not parse log line as JSON:', line);
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

    if (log.routerName && log.routerName !== 'unknown') {
      this.stats.topRouters[log.routerName] = (this.stats.topRouters[log.routerName] || 0) + 1;
    }

    if (log.requestAddr && log.requestAddr !== '') {
      this.stats.topRequestAddrs[log.requestAddr] = (this.stats.topRequestAddrs[log.requestAddr] || 0) + 1;
    }

    if (log.requestHost && log.requestHost !== '') {
      this.stats.topRequestHosts[log.requestHost] = (this.stats.topRequestHosts[log.requestHost] || 0) + 1;
    }

    if (log.country && log.countryCode) {
      const key = `${log.countryCode}|${log.country}`;
      this.stats.countries[key] = (this.stats.countries[key] || 0) + 1;
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
      .slice(0, 20)
      .map(([key, count]) => {
        const [code, name] = key.split('|');
        return { country: name, countryCode: code, count };
      });

    const topRouters = Object.entries(this.stats.topRouters)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([router, count]) => ({ router, count }));

    const topRequestAddrs = Object.entries(this.stats.topRequestAddrs)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([addr, count]) => ({ addr, count }));

    const topRequestHosts = Object.entries(this.stats.topRequestHosts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([host, count]) => ({ host, count }));

    return {
      ...this.stats,
      topIPs,
      topCountries,
      topRouters,
      topRequestAddrs,
      topRequestHosts,
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
      .map(([key, count]) => {
        const [code, name] = key.split('|');
        return { country: name, countryCode: code, count };
      })
      .sort((a, b) => b.count - a.count);

    return { countries };
  }
}