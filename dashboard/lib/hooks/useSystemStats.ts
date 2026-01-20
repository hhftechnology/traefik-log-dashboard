import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { useTabVisibility } from './useTabVisibility';
import { SystemStats } from '@/lib/types';

export function useSystemStats(demoMode: boolean) {
  const [systemStats, setSystemStats] = useState<SystemStats | undefined>(undefined);
  
  // REDUNDANCY FIX: Use shared visibility hook
  const isTabVisible = useTabVisibility();

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    async function fetchSystemStats() {
      // PERFORMANCE FIX: Don't fetch when demo mode or tab not visible
      if (demoMode || !isTabVisible) return;

      try {
        // MEMORY LEAK FIX: Add abort signal support
        // Note: getSystemResources needs to support abort signal, will be handled in API route
        const data = await apiClient.getSystemResources();
        if (isMounted) {
          setSystemStats(data);
        }
      } catch (error) {
        // Don't log abort errors as they're expected
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        if (isMounted) {
          console.error('Failed to fetch system stats:', error);
        }
      }
    }

    fetchSystemStats();
    // PERFORMANCE FIX: Increased from 5s to 15s to reduce CPU load
    const interval = setInterval(fetchSystemStats, 15000);

    return () => {
      isMounted = false;
      abortController.abort();
      clearInterval(interval);
    };
  }, [demoMode, isTabVisible]);

  return systemStats;
}
