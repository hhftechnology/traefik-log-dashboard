// dashboard/components/dashboard/DashboardWithFilters.tsx
'use client';

import { useMemo } from 'react';
import { useFilters } from '@/lib/contexts/FilterContext';
import { applyFilters, getActiveFilterSummary } from '@/lib/utils/filter-utils';
import { TraefikLog } from '@/lib/types';
import TabbedDashboard from './TabbedDashboard';
import { Badge } from '@/components/ui/badge';
import { Filter } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface DashboardWithFiltersProps {
  logs: TraefikLog[];
  demoMode?: boolean;
  agentId?: string;
  agentName?: string;
}

export default function DashboardWithFilters({ logs, demoMode = false, agentId, agentName }: DashboardWithFiltersProps) {
  const { settings } = useFilters();

  // Apply filters to logs
  const filteredLogs = useMemo(() => {
    return applyFilters(logs, settings);
  }, [logs, settings]);

  // Get active filter summary
  const filterSummary = useMemo(() => {
    return getActiveFilterSummary(settings);
  }, [settings]);

  const hasActiveFilters = filterSummary.length > 0;
  const filteredCount = logs.length - filteredLogs.length;

  return (
    <>
      {/* Filter Status Bar */}
      {hasActiveFilters && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200 px-4 py-3">
          <div className="container mx-auto flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-900">
                  Active Filters:
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {filterSummary.map((summary, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="bg-blue-100 text-blue-700 border-blue-300"
                  >
                    {summary}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-blue-700">
                {filteredCount > 0 && (
                  <>
                    <span className="font-semibold">{filteredCount}</span> log{filteredCount !== 1 ? 's' : ''} filtered
                  </>
                )}
              </span>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                <Link href="/settings/filters">
                  Manage Filters
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Dashboard */}
      <TabbedDashboard logs={filteredLogs} demoMode={demoMode} agentId={agentId} agentName={agentName} />
    </>
  );
}