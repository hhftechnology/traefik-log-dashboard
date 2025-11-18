'use client';

import { Activity, TrendingUp, TrendingDown } from 'lucide-react';
import Card from '@/components/ui/DashboardCard';
import { RequestMetrics } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

interface Props {
  metrics: RequestMetrics;
}

export default function RequestsCard({ metrics }: Props) {
  const getTrendIcon = () => {
    if (metrics.change > 0) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (metrics.change < 0) return <TrendingDown className="w-4 h-4 text-primary" />;
    return null;
  };

  const getTrendColor = () => {
    if (metrics.change > 0) return 'text-green-600';
    if (metrics.change < 0) return 'text-primary';
    return 'text-muted-foreground';
  };

  const sparklineData = Array.from({ length: 20 }, (_, i) => {
    const variance = Math.random() * 0.3 - 0.15;
    return metrics.perSecond * (1 + variance);
  });

  const maxValue = Math.max(...sparklineData);
  const minValue = Math.min(...sparklineData);

  return (
    <Card title="Requests" icon={<Activity className="w-5 h-5 text-primary" />}>
      <div className="space-y-6">
        <div className="text-center">
          <div className="text-5xl font-bold text-foreground mb-2">
            {formatNumber(metrics.total)}
          </div>
          <div className="text-sm text-muted-foreground">Total Requests</div>
          {metrics.change !== undefined && metrics.change !== 0 && (
            <div className={`flex items-center justify-center gap-1 mt-2 ${getTrendColor()}`}>
              {getTrendIcon()}
              <span className="text-sm font-semibold">
                {Math.abs(metrics.change).toFixed(1)}% {metrics.change > 0 ? 'increase' : 'decrease'}
              </span>
            </div>
          )}
        </div>

        <div className="bg-accent rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Requests per Second</span>
            <span className="text-2xl font-bold text-primary">{metrics.perSecond.toFixed(2)}</span>
          </div>
          <div className="h-12 flex items-end gap-0.5 mt-3">
            {sparklineData.map((value, idx) => {
              const height = ((value - minValue) / (maxValue - minValue)) * 100;
              return (
                <div
                  key={idx}
                  className="flex-1 bg-primary rounded-t transition-all hover:bg-primary/90"
                  style={{ height: `${height}%`, minHeight: '4px' }}
                  title={`${value.toFixed(2)} req/s`}
                />
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-lg p-3 border border-border">
            <div className="text-xs text-muted-foreground mb-1">Per Minute</div>
            <div className="text-xl font-bold text-primary">
              {formatNumber(Math.round(metrics.perSecond * 60))}
            </div>
          </div>
          <div className="bg-card rounded-lg p-3 border border-border">
            <div className="text-xs text-muted-foreground mb-1">Per Hour</div>
            <div className="text-xl font-bold text-primary">
              {formatNumber(Math.round(metrics.perSecond * 3600))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}