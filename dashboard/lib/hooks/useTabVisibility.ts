/**
 * Shared hook for tab visibility tracking
 * Consolidates duplicate visibility listener patterns across hooks
 */

import { useState, useEffect } from 'react';

/**
 * Hook to track whether the browser tab is currently visible
 * Pauses polling/updates when tab is hidden to improve performance
 * 
 * @returns boolean indicating if tab is visible
 */
export function useTabVisibility(): boolean {
  const [isTabVisible, setIsTabVisible] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return isTabVisible;
}

