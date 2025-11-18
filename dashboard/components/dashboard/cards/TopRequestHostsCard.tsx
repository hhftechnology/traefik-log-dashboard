'use client';

import { Globe } from 'lucide-react';
import Card from '@/components/ui/DashboardCard';
import { formatNumber } from '@/lib/utils';

interface HostMetric {
  host: string;
  count: number;
}

interface Props {
  hosts: HostMetric[];
}

export default function TopRequestHostsCard({ hosts }: Props) {
  if (!hosts || hosts.length === 0) {
    return (
      <Card title="Top Request Hosts" icon={<Globe className="w-5 h-5 text-primary" />}>
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          No request host data available
        </div>
      </Card>
    );
  }

  const maxCount = Math.max(...hosts.map(h => h.count), 1);
  const topHosts = hosts.slice(0, 10);

  return (
    <Card title="Top Request Hosts" icon={<Globe className="w-5 h-5 text-primary" />}>
      <div className="space-y-3">
        {topHosts.map((host, idx) => (
          <div key={idx} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium truncate flex-1 text-foreground" title={host.host}>
                {host.host}
              </span>
              <span className="text-xs text-muted-foreground font-medium ml-2">
                {formatNumber(host.count)}
              </span>
            </div>
            <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${(host.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}