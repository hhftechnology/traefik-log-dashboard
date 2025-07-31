import { Tail } from 'tail';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { getGeoLocation } from './geoLocation.js';

export class LogParser extends EventEmitter {
  constructor() {
    super();
    this.logs = [];
    this.maxLogs = 10000;
    this.tails = [];  // Array to hold multiple tail instances
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

  async setLogFiles(logPaths) {
    // Stop existing tails
    this.tails.forEach(tail => tail.unwatch());
    this.tails = [];

    // Handle both single path and array of paths
    const paths = Array.isArray(logPaths) ? logPaths : [logPaths];
    
    console.log(`Setting up monitoring for ${paths.length} log path(s)`);

    for (const logPath of paths) {
      try {
        const stats = await fs.stat(logPath);
        
        if (stats.isDirectory()) {
          // If it's a directory, find all log files in it
          const files = await this.findLogFiles(logPath);
          for (const file of files) {
            await this.setupTailForFile(file);
          }
        } else if (stats.isFile()) {
          // If it's a file, tail it directly
          await this.setupTailForFile(logPath);
        }
      } catch (error) {
        console.error(`Error accessing log path ${logPath}:`, error);
      }
    }

    // Pre-cache geolocation data for all log files
    await this.preCacheGeoLocationsForAllFiles(paths);
  }

  async findLogFiles(dirPath) {
    const files = [];
    try {
      const entries = await fs.readdir(dirPath);
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stats = await fs.stat(fullPath);
        
        if (stats.isFile() && (entry.endsWith('.log') || entry.includes('traefik'))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
    }
    
    return files;
  }

  async setupTailForFile(filePath) {
    try {
      console.log(`Setting up tail for file: ${filePath}`);
      
      const tail = new Tail(filePath, {
        fromBeginning: true,
        follow: true,
        logger: console
      });

      tail.on('line', async (line) => {
        await this.parseLine(line, true);
      });

      tail.on('error', (error) => {
        console.error(`Tail error for ${filePath}:`, error);
        this.emit('error', error);
      });

      this.tails.push(tail);
    } catch (error) {
      console.error(`Error setting up tail for ${filePath}:`, error);
    }
  }

  async preCacheGeoLocationsForAllFiles(paths) {
    console.log('Starting geolocation pre-caching for all files...');
    const ipSet = new Set();
    const ipRegex = /"ClientAddr":"([^"]+)"/;

    for (const logPath of paths) {
      try {
        const stats = await fs.stat(logPath);
        
        if (stats.isFile()) {
          await this.extractIPsFromFile(logPath, ipSet, ipRegex);
        } else if (stats.isDirectory()) {
          const files = await this.findLogFiles(logPath);
          for (const file of files) {
            await this.extractIPsFromFile(file, ipSet, ipRegex);
          }
        }
      } catch (error) {
        console.error(`Error processing path ${logPath} for IP extraction:`, error);
      }
    }

    const uniqueIPs = Array.from(ipSet);
    console.log(`Found ${uniqueIPs.length} unique public IP addresses to geolocate.`);

    // Batch process IPs to respect rate limits
    const batchSize = 40;
    for (let i = 0; i < uniqueIPs.length; i += batchSize) {
      const batch = uniqueIPs.slice(i, i + batchSize);
      await Promise.all(batch.map(ip => getGeoLocation(ip)));
      console.log(`Pre-cached ${Math.min(i + batchSize, uniqueIPs.length)} of ${uniqueIPs.length} IPs`);
      
      if (i + batchSize < uniqueIPs.length) {
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }

    console.log('Finished geolocation pre-caching.');
  }

  async extractIPsFromFile(filePath, ipSet, ipRegex) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      // Only process last 1000 lines for pre-caching
      for (const line of lines.slice(-1000)) {
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
    } catch (error) {
      console.error(`Error reading file ${filePath} for IP extraction:`, error);
    }
  }

  async setLogFile(filePath) {
    // Backward compatibility - convert single path to array
    return this.setLogFiles([filePath]);
  }

  async preCacheGeoLocations(filePath) {
    // This method is kept for backward compatibility
    // The new implementation handles this in setLogFiles
  }

  isPrivateIP(ip) {
    const parts = ip.split('.');
    return (
      ip === '127.0.0.1' ||
      ip === 'localhost' ||
      ip.startsWith('::') ||
      ip === '::1' ||
      (parts[0] === '10') ||
      (parts[0] === '172' && parseInt(parts[1]) >= 16 && parseInt(parts[1]) <= 31) ||
      (parts[0] === '192' && parts[1] === '168') ||
      (parts[0] === '169' && parts[1] === '254') // Link-local
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
        requestAddr: log.RequestAddr || '',
        requestHost: log.RequestHost || '',
        userAgent: log.request_UserAgent || '',
        size: parseInt(log.DownstreamContentSize || 0),
        country: null,
        city: null,
        countryCode: null,
        lat: null,
        lon: null,

        // New fields
        StartUTC: log.StartUTC,
        StartLocal: log.StartLocal,
        Duration: log.Duration,
        ServiceURL: log.ServiceURL,
        ServiceAddr: log.ServiceAddr,
        ClientHost: log.ClientHost,
        ClientPort: log.ClientPort,
        ClientUsername: log.ClientUsername,
        RequestPort: log.RequestPort,
        RequestProtocol: log.RequestProtocol,
        RequestScheme: log.RequestScheme,
        RequestLine: log.RequestLine,
        RequestContentSize: log.RequestContentSize,
        OriginDuration: log.OriginDuration,
        OriginContentSize: log.OriginContentSize,
        OriginStatus: log.OriginStatus,
        DownstreamStatus: log.DownstreamStatus,
        RequestCount: log.RequestCount,
        GzipRatio: log.GzipRatio,
        Overhead: log.Overhead,
        RetryAttempts: log.RetryAttempts,
        TLSVersion: log.TLSVersion,
        TLSCipher: log.TLSCipher,
        TLSClientSubject: log.TLSClientSubject,
        TraceId: log.TraceId,
        SpanId: log.SpanId
      };

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
      // It's common for log files to have non-JSON lines
    }
  }

  extractIP(clientAddr) {
    if (!clientAddr) return 'unknown';
    
    // Handle IPv6 addresses with brackets like [2001:db8::1]:80
    if (clientAddr.startsWith('[')) {
      const match = clientAddr.match(/\[([^\]]+)\]/);
      return match ? match[1] : clientAddr;
    }
    
    // Handle IPv4 addresses with port like 192.168.1.1:8080
    if (clientAddr.includes('.') && clientAddr.includes(':')) {
      return clientAddr.substring(0, clientAddr.lastIndexOf(':'));
    }
    
    // Handle plain IPv6 addresses without port
    if (clientAddr.includes(':') && !clientAddr.includes('.')) {
      return clientAddr;
    }
    
    // Handle plain IPv4 addresses without port
    return clientAddr;
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
    
    // Filter out unknown services/routers if requested
    if (filters.hideUnknown) {
      filteredLogs = filteredLogs.filter(log => 
        log.serviceName !== 'unknown' && log.routerName !== 'unknown'
      );
    }

    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedLogs = filteredLogs.slice(start, end);

    for (const log of paginatedLogs) {
      if (!log.country && log.clientIP) {
        const geoData = await getGeoLocation(log.clientIP);
        if (geoData) {
          log.country = geoData.country;
          log.city = geoData.city;
          log.countryCode = geoData.countryCode;
          log.lat = geoData.lat;
          log.lon = geoData.lon;
        }
      }
    }

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