// Metric Snapshot Service
// Creates time-windowed metric snapshots for accurate interval-based alerts

import { TraefikLog } from '../types';
import {
  MetricSnapshot,
  SnapshotMetrics,
  SnapshotOptions,
} from '../types/metrics-snapshot';
import { AlertInterval } from '../types/alerting';
import {
  calculateAverage,
  calculatePercentile,
  groupBy,
  extractUserAgentIdentifier,
} from '../utils';
import { randomUUID } from 'crypto';

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
 * Create a metric snapshot for a specific time window
 * @param logs - All available logs
 * @param agentId - Agent identifier
 * @param agentName - Agent name
 * @param options - Snapshot creation options
 * @returns MetricSnapshot containing metrics only from the specified time window
 */
export function createMetricSnapshot(
  logs: TraefikLog[],
  agentId: string,
  agentName: string,
  options: SnapshotOptions
): MetricSnapshot {
  const { interval, topLimit = 10 } = options;

  // Calculate time window
  const now = new Date();
  const windowDuration = intervalDurations[interval];
  const windowStart = new Date(now.getTime() - windowDuration);

  // Filter logs to only those within the time window
  const windowedLogs = filterLogsByTimeWindow(logs, windowStart, now);

  // Calculate metrics from windowed logs
  const metrics = calculateSnapshotMetrics(windowedLogs, topLimit);

  return {
    id: randomUUID(),
    agent_id: agentId,
    agent_name: agentName,
    timestamp: now.toISOString(),
    window_start: windowStart.toISOString(),
    window_end: now.toISOString(),
    interval,
    log_count: windowedLogs.length,
    metrics,
  };
}

/**
 * Filter logs to only those within a specific time window
 */
function filterLogsByTimeWindow(
  logs: TraefikLog[],
  windowStart: Date,
  windowEnd: Date
): TraefikLog[] {
  const startTime = windowStart.getTime();
  const endTime = windowEnd.getTime();

  return logs.filter((log) => {
    const logTime = new Date(log.StartUTC || log.StartLocal).getTime();
    return logTime >= startTime && logTime <= endTime;
  });
}

/**
 * Calculate metrics from a set of logs (windowed)
 */
function calculateSnapshotMetrics(
  logs: TraefikLog[],
  topLimit: number
): SnapshotMetrics {
  const total = logs.length;

  // If no logs in window, return minimal metrics
  if (total === 0) {
    return {
      request_count: 0,
      error_rate: 0,
    };
  }

  // Response time metrics
  const durations = logs.filter(l=>l.DownstreamStatus!=0).map(l => l.Duration / 1000000); // Convert to milliseconds and exclude logs with status 0
  const avgDuration = calculateAverage(durations);
  const p95Duration = calculatePercentile(durations, 95);
  const p99Duration = calculatePercentile(durations, 99);
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);

  // Status code metrics
  const statusCodes = logs.map((l) => l.DownstreamStatus);
  const status2xx = statusCodes.filter((s) => s >= 200 && s < 300).length;
  const status3xx = statusCodes.filter((s) => s >= 300 && s < 400).length;
  const status4xx = statusCodes.filter((s) => s >= 400 && s < 500).length;
  const status5xx = statusCodes.filter((s) => s >= 500).length;
  const errorRate = total > 0 ? ((status4xx + status5xx) / total) * 100 : 0;

  // Top routes
  const routeGroups = groupBy(logs.filter((l) => l.RequestPath), 'RequestPath');
  const top_routes = Object.entries(routeGroups)
    .map(([path, routeLogs]) => ({
      path,
      count: routeLogs.length,
      avgDuration: calculateAverage(routeLogs.map((l) => l.Duration / 1000000)),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topLimit);

  // Top Client IPs
  const clientIPGroups = groupBy(logs.filter((l) => l.ClientHost), 'ClientHost');
  const top_client_ips = Object.entries(clientIPGroups)
    .map(([ip, ipLogs]) => ({
      ip,
      count: ipLogs.length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topLimit);

  // Duplicate as top_ips (for backward compatibility)
  const top_ips = [...top_client_ips];

  // Top Request Addresses
  const addressGroups = groupBy(logs.filter((l) => l.RequestAddr), 'RequestAddr');
  const top_request_addresses = Object.entries(addressGroups)
    .map(([addr, addrLogs]) => ({
      addr,
      count: addrLogs.length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topLimit);

  // Top Request Hosts
  const hostGroups = groupBy(logs.filter((l) => l.RequestHost), 'RequestHost');
  const top_hosts = Object.entries(hostGroups)
    .map(([host, hostLogs]) => ({
      host,
      count: hostLogs.length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topLimit);

  // Top Routers
  const routerGroups = groupBy(logs.filter((l) => l.RouterName), 'RouterName');
  const top_routers = Object.entries(routerGroups)
    .map(([name, routerLogs]) => ({
      name,
      requests: routerLogs.length,
    }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, topLimit);

  // Top Services (Backends)
  const serviceGroups = groupBy(logs.filter((l) => l.ServiceName), 'ServiceName');
  const top_services = Object.entries(serviceGroups)
    .map(([name, serviceLogs]) => ({
      name,
      requests: serviceLogs.length,
    }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, topLimit);

  // Top User Agents
  const userAgentIdentifierGroups: Record<string, string[]> = {};
  logs.filter((l) => l.request_User_Agent).forEach((log) => {
    const identifier = extractUserAgentIdentifier(log.request_User_Agent || '');
    if (!userAgentIdentifierGroups[identifier]) {
      userAgentIdentifierGroups[identifier] = [];
    }
    userAgentIdentifierGroups[identifier].push(log.request_User_Agent || '');
  });

  const top_user_agents = Object.entries(userAgentIdentifierGroups)
    .map(([browser, agents]) => ({
      browser,
      count: agents.length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topLimit);

  return {
    request_count: total,
    error_rate: errorRate,
    response_time: {
      average: avgDuration,
      p95: p95Duration,
      p99: p99Duration,
      min: minDuration,
      max: maxDuration,
    },
    status_codes: {
      status2xx,
      status3xx,
      status4xx,
      status5xx,
    },
    top_ips,
    top_client_ips,
    top_routes,
    top_request_addresses,
    top_hosts,
    top_routers,
    top_services,
    top_user_agents,
  };
}

/**
 * Create snapshots for all configured intervals
 * @param logs - All available logs
 * @param agentId - Agent identifier
 * @param agentName - Agent name
 * @param intervals - List of intervals to create snapshots for
 * @returns Array of MetricSnapshots
 */
export function createSnapshotsForIntervals(
  logs: TraefikLog[],
  agentId: string,
  agentName: string,
  intervals: AlertInterval[]
): MetricSnapshot[] {
  return intervals.map((interval) =>
    createMetricSnapshot(logs, agentId, agentName, { interval })
  );
}
