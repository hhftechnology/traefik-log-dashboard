'use client';

import { useMemo } from 'react';
import DashboardGrid from './DashboardGrid';
import { TraefikLog, DashboardMetrics, AddressMetric, HostMetric, ClientMetric, GeoLocation } from '@/lib/types';
import {
  calculateAverage,
  calculatePercentile,
  groupBy,
  extractUserAgentIdentifier,
} from '@/lib/utils';
import { useMetricsProcessing } from '@/lib/hooks/useMetricsProcessing';
import { useGeoLocation } from '@/lib/hooks/useGeoLocation';
import { useSystemStats } from '@/lib/hooks/useSystemStats';
import { calculateMetrics, getEmptyMetrics } from '@/lib/utils/metric-calculator';

interface DashboardProps {
  logs: TraefikLog[];
  demoMode?: boolean;
  agentId?: string;
  agentName?: string;
}

export default function Dashboard({ logs, demoMode = false, agentId, agentName }: DashboardProps) {
  const { geoLocations, isLoadingGeo } = useGeoLocation(logs);
  const systemStats = useSystemStats(demoMode);

  // Calculate metrics (excluding geo data which is async)
  const metrics = useMemo(() => {
    if (logs.length === 0) {
      return getEmptyMetrics();
    }

    // Sort logs by most recent first and keep latest 1000 entries
    const sortedLogs = [...logs]
      .sort((a, b) => {
        const timeA = new Date(a.StartUTC || a.StartLocal).getTime();
        const timeB = new Date(b.StartUTC || b.StartLocal).getTime();
        return timeB - timeA; // Most recent first
      })
      .slice(0, 1000);

    return calculateMetrics(sortedLogs, geoLocations);
  }, [logs, geoLocations]);

  // Process metrics for alerts and snapshots (only in non-demo mode)
  useMetricsProcessing(agentId || null, agentName || null, metrics, logs, {
    enabled: !demoMode,
  });

  return (
    <div className="container mx-auto px-4 py-6">
      <DashboardGrid metrics={metrics} systemStats={systemStats} demoMode={demoMode} />
      
      {isLoadingGeo && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-lg text-sm flex items-center gap-3 z-50">
          <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
          <span className="font-medium">Loading location data...</span>
        </div>
      )}
    </div>
  );
}

function calculateTimeSpan(logs: TraefikLog[]): number {
  if (logs.length < 2) return 0;

  const timestamps = logs
    .map(l => new Date(l.StartUTC || l.StartLocal).getTime())
    .filter(t => !isNaN(t))
    .sort((a, b) => a - b);

  if (timestamps.length < 2) return 0;

  const span = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000;
  return span;
}

function generateTimeline(logs: TraefikLog[]): { timestamp: string; value: number; label: string }[] {
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