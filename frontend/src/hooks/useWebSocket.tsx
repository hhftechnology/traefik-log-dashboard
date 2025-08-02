import { useEffect, useRef, useState, useCallback } from 'react';

export interface LogEntry {
  id: string;
  timestamp: string;
  clientIP: string;
  method: string;
  path: string;
  status: number;
  responseTime: number;
  serviceName: string;
  routerName: string;
  host: string;
  requestAddr: string;
  requestHost: string;
  userAgent: string;
  size: number;
  country?: string;
  city?: string;
  countryCode?: string;
  lat?: number;
  lon?: number;

  // New Fields
  StartUTC: string;
  StartLocal: string;
  Duration: number;
  ServiceURL: string;
  ServiceAddr: string;
  ClientHost: string;
  ClientPort: string;
  ClientUsername: string;
  RequestPort: string;
  RequestProtocol: string;
  RequestScheme: string;
  RequestLine: string;
  RequestContentSize: number;
  OriginDuration: number;
  OriginContentSize: number;
  OriginStatus: number;
  DownstreamStatus: number;
  RequestCount: number;
  GzipRatio: number;
  Overhead: number;
  RetryAttempts: number;
  TLSVersion: string;
  TLSCipher: string;
  TLSClientSubject: string;
  TraceId: string;
  SpanId: string;
  "downstream_X-Content-Type-Options"?: string;
  "downstream_X-Frame-Options"?: string;
  "origin_X-Content-Type-Options"?: string;
  "origin_X-Frame-Options"?: string;
  "request_Accept"?: string;
  "request_Accept-Encoding"?: string;
  "request_Accept-Language"?: string;
  "request_Cdn-Loop"?: string;
  "request_Cf-Connecting-Ip"?: string;
  "request_Cf-Ipcountry"?: string;
  "request_Cf-Ray"?: string;
  "request_Cf-Visitor"?: string;
  "request_Cf-Warp-Tag-Id"?: string;
  "request_Dnt"?: string;
  "request_Priority"?: string;
  "request_Sec-Fetch-Dest"?: string;
  "request_Sec-Fetch-Mode"?: string;
  "request_Sec-Fetch-Site"?: string;
  "request_Sec-Fetch-User"?: string;
  "request_Sec-Gpc"?: string;
  "request_Upgrade-Insecure-Requests"?: string;
  "request_User-Agent"?: string;
  "request_X-Forwarded-Host"?: string;
  "request_X-Forwarded-Port"?: string;
  "request_X-Forwarded-Proto"?: string;
  "request_X-Forwarded-Server"?: string;
  "request_X-Real-Ip"?: string;
}

export interface Stats {
  totalRequests: number;
  statusCodes: Record<string, number>;
  services: Record<string, number>;
  routers: Record<string, number>;
  methods: Record<string, number>;
  avgResponseTime: number;
  requests5xx: number;
  requests4xx: number;
  requests2xx: number;
  requestsPerSecond: number;
  topIPs: Array<{ ip: string; count: number }>;
  topCountries: Array<{ country: string; countryCode: string; count: number }>;
  topRouters: Array<{ router: string; count: number }>;
  topRequestAddrs: Array<{ addr: string; count: number }>;
  topRequestHosts: Array<{ host: string; count: number }>;
  totalDataTransmitted: number;   // Total bytes transmitted
  oldestLogTime: string;          // Oldest log timestamp
  newestLogTime: string;          // Newest log timestamp
  analysisPeriod: string;         // Human readable period
}

interface WebSocketMessage {
  type: 'newLog' | 'logs' | 'stats' | 'geoStats' | 'clear' | 'geoDataUpdated';
  data: any;
  stats?: Stats; // Optional stats field for bundled updates
}

// Helper function to update stats with a new log entry (fallback for edge cases)
function updateStatsWithNewLog(currentStats: Stats | null, newLog: LogEntry): Stats {
  if (!currentStats) {
    // Initialize basic stats if none exist
    return {
      totalRequests: 1,
      statusCodes: { [newLog.status]: 1 },
      services: { [newLog.serviceName]: 1 },
      routers: { [newLog.routerName]: 1 },
      methods: { [newLog.method]: 1 },
      avgResponseTime: newLog.responseTime,
      requests5xx: newLog.status >= 500 ? 1 : 0,
      requests4xx: newLog.status >= 400 && newLog.status < 500 ? 1 : 0,
      requests2xx: newLog.status >= 200 && newLog.status < 300 ? 1 : 0,
      requestsPerSecond: 0,
      topIPs: newLog.clientIP ? [{ ip: newLog.clientIP, count: 1 }] : [],
      topCountries: newLog.country && newLog.countryCode ? [{ country: newLog.country, countryCode: newLog.countryCode, count: 1 }] : [],
      topRouters: [{ router: newLog.routerName, count: 1 }],
      topRequestAddrs: newLog.requestAddr ? [{ addr: newLog.requestAddr, count: 1 }] : [],
      topRequestHosts: newLog.requestHost ? [{ host: newLog.requestHost, count: 1 }] : [],
      totalDataTransmitted: typeof newLog.size === 'number' ? newLog.size : 0,
      oldestLogTime: newLog.timestamp,
      newestLogTime: newLog.timestamp,
      analysisPeriod: '', // You can update this as needed elsewhere
    };
  }

  // Create updated stats
  const updatedStats: Stats = {
    ...currentStats,
    totalRequests: currentStats.totalRequests + 1,
    statusCodes: {
      ...currentStats.statusCodes,
      [newLog.status]: (currentStats.statusCodes[newLog.status] || 0) + 1
    },
    services: {
      ...currentStats.services,
      [newLog.serviceName]: (currentStats.services[newLog.serviceName] || 0) + 1
    },
    routers: {
      ...currentStats.routers,
      [newLog.routerName]: (currentStats.routers[newLog.routerName] || 0) + 1
    },
    methods: {
      ...currentStats.methods,
      [newLog.method]: (currentStats.methods[newLog.method] || 0) + 1
    }
  };

  // Update status code counters
  if (newLog.status >= 500) {
    updatedStats.requests5xx = currentStats.requests5xx + 1;
  } else if (newLog.status >= 400) {
    updatedStats.requests4xx = currentStats.requests4xx + 1;
  } else if (newLog.status >= 200 && newLog.status < 300) {
    updatedStats.requests2xx = currentStats.requests2xx + 1;
  }

  // Update average response time
  updatedStats.avgResponseTime = (
    (currentStats.avgResponseTime * currentStats.totalRequests + newLog.responseTime) / 
    updatedStats.totalRequests
  );

  // Update top IPs
  if (newLog.clientIP) {
    const existingIP = updatedStats.topIPs.find(ip => ip.ip === newLog.clientIP);
    if (existingIP) {
      existingIP.count += 1;
    } else {
      updatedStats.topIPs.push({ ip: newLog.clientIP, count: 1 });
    }
    updatedStats.topIPs.sort((a, b) => b.count - a.count);
    updatedStats.topIPs = updatedStats.topIPs.slice(0, 10); // Keep top 10
  }

  // Update top countries
  if (newLog.country && newLog.countryCode) {
    const existingCountry = updatedStats.topCountries.find(c => c.countryCode === newLog.countryCode);
    if (existingCountry) {
      existingCountry.count += 1;
    } else {
      updatedStats.topCountries.push({ 
        country: newLog.country, 
        countryCode: newLog.countryCode, 
        count: 1 
      });
    }
    updatedStats.topCountries.sort((a, b) => b.count - a.count);
  }

  // Update top routers
  const existingRouter = updatedStats.topRouters.find(r => r.router === newLog.routerName);
  if (existingRouter) {
    existingRouter.count += 1;
  } else {
    updatedStats.topRouters.push({ router: newLog.routerName, count: 1 });
  }
  updatedStats.topRouters.sort((a, b) => b.count - a.count);
  updatedStats.topRouters = updatedStats.topRouters.slice(0, 10);

  // Update top request addresses
  if (newLog.requestAddr) {
    const existingAddr = updatedStats.topRequestAddrs.find(a => a.addr === newLog.requestAddr);
    if (existingAddr) {
      existingAddr.count += 1;
    } else {
      updatedStats.topRequestAddrs.push({ addr: newLog.requestAddr, count: 1 });
    }
    updatedStats.topRequestAddrs.sort((a, b) => b.count - a.count);
    updatedStats.topRequestAddrs = updatedStats.topRequestAddrs.slice(0, 10);
  }

  // Update top request hosts
  if (newLog.requestHost) {
    const existingHost = updatedStats.topRequestHosts.find(h => h.host === newLog.requestHost);
    if (existingHost) {
      existingHost.count += 1;
    } else {
      updatedStats.topRequestHosts.push({ host: newLog.requestHost, count: 1 });
    }
    updatedStats.topRequestHosts.sort((a, b) => b.count - a.count);
    updatedStats.topRequestHosts = updatedStats.topRequestHosts.slice(0, 10);
  }

  return updatedStats;
}

export function useWebSocket() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [geoDataVersion, setGeoDataVersion] = useState(0); // Track geo data updates
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        if (reconnectTimeout.current) {
          clearTimeout(reconnectTimeout.current);
          reconnectTimeout.current = null;
        }
      };

      ws.current.onmessage = (event) => {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        switch (message.type) {
          case 'newLog':
            setLogs(prev => [message.data, ...prev].slice(0, 1000));
            
            // Use bundled stats if available (preferred), otherwise calculate locally
            if (message.stats) {
              console.log('Received real-time stats with new log:', message.stats);
              setStats(message.stats);
            } else {
              // Fallback to local calculation if stats not bundled
              console.log('No bundled stats, calculating locally');
              setStats(prevStats => updateStatsWithNewLog(prevStats, message.data));
            }
            break;
            
          case 'logs':
            if (Array.isArray(message.data)) {
              setLogs(message.data);
            } else if (Array.isArray(message.data.logs)) {
              setLogs(message.data.logs);
            }
            break;
            
          case 'stats':
            setStats(message.data);
            break;
            
          case 'geoStats':
            // Update geography data in stats
            setStats(prevStats => {
              if (!prevStats) return prevStats;
              return {
                ...prevStats,
                topCountries: message.data.countries || prevStats.topCountries
              };
            });
            // Increment geo data version to trigger re-renders
            setGeoDataVersion(prev => prev + 1);
            break;
            
          case 'geoDataUpdated':
            // Handle immediate geo data updates from MaxMind reload
            console.log('Received geo data update notification:', message.data);
            // Force a geo data version increment to trigger map re-render
            setGeoDataVersion(prev => prev + 1);
            // Request fresh geo stats
            sendMessage({ type: 'getGeoStats' });
            sendMessage({ type: 'getStats' });
            break;
            
          case 'clear':
            setLogs([]);
            setStats(null);
            setGeoDataVersion(0);
            break;
        }
      };

      ws.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        reconnectTimeout.current = setTimeout(connect, 3000);
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  const requestLogs = useCallback((params: any) => {
    sendMessage({ type: 'getLogs', params });
  }, [sendMessage]);

  const requestStats = useCallback(() => {
    sendMessage({ type: 'getStats' });
  }, [sendMessage]);

  const refreshGeoData = useCallback(() => {
    sendMessage({ type: 'refreshGeoData' });
  }, [sendMessage]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  return {
    logs,
    stats,
    isConnected,
    geoDataVersion, // Expose geo data version for components that need to track updates
    requestLogs,
    requestStats,
    refreshGeoData,
  };
}