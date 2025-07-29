import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertCircle, CheckCircle, Clock, Globe, Server, TrendingUp, Users } from "lucide-react";
import { Stats } from "@/hooks/useWebSocket";

interface StatsCardsProps {
  stats: Stats | null;
}

export function StatsCards({ stats }: StatsCardsProps) {
  if (!stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Total Requests",
      value: stats.totalRequests.toLocaleString(),
      icon: Activity,
      description: "All time",
      color: "text-blue-600",
    },
    {
      title: "Requests/sec",
      value: stats.requestsPerSecond.toFixed(1),
      icon: TrendingUp,
      description: "Current rate",
      color: "text-green-600",
    },
    {
      title: "Avg Response Time",
      value: `${stats.avgResponseTime.toFixed(0)}ms`,
      icon: Clock,
      description: "Average latency",
      color: "text-orange-600",
    },
    {
      title: "Success Rate",
      value: `${((stats.requests2xx / stats.totalRequests) * 100).toFixed(1)}%`,
      icon: CheckCircle,
      description: "2xx responses",
      color: "text-green-600",
    },
    {
      title: "Error Rate (4xx)",
      value: `${((stats.requests4xx / stats.totalRequests) * 100).toFixed(1)}%`,
      icon: AlertCircle,
      description: "Client errors",
      color: "text-yellow-600",
    },
    {
      title: "Error Rate (5xx)",
      value: `${((stats.requests5xx / stats.totalRequests) * 100).toFixed(1)}%`,
      icon: AlertCircle,
      description: "Server errors",
      color: "text-red-600",
    },
    {
      title: "Active Services",
      value: Object.keys(stats.services).length.toString(),
      icon: Server,
      description: "Unique services",
      color: "text-purple-600",
    },
    {
      title: "Countries",
      value: Object.keys(stats.countries || {}).length.toString(),
      icon: Globe,
      description: "Unique locations",
      color: "text-indigo-600",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <Icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}