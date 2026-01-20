'use client';

import { lazy, Suspense, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { TraefikLog } from '@/lib/types';
import { useMetricsProcessing } from '@/lib/hooks/useMetricsProcessing';
import { useGeoLocation } from '@/lib/hooks/useGeoLocation';
import { useSystemStats } from '@/lib/hooks/useSystemStats';
import { calculateMetrics, getEmptyMetrics } from '@/lib/utils/metric-calculator';
import { sortLogsByTime } from '@/lib/utils/log-utils';
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
  demoMode?: boolean;
  agentId?: string;
  agentName?: string;
}

export default function TabbedDashboard({
  logs,
  demoMode = false,
  agentId,
  agentName,
}: TabbedDashboardProps) {
  const { geoLocations, isLoadingGeo } = useGeoLocation(logs);
  const systemStats = useSystemStats(demoMode);

  // Memoize sorted logs
  const sortedLogs = useMemo(() => {
    return sortLogsByTime(logs, 1000);
  }, [logs]);

  // Calculate metrics
  const metrics = useMemo(() => {
    if (sortedLogs.length === 0) {
      return getEmptyMetrics();
    }
    return calculateMetrics(sortedLogs, geoLocations);
  }, [sortedLogs, geoLocations]);

  // Process metrics for alerts and snapshots
  useMetricsProcessing(agentId || null, agentName || null, metrics, logs, {
    enabled: !demoMode,
  });

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'traffic', label: 'Traffic', icon: Route },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'geography', label: 'Geography', icon: Globe },
    { id: 'system', label: 'System', icon: Cpu },
    { id: 'logs', label: 'Logs', icon: FileText },
  ];

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
            <GeographySection locations={metrics.geoLocations} isLoading={isLoadingGeo} />
          </Suspense>
        </TabsContent>

        <TabsContent value="system" className="mt-6">
          <Suspense fallback={<SectionSkeleton />}>
            <SystemSection systemStats={systemStats} />
          </Suspense>
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <Suspense fallback={<SectionSkeleton />}>
            <LogsSection logs={metrics.logs} errors={metrics.errors} />
          </Suspense>
        </TabsContent>
      </Tabs>

      {isLoadingGeo && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-lg text-sm flex items-center gap-3 z-50">
          <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
          <span className="font-medium">Loading location data...</span>
        </div>
      )}
    </div>
  );
}
