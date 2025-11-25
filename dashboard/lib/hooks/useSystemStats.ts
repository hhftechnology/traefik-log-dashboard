import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

export function useSystemStats(demoMode: boolean) {
  const [systemStats, setSystemStats] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchSystemStats() {
      if (demoMode) return;

      try {
        const data = await apiClient.getSystemResources();
        if (isMounted) {
          setSystemStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch system stats:', error);
      }
    }

    fetchSystemStats();
    const interval = setInterval(fetchSystemStats, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [demoMode]);

  return systemStats;
}
