// Custom hook for processing metrics with alert, snapshot, and archival services
import { useEffect, useRef } from 'react';
import { buildUrl } from '@/lib/utils/base-url';
import { DashboardMetrics, TraefikLog } from '../types';

interface UseMetricsProcessingOptions {
  enabled?: boolean;
  debounceMs?: number;
}

/**
 * Hook to automatically process metrics for alerts, snapshots, and archival
 * Use this in your dashboard component to enable automatic alert evaluation and archival
 */
export function useMetricsProcessing(
  agentId: string | null,
  agentName: string | null,
  metrics: DashboardMetrics | null,
  logs: TraefikLog[] | null,
  options: UseMetricsProcessingOptions = {}
) {
  // PERFORMANCE FIX: Increased default debounce from 5s to 10s to match new polling intervals
  const { enabled = true, debounceMs = 10000 } = options;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedRef = useRef<string>('');

  useEffect(() => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Don't process if disabled or missing data
    if (!enabled || !agentId || !agentName || !metrics) {
      return;
    }

    // PERFORMANCE FIX: Create a hash of current metrics WITHOUT timestamp
    // Including timestamp caused every call to be treated as new (defeating deduplication)
    const metricsHash = JSON.stringify({
      agentId,
      requestCount: metrics.requests?.total,
      errorRate: metrics.statusCodes?.errorRate,
      avgResponseTime: metrics.responseTime?.average,
    });

    // Skip if we just processed the same metrics
    if (metricsHash === lastProcessedRef.current) {
      return;
    }

    // Debounce the processing
    timeoutRef.current = setTimeout(async () => {
      try {
        await fetch(buildUrl('/api/services/process-metrics'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId,
            agentName,
            metrics,
            logs: logs || [], // Include logs for snapshot creation
          }),
        });

        lastProcessedRef.current = metricsHash;
      } catch (error) {
        console.error('Failed to process metrics:', error);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [agentId, agentName, metrics, logs, enabled, debounceMs]);
}
