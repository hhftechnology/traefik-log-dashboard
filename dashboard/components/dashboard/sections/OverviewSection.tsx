'use client';

import { memo } from 'react';
import { Activity, Clock, Server, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Progress } from '@/components/ui/progress';
import { DashboardMetrics } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import TimeSeriesChart from '@/components/charts/TimeSeriesChart';

interface OverviewSectionProps {
  metrics: DashboardMetrics;
}

function OverviewSection({ metrics }: OverviewSectionProps) {
  const total = metrics.statusCodes.status2xx + metrics.statusCodes.status3xx +
                metrics.statusCodes.status4xx + metrics.statusCodes.status5xx;
  const successRate = total > 0 ? ((metrics.statusCodes.status2xx + metrics.statusCodes.status3xx) / total) * 100 : 0;

  const stats = [
    {
      title: 'Total Requests',
      value: formatNumber(metrics.requests.total),
      description: `${metrics.requests.perSecond.toFixed(2)} req/s`,
      icon: Activity,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      title: 'Response Time',
      value: `${metrics.responseTime.average.toFixed(0)}ms`,
      description: `P99: ${metrics.responseTime.p99.toFixed(0)}ms`,
      icon: Clock,
      color: metrics.responseTime.average < 200 ? 'text-green-600' : metrics.responseTime.average < 500 ? 'text-yellow-600' : 'text-red-600',
      bgColor: metrics.responseTime.average < 200 ? 'bg-green-50 dark:bg-green-950' : metrics.responseTime.average < 500 ? 'bg-yellow-50 dark:bg-yellow-950' : 'bg-red-50 dark:bg-red-950',
    },
    {
      title: 'Success Rate',
      value: `${successRate.toFixed(1)}%`,
      description: `${formatNumber(metrics.statusCodes.status2xx + metrics.statusCodes.status3xx)} successful`,
      icon: successRate >= 95 ? TrendingUp : TrendingDown,
      color: successRate >= 95 ? 'text-green-600' : successRate >= 90 ? 'text-yellow-600' : 'text-red-600',
      bgColor: successRate >= 95 ? 'bg-green-50 dark:bg-green-950' : successRate >= 90 ? 'bg-yellow-50 dark:bg-yellow-950' : 'bg-red-50 dark:bg-red-950',
    },
    {
      title: 'Active Services',
      value: metrics.backends.length.toString(),
      description: 'Services with traffic',
      icon: Server,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-950',
    },
  ];

  const statusCodes = [
    { label: '2xx Success', value: metrics.statusCodes.status2xx, total, color: 'bg-green-500' },
    { label: '3xx Redirect', value: metrics.statusCodes.status3xx, total, color: 'bg-blue-500' },
    { label: '4xx Client Error', value: metrics.statusCodes.status4xx, total, color: 'bg-yellow-500' },
    { label: '5xx Server Error', value: metrics.statusCodes.status5xx, total, color: 'bg-red-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, idx) => (
          <Card key={idx} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </div>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Timeline Chart */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">
            Request Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <TimeSeriesChart data={metrics.timeline} />
          </div>
        </CardContent>
      </Card>

      {/* Status Code Distribution */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">
            Status Code Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {statusCodes.map((status, idx) => {
              const percentage = total > 0 ? (status.value / total) * 100 : 0;
              return (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{status.label}</span>
                    <span className="font-semibold">{formatNumber(status.value)}</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">{percentage.toFixed(1)}%</p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Error Rate</span>
            <span className={`text-lg font-bold ${metrics.statusCodes.errorRate > 5 ? 'text-red-600' : 'text-green-600'}`}>
              {metrics.statusCodes.errorRate.toFixed(2)}%
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Response Time Details */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">
            Response Time Percentiles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Average', value: metrics.responseTime.average, desc: 'Mean response time' },
              { label: 'P95', value: metrics.responseTime.p95, desc: '95% of requests' },
              { label: 'P99', value: metrics.responseTime.p99, desc: '99% of requests' },
            ].map((item, idx) => {
              const getColor = (ms: number) => {
                if (ms < 100) return 'text-green-600';
                if (ms < 300) return 'text-yellow-600';
                if (ms < 1000) return 'text-orange-600';
                return 'text-red-600';
              };
              const getBg = (ms: number) => {
                if (ms < 100) return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800';
                if (ms < 300) return 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800';
                if (ms < 1000) return 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800';
                return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800';
              };
              return (
                <div key={idx} className={`p-4 rounded-lg border ${getBg(item.value)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <p className={`text-2xl font-bold ${getColor(item.value)}`}>
                      {item.value.toFixed(0)}
                      <span className="text-sm ml-1">ms</span>
                    </p>
                  </div>
                  <Progress
                    value={Math.min((item.value / 2000) * 100, 100)}
                    className="h-1.5"
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default memo(OverviewSection);
