/**
 * React hook for debouncing values
 * Replaces standalone debounce function with proper cleanup
 */

import { useState, useEffect } from 'react';

/**
 * Hook to debounce a value
 * Useful for search inputs, API calls, etc.
 * 
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 500)
 * @returns Debounced value
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Set up timeout to update debounced value
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup timeout on unmount or when value/delay changes
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

