'use client';

import { Users } from 'lucide-react';
import Card from '@/components/ui/DashboardCard';
import { formatNumber } from '@/lib/utils';

interface ClientMetric {
  ip: string;
  count: number;
}

interface Props {
  clients: ClientMetric[];
}

export default function TopClientIPsCard({ clients }: Props) {
  if (!clients || clients.length === 0) {
    return (
      <Card title="Top Client IPs" icon={<Users className="w-5 h-5 text-primary" />}>
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          No client IP data available
        </div>
      </Card>
    );
  }

  const maxCount = Math.max(...clients.map(c => c.count), 1);
  const topClients = clients.slice(0, 10);

  return (
    <Card title="Top Client IPs" icon={<Users className="w-5 h-5 text-primary" />}>
      <div className="space-y-3">
        {topClients.map((client, idx) => (
          <div key={idx} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-mono text-xs font-medium truncate text-foreground" title={client.ip}>
                {client.ip}
              </span>
              <span className="text-xs text-muted-foreground font-medium ml-2">
                {formatNumber(client.count)}
              </span>
            </div>
            <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${(client.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}