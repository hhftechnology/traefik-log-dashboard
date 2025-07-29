import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe } from "lucide-react";
import { Stats } from "@/hooks/useWebSocket";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface GeoMapProps {
  stats: Stats | null;
}

export function GeoMap({ stats }: GeoMapProps) {
  if (!stats || !stats.topCountries) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Geographic Distribution
          </CardTitle>
          <CardDescription>Requests by country</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No geographic data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = stats.topCountries.slice(0, 10).map((item: { country: string; count: number }) => ({
    country: item.country,
    requests: item.count
  }));

  const totalRequests = stats.topCountries.reduce((sum: number, item: { country: string; count: number }) => sum + item.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Geographic Distribution
        </CardTitle>
        <CardDescription>Top 10 countries by request count</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="country"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={12}
                />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="requests" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Country Breakdown</h4>
            <div className="grid grid-cols-2 gap-2">
              {stats.topCountries.slice(0, 8).map((item: { country: string; count: number }, index: number) => {
                const percentage = ((item.count / totalRequests) * 100).toFixed(1);
                return (
                  <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">{item.country}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{item.count.toLocaleString()}</Badge>
                      <span className="text-xs text-muted-foreground">{percentage}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}