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
  totalDataTransmitted: number;
  oldestLogTime: string;
  newestLogTime: string;
  analysisPeriod: string;
}

interface WebSocketMessage {
  type: 'newLog' | 'logs' | 'stats' | 'geoStats' | 'clear' | 'geoDataUpdated' | 'geoProcessingStatus';
  data: any;
  stats?: Stats;
}

// Maximum logs to keep in memory (prevent unbounded growth)
const MAX_LOGS_IN_MEMORY = 10000;

export function useWebSocket() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [geoDataVersion, setGeoDataVersion] = useState(0);
  
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000; // Start with 1 second
  const mounted = useRef(true);

  // Use callbacks to avoid stale closures
  const updateLogs = useCallback((newLog: LogEntry) => {
    if (!mounted.current) return;
    
    setLogs(prevLogs => {
      // Add new log at the beginning and limit total size
      const updated = [newLog, ...prevLogs].slice(0, MAX_LOGS_IN_MEMORY);
      console.log(`[WebSocket] Added new log. Total logs: ${updated.length}`);
      return updated;
    });
  }, []);

  const setLogsDirectly = useCallback((newLogs: LogEntry[]) => {
    if (!mounted.current) return;
    
    const trimmedLogs = newLogs.slice(0, MAX_LOGS_IN_MEMORY);
    console.log(`[WebSocket] Set logs directly. Received: ${newLogs.length}, Keeping: ${trimmedLogs.length}`);
    setLogs(trimmedLogs);
  }, []);

  const updateStats = useCallback((newStats: Stats) => {
    if (!mounted.current) return;
    
    setStats(newStats);
  }, []);

  const clearData = useCallback(() => {
    if (!mounted.current) return;
    
    setLogs([]);
    setStats(null);
    setGeoDataVersion(0);
    console.log('[WebSocket] Cleared all data');
  }, []);

  const connect = useCallback(() => {
    if (!mounted.current) return;
    
    if (ws.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log('[WebSocket] Connecting to:', wsUrl);
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        if (!mounted.current) return;
        
        console.log('[WebSocket] Connected successfully');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        
        if (reconnectTimeout.current) {
          clearTimeout(reconnectTimeout.current);
          reconnectTimeout.current = null;
        }
      };

      ws.current.onmessage = (event) => {
        if (!mounted.current) return;
        
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'newLog':
              updateLogs(message.data);
              // Use bundled stats if available for real-time efficiency
              if (message.stats) {
                updateStats(message.stats);
              }
              break;
              
            case 'logs':
              if (Array.isArray(message.data)) {
                console.log(`[WebSocket] Received ${message.data.length} logs directly`);
                setLogsDirectly(message.data);
              } else if (Array.isArray(message.data?.logs)) {
                console.log(`[WebSocket] Received ${message.data.logs.length} logs in result object`);
                setLogsDirectly(message.data.logs);
              } else {
                console.warn('[WebSocket] Received logs message but data is not an array:', message.data);
              }
              break;
              
            case 'stats':
              updateStats(message.data);
              break;
              
            case 'geoStats':
              setStats(prevStats => {
                if (!prevStats) return prevStats;
                return {
                  ...prevStats,
                  topCountries: message.data.countries || prevStats.topCountries
                };
              });
              setGeoDataVersion(prev => prev + 1);
              break;
              
            case 'geoDataUpdated':
              console.log('[WebSocket] Received geo data update notification');
              setGeoDataVersion(prev => prev + 1);
              sendMessage({ type: 'getGeoStats' });
              sendMessage({ type: 'getStats' });
              break;
              
            case 'geoProcessingStatus':
              // Handle geo processing status if needed
              break;
              
            case 'clear':
              clearData();
              break;
              
            default:
              console.warn('[WebSocket] Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      ws.current.onclose = (event) => {
        if (!mounted.current) return;
        
        console.log('[WebSocket] Disconnected:', event.code, event.reason);
        setIsConnected(false);
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(
            baseReconnectDelay * Math.pow(2, reconnectAttempts.current),
            30000 // Max 30 seconds
          );
          
          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeout.current = setTimeout(() => {
            if (mounted.current) {
              reconnectAttempts.current += 1;
              connect();
            }
          }, delay);
        } else {
          console.error('[WebSocket] Max reconnection attempts reached');
        }
      };

      ws.current.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error);
    }
  }, [updateLogs, setLogsDirectly, updateStats, clearData]);

  const sendMessage = useCallback((message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Sending message:', message.type);
      ws.current.send(JSON.stringify(message));
      return true;
    } else {
      console.warn('[WebSocket] Not connected, cannot send message:', message);
      return false;
    }
  }, []);

  const requestLogs = useCallback((params: any) => {
    console.log('[WebSocket] Requesting logs with params:', params);
    return sendMessage({ type: 'getLogs', params });
  }, [sendMessage]);

  const requestStats = useCallback(() => {
    console.log('[WebSocket] Requesting stats');
    return sendMessage({ type: 'getStats' });
  }, [sendMessage]);

  const refreshGeoData = useCallback(() => {
    console.log('[WebSocket] Refreshing geo data');
    return sendMessage({ type: 'refreshGeoData' });
  }, [sendMessage]);

  // Connect on mount and cleanup on unmount
  useEffect(() => {
    mounted.current = true;
    connect();

    // Cleanup function
    return () => {
      mounted.current = false;
      
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  // Periodically check connection health
  useEffect(() => {
    const healthCheck = setInterval(() => {
      if (mounted.current && !isConnected && ws.current?.readyState !== WebSocket.CONNECTING) {
        console.log('[WebSocket] Health check: reconnecting...');
        connect();
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(healthCheck);
  }, [isConnected, connect]);

  // Debug log current state periodically
  useEffect(() => {
    const debugLog = setInterval(() => {
      console.log(`[WebSocket] Current state - Connected: ${isConnected}, Logs: ${logs.length}, Stats: ${stats ? 'loaded' : 'null'}`);
    }, 30000); // Log every 30 seconds

    return () => clearInterval(debugLog);
  }, [isConnected, logs.length, stats]);

  return {
    logs,
    stats,
    isConnected,
    geoDataVersion,
    requestLogs,
    requestStats,
    refreshGeoData,
    sendMessage,
  };
}