'use client';

import { memo } from 'react';
import { Users, Globe, Network, Monitor } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardMetrics } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

interface ClientsSectionProps {
  metrics: DashboardMetrics;
}

function ClientsSection({ metrics }: ClientsSectionProps) {
  const maxIPCount = Math.max(...metrics.topClientIPs.map(c => c.count), 1);
  const maxHostCount = Math.max(...metrics.topRequestHosts.map(h => h.count), 1);
  const maxAddressCount = Math.max(...metrics.topRequestAddresses.map(a => a.count), 1);

  // Calculate total for percentages
  const totalUserAgentRequests = metrics.userAgents.reduce((sum, ua) => sum + ua.count, 0);

  return (
    <div className="space-y-6">
      {/* Client Data Tabs */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">Client Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="ips" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ips" className="gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Client IPs</span>
              </TabsTrigger>
              <TabsTrigger value="hosts" className="gap-2">
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">Hosts</span>
              </TabsTrigger>
              <TabsTrigger value="addresses" className="gap-2">
                <Network className="h-4 w-4" />
                <span className="hidden sm:inline">Addresses</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ips" className="mt-4">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {metrics.topClientIPs.slice(0, 15).map((client, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <code className="font-mono text-xs bg-muted px-2 py-1 rounded">
                        {client.ip}
                      </code>
                      <span className="font-semibold">{formatNumber(client.count)}</span>
                    </div>
                    <Progress value={(client.count / maxIPCount) * 100} className="h-1.5" />
                  </div>
                ))}
                {metrics.topClientIPs.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No client IP data available</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="hosts" className="mt-4">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {metrics.topRequestHosts.slice(0, 15).map((host, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate max-w-[250px]" title={host.host}>
                        {host.host}
                      </span>
                      <span className="font-semibold">{formatNumber(host.count)}</span>
                    </div>
                    <Progress value={(host.count / maxHostCount) * 100} className="h-1.5" />
                  </div>
                ))}
                {metrics.topRequestHosts.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No host data available</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="addresses" className="mt-4">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {metrics.topRequestAddresses.slice(0, 15).map((address, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <code className="font-mono text-xs bg-muted px-2 py-1 rounded truncate max-w-[250px]" title={address.addr}>
                        {address.addr}
                      </code>
                      <span className="font-semibold">{formatNumber(address.count)}</span>
                    </div>
                    <Progress value={(address.count / maxAddressCount) * 100} className="h-1.5" />
                  </div>
                ))}
                {metrics.topRequestAddresses.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No address data available</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* User Agents */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">User Agents</CardTitle>
          <Monitor className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics.userAgents.slice(0, 12).map((ua, idx) => {
              const percentage = totalUserAgentRequests > 0 ? (ua.count / totalUserAgentRequests) * 100 : 0;
              return (
                <div key={idx} className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm truncate" title={ua.browser}>
                      {ua.browser}
                    </span>
                    <span className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</span>
                  </div>
                  <div className="text-lg font-bold text-primary">{formatNumber(ua.count)}</div>
                  <Progress value={percentage} className="h-1 mt-2" />
                </div>
              );
            })}
          </div>
          {metrics.userAgents.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No user agent data available</p>
          )}
          {metrics.userAgents.length > 12 && (
            <p className="text-xs text-muted-foreground text-center mt-4">
              Showing top 12 of {metrics.userAgents.length} user agents
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default memo(ClientsSection);
