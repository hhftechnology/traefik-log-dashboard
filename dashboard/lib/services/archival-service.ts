// Historical Data Archival Service
// Periodically archives metrics to historical database

import {
  getHistoricalConfig,
  addHistoricalData,
  cleanupHistoricalData,
} from '../db/historical-database';
import { getAllAgents } from '../db/database';
import { DashboardMetrics } from '../types';

/**
 * Archival Service
 * Automatically archives dashboard metrics to historical database at configured intervals
 */
export class ArchivalService {
  private archivalInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isArchiving = false;
  private metricsCache = new Map<string, DashboardMetrics>();

  /**
   * Start the archival service
   */
  start(): void {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Starting Historical Data Archival Service...');
    }

    const config = getHistoricalConfig();

    if (!config.enabled) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Historical data storage is disabled');
      }
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `Archival Service configured: interval=${config.archive_interval}min, retention=${config.retention_days}days`
      );
    }

    // Start archival interval
    this.archivalInterval = setInterval(
      () => this.archiveMetrics(),
      config.archive_interval * 60 * 1000
    );

    // Start cleanup interval (run daily)
    this.cleanupInterval = setInterval(
      () => this.performCleanup(),
      24 * 60 * 60 * 1000
    );

    // Initial archive on startup (after 30 seconds to allow metrics to populate)
    setTimeout(() => this.archiveMetrics(), 30000);

    if (process.env.NODE_ENV === 'development') {
      console.warn('✓ Archival Service started successfully');
    }
  }

  /**
   * Stop the archival service
   */
  stop(): void {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Stopping Historical Data Archival Service...');
    }

    if (this.archivalInterval) {
      clearInterval(this.archivalInterval);
      this.archivalInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.metricsCache.clear();

    if (process.env.NODE_ENV === 'development') {
      console.warn('✓ Archival Service stopped');
    }
  }

  /**
   * Restart the service (useful when config changes)
   */
  restart(): void {
    this.stop();
    this.start();
  }

  /**
   * Check if the service is running
   */
  isRunning(): boolean {
    return this.archivalInterval !== null;
  }

  /**
   * Update metrics cache for an agent
   * This should be called from the dashboard when metrics are calculated
   * CONCURRENCY FIX: Safe write operation
   */
  updateMetricsCache(agentId: string, metrics: DashboardMetrics): void {
    // Defensive: limit cache size to prevent memory leaks
    if (this.metricsCache.size > 100) {
      // Remove oldest entry (simple FIFO, could be improved with LRU)
      const firstKey = this.metricsCache.keys().next().value;
      if (firstKey) {
        this.metricsCache.delete(firstKey);
      }
    }
    this.metricsCache.set(agentId, metrics);
  }

  /**
   * Get cached metrics for an agent
   */
  getCachedMetrics(agentId: string): DashboardMetrics | undefined {
    return this.metricsCache.get(agentId);
  }

  /**
   * Archive current metrics for all agents
   */
  private async archiveMetrics(): Promise<void> {
    if (this.isArchiving) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Archival already in progress, skipping...');
      }
      return;
    }

    this.isArchiving = true;

    try {
      const config = getHistoricalConfig();

      if (!config.enabled) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Historical data storage is disabled, stopping service');
        }
        this.stop();
        return;
      }

      const agents = getAllAgents();
      let archivedCount = 0;

      for (const agent of agents) {
        try {
          const metrics = this.metricsCache.get(agent.id);

          if (!metrics) {
            if (process.env.NODE_ENV === 'development') {
              console.warn(`No metrics cached for agent ${agent.name} (${agent.id}), skipping`);
            }
            continue;
          }

          // Archive the metrics
          addHistoricalData(agent.id, metrics);
          archivedCount++;

          if (process.env.NODE_ENV === 'development') {
            console.warn(`✓ Archived metrics for agent: ${agent.name}`);
          }
        } catch (error) {
          console.error(`Failed to archive metrics for agent ${agent.id}:`, error);
        }
      }

      if (archivedCount > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`✓ Successfully archived metrics for ${archivedCount} agent(s)`);
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn('No metrics were archived (no cached data available)');
        }
      }
    } catch (error) {
      console.error('Error during archival:', error);
    } finally {
      this.isArchiving = false;
    }
  }

  /**
   * Perform cleanup of old historical data
   */
  private async performCleanup(): Promise<void> {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Running historical data cleanup...');
      }

      const deletedCount = cleanupHistoricalData();

      if (deletedCount > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`✓ Cleaned up ${deletedCount} old historical entries`);
        }
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn('No old entries to clean up');
        }
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Manually trigger archival (useful for testing)
   */
  async triggerArchival(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Manual archival triggered');
    }
    await this.archiveMetrics();
  }

  /**
   * Manually trigger cleanup (useful for testing)
   */
  async triggerCleanup(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Manual cleanup triggered');
    }
    await this.performCleanup();
  }

  /**
   * Get service status
   */
  getStatus(): {
    running: boolean;
    enabled: boolean;
    cachedAgents: number;
    archiving: boolean;
  } {
    const config = getHistoricalConfig();

    return {
      running: this.isRunning(),
      enabled: config.enabled,
      cachedAgents: this.metricsCache.size,
      archiving: this.isArchiving,
    };
  }
}

// Singleton instance
export const archivalService = new ArchivalService();
