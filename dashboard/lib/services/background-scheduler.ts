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
      console.log('Running background metrics processing...');
      const agents = getAllAgents();

      for (const agent of agents) {
        if (agent.status === 'offline') continue;

        try {
          // Fetch logs
          const logs = await this.fetchLogs(agent.url, agent.token);
          
          if (logs.length === 0) continue;

          // Calculate metrics
          // Note: We don't have geo-location in background yet, passing empty array
          // This is fine for alerts that don't depend on geo-location
          const metrics = calculateMetrics(logs, []);

          // Process metrics (triggers alerts)
          await serviceManager.processMetrics(agent.id, agent.name, metrics, logs);
          
          console.log(`Processed metrics for agent ${agent.name} (${agent.id})`);
        } catch (error) {
          console.error(`Error processing agent ${agent.name}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in background scheduler:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async fetchLogs(url: string, token: string): Promise<TraefikLog[]> {
    try {
      // Ensure URL doesn't end with slash
      const baseUrl = url.replace(/\/$/, '');
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
      console.error(`Failed to fetch logs from ${url}:`, error);
      return [];
    }
  }
}

export const backgroundScheduler = new BackgroundScheduler();
