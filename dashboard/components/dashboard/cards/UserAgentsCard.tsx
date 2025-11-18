'use client';

import { Monitor } from 'lucide-react';
import Card from '@/components/ui/DashboardCard';
import { formatNumber } from '@/lib/utils';

interface Props {
  userAgents: any[];
}

export default function UserAgentsCard({ userAgents }: Props) {
  if (!userAgents || userAgents.length === 0) {
    return (
      <Card title="User Agents" icon={<Monitor className="w-5 h-5 text-primary" />}>
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          No user agent data available
        </div>
      </Card>
    );
  }

  const topAgents = userAgents.slice(0, 12);
  const maxCount = Math.max(...topAgents.map(ua => ua.count), 1);

  const getBrowserName = (agent: any): string => {
    if (typeof agent.browser === 'string') {
      return agent.browser;
    }
    if (typeof agent.browser === 'object' && agent.browser.browser) {
      return agent.browser.browser;
    }
    return 'Unknown';
  };

  return (
    <Card title="User Agents" icon={<Monitor className="w-5 h-5 text-primary" />}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {topAgents.map((agent, idx) => {
          const browserName = getBrowserName(agent);
          return (
            <div key={idx} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate flex-1 text-foreground" title={browserName}>
                  {browserName}
                </span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground ml-2">
                  <span className="font-medium">{formatNumber(agent.count)}</span>
                  <span className="font-semibold text-primary">{agent.percentage.toFixed(1)}%</span>
                </div>
              </div>
              <div className="h-2 w-full bg-accent rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${(agent.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}