'use client';

import { Server, CheckCircle, AlertCircle, Activity } from 'lucide-react';
import Card from '@/components/ui/DashboardCard';
import { BackendMetrics } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

interface Props {
  backends: BackendMetrics[];
}

export default function BackendsCard({ backends }: Props) {
  if (!backends || backends.length === 0) {
    return (
      <Card title="Backends" icon={<Server className="w-5 h-5 text-primary" />}>
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          No backend data available
        </div>
      </Card>
    );
  }

  const totalRequests = backends.reduce((sum, b) => sum + b.requests, 0);
  const healthyBackends = backends.filter(b => b.errorRate < 5).length;
  const warningBackends = backends.filter(b => b.errorRate >= 5 && b.errorRate < 10).length;
  const criticalBackends = backends.filter(b => b.errorRate >= 10).length;

  const getHealthStatus = (errorRate: number) => {
    if (errorRate < 5) return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', label: 'Healthy' };
    if (errorRate < 10) return { icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', label: 'Warning' };
    return { icon: AlertCircle, color: 'text-primary', bg: 'bg-primary/10', border: 'border-border', label: 'Critical' };
  };

  return (
    <Card title="Backends" icon={<Server className="w-5 h-5 text-primary" />}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-center">
            <div className="text-2xl font-bold text-green-600">{healthyBackends}</div>
            <div className="text-xs text-muted-foreground mt-1">Healthy</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200 text-center">
            <div className="text-2xl font-bold text-yellow-600">{warningBackends}</div>
            <div className="text-xs text-muted-foreground mt-1">Warning</div>
          </div>
          <div className="bg-primary/10 rounded-lg p-3 border border-border text-center">
            <div className="text-2xl font-bold text-primary">{criticalBackends}</div>
            <div className="text-xs text-muted-foreground mt-1">Critical</div>
          </div>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {backends.map((backend, idx) => {
            const status = getHealthStatus(backend.errorRate);
            const StatusIcon = status.icon;
            const percentage = (backend.requests / totalRequests) * 100;

            return (
              <div
                key={idx}
                className={`p-3 rounded-lg border ${status.border} ${status.bg} transition-all hover:shadow-md`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <StatusIcon className={`w-5 h-5 ${status.color} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-foreground truncate" title={backend.name}>
                        {backend.name}
                      </div>
                      {backend.url && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5" title={backend.url}>
                          {backend.url}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={`text-xs font-semibold px-2 py-1 rounded ${status.bg} ${status.color} whitespace-nowrap`}>
                    {status.label}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Requests</div>
                    <div className="text-sm font-bold text-foreground">{formatNumber(backend.requests)}</div>
                    <div className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Avg Time</div>
                    <div className="text-sm font-bold text-foreground">{backend.avgDuration.toFixed(0)}ms</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Error Rate</div>
                    <div className={`text-sm font-bold ${status.color}`}>{backend.errorRate.toFixed(1)}%</div>
                  </div>
                </div>

                <div className="mt-2">
                  <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Total Backend Traffic
            </span>
            <span className="font-bold text-foreground">{formatNumber(totalRequests)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}