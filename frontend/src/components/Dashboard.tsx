import { useWebSocket } from "@/hooks/useWebSocket";
import { StatsCards } from "./StatsCards";
import { LogTable } from "./LogTable";
import { GeoMap } from "./GeoMap";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertCircle, Server } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

export function Dashboard() {
  const { logs, stats, isConnected } = useWebSocket();

  const statusCodeData = stats ? Object.entries(stats.statusCodes).map(([code, count]) => ({
    name: code,
    value: count,
    color: getStatusColor(parseInt(code))
  })) : [];

  const serviceData = stats ? Object.entries(stats.services)
    .sort(([, a]: [string, number], [, b]: [string, number]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({
      name,
      value: count
    })) : [];

  function getStatusColor(status: number) {
    if (status >= 200 && status < 300) return "#10b981";
    if (status >= 300 && status < 400) return "#6b7280";
    if (status >= 400 && status < 500) return "#f59e0b";
    if (status >= 500) return "#ef4444";
    return "#9ca3af";
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Traefik Dashboard</h1>
        <Badge variant={isConnected ? "success" : "destructive"}>
          {isConnected ? "Connected" : "Disconnected"}
        </Badge>
      </div>

      <StatsCards stats={stats} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Status Code Distribution
            </CardTitle>
            <CardDescription>HTTP response status codes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusCodeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: { name: string, percent: number }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusCodeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Top Services
            </CardTitle>
            <CardDescription>Most active services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {serviceData.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No service data available
                </div>
              ) : (
                serviceData.map((service: { name: string, value: number }, index) => {
                  const percentage = stats ? ((service.value / stats.totalRequests) * 100).toFixed(1) : 0;
                  return (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full bg-blue-${600 - index * 100}`} />
                        <span className="font-medium text-sm">{service.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{service.value.toLocaleString()}</Badge>
                        <span className="text-xs text-muted-foreground">{percentage}%</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <GeoMap stats={stats} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Recent Logs
          </CardTitle>
          <CardDescription>Real-time log entries</CardDescription>
        </CardHeader>
        <CardContent>
          <LogTable logs={logs} />
        </CardContent>
      </Card>
    </div>
  );
}