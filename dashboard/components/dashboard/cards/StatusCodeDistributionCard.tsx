'use client';

import { BarChart3 } from 'lucide-react';
import Card from '@/components/ui/DashboardCard';
import { StatusCodeMetrics } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

interface Props {
  metrics: StatusCodeMetrics;
}

export default function StatusCodeDistributionCard({ metrics }: Props) {
  const total = metrics.status2xx + metrics.status3xx + metrics.status4xx + metrics.status5xx;

  if (total === 0) {
    return (
      <Card title="Status Code Distribution" icon={<BarChart3 className="w-5 h-5 text-primary" />}>
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          No status code data available
        </div>
      </Card>
    );
  }

  const codes = [
    {
      label: '2xx Success',
      count: metrics.status2xx,
      percentage: (metrics.status2xx / total) * 100,
      color: 'bg-green-500',
      textColor: 'text-green-700'
    },
    {
      label: '3xx Redirect',
      count: metrics.status3xx,
      percentage: (metrics.status3xx / total) * 100,
      color: 'bg-blue-500',
      textColor: 'text-blue-700'
    },
    {
      label: '4xx Client Error',
      count: metrics.status4xx,
      percentage: (metrics.status4xx / total) * 100,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-700'
    },
    {
      label: '5xx Server Error',
      count: metrics.status5xx,
      percentage: (metrics.status5xx / total) * 100,
      color: 'bg-primary',
      textColor: 'text-primary'
    }
  ];

  return (
    <Card title="Status Code Distribution" icon={<BarChart3 className="w-5 h-5 text-primary" />}>
      <div className="space-y-4">
        {codes.map((code, idx) => (
          <div key={idx} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{code.label}</span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-medium">{formatNumber(code.count)}</span>
                <span className="text-muted-foreground">•</span>
                <span className={`font-semibold ${code.textColor}`}>{code.percentage.toFixed(1)}%</span>
              </div>
            </div>
            <div className="h-2 w-full bg-accent rounded-full overflow-hidden">
              <div
                className={`h-full ${code.color} transition-all duration-500 ease-out`}
                style={{ width: `${code.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}