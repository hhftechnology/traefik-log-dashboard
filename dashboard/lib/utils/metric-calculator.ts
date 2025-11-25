import { TraefikLog, DashboardMetrics, AddressMetric, HostMetric, ClientMetric, GeoLocation } from '@/lib/types';
import {
  calculateAverage,
  calculatePercentile,
  groupBy,
  extractUserAgentIdentifier,
} from '@/lib/utils';

export function calculateMetrics(logs: TraefikLog[], geoLocations: GeoLocation[] = []): DashboardMetrics {
  // Request metrics
  const total = logs.length;
  const timeSpan = calculateTimeSpan(logs);
  const perSecond = timeSpan > 0 ? total / timeSpan : 0;

  // Response time metrics
  const durations = logs.map(l => l.Duration / 1000000); // Convert to milliseconds
  const avgDuration = calculateAverage(durations);
  const p95Duration = calculatePercentile(durations, 95);
  const p99Duration = calculatePercentile(durations, 99);

  // Status code metrics
  const statusCodes = logs.map(l => l.DownstreamStatus);
  const status2xx = statusCodes.filter(s => s >= 200 && s < 300).length;
  const status3xx = statusCodes.filter(s => s >= 300 && s < 400).length;
  const status4xx = statusCodes.filter(s => s >= 400 && s < 500).length;
  const status5xx = statusCodes.filter(s => s >= 500).length;
  const errorRate = total > 0 ? ((status4xx + status5xx) / total) * 100 : 0;

  // Top routes
  const routeGroups = groupBy(logs.filter(l => l.RequestPath), 'RequestPath');
  const topRoutes = Object.entries(routeGroups)
    .map(([path, routeLogs]) => ({
      path,
      count: routeLogs.length,
      avgDuration: calculateAverage(routeLogs.map(l => l.Duration / 1000000)),
      method: routeLogs[0]?.RequestMethod || 'GET',
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Backend services
  const backendGroups = groupBy(logs.filter(l => l.ServiceName), 'ServiceName');
  const backends = Object.entries(backendGroups)
    .map(([name, backendLogs]) => {
      const errors = backendLogs.filter(l => l.DownstreamStatus >= 400).length;
      return {
        name,
        requests: backendLogs.length,
        avgDuration: calculateAverage(backendLogs.map(l => l.Duration / 1000000)),
        errorRate: backendLogs.length > 0 ?
          (errors / backendLogs.length) * 100 : 0,
        url: backendLogs[0]?.ServiceURL || '',
      };
    })
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 10);

  // Routers
  const routerGroups = groupBy(logs.filter(l => l.RouterName), 'RouterName');
  const routers = Object.entries(routerGroups)
    .map(([name, routerLogs]) => ({
      name,
      requests: routerLogs.length,
      avgDuration: calculateAverage(routerLogs.map(l => l.Duration / 1000000)),
      service: routerLogs[0]?.ServiceName || '',
    }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 10);

  // Top Request Addresses
  const addressGroups = groupBy(logs.filter(l => l.RequestAddr), 'RequestAddr');
  const topRequestAddresses: AddressMetric[] = Object.entries(addressGroups)
    .map(([addr, addrLogs]) => ({
      addr,
      count: addrLogs.length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top Request Hosts
  const hostGroups = groupBy(logs.filter(l => l.RequestHost), 'RequestHost');
  const topRequestHosts: HostMetric[] = Object.entries(hostGroups)
    .map(([host, hostLogs]) => ({
      host,
      count: hostLogs.length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top Client IPs
  const clientIPGroups = groupBy(logs.filter(l => l.ClientHost), 'ClientHost');
  const topClientIPs: ClientMetric[] = Object.entries(clientIPGroups)
    .map(([ip, ipLogs]) => ({
      ip,
      count: ipLogs.length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // User agents - Extract identifier, group, show top 11 + Others
  const userAgentIdentifierGroups: Record<string, string[]> = {};

  // First pass: Extract identifiers and group the original user agents
  logs.filter(l => l.request_User_Agent).forEach(log => {
    const identifier = extractUserAgentIdentifier(log.request_User_Agent || '');
    if (!userAgentIdentifierGroups[identifier]) {
      userAgentIdentifierGroups[identifier] = [];
    }
    userAgentIdentifierGroups[identifier].push(log.request_User_Agent || '');
  });

  // Convert to array and sort by count
  const sortedUserAgents = Object.entries(userAgentIdentifierGroups)
    .map(([identifier, agents]) => ({
      identifier,
      count: agents.length,
      percentage: (agents.length / total) * 100,
    }))
    .sort((a, b) => b.count - a.count);

  // Take top 11, aggregate the rest as "Others"
  const top11 = sortedUserAgents.slice(0, 11);
  const othersCount = sortedUserAgents.slice(11).reduce((sum, ua) => sum + ua.count, 0);

  // Build final userAgents array
  const userAgents = top11.map(ua => ({
    browser: ua.identifier,
    count: ua.count,
    percentage: ua.percentage,
  }));

  // Add "Others" if there are more than 11 unique identifiers
  if (sortedUserAgents.length > 11) {
    userAgents.push({
      browser: 'Others',
      count: othersCount,
      percentage: (othersCount / total) * 100,
    });
  }

  // Timeline - keep latest data points
  const timeline = generateTimeline(logs);

  // Recent errors - keep latest 50 errors
  const errors = logs
    .filter(l => l.DownstreamStatus >= 400)
    .slice(0, 50)
    .map(l => ({
      timestamp: l.StartUTC || l.StartLocal,
      level: l.DownstreamStatus >= 500 ? 'error' : 'warning',
      message: `${l.RequestMethod} ${l.RequestPath} - ${l.DownstreamStatus}`,
      status: l.DownstreamStatus,
    }));

  return {
    requests: {
      total,
      perSecond,
      change: 0,
    },
    responseTime: {
      average: avgDuration,
      p95: p95Duration,
      p99: p99Duration,
      change: 0,
    },
    statusCodes: {
      status2xx,
      status3xx,
      status4xx,
      status5xx,
      errorRate,
    },
    topRoutes,
    backends,
    routers,
    topRequestAddresses,
    topRequestHosts,
    topClientIPs,
    userAgents,
    timeline,
    errors,
    geoLocations,
    logs, // Pass sorted logs to table
  };
}

export function calculateTimeSpan(logs: TraefikLog[]): number {
  if (logs.length < 2) return 0;

  const timestamps = logs
    .map(l => new Date(l.StartUTC || l.StartLocal).getTime())
    .filter(t => !isNaN(t))
    .sort((a, b) => a - b);

  if (timestamps.length < 2) return 0;

  const span = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000;
  return span;
}

export function generateTimeline(logs: TraefikLog[]): { timestamp: string; value: number; label: string }[] {
  if (logs.length < 2) {
    return [];
  }

  const timestamps = logs
    .map(l => new Date(l.StartUTC || l.StartLocal).getTime())
    .filter(t => !isNaN(t));

  if (timestamps.length < 2) {
    return [];
  }

  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const points = 20;

  const effectiveMaxTime = Math.max(maxTime, minTime + 60 * 1000);
  const totalTimeSpan = effectiveMaxTime - minTime;
  const interval = Math.ceil(totalTimeSpan / points);

  const buckets: Map<number, number> = new Map();
  timestamps.forEach(logTime => {
    const bucketTime = Math.floor(logTime / interval) * interval;
    buckets.set(bucketTime, (buckets.get(bucketTime) || 0) + 1);
  });

  const startTime = Math.floor(minTime / interval) * interval;
  const endTime = Math.floor(maxTime / interval) * interval;

  const timelineData = [];

  for (let currentTime = startTime; currentTime <= endTime; currentTime += interval) {
    timelineData.push({
      timestamp: new Date(currentTime).toISOString(),
      value: buckets.get(currentTime) || 0,
      label: new Date(currentTime).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    });
  }

  return timelineData;
}

export function getEmptyMetrics(): DashboardMetrics {
  return {
    requests: { total: 0, perSecond: 0, change: 0 },
    responseTime: { average: 0, p95: 0, p99: 0, change: 0 },
    statusCodes: { status2xx: 0, status3xx: 0, status4xx: 0, status5xx: 0, errorRate: 0 },
    topRoutes: [],
    backends: [],
    routers: [],
    topRequestAddresses: [],
    topRequestHosts: [],
    topClientIPs: [],
    userAgents: [],
    timeline: [],
    errors: [],
    geoLocations: [],
    logs: [], // Include empty logs array
  };
}
