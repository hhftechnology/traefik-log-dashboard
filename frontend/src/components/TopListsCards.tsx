import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Router, Network, ExternalLink, Users } from "lucide-react";
import { Stats } from "@/hooks/useWebSocket";

interface TopListsCardsProps {
  stats: Stats | null;
}

export function TopListsCards({ stats }: TopListsCardsProps) {
  if (!stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-32 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const topLists = [
    {
      title: "Top Routers",
      description: "Most active routers",
      icon: Router,
      data: stats.topRouters || [],
      color: "text-purple-600",
      dataKey: "router"
    },
    {
      title: "Top Request Addresses", 
      description: "Most requested addresses",
      icon: Network,
      data: stats.topRequestAddrs || [],
      color: "text-cyan-600",
      dataKey: "addr"
    },
    {
      title: "Top Request Hosts",
      description: "Most requested hosts", 
      icon: ExternalLink,
      data: stats.topRequestHosts || [],
      color: "text-emerald-600",
      dataKey: "host"
    },
    {
      title: "Top Client IPs",
      description: "Most active IP addresses",
      icon: Users,
      data: stats.topIPs || [],
      color: "text-orange-600", 
      dataKey: "ip"
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {topLists.map((list, index) => {
        const Icon = list.icon;
        return (
          <Card key={index}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${list.color}`} />
                {list.title}
              </CardTitle>
              <CardDescription>{list.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {list.data.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4">
                    No data available
                  </div>
                ) : (
                  list.data.slice(0, 5).map((item: any, itemIndex) => {
                    const percentage = stats ? ((item.count / stats.totalRequests) * 100).toFixed(1) : 0;
                    const value = item[list.dataKey];
                    const displayValue = value.length > 20 ? `${value.substring(0, 20)}...` : value;
                    
                    return (
                      <div key={itemIndex} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className={`w-2 h-2 rounded-full bg-${list.color.split('-')[1]}-${500 - itemIndex * 50}`} 
                               style={{ backgroundColor: `hsl(${220 - itemIndex * 20}, 70%, ${60 - itemIndex * 5}%)` }} />
                          <span className="font-mono text-xs truncate" title={value}>
                            {displayValue}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="secondary" className="text-xs">
                            {item.count.toLocaleString()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {percentage}%
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}