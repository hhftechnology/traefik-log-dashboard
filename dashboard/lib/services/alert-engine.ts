// Alert Evaluation Engine
// Evaluates alert rules and triggers notifications based on current metrics

import {
  getEnabledAlertRules,
  getWebhookById,
  addNotificationHistory,
  getLatestSnapshot,
} from '../db/database';
import { sendNotification } from './notification-service';
import { AlertRule, AlertData, AlertInterval } from '../types/alerting';
import { DashboardMetrics } from '../types';
import { MetricSnapshot } from '../types/metrics-snapshot';

// Track last execution time for each alert rule
// MEMORY LEAK FIX: TTL-based cleanup to prevent unbounded growth
const lastExecutionTimes = new Map<string, number>();
const MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 1000; // Maximum number of entries
const CLEANUP_INTERVAL = 60 * 60 * 1000; // Cleanup every hour

// Track alert execution intervals in milliseconds
const intervalMap: Record<AlertInterval, number> = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

// Start periodic cleanup
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Cleanup old entries from lastExecutionTimes map
 */
function cleanupExecutionTimes(): void {
  const now = Date.now();
  const entriesToDelete: string[] = [];

  // Remove entries older than MAX_CACHE_AGE
  for (const [alertId, timestamp] of lastExecutionTimes.entries()) {
    if (now - timestamp > MAX_CACHE_AGE) {
      entriesToDelete.push(alertId);
    }
  }

  entriesToDelete.forEach(id => lastExecutionTimes.delete(id));

  // If still too large, remove oldest entries (LRU strategy)
  if (lastExecutionTimes.size > MAX_CACHE_SIZE) {
    const sortedEntries = Array.from(lastExecutionTimes.entries())
      .sort((a, b) => a[1] - b[1]); // Sort by timestamp (oldest first)
    
    const toRemove = sortedEntries.slice(0, lastExecutionTimes.size - MAX_CACHE_SIZE);
    toRemove.forEach(([id]) => lastExecutionTimes.delete(id));
    
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[AlertEngine] Cleaned up ${toRemove.length} old execution time entries`);
    }
  }

  if (entriesToDelete.length > 0 && process.env.NODE_ENV === 'development') {
    console.warn(`[AlertEngine] Cleaned up ${entriesToDelete.length} expired execution time entries`);
  }
}

// Initialize cleanup interval (only in server context)
if (typeof window === 'undefined') {
  _cleanupInterval = setInterval(cleanupExecutionTimes, CLEANUP_INTERVAL);
  if (process.env.NODE_ENV === 'development') {
    console.warn('[AlertEngine] Execution times cleanup initialized (runs every hour)');
  }
}

/**
 * Alert Evaluation Engine
 * Evaluates alert rules against current metrics and triggers notifications
 */
export class AlertEngine {
  private isRunning = false;

  /**
   * Evaluate all enabled alert rules against current metrics
   */
  async evaluateAlerts(
    agentId: string,
    agentName: string,
    metrics: DashboardMetrics
  ): Promise<void> {
    if (this.isRunning) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Alert evaluation already in progress, skipping...');
      }
      return;
    }

    this.isRunning = true;

    try {
      const enabledAlerts = getEnabledAlertRules();
      const now = Date.now();

      for (const alert of enabledAlerts) {
        // Check if alert applies to this agent
        if (alert.agent_id && alert.agent_id !== agentId) {
          continue;
        }

        // Check if alert should trigger based on type
        const shouldTrigger = this.shouldTriggerAlert(alert, now);

        if (shouldTrigger) {
          await this.triggerAlert(alert, agentId, agentName, metrics);
          lastExecutionTimes.set(alert.id, now);
        }
      }
    } catch (error) {
      console.error('Error evaluating alerts:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Determine if an alert should trigger based on its configuration
   */
  private shouldTriggerAlert(alert: AlertRule, now: number): boolean {
    switch (alert.trigger_type) {
      case 'interval':
        return this.shouldTriggerIntervalAlert(alert, now);

      case 'threshold':
        // Threshold alerts always evaluate (threshold check happens in triggerAlert)
        return true;

      case 'event':
        // Event alerts always evaluate (event check happens in triggerAlert)
        return true;

      default:
        return false;
    }
  }

  /**
   * Check if interval-based alert should trigger
   */
  private shouldTriggerIntervalAlert(alert: AlertRule, now: number): boolean {
    if (!alert.interval) return false;

    const intervalMs = intervalMap[alert.interval];
    if (!intervalMs) return false;

    const lastExecution = lastExecutionTimes.get(alert.id);

    // If never executed, trigger immediately
    if (!lastExecution) return true;

    // Check if enough time has passed
    return now - lastExecution >= intervalMs;
  }

  /**
   * Check if threshold-based alert should trigger
   */
  private shouldTriggerThresholdAlert(
    alert: AlertRule,
    metrics: DashboardMetrics
  ): boolean {
    // Check if any threshold parameters are exceeded
    for (const param of alert.parameters) {
      if (!param.enabled || !param.threshold) continue;

      switch (param.parameter) {
        case 'error_rate':
          if (metrics.statusCodes?.errorRate > param.threshold) {
            return true;
          }
          break;

        case 'response_time':
          if (metrics.responseTime?.average > param.threshold) {
            return true;
          }
          break;

        case 'request_count':
          if (metrics.requests?.total > param.threshold) {
            return true;
          }
          break;
      }
    }

    return false;
  }

  /**
   * Trigger an alert by sending notifications to all configured webhooks
   */
  private async triggerAlert(
    alert: AlertRule,
    agentId: string,
    agentName: string,
    metrics: DashboardMetrics
  ): Promise<void> {
    // For threshold alerts, check if threshold is actually exceeded
    if (alert.trigger_type === 'threshold') {
      if (!this.shouldTriggerThresholdAlert(alert, metrics)) {
        return;
      }
    }

    // For interval alerts, use snapshot data instead of live metrics
    let alertData: AlertData;
    if (alert.trigger_type === 'interval' && alert.interval) {
      const snapshot = getLatestSnapshot(agentId, alert.interval);
      if (snapshot) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Using snapshot for interval alert: ${alert.interval}, window: ${snapshot.window_start} to ${snapshot.window_end}`);
        }
        alertData = this.buildAlertDataFromSnapshot(snapshot);
      } else {
        console.warn(`No snapshot found for interval ${alert.interval}, using live metrics`);
        alertData = this.buildAlertData(agentId, agentName, metrics);
      }
    } else {
      // For threshold and event alerts, use live metrics
      alertData = this.buildAlertData(agentId, agentName, metrics);
    }

    // Send to all webhooks
    for (const webhookId of alert.webhook_ids) {
      try {
        const webhook = getWebhookById(webhookId);
        if (!webhook || !webhook.enabled) {
          if (process.env.NODE_ENV === 'development') {
          console.warn(`Webhook ${webhookId} not found or disabled, skipping`);
        }
          continue;
        }

        if (process.env.NODE_ENV === 'development') {
          console.warn(`Sending alert "${alert.name}" to webhook "${webhook.name}"`);
        }

        const result = await sendNotification(
          webhook,
          alertData,
          alert.name,
          alert.parameters
        );

        // Log notification history
        addNotificationHistory({
          alert_rule_id: alert.id,
          webhook_id: webhookId,
          agent_id: agentId,
          status: result.success ? 'success' : 'failed',
          error_message: result.error,
          payload: JSON.stringify(alertData),
        });

        if (result.success) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`✓ Alert sent successfully to ${webhook.name}`);
          }
        } else {
          console.error(`✗ Failed to send alert to ${webhook.name}: ${result.error}`);
        }
      } catch (error) {
        console.error(`Error sending to webhook ${webhookId}:`, error);

        // Log failed notification
        addNotificationHistory({
          alert_rule_id: alert.id,
          webhook_id: webhookId,
          agent_id: agentId,
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          payload: JSON.stringify(alertData),
        });
      }
    }
  }

  /**
   * Build alert data from dashboard metrics
   */
  private buildAlertData(
    agentId: string,
    agentName: string,
    metrics: DashboardMetrics
  ): AlertData {
    return {
      timestamp: new Date().toISOString(),
      agent_name: agentName,
      agent_id: agentId,
      metrics: {
        top_ips: metrics.topClientIPs?.slice(0, 10).map(ip => ({
          ip: ip.ip,
          count: ip.count,
        })),
        top_locations: metrics.geoLocations?.slice(0, 10).map(loc => ({
          country: loc.country,
          city: loc.city,
          count: loc.count,
        })),
        top_routes: metrics.topRoutes?.slice(0, 10).map(route => ({
          path: route.path,
          count: route.count,
          avgDuration: route.avgDuration,
        })),
        top_status_codes: metrics.statusCodes
          ? [
              { status: 200, count: metrics.statusCodes.status2xx },
              { status: 300, count: metrics.statusCodes.status3xx },
              { status: 400, count: metrics.statusCodes.status4xx },
              { status: 500, count: metrics.statusCodes.status5xx },
            ].filter(s => s.count > 0)
          : undefined,
        top_user_agents: metrics.userAgents?.slice(0, 10).map(ua => ({
          browser: ua.browser,
          count: ua.count,
        })),
        top_routers: metrics.routers?.slice(0, 10).map(router => ({
          name: router.name,
          requests: router.requests,
        })),
        top_services: metrics.backends?.slice(0, 10).map(backend => ({
          name: backend.name,
          requests: backend.requests,
        })),
        top_hosts: metrics.topRequestHosts?.slice(0, 10).map(host => ({
          host: host.host,
          count: host.count,
        })),
        top_request_addresses: metrics.topRequestAddresses?.slice(0, 10).map(addr => ({
          addr: addr.addr,
          count: addr.count,
        })),
        top_client_ips: metrics.topClientIPs?.slice(0, 10).map(ip => ({
          ip: ip.ip,
          count: ip.count,
        })),
        error_rate: metrics.statusCodes?.errorRate,
        response_time: metrics.responseTime
          ? {
              average: metrics.responseTime.average,
              p95: metrics.responseTime.p95,
              p99: metrics.responseTime.p99,
            }
          : undefined,
        request_count: metrics.requests?.total,
      },
    };
  }

  /**
   * Build alert data from a metric snapshot
   * This provides clean, time-windowed data instead of cumulative metrics
   */
  private buildAlertDataFromSnapshot(snapshot: MetricSnapshot): AlertData {
    return {
      timestamp: snapshot.timestamp,
      agent_name: snapshot.agent_name,
      agent_id: snapshot.agent_id,
      metrics: {
        top_ips: snapshot.metrics.top_ips,
        top_locations: snapshot.metrics.top_locations,
        top_routes: snapshot.metrics.top_routes,
        top_status_codes: snapshot.metrics.status_codes
          ? [
              { status: 200, count: snapshot.metrics.status_codes.status2xx },
              { status: 300, count: snapshot.metrics.status_codes.status3xx },
              { status: 400, count: snapshot.metrics.status_codes.status4xx },
              { status: 500, count: snapshot.metrics.status_codes.status5xx },
            ].filter((s) => s.count > 0)
          : undefined,
        top_user_agents: snapshot.metrics.top_user_agents,
        top_routers: snapshot.metrics.top_routers,
        top_services: snapshot.metrics.top_services,
        top_hosts: snapshot.metrics.top_hosts,
        top_request_addresses: snapshot.metrics.top_request_addresses,
        top_client_ips: snapshot.metrics.top_client_ips,
        error_rate: snapshot.metrics.error_rate,
        response_time: snapshot.metrics.response_time,
        request_count: snapshot.metrics.request_count,
      },
    };
  }

  /**
   * Reset execution times (useful for testing)
   */
  resetExecutionTimes(): void {
    lastExecutionTimes.clear();
  }

  /**
   * Get last execution time for an alert
   */
  getLastExecutionTime(alertId: string): number | undefined {
    return lastExecutionTimes.get(alertId);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; oldestEntry: number | null } {
    const entries = Array.from(lastExecutionTimes.values());
    return {
      size: lastExecutionTimes.size,
      maxSize: MAX_CACHE_SIZE,
      oldestEntry: entries.length > 0 ? Math.min(...entries) : null,
    };
  }

  /**
   * Manually trigger cleanup
   */
  cleanup(): void {
    cleanupExecutionTimes();
  }
}

// Singleton instance
export const alertEngine = new AlertEngine();
