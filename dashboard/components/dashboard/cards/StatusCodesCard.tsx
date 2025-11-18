'use client';

import { Activity } from 'lucide-react';
import Card from '@/components/ui/DashboardCard';
import { StatusCodeMetrics } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

interface Props {
  metrics: StatusCodeMetrics;
}

export default function StatusCodesCard({ metrics }: Props) {
  const total = metrics.status2xx + metrics.status3xx + metrics.status4xx + metrics.status5xx;

  if (total === 0) {
    return (
      <Card title="Status Codes" icon={<Activity className="w-5 h-5 text-primary" />}>
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          No status code data available
        </div>
      </Card>
    );
  }

  const statusData = [
    {
      range: '2xx',
      label: 'Success',
      count: metrics.status2xx,
      percentage: (metrics.status2xx / total) * 100,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-300'
    },
    {
      range: '3xx',
      label: 'Redirect',
      count: metrics.status3xx,
      percentage: (metrics.status3xx / total) * 100,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-300'
    },
    {
      range: '4xx',
      label: 'Client Error',
      count: metrics.status4xx,
      percentage: (metrics.status4xx / total) * 100,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-300'
    },
    {
      range: '5xx',
      label: 'Server Error',
      count: metrics.status5xx,
      percentage: (metrics.status5xx / total) * 100,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: 'border-border'
    }
  ];

  return (
    <Card title="Status Codes" icon={<Activity className="w-5 h-5 text-primary" />}>
      <div className="grid grid-cols-2 gap-4">
        {statusData.map((status, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-lg border ${status.borderColor} ${status.bgColor} hover:shadow-md transition-all`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-2xl font-bold ${status.color}`}>{status.range}</span>
              <span className={`text-xs font-semibold ${status.color}`}>
                {status.percentage.toFixed(1)}%
              </span>
            </div>
            <div className="text-xs text-muted-foreground mb-1">{status.label}</div>
            <div className={`text-lg font-semibold ${status.color}`}>
              {formatNumber(status.count)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Total Requests</span>
        <span className="text-lg font-bold text-foreground">{formatNumber(total)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Error Rate</span>
        <span className={`text-lg font-bold ${metrics.errorRate > 5 ? 'text-primary' : 'text-green-600'}`}>
          {metrics.errorRate.toFixed(2)}%
        </span>
      </div>
    </Card>
  );
}