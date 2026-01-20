/**
 * Shared log utility functions
 * Consolidated to eliminate duplicate sorting logic across components
 */

import { TraefikLog } from '../types';

/**
 * Sort logs by time (most recent first) and limit to specified count
 * Used by Dashboard, useGeoLocation, and RecentLogsTable
 */
export function sortLogsByTime(logs: TraefikLog[], limit?: number): TraefikLog[] {
  if (logs.length === 0) return [];

  const sorted = [...logs].sort((a, b) => {
    const timeA = new Date(a.StartUTC || a.StartLocal).getTime();
    const timeB = new Date(b.StartUTC || b.StartLocal).getTime();
    return timeB - timeA; // Most recent first
  });

  if (limit !== undefined && limit > 0) {
    return sorted.slice(0, limit);
  }

  return sorted;
}

