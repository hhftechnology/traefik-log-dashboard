// Alert Evaluation Engine
// Evaluates alert rules and triggers notifications based on current metrics

import {
  addNotificationHistory,
  getEnabledAlertRules,
  getLatestSnapshot,
  getSnapshotsByTimeRange,
  getWebhookById,
  deleteSnapshotsAfterAlert,
  getAlertExecutionState,
  setAlertExecutionState,
} from '../db/database';
import { sendNotification } from './notification-service';
import { AlertData, AlertInterval, AlertRule } from '../types/alerting';
import { DashboardMetrics } from '../types';
import { MetricSnapshot } from '../types/metrics-snapshot';

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

const DEFAULT_THRESHOLD_WINDOW_MS = 5 * 60 * 1000;

// Empty metrics object used by testFire() so triggerAlert() always has
// a valid DashboardMetrics to fall back to for payload building.
const EMPTY_METRICS: DashboardMetrics = {
  requests:            { total: 0, perSecond: 0, change: 0 },
  responseTime:        { average: 0, p95: 0, p99: 0, change: 0 },
  statusCodes:         { status2xx: 0, status3xx: 0, status4xx: 0, status5xx: 0, errorRate: 0 },
  topRoutes:           [],
  backends:            [],
  routers:             [],
  topRequestAddresses: [],
  topRequestHosts:     [],
  topClientIPs:        [],
  userAgents:          [],
  timeline:            [],
  errors:              [],
  geoLocations:        [],
  logs:                [],
};

export class AlertEngine {
  private agentQueues = new Map<string, AlertQueueState>();

  /**
   * Evaluate all enabled alert rules against current metrics.
   * Called by the background scheduler on each tick.
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
   * Reset persisted execution state for a SINGLE alert rule.
   * Called by the test-trigger route before testFire() so the alert
   * is not blocked by its cooldown window.
   */
  async resetAlertState(alertId: string): Promise<void> {
    setAlertExecutionState(alertId, {
      last_triggered_at: null,
      threshold_active:  0,
    });
  }

  /**
   * Fire a single alert unconditionally — bypasses threshold evaluation,
   * snapshot aggregation, and cooldown checks entirely.
   *
   * Used exclusively by the test-trigger API route. The caller should
   * call resetAlertState(alertId) first so the cooldown does not block
   * the next real evaluation cycle.
   */
  async testFire(
    alertId:   string,
    agentId:   string,
    agentName: string
  ): Promise<void> {
    const { getAlertRuleById } = await import('../db/database');
    const alert = getAlertRuleById(alertId);
    if (!alert) throw new Error(`Alert rule ${alertId} not found`);

    // Use the latest snapshot as payload if available, otherwise empty metrics.
    const snapshot = alert.interval
      ? getLatestSnapshot(agentId, alert.interval)
      : null;

    const alertData = snapshot
      ? this.buildAlertDataFromSnapshot(snapshot)
      : this.buildAlertData(agentId, agentName, EMPTY_METRICS, Date.now());

    for (const webhookId of alert.webhook_ids) {
      try {
        const webhook = getWebhookById(webhookId);
        if (!webhook || !webhook.enabled) continue;

        const result = await sendNotification(
          webhook, alertData, `[TEST] ${alert.name}`, alert.parameters
        );

        addNotificationHistory({
          alert_rule_id: alert.id,
          webhook_id:    webhookId,
          agent_id:      agentId,
          status:        result.success ? 'success' : 'failed',
          error_message: result.error,
          payload:       JSON.stringify(alertData),
        });
      } catch (err) {
        console.error(`[AlertEngine] testFire webhook ${webhookId} error:`, err);
        addNotificationHistory({
          alert_rule_id: alert.id,
          webhook_id:    webhookId,
          agent_id:      agentId,
          status:        'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error',
          payload:       JSON.stringify(alertData),
        });
      }
    }
  }

  // ─── Private: evaluation loop ─────────────────────────────────────────────

  private getAgentQueue(agentId: string): AlertQueueState {
    if (!this.agentQueues.has(agentId)) {
      this.agentQueues.set(agentId, { inFlight: null });
    }
    return this.agentQueues.get(agentId)!;
  }

  private async runEvaluation(
    agentId:   string,
    agentName: string,
    metrics:   DashboardMetrics
  ): Promise<void> {
    const now = Date.now();
    try {
      const enabledAlerts = getEnabledAlertRules();
      for (const alert of enabledAlerts) {
        if (alert.agent_id && alert.agent_id !== agentId) continue;

        const shouldTrigger = await this.shouldTriggerAlert(alert, agentId, metrics, now);
        if (!shouldTrigger) continue;

        await this.triggerAlert(alert, agentId, agentName, metrics, now);
      }
    } catch (err) {
      console.error('[AlertEngine] Error in runEvaluation:', err);
    }
  }

  // ─── Private: trigger decision ────────────────────────────────────────────

  private  async shouldTriggerAlert(
    alert: AlertRule,
    agentId: string,
    metrics: DashboardMetrics,
    now:     number
  ): Promise<boolean> {
    switch (alert.trigger_type) {
      case 'interval':  
        return this.shouldTriggerIntervalAlert(alert, now);

      case 'threshold': 
        return this.shouldTriggerThresholdAlert(alert, agentId, metrics, now);
      case 'event':     
        return true;
      default:          
        return false;
    }
  }

  // reads from SQLite, not in-memory Map.
  private shouldTriggerIntervalAlert(alert: AlertRule, now: number): boolean {
    if (!alert.interval) {
      return false;
    }

    const intervalMs = intervalMap[alert.interval];
    if (!intervalMs) {
      return false;
    }

    const state         = getAlertExecutionState(alert.id);
    const lastTriggered = state?.last_triggered_at
      ? new Date(state.last_triggered_at).getTime()
      : null;

    if (!lastTriggered) return true;
    return now - lastTriggered >= intervalMs;
  }

  //  aggregates snapshots before comparing to threshold.
  private async shouldTriggerThresholdAlert(
    alert:   AlertRule,
    agentId: string,
    metrics: DashboardMetrics,
    now:     number
  ): Promise<boolean> {
    const state            = getAlertExecutionState(alert.id);
    const previouslyActive = state?.threshold_active === 1;

    const isBreached = await this.isThresholdBreachedWithAggregation(
      alert, agentId, metrics, now
    );

    if (!isBreached) {
      if (previouslyActive) {
        setAlertExecutionState(alert.id, {
          threshold_active:  0,
          last_triggered_at: state?.last_triggered_at ?? null,
        });
      }
      return false;
    }

    // Fire only on the rising edge (inactive → active transition).
    return !previouslyActive;
  }

  // FIX BUG 2: AVG across snapshot rows in the window.
  private async isThresholdBreachedWithAggregation(
    alert:   AlertRule,
    agentId: string,
    metrics: DashboardMetrics,
    now:     number
  ): Promise<boolean> {
    const windowMs       = alert.interval
      ? intervalMap[alert.interval]
      : DEFAULT_THRESHOLD_WINDOW_MS;
    const windowStart    = new Date(now - windowMs).toISOString();
    const windowEnd      = new Date(now).toISOString();
    const snapshotInterval = alert.interval ?? '5m';
    const snapshots      = getSnapshotsByTimeRange(
      agentId, snapshotInterval, windowStart, windowEnd
    );

    for (const param of alert.parameters) {
      if (!param.enabled || typeof param.threshold !== 'number') continue;

      const aggregatedValue = snapshots.length > 0
        ? this.aggregateSnapshotMetric(snapshots, param.parameter)
        : this.getInstantaneousMetric(param.parameter, metrics);

      switch (param.parameter) {
        case 'error_rate':
        case 'response_time':
        case 'request_count':
          if (aggregatedValue > param.threshold) return true;
          break;
      }
    }

    return false;
  }

  private aggregateSnapshotMetric(
    snapshots: MetricSnapshot[],
    parameter: string
  ): number {
    const values: number[] = [];
    for (const snap of snapshots) {
      switch (parameter) {
        case 'error_rate':
          if (typeof snap.metrics.error_rate === 'number')
            values.push(snap.metrics.error_rate);
          break;
        case 'response_time':
          if (typeof snap.metrics.response_time?.average === 'number')
            values.push(snap.metrics.response_time.average);
          break;
        case 'request_count':
          if (typeof snap.metrics.request_count === 'number')
            values.push(snap.metrics.request_count);
          break;
      }
    }
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private getInstantaneousMetric(
    parameter: string,
    metrics:   DashboardMetrics
  ): number {
    switch (parameter) {
      case 'error_rate':    return metrics.statusCodes?.errorRate ?? 0;
      case 'response_time': return metrics.responseTime?.average ?? 0;
      case 'request_count': return metrics.requests?.total ?? 0;
      default:              return 0;
    }
  }

  // ─── Private: fire ────────────────────────────────────────────────────────

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

    let anySuccess = false;

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

        if (result.success) {
          anySuccess = true;
        } else {
          console.error(`[AlertEngine] ✗ Webhook ${webhook.name} failed: ${result.error}`);
        }
      } catch (err) {
        console.error(`[AlertEngine] Webhook ${webhookId} threw:`, err);
        addNotificationHistory({
          alert_rule_id: alert.id,
          webhook_id: webhookId,
          agent_id: agentId,
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error',
          payload: JSON.stringify(alertData),
        });
      }
    }

    // Delete snapshots immediately after successful send.
    // Only deletes the specific agent+interval that just fired.
    if (anySuccess) {
      deleteSnapshotsAfterAlert(agentId, alert.interval ?? '5m');
    }

    // FIX BUG 1: Persist execution state so restarts don't reset the clock.
    setAlertExecutionState(alert.id, {
      last_triggered_at: new Date(now).toISOString(),
      threshold_active:  alert.trigger_type === 'threshold' ? 1 : 0,
    });
  }

  // ─── Private: payload builders ────────────────────────────────────────────

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
}

export const alertEngine = new AlertEngine();
