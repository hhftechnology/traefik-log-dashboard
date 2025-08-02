import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertCircle, CheckCircle, Clock, Globe, Server, TrendingUp, HardDrive, Calendar } from "lucide-react";
import { Stats } from "@/hooks/useWebSocket";

interface StatsCardsProps {
  stats: Stats | null;
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Helper function to format date for display
function formatDateForDisplay(dateStr: string): string {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  } catch {
    return 'N/A';
  }
}

export function StatsCards({ stats }: StatsCardsProps) {
  if (!stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[...Array(10)].map((_, i) => (
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
      title: "Data Transmitted",
      value: formatBytes(stats.totalDataTransmitted || 0),
      icon: HardDrive,
      description: "Total bandwidth",
      color: "text-cyan-600",
    },
    {
      title: "Analysis Period",
      value: stats.analysisPeriod || "N/A",
      icon: Calendar,
      description: stats.oldestLogTime && stats.newestLogTime ? 
        `${formatDateForDisplay(stats.oldestLogTime).split(' ')[0]} - ${formatDateForDisplay(stats.newestLogTime).split(' ')[0]}` : 
        "No data",
      color: "text-indigo-600",
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
      value: `${stats.totalRequests > 0 ? ((stats.requests2xx / stats.totalRequests) * 100).toFixed(1) : 0}%`,
      icon: CheckCircle,
      description: "2xx responses",
      color: "text-green-600",
    },
    {
      title: "Error Rate (4xx)",
      value: `${stats.totalRequests > 0 ? ((stats.requests4xx / stats.totalRequests) * 100).toFixed(1) : 0}%`,
      icon: AlertCircle,
      description: "Client errors",
      color: "text-yellow-600",
    },
    {
      title: "Error Rate (5xx)",
      value: `${stats.totalRequests > 0 ? ((stats.requests5xx / stats.totalRequests) * 100).toFixed(1) : 0}%`,
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
      value: (stats.topCountries || []).length.toString(),
      icon: Globe,
      description: "Unique locations",
      color: "text-indigo-600",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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