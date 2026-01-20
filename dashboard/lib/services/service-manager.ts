// Service Manager
// Centralized manager for alert engine, archival service, and snapshot scheduler

import { alertEngine } from './alert-engine';
import { archivalService } from './archival-service';
import { snapshotScheduler } from './snapshot-scheduler';
import { DashboardMetrics } from '../types';
import { TraefikLog } from '../types';

/**
 * Service Manager
 * Manages lifecycle and coordination of alert engine and archival service
 */
export class ServiceManager {
  private static instance: ServiceManager | null = null;
  private initialized = false;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  /**
   * Initialize all services
   */
  initialize(): void {
    if (this.initialized) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Services already initialized');
      }
      return;
    }

    try {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Initializing Traefik Log Dashboard Services...');
      }

      // Start archival service
      archivalService.start();

      this.initialized = true;
      if (process.env.NODE_ENV === 'development') {
        console.warn('✓ All services initialized successfully');
      }
    } catch (error) {
      console.error('Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * Shutdown all services
   */
  shutdown(): void {
    if (!this.initialized) {
      return;
    }

    try {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Shutting down services...');
      }

      // Stop archival service
      archivalService.stop();

      this.initialized = false;
      if (process.env.NODE_ENV === 'development') {
        console.warn('✓ All services shut down successfully');
      }
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }

  /**
   * Process metrics - update cache, create snapshots, and evaluate alerts
   * This should be called whenever new metrics are calculated
   */
  async processMetrics(
    agentId: string,
    agentName: string,
    metrics: DashboardMetrics,
    logs?: TraefikLog[]
  ): Promise<void> {
    try {
      // Update metrics cache for archival service
      archivalService.updateMetricsCache(agentId, metrics);

      // Create snapshots if logs are provided
      if (logs && logs.length > 0) {
        await snapshotScheduler.processLogs(agentId, agentName, logs);
      }

      // Evaluate alerts (will use snapshots for interval alerts)
      await alertEngine.evaluateAlerts(agentId, agentName, metrics);
    } catch (error) {
      console.error('Error processing metrics:', error);
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean;
    archivalService: ReturnType<typeof archivalService.getStatus>;
  } {
    return {
      initialized: this.initialized,
      archivalService: archivalService.getStatus(),
    };
  }

  /**
   * Check if services are initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Restart archival service (useful when configuration changes)
   */
  restartArchivalService(): void {
    archivalService.restart();
  }

  /**
   * Manually trigger archival
   */
  async triggerArchival(): Promise<void> {
    await archivalService.triggerArchival();
  }

  /**
   * Manually trigger cleanup
   */
  async triggerCleanup(): Promise<void> {
    await archivalService.triggerCleanup();
  }
}

// Export singleton instance
export const serviceManager = ServiceManager.getInstance();

// Auto-initialize in server context
if (typeof window === 'undefined') {
  try {
    serviceManager.initialize();
    if (process.env.NODE_ENV === 'development') {
      console.warn('Service Manager auto-initialized');
    }
  } catch (error) {
    console.error('Failed to auto-initialize services:', error);
  }
}
