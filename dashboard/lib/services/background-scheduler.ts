import { getAllAgents, getAgentById } from '../db/database';
import { calculateMetrics } from '../utils/metric-calculator';
import { parseTraefikLogs } from '../traefik-parser';
import { serviceManager } from './service-manager';
import { TraefikLog } from '../types';

const SCHEDULER_INTERVAL = 5 * 60 * 1000; // 5 minutes

class BackgroundScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  start() {
    if (this.intervalId) return;

    console.log('Starting background scheduler...');
    
    // Run immediately on start
    this.runJob();

    // Schedule periodic runs
    this.intervalId = setInterval(() => {
      this.runJob();
    }, SCHEDULER_INTERVAL);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async runJob() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      console.log(`[Scheduler] Running background metrics processing at ${new Date().toISOString()}...`);
      const agents = getAllAgents();
      console.log(`[Scheduler] Found ${agents.length} agents to process`);

      for (const agent of agents) {
        if (agent.status === 'offline') {
            console.log(`[Scheduler] Skipping offline agent: ${agent.name}`);
            continue;
        }

        try {
          console.log(`[Scheduler] Fetching logs for agent: ${agent.name} (${agent.url})`);
          // Fetch logs
          const logs = await this.fetchLogs(agent.url, agent.token);
          
          if (logs.length === 0) {
            console.log(`[Scheduler] No new logs for agent: ${agent.name}`);
            continue;
          }

          console.log(`[Scheduler] Processing ${logs.length} logs for agent: ${agent.name}`);

          // Calculate metrics
          // Note: We don't have geo-location in background yet, passing empty array
          // This is fine for alerts that don't depend on geo-location
          const metrics = calculateMetrics(logs, []);

          // Process metrics (triggers alerts)
          await serviceManager.processMetrics(agent.id, agent.name, metrics, logs);
          
          console.log(`[Scheduler] Successfully processed metrics for agent ${agent.name} (${agent.id})`);
        } catch (error) {
          console.error(`[Scheduler] Error processing agent ${agent.name}:`, error);
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error in background scheduler:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async fetchLogs(url: string, token: string): Promise<TraefikLog[]> {
    try {
      // Ensure URL doesn't end with slash
      let baseUrl = url.replace(/\/$/, '');
      
      // FIX: If running in container and url is localhost, try to use host.docker.internal or service name
      // This is a common issue when running dashboard in container but agent is on host or another container
      if (process.env.NODE_ENV === 'production' && (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1'))) {
         // In docker-compose, we should use the service name 'traefik-agent' if it's the default agent
         // But we can't easily know if this specific agent is the one in docker-compose.
         // However, if the user manually added 'localhost', it won't work from inside container.
         console.warn(`[Scheduler] Warning: Agent URL contains localhost (${baseUrl}). This might fail inside Docker.`);
      }

      const endpoint = `${baseUrl}/api/logs/access`;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        // Set a reasonable timeout
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      return parseTraefikLogs(lines);
    } catch (error) {
      console.error(`[Scheduler] Failed to fetch logs from ${url}:`, error);
      return [];
    }
  }
}

export const backgroundScheduler = new BackgroundScheduler();
