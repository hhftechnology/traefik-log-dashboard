import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LogEntry } from "@/hooks/useWebSocket";
import { format } from "date-fns";
import { Globe, Clock, Server, Router } from "lucide-react";

interface LogTableProps {
  logs: LogEntry[];
}

export function LogTable({ logs }: LogTableProps) {
  const getStatusBadgeVariant = (status: number) => {
    if (status >= 200 && status < 300) return "success";
    if (status >= 300 && status < 400) return "secondary";
    if (status >= 400 && status < 500) return "warning";
    if (status >= 500) return "destructive";
    return "default";
  };

  const getMethodBadgeVariant = (method: string) => {
    switch (method) {
      case "GET":
        return "secondary";
      case "POST":
        return "default";
      case "PUT":
      case "PATCH":
        return "warning";
      case "DELETE":
        return "destructive";
      default:
        return "outline";
    }
  };

  const formatResponseTime = (time: number) => {
    if (time < 100) return { value: time.toFixed(0), unit: "ms", color: "text-green-600" };
    if (time < 1000) return { value: time.toFixed(0), unit: "ms", color: "text-yellow-600" };
    return { value: (time / 1000).toFixed(2), unit: "s", color: "text-red-600" };
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Path</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Response Time</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Router</TableHead>
            <TableHead>Client IP</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Size</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                No logs found. Waiting for incoming requests...
              </TableCell>
            </TableRow>
          ) : (
            logs.map((log) => {
              const responseTime = formatResponseTime(log.responseTime);
              return (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-xs">
                    {format(new Date(log.timestamp), "HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getMethodBadgeVariant(log.method)}>
                      {log.method}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate font-mono text-xs">
                    {log.path}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(log.status)}>
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`font-mono text-xs ${responseTime.color}`}>
                      {responseTime.value}{responseTime.unit}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Server className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs">{log.serviceName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Router className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs">{log.routerName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.clientIP}
                  </TableCell>
                  <TableCell>
                    {log.country && (
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">
                          {log.countryCode} - {log.city}
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {(log.size / 1024).toFixed(1)} KB
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}