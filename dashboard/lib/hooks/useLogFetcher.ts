import { useState, useEffect, useRef } from 'react';
import { TraefikLog } from '@/lib/types';
import { parseTraefikLogs } from '@/lib/traefik-parser';
import { enrichLogsWithGeoLocation } from '@/lib/location';
import { apiClient } from '@/lib/api-client';

export function useLogFetcher() {
  const [logs, setLogs] = useState<TraefikLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);

  const positionRef = useRef<number>(-1);
  const isFirstFetch = useRef(true);
  const seenLogsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fetchLogs = async () => {
      if (isPaused) return;

      try {
        const position = positionRef.current ?? -1;
        const data = await apiClient.getAccessLogs(position, 1000);

        if (isFirstFetch.current && data.agent) {
          setAgentId(data.agent.id);
          setAgentName(data.agent.name);
        }

        if (data.logs && data.logs.length > 0) {
          const parsedLogs = parseTraefikLogs(data.logs);

          const newUniqueLogs = parsedLogs.filter(log => {
            const logKey = `${log.StartUTC || log.StartLocal}-${log.RequestCount}-${log.RequestPath}-${log.ClientHost}`;

            if (seenLogsRef.current.has(logKey)) {
              return false;
            }

            seenLogsRef.current.add(logKey);
            return true;
          });

          if (newUniqueLogs.length > 0) {
            const enrichedLogs = await enrichLogsWithGeoLocation(newUniqueLogs);

            setLogs((prevLogs: TraefikLog[]) => {
              if (isFirstFetch.current) {
                isFirstFetch.current = false;
                return enrichedLogs;
              }
              return [...prevLogs, ...enrichedLogs].slice(-1000);
            });
          }
        }

        if (data.positions && data.positions.length > 0 && typeof data.positions[0].Position === 'number') {
          positionRef.current = data.positions[0].Position;
        }

        setConnected(true);
        setError(null);
        setLastUpdate(new Date());
      } catch (err) {
        console.error('Error fetching logs:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch logs');
        setConnected(false);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [isPaused]);

  return {
    logs,
    loading,
    error,
    connected,
    lastUpdate,
    isPaused,
    setIsPaused,
    agentId,
    agentName
  };
}
