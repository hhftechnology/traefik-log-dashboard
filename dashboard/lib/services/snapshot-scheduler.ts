// Snapshot Scheduler Service
// Periodically creates metric snapshots for all configured intervals

import { AlertInterval } from '../types/alerting';
import { TraefikLog } from '../types';
import { createSnapshotsForIntervals } from './metric-snapshot-service';
import { saveMetricSnapshot } from '../db/database';

/**
 * Interval durations in milliseconds
 */
const intervalDurations: Record<AlertInterval, number> = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

/**
 * Track last snapshot creation time for each interval
 * MEMORY LEAK FIX: Add cleanup to prevent unbounded growth
 */
const lastSnapshotTimes = new Map<string, number>();
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CACHE_SIZE = 1000;
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // Cleanup daily

/**
 * Cleanup old snapshot times
 */
function cleanupSnapshotTimes(): void {
  const now = Date.now();
  const entriesToDelete: string[] = [];

  // Remove entries older than MAX_CACHE_AGE
  for (const [key, timestamp] of lastSnapshotTimes.entries()) {
    if (now - timestamp > MAX_CACHE_AGE) {
      entriesToDelete.push(key);
    }
  }

  entriesToDelete.forEach(key => lastSnapshotTimes.delete(key));

  // If still too large, remove oldest entries
  if (lastSnapshotTimes.size > MAX_CACHE_SIZE) {
    const sortedEntries = Array.from(lastSnapshotTimes.entries())
      .sort((a, b) => a[1] - b[1]);
    
    const toRemove = sortedEntries.slice(0, lastSnapshotTimes.size - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => lastSnapshotTimes.delete(key));
    
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[SnapshotScheduler] Cleaned up ${toRemove.length} old snapshot time entries`);
    }
  }

  if (entriesToDelete.length > 0 && process.env.NODE_ENV === 'development') {
    console.warn(`[SnapshotScheduler] Cleaned up ${entriesToDelete.length} expired snapshot time entries`);
  }
}

// Initialize cleanup interval (only in server context)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _cleanupInterval: NodeJS.Timeout | null = null;
if (typeof window === 'undefined') {
  _cleanupInterval = setInterval(cleanupSnapshotTimes, CLEANUP_INTERVAL);
  if (process.env.NODE_ENV === 'development') {
    console.warn('[SnapshotScheduler] Snapshot times cleanup initialized (runs daily)');
  }
}

/**
 * Snapshot Scheduler
 * Creates metric snapshots at configured intervals
 */
export class SnapshotScheduler {
  private isRunning = false;
  private intervals: AlertInterval[] = ['5m', '15m', '30m', '1h', '6h', '12h', '24h'];

  /**
   * Process logs and create snapshots if needed
   * @param agentId - Agent identifier
   * @param agentName - Agent name
   * @param logs - All available logs
   */
  async processLogs(
    agentId: string,
    agentName: string,
    logs: TraefikLog[]
  ): Promise<void> {
    if (this.isRunning) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Snapshot creation already in progress, skipping...');
      }
      return;
    }

    this.isRunning = true;

    try {
      const now = Date.now();
      const intervalsToSnapshot: AlertInterval[] = [];

      // CONCURRENCY FIX: Create a snapshot of the map to avoid iteration issues
      // Check which intervals need new snapshots
      const currentSnapshotTimes = new Map(lastSnapshotTimes); // Defensive copy
      
      for (const interval of this.intervals) {
        const key = `${agentId}-${interval}`;
        const lastTime = currentSnapshotTimes.get(key);
        const intervalMs = intervalDurations[interval];

        // Create snapshot if:
        // 1. Never created before, OR
        // 2. Enough time has passed since last snapshot
        if (!lastTime || now - lastTime >= intervalMs) {
          intervalsToSnapshot.push(interval);
        }
      }

      if (intervalsToSnapshot.length === 0) {
        return;
      }

      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `Creating snapshots for agent ${agentName} (${agentId}): ${intervalsToSnapshot.join(', ')}`
        );
      }

      // Create snapshots for all intervals that need updating
      const snapshots = createSnapshotsForIntervals(
        logs,
        agentId,
        agentName,
        intervalsToSnapshot
      );

      // Save snapshots to database
      for (const snapshot of snapshots) {
        try {
          saveMetricSnapshot(snapshot);
          // CONCURRENCY FIX: Safe write after all reads are complete
          const key = `${agentId}-${snapshot.interval}`;
          lastSnapshotTimes.set(key, now);

          if (process.env.NODE_ENV === 'development') {
            console.warn(
              `✓ Created snapshot for interval ${snapshot.interval}: ${snapshot.log_count} logs from ${snapshot.window_start} to ${snapshot.window_end}`
            );
          }
        } catch (error) {
          console.error(`Failed to save snapshot for ${snapshot.interval}:`, error);
        }
      }
    } catch (error) {
      console.error('Error creating snapshots:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Set which intervals to create snapshots for
   * @param intervals - List of intervals to monitor
   */
  setIntervals(intervals: AlertInterval[]): void {
    this.intervals = intervals;
  }

  /**
   * Reset snapshot times (useful for testing)
   */
  resetSnapshotTimes(): void {
    lastSnapshotTimes.clear();
  }

  /**
   * Get last snapshot time for an agent and interval
   */
  getLastSnapshotTime(agentId: string, interval: AlertInterval): number | undefined {
    const key = `${agentId}-${interval}`;
    // CONCURRENCY FIX: Safe read from map
    return lastSnapshotTimes.get(key);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; oldestEntry: number | null } {
    const entries = Array.from(lastSnapshotTimes.values());
    return {
      size: lastSnapshotTimes.size,
      maxSize: MAX_CACHE_SIZE,
      oldestEntry: entries.length > 0 ? Math.min(...entries) : null,
    };
  }

  /**
   * Manually trigger cleanup
   */
  cleanup(): void {
    cleanupSnapshotTimes();
  }
}

// Singleton instance
export const snapshotScheduler = new SnapshotScheduler();
