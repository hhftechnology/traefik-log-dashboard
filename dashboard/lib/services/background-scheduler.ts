import { getAllAgents } from '../db/database';
import { calculateMetrics } from '../utils/metric-calculator';
import { parseTraefikLogs } from '../traefik-parser';
import { serviceManager } from './service-manager';
import { getLogCursor, setLogCursor } from '../db/database';
import { TraefikLog } from '../types';

// 5-minute tick is correct for the snapshot granularity the system needs.
// Do NOT reduce this further — each tick produces a snapshot row, so lower
// values mean more rows and more DB writes with no benefit.
const SCHEDULER_INTERVAL = 5 * 60 * 1000;

// How far back to look on the very first run (no cursor stored yet).
// This seeds the snapshot table without pulling unbounded history.
const INITIAL_LOOKBACK_MS = 15 * 60 * 1000; // 15 minutes

class BackgroundScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private startTime: Date | null = null;
  private lastRunTime: Date | null = null;
  private runCount = 0;
  private errorCount = 0;

  start() {
    if (this.intervalId) return;   // idempotent

    this.startTime = new Date();
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Scheduler] Starting background scheduler (30min interval)...');
      console.warn(`[Scheduler] Initial run will execute immediately, then every ${SCHEDULER_INTERVAL / 1000 / 60} minutes`);
    }

    // FIX for Issue #122: Run immediately on start to ensure alerts trigger without dashboard being open
    // This ensures the scheduler doesn't wait 30 minutes before first run
    this.runJob().catch(err => {
      console.error('[Scheduler] Error in initial run:', err);
    });

    // Schedule periodic runs
    this.intervalId = setInterval(() => {
      this.runJob().catch(err => {
        console.error('[Scheduler] Error in scheduled run:', err);
      });
    }, SCHEDULER_INTERVAL);

    if (process.env.NODE_ENV === 'development') {
      console.warn('[Scheduler] Background scheduler started successfully');
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Scheduler] Background scheduler stopped');
      }
    }
  }

  /**
   * Get scheduler health status
   */
  getStatus() {
    return {
      isRunning: this.intervalId !== null,
      startTime: this.startTime,
      lastRunTime: this.lastRunTime,
      runCount: this.runCount,
      errorCount: this.errorCount,
      isCurrentlyRunning: this.isRunning,
    };
  }

  /**
   * Run the scheduler job immediately (cron/ops trigger)
   */
  async runOnce() {
    await this.runJob();
  }

  private async runJob() {
    if (this.isRunning) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Scheduler] Previous job still running, skipping this cycle');
      }
      return;
    }

    this.isRunning = true;
    const runStart = Date.now();

    try {
      const agents = getAllAgents();
      if (agents.length === 0) return;

      for (const agent of agents) {
        if (agent.status === 'offline') continue;

        try {
          // FIX: fetch only logs since the last cursor, not all logs.
          const { logs, newCursor } = await this.fetchLogsSince(
            agent.id, agent.url, agent.token
          );

          if (logs.length === 0) continue;

          // Advance cursor so next tick doesn't re-fetch these logs.
          setLogCursor(agent.id, newCursor);

          const metrics = calculateMetrics(logs, []);
          await serviceManager.processMetrics(agent.id, agent.name, metrics, logs);
        } catch (err) {
          this.errorCount++;
          console.error(`[Scheduler] ✗ Error processing agent ${agent.name}:`, err);
        }
      }

      this.lastRunTime = new Date();
      this.runCount++;

      if (process.env.NODE_ENV === 'development') {
        console.log(`[Scheduler] Run ${this.runCount} done in ${Date.now() - runStart}ms`);
      }
    } catch (err) {
      this.errorCount++;
      console.error('[Scheduler] Fatal error:', err);
    } finally {
      this.isRunning = false;
    }
  }

  // FIX: passes ?since= to the agent so only new log lines are returned.
  // Returns the new cursor (= the timestamp of the newest log in this batch).
  private async fetchLogsSince(
    agentId: string,
    url: string,
    token: string
  ): Promise<{ logs: TraefikLog[]; newCursor: string }> {
    const baseUrl = url.replace(/\/$/, '');

    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      console.warn(
        `[Scheduler] Agent URL "${baseUrl}" uses localhost. ` +
        `If running inside Docker, this will not reach the host machine. ` +
        `Use host.docker.internal or container service name instead.`
      );
    }

    // Load the stored cursor, or default to INITIAL_LOOKBACK_MS ago.
    const storedCursor = getLogCursor(agentId);
    const since = storedCursor
      ? storedCursor
      : new Date(Date.now() - INITIAL_LOOKBACK_MS).toISOString();

    // The agent's /api/logs/access endpoint already accepts ?start= for
    // time-range filtering (visible in agent/internal/routes).
    const endpoint = `${baseUrl}/api/logs/access?start=${encodeURIComponent(since)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      const lines = text.split('\n').filter(l => l.trim());
      const logs = parseTraefikLogs(lines);

      // The new cursor is the latest log timestamp in this batch.
      // If the batch is empty the cursor stays where it was.
      let newCursor = since;
      if (logs.length > 0) {
        const timestamps = logs
          .map(l => (l as any).timestamp ?? (l as any).time ?? '')
          .filter(Boolean)
          .sort();
        if (timestamps.length > 0) {
          newCursor = timestamps[timestamps.length - 1];
        }
      }

      return { logs, newCursor };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Request timeout after 30s for ${baseUrl}`);
      }
      throw err;
    }
  }
}

export const backgroundScheduler = new BackgroundScheduler();

/**
 * Call this from instrumentation.ts (Next.js server startup), NOT from a
 * route handler or React component.  If called from a route handler the
 * scheduler only starts when that route is first hit, which may be never.
 *
 * instrumentation.ts (place in project root):
 *
 *   export async function register() {
 *     if (process.env.NEXT_RUNTIME === 'nodejs') {
 *       const { ensureSchedulerStarted } = await import('./lib/services/background-scheduler');
 *       ensureSchedulerStarted();
 *     }
 *   }
 */
export function ensureSchedulerStarted() {
  serviceManager.initialize();
}