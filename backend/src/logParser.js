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
    this.tails = [];
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
    this.geoProcessingQueue = [];
    this.isProcessingGeo = false;
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
          const files = await this.findLogFiles(logPath);
          for (const file of files) {
            await this.setupTailForFile(file);
          }
        } else if (stats.isFile()) {
          await this.setupTailForFile(logPath);
        }
      } catch (error) {
        console.error(`Error accessing log path ${logPath}:`, error);
      }
    }

    // Load all historical logs first
    await this.loadHistoricalLogs(paths);
    
    // Start background geo processing
    this.startGeoProcessing();
  }

  async loadHistoricalLogs(paths) {
    console.log('Loading historical logs...');
    let totalLines = 0;

    for (const logPath of paths) {
      try {
        const stats = await fs.stat(logPath);
        
        if (stats.isFile()) {
          totalLines += await this.loadLogsFromFile(logPath);
        } else if (stats.isDirectory()) {
          const files = await this.findLogFiles(logPath);
          for (const file of files) {
            totalLines += await this.loadLogsFromFile(file);
          }
        }
      } catch (error) {
        console.error(`Error loading historical logs from ${logPath}:`, error);
      }
    }

    console.log(`Loaded ${totalLines} historical log entries`);
    console.log(`Found ${Object.keys(this.stats.topIPs).length} unique IPs`);
  }

  async loadLogsFromFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      // Process ALL lines, not just the last 1000
      for (const line of lines) {
        await this.parseLine(line, false); // Don't emit events during initial load
      }
      
      return lines.length;
    } catch (error) {
      console.error(`Error loading logs from ${filePath}:`, error);
      return 0;
    }
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
        fromBeginning: false, // Don't re-read from beginning since we loaded historical
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

  async setLogFile(filePath) {
    return this.setLogFiles([filePath]);
  }

  isPrivateIP(ip) {
    if (!ip || ip === 'unknown') return true;
    
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    
    return (
      ip === '127.0.0.1' ||
      ip === 'localhost' ||
      ip.startsWith('::') ||
      ip === '::1' ||
      (parts[0] === '10') ||
      (parts[0] === '172' && parseInt(parts[1]) >= 16 && parseInt(parts[1]) <= 31) ||
      (parts[0] === '192' && parts[1] === '168') ||
      (parts[0] === '169' && parts[1] === '254')
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
        SpanId: log.SpanId,
        "downstream_X-Content-Type-Options": log["downstream_X-Content-Type-Options"],
        "downstream_X-Frame-Options": log["downstream_X-Frame-Options"],
        "origin_X-Content-Type-Options": log["origin_X-Content-Type-Options"],
        "origin_X-Frame-Options": log["origin_X-Frame-Options"],
        "request_Accept": log["request_Accept"],
        "request_Accept-Encoding": log["request_Accept-Encoding"],
        "request_Accept-Language": log["request_Accept-Language"],
        "request_Cdn-Loop": log["request_Cdn-Loop"],
        "request_Cf-Connecting-Ip": log["request_Cf-Connecting-Ip"],
        "request_Cf-Ipcountry": log["request_Cf-Ipcountry"],
        "request_Cf-Ray": log["request_Cf-Ray"],
        "request_Cf-Visitor": log["request_Cf-Visitor"],
        "request_Cf-Warp-Tag-Id": log["request_Cf-Warp-Tag-Id"],
        "request_Dnt": log["request_Dnt"],
        "request_Priority": log["request_Priority"],
        "request_Sec-Fetch-Dest": log["request_Sec-Fetch-Dest"],
        "request_Sec-Fetch-Mode": log["request_Sec-Fetch-Mode"],
        "request_Sec-Fetch-Site": log["request_Sec-Fetch-Site"],
        "request_Sec-Fetch-User": log["request_Sec-Fetch-User"],
        "request_Sec-Gpc": log["request_Sec-Gpc"],
        "request_Upgrade-Insecure-Requests": log["request_Upgrade-Insecure-Requests"],
        "request_User-Agent": log["request_User-Agent"],
        "request_X-Forwarded-Host": log["request_X-Forwarded-Host"],
        "request_X-Forwarded-Port": log["request_X-Forwarded-Port"],
        "request_X-Forwarded-Proto": log["request_X-Forwarded-Proto"],
        "request_X-Forwarded-Server": log["request_X-Forwarded-Server"],
        "request_X-Real-Ip": log["request_X-Real-Ip"],
      };

     // Add to geo processing queue if IP is public and not yet processed
      if (parsedLog.clientIP !== 'unknown' && !this.isPrivateIP(parsedLog.clientIP)) {
        this.geoProcessingQueue.push(parsedLog);
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
      // Ignore non-JSON lines
    }
  }

  async startGeoProcessing() {
    if (this.isProcessingGeo) return;
    
    this.isProcessingGeo = true;
    console.log('Starting background geo processing...');
    
    while (this.geoProcessingQueue.length > 0) {
      const batch = this.geoProcessingQueue.splice(0, 40); // Process 40 at a time
      
      await Promise.all(batch.map(async (log) => {
        const geoData = await getGeoLocation(log.clientIP);
        if (geoData) {
          log.country = geoData.country;
          log.city = geoData.city;
          log.countryCode = geoData.countryCode;
          log.lat = geoData.lat;
          log.lon = geoData.lon;
          
          // Update country stats
          if (log.country && log.countryCode) {
            const key = `${log.countryCode}|${log.country}`;
            this.stats.countries[key] = (this.stats.countries[key] || 0) + 1;
          }
        }
      }));
      
      console.log(`Processed ${batch.length} geo locations. ${this.geoProcessingQueue.length} remaining.`);
      
      // Only wait if we have more to process (respecting rate limit)
      if (this.geoProcessingQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 60000)); // 60 seconds between batches
      }
    }
    
    this.isProcessingGeo = false;
    console.log('Geo processing complete.');
  }

  extractIP(clientAddr) {
    if (!clientAddr) return 'unknown';
    
    if (clientAddr.startsWith('[')) {
      const match = clientAddr.match(/\[([^\]]+)\]/);
      return match ? match[1] : clientAddr;
    }
    
    if (clientAddr.includes('.') && clientAddr.includes(':')) {
      return clientAddr.substring(0, clientAddr.lastIndexOf(':'));
    }
    
    if (clientAddr.includes(':') && !clientAddr.includes('.')) {
      return clientAddr;
    }
    
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

    // Update country stats if already geolocated
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

    // Return ALL countries for the map, not just top 20
    const topCountries = Object.entries(this.stats.countries)
      .sort(([, a], [, b]) => b - a)
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
      avgResponseTime: Math.round(this.stats.avgResponseTime * 100) / 100,
      geoProcessingRemaining: this.geoProcessingQueue.length
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
    
    if (filters.hideUnknown) {
      filteredLogs = filteredLogs.filter(log => 
        log.serviceName !== 'unknown' && log.routerName !== 'unknown'
      );
    }

    if (filters.hidePrivateIPs) {
      filteredLogs = filteredLogs.filter(log => !this.isPrivateIP(log.clientIP));
    }

    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedLogs = filteredLogs.slice(start, end);

    // Try to geolocate any logs that don't have location data yet
    for (const log of paginatedLogs) {
      if (!log.country && log.clientIP && !this.isPrivateIP(log.clientIP)) {
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
    // Return ALL countries, not filtered
    const countries = Object.entries(this.stats.countries)
      .map(([key, count]) => {
        const [code, name] = key.split('|');
        return { country: name, countryCode: code, count };
      })
      .sort((a, b) => b.count - a.count);

    return { 
      countries,
      totalCountries: countries.length,
      geoProcessingRemaining: this.geoProcessingQueue.length 
    };
  }
}