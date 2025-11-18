'use client';

import { Clock } from 'lucide-react';
import Card from '@/components/ui/DashboardCard';
import { ResponseTimeMetrics } from '@/lib/types';

interface Props {
  metrics: ResponseTimeMetrics;
}

export default function ResponseTimeCard({ metrics }: Props) {
  const getPerformanceColor = (ms: number) => {
    if (ms < 100) return 'text-green-600';
    if (ms < 300) return 'text-yellow-600';
    if (ms < 1000) return 'text-orange-600';
    return 'text-primary';
  };

  const getPerformanceBg = (ms: number) => {
    if (ms < 100) return 'bg-green-50 border-green-200';
    if (ms < 300) return 'bg-yellow-50 border-yellow-200';
    if (ms < 1000) return 'bg-orange-50 border-orange-200';
    return 'bg-primary/10 border-border';
  };

  const percentiles = [
    { label: 'Average', value: metrics.average, description: 'Mean response time' },
    { label: 'P95', value: metrics.p95, description: '95% of requests' },
    { label: 'P99', value: metrics.p99, description: '99% of requests' }
  ];

  return (
    <Card title="Response Time" icon={<Clock className="w-5 h-5 text-primary" />}>
      <div className="space-y-3">
        {percentiles.map((percentile, idx) => (
          <div key={idx} className={`p-4 rounded-lg border ${getPerformanceBg(percentile.value)} transition-all hover:shadow-md`}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-semibold text-foreground">{percentile.label}</div>
                <div className="text-xs text-muted-foreground">{percentile.description}</div>
              </div>
              <div className={`text-3xl font-bold ${getPerformanceColor(percentile.value)}`}>
                {percentile.value.toFixed(0)}
                <span className="text-sm ml-1">ms</span>
              </div>
            </div>
            <div className="mt-2">
              <div className="h-2 w-full bg-accent rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    percentile.value < 100 ? 'bg-green-500' :
                    percentile.value < 300 ? 'bg-yellow-500' :
                    percentile.value < 1000 ? 'bg-orange-500' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min((percentile.value / 2000) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-border text-center">
        <div className="text-xs text-muted-foreground mb-1">Performance Score</div>
        <div className={`text-2xl font-bold ${getPerformanceColor(metrics.average)}`}>
          {metrics.average < 100 ? 'Excellent' :
           metrics.average < 300 ? 'Good' :
           metrics.average < 1000 ? 'Fair' : 'Poor'}
        </div>
      </div>
    </Card>
  );
}