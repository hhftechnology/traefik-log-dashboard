'use client';

import { TrendingUp } from 'lucide-react';
import Card from '@/components/ui/DashboardCard';
import { RouteMetrics } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

interface Props {
  routes: RouteMetrics[];
}

export default function TopRoutesCard({ routes }: Props) {
  if (!routes || routes.length === 0) {
    return (
      <Card title="Top Routes" icon={<TrendingUp className="w-5 h-5 text-primary" />}>
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          No route data available
        </div>
      </Card>
    );
  }

  const maxCount = Math.max(...routes.map(r => r.count), 1);
  const topRoutes = routes.slice(0, 10);

  return (
    <Card title="Top Routes" icon={<TrendingUp className="w-5 h-5 text-primary" />}>
      <div className="space-y-4">
        {topRoutes.map((route, idx) => (
          <div key={idx} className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-medium bg-accent rounded text-primary">
                    {idx + 1}
                  </span>
                  <span className="font-mono text-xs font-medium truncate text-foreground" title={route.path}>
                    {route.path}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground whitespace-nowrap">
                <span className="font-medium">{formatNumber(route.count)}</span>
                <span className="text-muted-foreground">•</span>
                <span>{route.avgDuration.toFixed(0)}ms</span>
              </div>
            </div>
            <div className="ml-8">
              <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${(route.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}