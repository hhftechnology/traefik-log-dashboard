// Alert Evaluation Engine
// Evaluates alert rules and triggers notifications based on current metrics

import {
  addNotificationHistory,
  getEnabledAlertRules,
  getLatestSnapshot,
  getWebhookById,
} from '../db/database';
import { sendNotification } from './notification-service';
import { AlertData, AlertInterval, AlertRule } from '../types/alerting';
import { DashboardMetrics } from '../types';
import { MetricSnapshot } from '../types/metrics-snapshot';

type AlertExecutionState = {
  lastTriggeredAt?: number;
  thresholdActive?: boolean;
};

type AlertQueueState = {
  inFlight: Promise<void> | null;
};

const intervalMap: Record<AlertInterval, number> = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

const MAX_STATE_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_STATE_ENTRIES = 2000;

/**
 * Alert Evaluation Engine
 * Evaluates alert rules against current metrics and triggers notifications
 */
export class AlertEngine {
  private executionState = new Map<string, AlertExecutionState>();
  private agentQueues = new Map<string, AlertQueueState>();

  /**
   * Evaluate all enabled alert rules against current metrics
   */
  async evaluateAlerts(
    agentId: string,
    agentName: string,
    metrics: DashboardMetrics
  ): Promise<void> {
    const queue = this.getAgentQueue(agentId);
    const previous = queue.inFlight ?? Promise.resolve();

    const run = previous
      .catch(() => undefined)
      .then(() => this.runEvaluation(agentId, agentName, metrics));

    queue.inFlight = run;

    run.finally(() => {
      if (queue.inFlight === run) {
        queue.inFlight = null;
      }
    });

    return run;
  }

  /**
   * Reset execution times and active threshold states (useful for testing)
   */
  resetExecutionTimes(): void {
    this.executionState.clear();
  }

  /**
   * Get last execution time for an alert
   */
  getLastExecutionTime(alertId: string): number | undefined {
    return this.executionState.get(alertId)?.lastTriggeredAt;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; oldestEntry: number | null } {
    const entries = Array.from(this.executionState.values())
      .map((entry) => entry.lastTriggeredAt)
      .filter((timestamp): timestamp is number => typeof timestamp === 'number');

    return {
      size: this.executionState.size,
      maxSize: MAX_STATE_ENTRIES,
      oldestEntry: entries.length > 0 ? Math.min(...entries) : null,
    };
  }

  /**
   * Manually trigger cleanup
   */
  cleanup(): void {
    this.cleanupExecutionState(Date.now());
  }

  private getAgentQueue(agentId: string): AlertQueueState {
    const existing = this.agentQueues.get(agentId);
    if (existing) {
      return existing;
    }

    const queue = { inFlight: null };
    this.agentQueues.set(agentId, queue);
    return queue;
  }

  private async runEvaluation(
    agentId: string,
    agentName: string,
    metrics: DashboardMetrics
  ): Promise<void> {
    const now = Date.now();
    this.cleanupExecutionState(now);

    try {
      const enabledAlerts = getEnabledAlertRules();

      for (const alert of enabledAlerts) {
        if (alert.agent_id && alert.agent_id !== agentId) {
          continue;
        }

        const shouldTrigger = this.shouldTriggerAlert(alert, metrics, now);

        if (!shouldTrigger) {
          continue;
        }

        await this.triggerAlert(alert, agentId, agentName, metrics, now);
        this.updateExecutionState(alert, metrics, now, true);
      }
    } catch (error) {
      console.error('Error evaluating alerts:', error);
    }
  }

  private shouldTriggerAlert(
    alert: AlertRule,
    metrics: DashboardMetrics,
    now: number
  ): boolean {
    switch (alert.trigger_type) {
      case 'interval':
        return this.shouldTriggerIntervalAlert(alert, now);

      case 'threshold':
        return this.shouldTriggerThresholdAlert(alert, metrics, now);

      case 'event':
        return true;

      default:
        return false;
    }
  }

  private shouldTriggerIntervalAlert(alert: AlertRule, now: number): boolean {
    if (!alert.interval) {
      return false;
    }

    const intervalMs = intervalMap[alert.interval];
    if (!intervalMs) {
      return false;
    }

    const lastExecution = this.executionState.get(alert.id)?.lastTriggeredAt;

    if (!lastExecution) {
      return true;
    }

    return now - lastExecution >= intervalMs;
  }

  private shouldTriggerThresholdAlert(
    alert: AlertRule,
    metrics: DashboardMetrics,
    now: number
  ): boolean {
    const isBreached = this.isThresholdBreached(alert, metrics);
    const previousState = this.executionState.get(alert.id)?.thresholdActive;

    if (!isBreached) {
      this.updateExecutionState(alert, metrics, now, false);
      return false;
    }

    return !previousState;
  }

  private isThresholdBreached(alert: AlertRule, metrics: DashboardMetrics): boolean {
    for (const param of alert.parameters) {
      if (!param.enabled || typeof param.threshold !== 'number') {
        continue;
      }

      switch (param.parameter) {
        case 'error_rate':
          if ((metrics.statusCodes?.errorRate ?? 0) > param.threshold) {
            return true;
          }
          break;

        case 'response_time':
          if ((metrics.responseTime?.average ?? 0) > param.threshold) {
            return true;
          }
          break;

        case 'request_count':
          if ((metrics.requests?.total ?? 0) > param.threshold) {
            return true;
          }
          break;

        default:
          break;
      }
    }

    return false;
  }

  private updateExecutionState(
    alert: AlertRule,
    metrics: DashboardMetrics,
    now: number,
    triggered: boolean
  ): void {
    const state = this.executionState.get(alert.id) ?? {};

    if (alert.trigger_type === 'threshold') {
      state.thresholdActive = triggered ? true : this.isThresholdBreached(alert, metrics);
    }

    if (triggered) {
      state.lastTriggeredAt = now;
    }

    this.executionState.set(alert.id, state);
  }

  private async triggerAlert(
    alert: AlertRule,
    agentId: string,
    agentName: string,
    metrics: DashboardMetrics,
    now: number
  ): Promise<void> {
    let alertData: AlertData;

    if (alert.trigger_type === 'interval' && alert.interval) {
      const snapshot = getLatestSnapshot(agentId, alert.interval);
      alertData = snapshot
        ? this.buildAlertDataFromSnapshot(snapshot)
        : this.buildAlertData(agentId, agentName, metrics, now);
    } else {
      alertData = this.buildAlertData(agentId, agentName, metrics, now);
    }

    for (const webhookId of alert.webhook_ids) {
      try {
        const webhook = getWebhookById(webhookId);
        if (!webhook || !webhook.enabled) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`Webhook ${webhookId} not found or disabled, skipping`);
          }
          continue;
        }

        const result = await sendNotification(
          webhook,
          alertData,
          alert.name,
          alert.parameters
        );

        addNotificationHistory({
          alert_rule_id: alert.id,
          webhook_id: webhookId,
          agent_id: agentId,
          status: result.success ? 'success' : 'failed',
          error_message: result.error,
          payload: JSON.stringify(alertData),
        });

        if (!result.success) {
          console.error(`✗ Failed to send alert to ${webhook.name}: ${result.error}`);
        }
      } catch (error) {
        console.error(`Error sending to webhook ${webhookId}:`, error);

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

  private buildAlertData(
    agentId: string,
    agentName: string,
    metrics: DashboardMetrics,
    timestamp: number
  ): AlertData {
    return {
      timestamp: new Date(timestamp).toISOString(),
      agent_name: agentName,
      agent_id: agentId,
      metrics: {
        top_ips: metrics.topClientIPs?.slice(0, 10).map((ip) => ({
          ip: ip.ip,
          count: ip.count,
        })),
        top_locations: metrics.geoLocations?.slice(0, 10).map((loc) => ({
          country: loc.country,
          city: loc.city,
          count: loc.count,
        })),
        top_routes: metrics.topRoutes?.slice(0, 10).map((route) => ({
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
            ].filter((status) => status.count > 0)
          : undefined,
        top_user_agents: metrics.userAgents?.slice(0, 10).map((ua) => ({
          browser: ua.browser,
          count: ua.count,
        })),
        top_routers: metrics.routers?.slice(0, 10).map((router) => ({
          name: router.name,
          requests: router.requests,
        })),
        top_services: metrics.backends?.slice(0, 10).map((backend) => ({
          name: backend.name,
          requests: backend.requests,
        })),
        top_hosts: metrics.topRequestHosts?.slice(0, 10).map((host) => ({
          host: host.host,
          count: host.count,
        })),
        top_request_addresses: metrics.topRequestAddresses?.slice(0, 10).map((addr) => ({
          addr: addr.addr,
          count: addr.count,
        })),
        top_client_ips: metrics.topClientIPs?.slice(0, 10).map((ip) => ({
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
            ].filter((status) => status.count > 0)
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

  private cleanupExecutionState(now: number): void {
    const entries = Array.from(this.executionState.entries());
    const expired = entries.filter(([, state]) =>
      state.lastTriggeredAt ? now - state.lastTriggeredAt > MAX_STATE_AGE_MS : false
    );

    for (const [alertId] of expired) {
      this.executionState.delete(alertId);
    }

    if (this.executionState.size > MAX_STATE_ENTRIES) {
      const sorted = entries
        .filter(([, state]) => typeof state.lastTriggeredAt === 'number')
        .sort((a, b) => (a[1].lastTriggeredAt ?? 0) - (b[1].lastTriggeredAt ?? 0));

      const overflowCount = this.executionState.size - MAX_STATE_ENTRIES;
      for (const [alertId] of sorted.slice(0, overflowCount)) {
        this.executionState.delete(alertId);
      }
    }
  }
}

// Singleton instance
export const alertEngine = new AlertEngine();
