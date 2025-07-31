import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Globe, Server, Router, Network, ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useEffect, useState } from "react";
import axios from "axios";

interface LogTableProps {
  logs: LogEntry[];
  requestLogs: (params: { page: number, limit: number }) => void;
}

type SortColumn = 'method' | 'status' | 'responseTime' | 'serviceName' | 'routerName' | 'requestAddr' | 'requestHost' | 'clientIP' | 'location';
type SortDirection = 'asc' | 'desc' | null;

export function LogTable({ logs: initialLogs, requestLogs }: LogTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
  const [loading, setLoading] = useState(false);
  const [hideUnknown, setHideUnknown] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Fetch logs from API
  const fetchLogs = async (page: number, limit: number) => {
    setLoading(true);
    try {
      const response = await axios.get('/api/logs', {
        params: {
          page,
          limit,
          hideUnknown
        }
      });
      setLogs(response.data.logs);
      setTotalPages(response.data.totalPages);
      setTotalLogs(response.data.total);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch logs when page, pageSize, or hideUnknown changes
  useEffect(() => {
    fetchLogs(currentPage, pageSize);
  }, [currentPage, pageSize, hideUnknown]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [hideUnknown, pageSize]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
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

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }

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

  // Calculate page range for pagination display
  const getPageRange = () => {
    const delta = 2;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    range.forEach((i) => {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    });

    return rangeWithDots;
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="hide-unknown" 
              checked={hideUnknown}
              onCheckedChange={(checked) => setHideUnknown(checked as boolean)}
            />
            <Label 
              htmlFor="hide-unknown" 
              className="text-sm font-normal cursor-pointer"
            >
              Hide entries with unknown service/router
            </Label>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Show</span>
            <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="150">150</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">entries</span>
          </div>
          
          <div className="text-sm text-muted-foreground">
            Showing {Math.min((currentPage - 1) * pageSize + 1, totalLogs)} to {Math.min(currentPage * pageSize, totalLogs)} of {totalLogs} entries
          </div>
        </div>
      </div>

      {/* Table */}
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
            {loading ? (
              <TableRow>
                <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                  Loading logs...
                </TableCell>
              </TableRow>
            ) : sortedLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                  No logs found. {hideUnknown && "Try disabling the 'Hide unknown' filter."}
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
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Total {totalLogs} entries
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1 || loading}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1 || loading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex gap-1">
            {getPageRange().map((page, index) => {
              if (page === '...') {
                return <span key={`dots-${index}`} className="px-2 py-1">...</span>;
              }
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page as number)}
                  disabled={loading}
                  className="min-w-[40px]"
                >
                  {page}
                </Button>
              );
            })}
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages || loading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages || loading}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}