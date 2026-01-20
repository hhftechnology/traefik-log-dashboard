import { getAllAgents } from '../db/database';
import { calculateMetrics } from '../utils/metric-calculator';
import { parseTraefikLogs } from '../traefik-parser';
import { serviceManager } from './service-manager';
import { TraefikLog } from '../types';

// PERFORMANCE FIX: Increased from 5min to 30min to reduce CPU/memory load
const SCHEDULER_INTERVAL = 30 * 60 * 1000; // 30 minutes

class BackgroundScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private startTime: Date | null = null;
  private lastRunTime: Date | null = null;
  private runCount = 0;
  private errorCount = 0;

  /**
   * Start the background scheduler
   * FIX: Ensure scheduler runs immediately on start for Issue #122
   */
  start() {
    if (this.intervalId) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Scheduler] Already running');
      }
      return;
    }

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
      nextRunIn: this.intervalId ? SCHEDULER_INTERVAL : null,
    };
  }

  private async runJob() {
    if (this.isRunning) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Scheduler] Previous job still running, skipping this cycle');
      }
      return;
    }
    
    this.isRunning = true;
    const runStartTime = new Date();

    try {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Scheduler] Running background metrics processing at ${runStartTime.toISOString()}...`);
      }
      const agents = getAllAgents();
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Scheduler] Found ${agents.length} agents to process`);
      }

      if (agents.length === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Scheduler] No agents configured, skipping run');
        }
        return;
      }

      let processedCount = 0;
      let skippedCount = 0;

      for (const agent of agents) {
        if (agent.status === 'offline') {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[Scheduler] Skipping offline agent: ${agent.name}`);
          }
          skippedCount++;
          continue;
        }

        try {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[Scheduler] Fetching logs for agent: ${agent.name} (${agent.url})`);
          }
          // Fetch logs
          const logs = await this.fetchLogs(agent.url, agent.token);
          
          if (logs.length === 0) {
            if (process.env.NODE_ENV === 'development') {
              console.warn(`[Scheduler] No new logs for agent: ${agent.name}`);
            }
            skippedCount++;
            continue;
          }

          if (process.env.NODE_ENV === 'development') {
            console.warn(`[Scheduler] Processing ${logs.length} logs for agent: ${agent.name}`);
          }

          // Calculate metrics
          // Note: We don't have geo-location in background yet, passing empty array
          // This is fine for alerts that don't depend on geo-location
          const metrics = calculateMetrics(logs, []);

          // Process metrics (triggers alerts)
          await serviceManager.processMetrics(agent.id, agent.name, metrics, logs);
          
          processedCount++;
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[Scheduler] ✓ Successfully processed metrics for agent ${agent.name} (${agent.id})`);
          }
        } catch (error) {
          this.errorCount++;
          console.error(`[Scheduler] ✗ Error processing agent ${agent.name}:`, error);
        }
      }

      this.lastRunTime = new Date();
      this.runCount++;
      const duration = this.lastRunTime.getTime() - runStartTime.getTime();
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Scheduler] Run completed: ${processedCount} processed, ${skippedCount} skipped, ${this.errorCount} errors total, took ${duration}ms`);
      }
    } catch (error) {
      this.errorCount++;
      console.error('[Scheduler] ✗ Fatal error in background scheduler:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async fetchLogs(url: string, token: string): Promise<TraefikLog[]> {
    try {
      // Ensure URL doesn't end with slash
      const baseUrl = url.replace(/\/$/, '');
      
      // FIX for Issue #122: Better URL resolution for containerized deployments
      // If running in container and url is localhost, provide helpful warning and try alternatives
      if (typeof window === 'undefined' && (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1'))) {
        // In containerized environments, localhost won't work for inter-service communication
        // Log warning with helpful information
        const dockerServiceName = process.env.AGENT_SERVICE_NAME || 'traefik-agent';
        console.warn(`[Scheduler] Agent URL contains localhost (${baseUrl}).`);
        console.warn(`[Scheduler] In containerized deployments, use service names (e.g., http://${dockerServiceName}:5000) instead of localhost.`);
        console.warn(`[Scheduler] Attempting fetch anyway - this may fail in containerized environments.`);
        
        // Note: We don't automatically replace localhost because we can't know the correct service name
        // User should configure agents with proper service names or host.docker.internal if needed
      }

      const endpoint = `${baseUrl}/api/logs/access`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Failed to fetch logs: ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        const lines = text.split('\n').filter(line => line.trim());
        
        return parseTraefikLogs(lines);
      } catch (fetchError: unknown) {
        clearTimeout(timeoutId);
        
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error(`Request timeout after 30s for ${baseUrl}`);
        }
        throw fetchError;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Scheduler] Failed to fetch logs from ${url}:`, errorMessage);
      return [];
    }
  }
}

export const backgroundScheduler = new BackgroundScheduler();
