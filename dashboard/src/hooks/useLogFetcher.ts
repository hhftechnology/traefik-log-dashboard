import { useState, useEffect, useRef, useSyncExternalStore, useCallback, useMemo } from 'react'; // eslint-disable-line no-restricted-syntax
import { TraefikLog } from '@/utils/types';
import { enrichLogsWithGeoLocation } from '@/utils/location';
import { apiClient } from '@/utils/api-client';
import { useTabVisibility } from './useTabVisibility';
import { buildLogKey, createLogBuffer, dedupeLogs } from '@/utils/utils/log-batching';
import { getNextLogCursor } from '@/utils/utils/log-cursor';
import { useConfig } from '@/utils/contexts/ConfigContext';
import { useAgents } from '@/utils/contexts/AgentContext';
import { logStore } from '@/utils/stores/log-store';
import { saveLogsToIDB, loadLogsFromIDB, clearLogsFromIDB } from '@/utils/stores/log-persistence';

const STREAM_BATCH_SIZE = 250;
const STREAM_FLUSH_INTERVAL = 350;
const POLL_MAX_INTERVAL = 30000;
const STALE_CONNECTION_MS = 45000;
const SSE_MAX_RETRIES = 3;
const SSE_INITIAL_BACKOFF = 2000;

export interface DedupeDebugStats {
  received: number;
  kept: number;
  dropped: number;
  dropRate: number;
}

export function useLogFetcher() {
  const { config } = useConfig();
  const { selectedAgent } = useAgents();
  const maxLogsDisplay = Math.max(1, config.maxLogsDisplay);
  const maxHistoryLoad = Math.max(1, config.maxHistoryLoad);

  // Subscribe to logStore for reactive updates
  const storeState = useSyncExternalStore(
    logStore.subscribe,
    logStore.getState,
    logStore.getState
  );

  const [isPaused, setIsPaused] = useState(false);
  const [dedupeDebug, setDedupeDebug] = useState<DedupeDebugStats | null>(null);

  const previousAgentRef = useRef<string | null>(null);
  const isFirstFetchRef = useRef(true);
  const dedupeReceivedRef = useRef(0);
  const dedupeDroppedRef = useRef(0);
  const idbHydrated = useRef(false);

  // Use refs for derived config values to prevent effect re-fires
  const maxLogsDisplayRef = useRef(maxLogsDisplay);
  maxLogsDisplayRef.current = maxLogsDisplay;
  const maxHistoryLoadRef = useRef(maxHistoryLoad);
  maxHistoryLoadRef.current = maxHistoryLoad;
  const maxSeenLogsRef = useRef(maxLogsDisplay * 2);
  maxSeenLogsRef.current = maxLogsDisplay * 2;

  const pollDelayRef = useRef(config.refreshIntervalMs);
  const lastSuccessRef = useRef<number | null>(null);

  const isTabVisible = useTabVisibility();

  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    const selectedAgentID = selectedAgent?.id;
    const selectedAgentName = selectedAgent?.name ?? null;
    const hasAgentChanged = previousAgentRef.current !== selectedAgentID;

    if (hasAgentChanged) {
      // Agent switched — clear store and start fresh
      logStore.clear();
      logStore.setAgentInfo(selectedAgentID ?? null, selectedAgentName);
      isFirstFetchRef.current = true;
      idbHydrated.current = false;
      dedupeReceivedRef.current = 0;
      dedupeDroppedRef.current = 0;
      setDedupeDebug(null);
      lastSuccessRef.current = null;
      previousAgentRef.current = selectedAgentID ?? null;
    } else {
      logStore.setAgentInfo(selectedAgentID ?? null, selectedAgentName);
    }

    if (!selectedAgentID) {
      logStore.setLoading(false);
      logStore.setError('No agent selected or available');
      return;
    }

    pollDelayRef.current = config.refreshIntervalMs;
    let isMounted = true;
    let pollTimeout: ReturnType<typeof setTimeout> | null = null;
    let staleInterval: ReturnType<typeof setInterval> | null = null;
    const activeControllers = new Set<AbortController>();

    const addController = () => {
      const controller = new AbortController();
      activeControllers.add(controller);
      return controller;
    };

    const abortActiveControllers = () => {
      activeControllers.forEach((controller) => controller.abort());
      activeControllers.clear();
    };

    const processLogs = async (rawLogs: TraefikLog[]) => {
      if (!isMounted || rawLogs.length === 0) return;

      const seenKeys = logStore.getSeenKeys();
      const uniqueLogs = dedupeLogs(rawLogs, seenKeys, maxSeenLogsRef.current, buildLogKey);
      const dropped = rawLogs.length - uniqueLogs.length;
      dedupeReceivedRef.current += rawLogs.length;
      dedupeDroppedRef.current += dropped;
      if (import.meta.env.DEV) {
        const received = dedupeReceivedRef.current;
        const droppedTotal = dedupeDroppedRef.current;
        const kept = received - droppedTotal;
        setDedupeDebug({
          received,
          kept,
          dropped: droppedTotal,
          dropRate: received > 0 ? (droppedTotal / received) * 100 : 0,
        });
      }

      if (uniqueLogs.length === 0) {
        logStore.setLoading(false);
        return;
      }

      let enrichedLogs = uniqueLogs;
      try {
        const shouldEnrichGeo = uniqueLogs.some((log) => Boolean(log.ClientHost || log.ClientAddr));
        if (shouldEnrichGeo) {
          enrichedLogs = await enrichLogsWithGeoLocation(uniqueLogs);
        }
      } catch (geoError) {
        console.warn('GeoLocation enrichment failed, continuing without geo data:', geoError);
      }

      if (!isMounted) return;

      logStore.appendLogs(enrichedLogs, maxLogsDisplayRef.current, isFirstFetchRef.current);
      isFirstFetchRef.current = false;
      logStore.setConnected(true);
      logStore.setError(null);
      logStore.setLastUpdate(new Date());
      lastSuccessRef.current = Date.now();

      // Persist to IndexedDB (debounced)
      const currentState = logStore.getState();
      const pos = logStore.getPosition(selectedAgentID);
      saveLogsToIDB(selectedAgentID, currentState.logs, pos);
    };

    const buffer = createLogBuffer(
      async (batch) => {
        await processLogs(batch);
      },
      {
        flushIntervalMs: STREAM_FLUSH_INTERVAL,
        maxBatchSize: STREAM_BATCH_SIZE,
        maxBufferSize: STREAM_BATCH_SIZE * 6,
      }
    );

    const scheduleStaleCheck = () => {
      staleInterval = setInterval(() => {
        if (!isMounted) return;
        if (!lastSuccessRef.current) return;
        if (isPaused) return;
        const age = Date.now() - lastSuccessRef.current;
        if (age > STALE_CONNECTION_MS) {
          logStore.setConnected(false);
        }
      }, STALE_CONNECTION_MS);
    };

    const schedulePoll = (delay = pollDelayRef.current) => {
      if (pollTimeout) clearTimeout(pollTimeout);
      pollTimeout = setTimeout(() => {
        void pollLogs();
      }, delay);
    };

    const pollLogs = async (scheduleNextPoll = true) => {
      if (isPaused || !isTabVisible || !isMounted) return;
      if (!selectedAgentID) return;

      const controller = addController();
      try {
        const position = logStore.getPosition(selectedAgentID);

        // Determine lines to request:
        // - First ever connect (position=-1): use tail mode (-1) to always get recent logs
        //   (agent-tracked position can be at EOF, causing empty responses)
        // - Subsequent fetches: use maxLogsDisplay for incremental updates
        const isFirstEverConnect = position === -1;
        const requestPosition = isFirstEverConnect ? -1 : position;
        const requestLines = isFirstEverConnect
          ? maxHistoryLoadRef.current
          : maxLogsDisplayRef.current;

        if (isFirstEverConnect) {
          logStore.setCatchingUp(true);
        }

        const data = await apiClient.getAccessLogs({
          agentId: selectedAgentID,
          position: requestPosition,
          lines: requestLines,
          signal: controller.signal,
        });
        if (!isMounted) return;

        if (isFirstFetchRef.current && data.agent) {
          logStore.setAgentInfo(data.agent.id, data.agent.name);
        }

        if (data.logs?.length) {
          buffer.push(data.logs);
          await buffer.flush();
        }

        const nextPosition = getNextLogCursor(
          data.positions as Array<{ position?: unknown; Position?: unknown }> | undefined
        );

        if (typeof nextPosition === 'number') {
          logStore.setPosition(selectedAgentID, nextPosition);
        }

        if (isFirstEverConnect) {
          logStore.setCatchingUp(false);
        }

        // Always mark connected on ANY successful API response,
        // even if 0 new logs were returned (e.g. no new traffic)
        logStore.setConnected(true);
        logStore.setError(null);
        logStore.setLoading(false);
        lastSuccessRef.current = Date.now();

        pollDelayRef.current = config.refreshIntervalMs;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!isMounted) return;
        console.error('Error fetching logs:', err);
        logStore.setError(err instanceof Error ? err.message : 'Failed to fetch logs');
        logStore.setConnected(false);
        logStore.setLoading(false);
        logStore.setCatchingUp(false);
        pollDelayRef.current = Math.min(pollDelayRef.current * 1.6, POLL_MAX_INTERVAL);
      } finally {
        activeControllers.delete(controller);
        if (scheduleNextPoll && isMounted && !isPaused && isTabVisible) {
          schedulePoll();
        }
      }
    };

    const startStreaming = async (retryCount = 0): Promise<void> => {
      if (!selectedAgentID) return;
      const controller = addController();

      try {
        for await (const line of apiClient.streamAccessLogs({ agentId: selectedAgentID, signal: controller.signal })) {
          if (!isMounted) return;
          if (isPaused || !isTabVisible) {
            controller.abort();
            return;
          }
          buffer.push(line);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (!isMounted) return;

        // Skip retries for 404 — endpoint doesn't exist, retrying won't help
        const is404 = err instanceof Error && err.message.includes('404');
        if (is404) {
          console.warn('Streaming endpoint not available (404), using polling mode');
          schedulePoll(2000);
        } else if (retryCount < SSE_MAX_RETRIES) {
          // SSE reconnection with exponential backoff for transient errors
          const backoff = SSE_INITIAL_BACKOFF * Math.pow(2, retryCount);
          console.warn(`Streaming failed (attempt ${retryCount + 1}/${SSE_MAX_RETRIES}), retrying in ${backoff}ms...`);
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, backoff);
            // Store timer for cleanup on unmount
            pollTimeout = timer as unknown as ReturnType<typeof setTimeout>;
          });
          // Re-check mounted state AFTER the await (fixes race condition)
          if (isMounted && !isPaused && isTabVisible) {
            return startStreaming(retryCount + 1);
          }
        } else {
          console.warn('Streaming failed after max retries, falling back to polling');
          schedulePoll(2000);
        }
      } finally {
        activeControllers.delete(controller);
        try {
          await buffer.flush();
        } catch (flushError) {
          console.error('Failed to flush buffered logs:', flushError);
        }
      }
    };

    // ── Initialization sequence ────────────────────────────────────
    const initialize = async () => {
      // Step 1: Hydrate from IndexedDB if we haven't already for this agent
      if (!idbHydrated.current && hasAgentChanged) {
        idbHydrated.current = true;
        try {
          const cached = await loadLogsFromIDB(selectedAgentID);
          if (cached && cached.logs.length > 0 && isMounted) {
            logStore.setLogs(cached.logs, true /* isCached */);
            // Restore position from IDB if we don't have one
            if (!logStore.hasPosition(selectedAgentID)) {
              logStore.setPosition(selectedAgentID, cached.position);
            }
            lastSuccessRef.current = Date.now();
            isFirstFetchRef.current = false;
          }
        } catch (err) {
          console.warn('Failed to hydrate from IndexedDB:', err);
        }
      }

      if (!isMounted || isPaused || !isTabVisible) return;

      // Step 2: Catch-up poll then stream
      await pollLogs(false);
      if (!isMounted || isPaused || !isTabVisible) return;
      await startStreaming();
    };

    if (!isPaused && isTabVisible) {
      void initialize();
    } else if (isTabVisible) {
      schedulePoll();
    }

    scheduleStaleCheck();

    return () => {
      isMounted = false;
      buffer.clear();
      abortActiveControllers();
      if (pollTimeout) clearTimeout(pollTimeout);
      if (staleInterval) clearInterval(staleInterval);
    };
    // maxLogsDisplay, maxSeenLogs are accessed via refs to prevent
    // effect re-fires that would reset position tracking and lose initial tail data
    // resetTrigger causes re-init when user clicks "Load recent"
  }, [config.refreshIntervalMs, isPaused, isTabVisible, selectedAgent?.id, selectedAgent?.name, storeState.resetTrigger]);

  // Trim logs when maxLogsDisplay config changes
  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    logStore.trimLogs(maxLogsDisplay);
  }, [maxLogsDisplay]);

  const resetAndLoadRecent = useCallback(() => {
    if (selectedAgent?.id) {
      // clearLogsFromIDB handles its own errors internally
      clearLogsFromIDB(selectedAgent.id);
      logStore.clearPosition(selectedAgent.id);
      logStore.clearLogs();
      logStore.requestReset();
    }
  }, [selectedAgent?.id]);

  return useMemo(() => ({
    logs: storeState.logs,
    loading: storeState.loading,
    error: storeState.error,
    connected: storeState.connected,
    lastUpdate: storeState.lastUpdate,
    isPaused,
    setIsPaused,
    agentId: storeState.agentId,
    agentName: storeState.agentName,
    dedupeDebug,
    isCatchingUp: storeState.isCatchingUp,
    isCached: storeState.isCached,
    resetAndLoadRecent,
  }), [storeState.logs, storeState.loading, storeState.error, storeState.connected, storeState.lastUpdate, isPaused, setIsPaused, storeState.agentId, storeState.agentName, dedupeDebug, storeState.isCatchingUp, storeState.isCached, resetAndLoadRecent]);
}
