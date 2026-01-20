import { useState, useEffect, useRef } from 'react';
import { TraefikLog } from '@/lib/types';
import { parseTraefikLogs } from '@/lib/traefik-parser';
import { enrichLogsWithGeoLocation } from '@/lib/location';
import { apiClient } from '@/lib/api-client';
import { useTabVisibility } from './useTabVisibility';

// Get max logs display from environment variable (default: 1000)
const MAX_LOGS_DISPLAY = parseInt(process.env.NEXT_PUBLIC_MAX_LOGS_DISPLAY || '1000', 10);

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
  const maxSeenLogs = MAX_LOGS_DISPLAY * 2; // Limit seen logs cache to prevent infinite growth

  // REDUNDANCY FIX: Use shared visibility hook
  const isTabVisible = useTabVisibility();

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const fetchLogs = async () => {
      // PERFORMANCE FIX: Don't fetch when paused or tab not visible
      if (isPaused || !isTabVisible) return;

      try {
        const position = positionRef.current ?? -1;
        // MEMORY LEAK FIX: Pass abort signal to prevent updates after unmount
        const data = await apiClient.getAccessLogs(position, 1000, { signal: abortController.signal });
        
        // Check if component is still mounted before updating state
        if (!isMounted) return;

        if (isFirstFetch.current && data.agent) {
          setAgentId(data.agent.id);
          setAgentName(data.agent.name);
        }

        if (!isMounted) return;

        if (data.logs && data.logs.length > 0) {
          const parsedLogs = parseTraefikLogs(data.logs);

          const newUniqueLogs = parsedLogs.filter(log => {
            const logKey = `${log.StartUTC || log.StartLocal}-${log.RequestCount}-${log.RequestPath}-${log.ClientHost}`;

            if (seenLogsRef.current.has(logKey)) {
              return false;
            }

            seenLogsRef.current.add(logKey);

            // MEMORY LEAK FIX: Prevent infinite Set growth
            if (seenLogsRef.current.size > maxSeenLogs) {
              // Convert to array, remove oldest half, convert back to Set
              const logsArray = Array.from(seenLogsRef.current);
              seenLogsRef.current = new Set(logsArray.slice(logsArray.length / 2));
            }

            return true;
          });

          if (newUniqueLogs.length > 0) {
            // FIX: Handle geolocation lookup failure gracefully - don't let it block dashboard
            let enrichedLogs = newUniqueLogs;
            try {
              enrichedLogs = await enrichLogsWithGeoLocation(newUniqueLogs);
            } catch (geoError) {
              console.warn('GeoLocation enrichment failed, continuing without geo data:', geoError);
            }

            if (!isMounted) return;

            setLogs((prevLogs: TraefikLog[]) => {
              if (isFirstFetch.current) {
                isFirstFetch.current = false;
                return enrichedLogs;
              }
              return [...prevLogs, ...enrichedLogs].slice(-MAX_LOGS_DISPLAY);
            });
          }
        }

        if (!isMounted) return;

        if (data.positions && data.positions.length > 0 && typeof data.positions[0].Position === 'number') {
          positionRef.current = data.positions[0].Position;
        }

        setConnected(true);
        setError(null);
        setLastUpdate(new Date());
      } catch (err) {
        // Don't log abort errors as they're expected
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        
        if (!isMounted) return;
        
        console.error('Error fetching logs:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch logs');
        setConnected(false);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchLogs();
    // PERFORMANCE FIX: Increased from 5s to 10s to reduce CPU load
    const interval = setInterval(fetchLogs, 10000);
    return () => {
      isMounted = false;
      abortController.abort();
      clearInterval(interval);
    };
  }, [isPaused, isTabVisible]);

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
