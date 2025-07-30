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
  userAgent: string;
  size: number;
  country?: string;
  city?: string;
  countryCode?: string;
  lat?: number;
  lon?: number;
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
}

interface WebSocketMessage {
  type: 'newLog' | 'logs' | 'stats';
  data: any;
}

export function useWebSocket() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isConnected, setIsConnected] = useState(false);
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
            break;
          case 'logs':
            if (Array.isArray(message.data.logs)) {
              setLogs(prev => [...prev, ...message.data.logs]);
            }
            break;
          case 'stats':
            setStats(message.data);
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
    requestLogs,
    requestStats,
  };
}