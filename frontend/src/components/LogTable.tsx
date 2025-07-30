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
import { Globe, Server, Router, Network, ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface LogTableProps {
  logs: LogEntry[];
  requestLogs: (params: { page: number, limit: number }) => void;
}

type SortColumn = 'method' | 'status' | 'responseTime' | 'serviceName' | 'routerName' | 'requestAddr' | 'requestHost' | 'clientIP' | 'location';
type SortDirection = 'asc' | 'desc' | null;

export function LogTable({ logs, requestLogs }: LogTableProps) {
  const [page, setPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const observer = useRef<IntersectionObserver | null>(null);
  const loader = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setPage(prevPage => prevPage + 1);
      }
    });

    if (loader.current) {
      observer.current.observe(loader.current);
    }

    return () => {
      if (observer.current) observer.current.disconnect();
    };
  }, [logs]);

  useEffect(() => {
    if (page > 1) {
      requestLogs({ page, limit: 50 });
    }
  }, [page, requestLogs]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Cycle through: asc -> desc -> none
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortColumn(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />;
    }
    if (sortDirection === 'asc') {
      return <ChevronUp className="h-4 w-4 text-foreground" />;
    }
    if (sortDirection === 'desc') {
      return <ChevronDown className="h-4 w-4 text-foreground" />;
    }
    return <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />;
  };

  const sortedLogs = [...logs].sort((a, b) => {
    if (!sortColumn || !sortDirection) return 0;

    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case 'method':
        aValue = a.method;
        bValue = b.method;
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      case 'responseTime':
        aValue = a.responseTime;
        bValue = b.responseTime;
        break;
      case 'serviceName':
        aValue = a.serviceName;
        bValue = b.serviceName;
        break;
      case 'routerName':
        aValue = a.routerName;
        bValue = b.routerName;
        break;
      case 'requestAddr':
        aValue = a.requestAddr || '';
        bValue = b.requestAddr || '';
        break;
      case 'requestHost':
        aValue = a.requestHost || '';
        bValue = b.requestHost || '';
        break;
      case 'clientIP':
        aValue = a.clientIP;
        bValue = b.clientIP;
        break;
      case 'location':
        aValue = a.country || '';
        bValue = b.country || '';
        break;
      default:
        return 0;
    }

    // Handle different data types
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }

    // String comparison
    const aStr = String(aValue).toLowerCase();
    const bStr = String(bValue).toLowerCase();
    
    if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1;
    if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });


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
            <TableHead 
              className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
              onClick={() => handleSort('method')}
            >
              <div className="flex items-center gap-1">
                Method
                {getSortIcon('method')}
              </div>
            </TableHead>
            <TableHead>Path</TableHead>
            <TableHead 
              className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
              onClick={() => handleSort('status')}
            >
              <div className="flex items-center gap-1">
                Status
                {getSortIcon('status')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
              onClick={() => handleSort('responseTime')}
            >
              <div className="flex items-center gap-1">
                Response Time
                {getSortIcon('responseTime')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
              onClick={() => handleSort('serviceName')}
            >
              <div className="flex items-center gap-1">
                Service
                {getSortIcon('serviceName')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
              onClick={() => handleSort('routerName')}
            >
              <div className="flex items-center gap-1">
                Router
                {getSortIcon('routerName')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
              onClick={() => handleSort('requestAddr')}
            >
              <div className="flex items-center gap-1">
                Request Addr
                {getSortIcon('requestAddr')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
              onClick={() => handleSort('requestHost')}
            >
              <div className="flex items-center gap-1">
                Request Host
                {getSortIcon('requestHost')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
              onClick={() => handleSort('clientIP')}
            >
              <div className="flex items-center gap-1">
                Client IP
                {getSortIcon('clientIP')}
              </div>
            </TableHead>
            <TableHead 
              className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
              onClick={() => handleSort('location')}
            >
              <div className="flex items-center gap-1">
                Location
                {getSortIcon('location')}
              </div>
            </TableHead>
            <TableHead>Size</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedLogs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                No logs found. Waiting for incoming requests...
              </TableCell>
            </TableRow>
          ) : (
            sortedLogs.map((log) => {
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
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Network className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-mono max-w-32 truncate" title={log.requestAddr}>
                        {log.requestAddr || '-'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-mono max-w-32 truncate" title={log.requestHost}>
                        {log.requestHost || '-'}
                      </span>
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
          <TableRow ref={loader}>
            <TableCell colSpan={12} className="text-center text-muted-foreground">
              Loading more logs...
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}