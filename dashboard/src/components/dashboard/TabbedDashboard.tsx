'use client';

import React, { lazy, Suspense, useMemo, useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { TraefikLog } from '@/utils/types';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import { useSystemStats } from '@/hooks/useSystemStats';
import { useAgentStatus } from '@/hooks/useAgentStatus';
import { useConfig } from '@/utils/contexts/ConfigContext';
import { calculateMetrics, getEmptyMetrics } from '@/utils/utils/metric-calculator';
import { sortLogsByTime } from '@/utils/utils/log-utils';
import {
  LayoutDashboard,
  Route,
  Users,
  Globe,
  Cpu,
  FileText,
} from 'lucide-react';

// Lazy load section components
const OverviewSection = lazy(() => import('./sections/OverviewSection'));
const TrafficSection = lazy(() => import('./sections/TrafficSection'));
const ClientsSection = lazy(() => import('./sections/ClientsSection'));
const GeographySection = lazy(() => import('./sections/GeographySection'));
const SystemSection = lazy(() => import('./sections/SystemSection'));
const LogsSection = lazy(() => import('./sections/LogsSection'));

// Section skeleton for loading
function SectionSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-lg border bg-card p-4">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="h-64 rounded-lg border bg-card p-6">
        <Skeleton className="h-full w-full" />
      </div>
    </div>
  );
}

interface TabbedDashboardProps {
  logs: TraefikLog[];
  totalLogs: number;
  filteredCount: number;
  hideInternalTraffic: boolean;
  onShowInternalTraffic?: () => void;
  demoMode?: boolean;
  agentId?: string;
}

export default function TabbedDashboard({
  logs,
  totalLogs,
  filteredCount,
  hideInternalTraffic,
  onShowInternalTraffic,
  demoMode = false,
  agentId,
}: TabbedDashboardProps) {
  const { config } = useConfig();
  const { geoLocations, isLoadingGeo, diagnostic } = useGeoLocation(logs, {
    totalLogs,
    filteredCount,
    hideInternalTraffic,
  });
  const systemStats = useSystemStats(demoMode);
  const {
    status: agentStatus,
    loading: isStatusLoading,
    error: statusError,
    lastUpdate: statusLastUpdate,
    parserTrend,
  } = useAgentStatus({
    agentId,
    demoMode,
    intervalMs: 15000,
    trendWindowMinutes: config.parserTrendWindowMinutes,
  });

  // Memoize sorted logs
  const sortedLogs = useMemo(() => {
    return sortLogsByTime(logs, config.maxLogsDisplay);
  }, [logs]);

  // Calculate metrics
  const metrics = useMemo(() => {
    if (sortedLogs.length === 0) {
      return getEmptyMetrics();
    }
    return calculateMetrics(sortedLogs, geoLocations, config.trafficTopItemsLimit);
  }, [sortedLogs, geoLocations, config.trafficTopItemsLimit]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'traffic', label: 'Traffic', icon: Route },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'geography', label: 'Geography', icon: Globe },
    { id: 'system', label: 'System', icon: Cpu },
    { id: 'logs', label: 'Logs', icon: FileText },
  ];

  const [showGeoLoading, setShowGeoLoading] = useState(false);
 
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isLoadingGeo) {
      timer = setTimeout(() => setShowGeoLoading(true), 500);
    } else {
      setShowGeoLoading(false);
    }
    return () => clearTimeout(timer);
  }, [isLoadingGeo]);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="gap-2 min-w-fit"
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Suspense fallback={<SectionSkeleton />}>
            <OverviewSection metrics={metrics} />
          </Suspense>
        </TabsContent>

        <TabsContent value="traffic" className="mt-6">
          <Suspense fallback={<SectionSkeleton />}>
            <TrafficSection metrics={metrics} />
          </Suspense>
        </TabsContent>

        <TabsContent value="clients" className="mt-6">
          <Suspense fallback={<SectionSkeleton />}>
            <ClientsSection metrics={metrics} />
          </Suspense>
        </TabsContent>

        <TabsContent value="geography" className="mt-6">
          <Suspense fallback={<SectionSkeleton />}>
            <GeographySection
              locations={metrics.geoLocations}
              isLoading={isLoadingGeo}
              diagnostic={diagnostic}
              hideInternalTraffic={hideInternalTraffic}
              onShowInternalTraffic={onShowInternalTraffic}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="system" className="mt-6">
          <Suspense fallback={<SectionSkeleton />}>
            <SystemSection
              systemStats={systemStats}
              parserMetrics={agentStatus?.parser_metrics}
              statusLoading={isStatusLoading}
              statusError={statusError}
              statusLastUpdate={statusLastUpdate}
              parserTrend={parserTrend}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <Suspense fallback={<SectionSkeleton />}>
            <LogsSection logs={metrics.logs} errors={metrics.errors} />
          </Suspense>
        </TabsContent>
      </Tabs>

      {showGeoLoading && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-lg text-sm flex items-center gap-3 z-50 animate-in fade-in duration-300">
          <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
          <span className="font-medium">Loading location data...</span>
        </div>
      )}
    </div>
  );
}
