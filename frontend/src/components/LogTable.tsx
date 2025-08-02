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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogEntry } from "@/hooks/useWebSocket";
import { format } from "date-fns";
import { Globe, Server, Router, Network, ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Settings } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import axios from "axios";

interface LogTableProps {
  logs: LogEntry[];
}

type SortColumn = keyof LogEntry;
type SortDirection = 'asc' | 'desc' | null;

export function LogTable({ logs: realtimeLogs }: LogTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [apiLogs, setApiLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hideUnknown, setHideUnknown] = useState(false);
  const [hidePrivateIPs, setHidePrivateIPs] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection | null>(null);
  const [pathTruncateLength, setPathTruncateLength] = useState(50); // Configurable path length

  // Column visibility state
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    id: false,
    timestamp: true,
    clientIP: true,
    method: true,
    path: true,
    status: true,
    responseTime: true,
    serviceName: true,
    routerName: true,
    host: false,
    requestAddr: true,
    requestHost: true,
    userAgent: false,
    size: true,
    country: true,
    city: false,
    countryCode: false,
    lat: false,
    lon: false,
    StartUTC: false,
    StartLocal: false,
    Duration: false,
    ServiceURL: false,
    ServiceAddr: false,
    ClientHost: false,
    ClientPort: false,
    ClientUsername: false,
    RequestPort: false,
    RequestProtocol: false,
    RequestScheme: false,
    RequestLine: false,
    RequestContentSize: false,
    OriginDuration: false,
    OriginContentSize: false,
    OriginStatus: false,
    DownstreamStatus: false,
    RequestCount: false,
    GzipRatio: false,
    Overhead: false,
    RetryAttempts: false,
    TLSVersion: false,
    TLSCipher: false,
    TLSClientSubject: false,
    TraceId: false,
    SpanId: false,
    "downstream_X-Content-Type-Options": false,
    "downstream_X-Frame-Options": false,
    "origin_X-Content-Type-Options": false,
    "origin_X-Frame-Options": false,
    "request_Accept": false,
    "request_Accept-Encoding": false,
    "request_Accept-Language": false,
    "request_Cdn-Loop": false,
    "request_Cf-Connecting-Ip": true,
    "request_Cf-Ipcountry": true,
    "request_Cf-Ray": false,
    "request_Cf-Visitor": false,
    "request_Cf-Warp-Tag-Id": false,
    "request_Dnt": false,
    "request_Priority": false,
    "request_Sec-Fetch-Dest": false,
    "request_Sec-Fetch-Mode": false,
    "request_Sec-Fetch-Site": false,
    "request_Sec-Fetch-User": false,
    "request_Sec-Gpc": false,
    "request_Upgrade-Insecure-Requests": false,
    "request_User-Agent": false,
    "request_X-Forwarded-Host": false,
    "request_X-Forwarded-Port": false,
    "request_X-Forwarded-Proto": false,
    "request_X-Forwarded-Server": false,
    "request_X-Real-Ip": true,
  });

  const columnNames: Record<string, string> = {
    id: 'ID',
    timestamp: 'Time',
    clientIP: 'Client IP',
    method: 'Method',
    path: 'Path',
    status: 'Status',
    responseTime: 'Response Time',
    serviceName: 'Service',
    routerName: 'Router',
    host: 'Host',
    requestAddr: 'Request Addr',
    requestHost: 'Request Host',
    userAgent: 'User Agent',
    size: 'Size',
    country: 'Location',
    city: 'City',
    countryCode: 'Country Code',
    lat: 'Latitude',
    lon: 'Longitude',
    StartUTC: 'Start UTC',
    StartLocal: 'Start Local',
    Duration: 'Duration (ns)',
    ServiceURL: 'Service URL',
    ServiceAddr: 'Service Addr',
    ClientHost: 'Client Host',
    ClientPort: 'Client Port',
    ClientUsername: 'Client Username',
    RequestPort: 'Request Port',
    RequestProtocol: 'Request Protocol',
    RequestScheme: 'Request Scheme',
    RequestLine: 'Request Line',
    RequestContentSize: 'Request Content Size',
    OriginDuration: 'Origin Duration (ns)',
    OriginContentSize: 'Origin Content Size',
    OriginStatus: 'Origin Status',
    DownstreamStatus: 'Downstream Status',
    RequestCount: 'Request Count',
    GzipRatio: 'Gzip Ratio',
    Overhead: 'Overhead (ns)',
    RetryAttempts: 'Retry Attempts',
    TLSVersion: 'TLS Version',
    TLSCipher: 'TLS Cipher',
    TLSClientSubject: 'TLS Client Subject',
    TraceId: 'Trace ID',
    SpanId: 'Span ID',
    "downstream_X-Content-Type-Options": "Downstream X-Content-Type-Options",
    "downstream_X-Frame-Options": "Downstream X-Frame-Options",
    "origin_X-Content-Type-Options": "Origin X-Content-Type-Options",
    "origin_X-Frame-Options": "Origin X-Frame-Options",
    "request_Accept": "Accept",
    "request_Accept-Encoding": "Accept-Encoding",
    "request_Accept-Language": "Accept-Language",
    "request_Cdn-Loop": "CDN Loop",
    "request_Cf-Connecting-Ip": "CF Connecting IP",
    "request_Cf-Ipcountry": "CF IP Country",
    "request_Cf-Ray": "CF Ray",
    "request_Cf-Visitor": "CF Visitor",
    "request_Cf-Warp-Tag-Id": "CF Warp Tag ID",
    "request_Dnt": "DNT",
    "request_Priority": "Priority",
    "request_Sec-Fetch-Dest": "Sec-Fetch-Dest",
    "request_Sec-Fetch-Mode": "Sec-Fetch-Mode",
    "request_Sec-Fetch-Site": "Sec-Fetch-Site",
    "request_Sec-Fetch-User": "Sec-Fetch-User",
    "request_Sec-Gpc": "Sec-GPC",
    "request_Upgrade-Insecure-Requests": "Upgrade-Insecure-Requests",
    "request_User-Agent": "User-Agent",
    "request_X-Forwarded-Host": "X-Forwarded-Host",
    "request_X-Forwarded-Port": "X-Forwarded-Port",
    "request_X-Forwarded-Proto": "X-Forwarded-Proto",
    "request_X-Forwarded-Server": "X-Forwarded-Server",
    "request_X-Real-Ip": "X-Real-IP",
  };

  const visibleColumns = useMemo(() => {
    return (Object.keys(columnVisibility) as Array<keyof LogEntry>).filter(key => columnVisibility[key]);
  }, [columnVisibility]);

  // Determine if we should use real-time logs or API logs
  const shouldUseRealtimeLogs = currentPage === 1 && !hideUnknown && !hidePrivateIPs;

  // Choose the appropriate log source
  const displayLogs = shouldUseRealtimeLogs ? realtimeLogs.slice(0, pageSize) : apiLogs;

  const fetchLogs = async (page: number, limit: number) => {
    setLoading(true);
    try {
      const response = await axios.get('/api/logs', {
        params: {
          page,
          limit,
          hideUnknown,
          hidePrivateIPs
        }
      });
      setApiLogs(response.data.logs);
      setTotalPages(response.data.totalPages);
      setTotalLogs(response.data.total);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update total logs count for real-time mode
  useEffect(() => {
    if (shouldUseRealtimeLogs) {
      setTotalLogs(realtimeLogs.length);
      setTotalPages(Math.ceil(realtimeLogs.length / pageSize));
    }
  }, [realtimeLogs.length, pageSize, shouldUseRealtimeLogs]);

  // Fetch logs when not using real-time mode
  useEffect(() => {
    if (!shouldUseRealtimeLogs) {
      fetchLogs(currentPage, pageSize);
    }
  }, [currentPage, pageSize, hideUnknown, hidePrivateIPs, shouldUseRealtimeLogs]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [hideUnknown, pageSize, hidePrivateIPs]);

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

  const sortedLogs = [...displayLogs].sort((a, b) => {
    if (!sortColumn || !sortDirection) return 0;

    let aValue = a[sortColumn];
    let bValue = b[sortColumn];
    
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
    if (time < 100) return { value: time.toFixed(0), unit: "ms", color: "text-green-600 dark:text-green-400" };
    if (time < 1000) return { value: time.toFixed(0), unit: "ms", color: "text-yellow-600 dark:text-yellow-400" };
    return { value: (time / 1000).toFixed(2), unit: "s", color: "text-red-600 dark:text-red-400" };
  };

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

  const renderCellContent = (log: LogEntry, column: string) => {
    switch (column) {
      case 'timestamp':
        return <span className="font-mono text-xs">{format(new Date(log.timestamp), "HH:mm:ss")}</span>;
      case 'method':
        return <Badge variant={getMethodBadgeVariant(log.method)}>{log.method}</Badge>;
      case 'path':
        const truncatedPath = log.path.length > pathTruncateLength 
          ? `${log.path.substring(0, pathTruncateLength)}...` 
          : log.path;
        return (
          <span 
            className="max-w-xs font-mono text-xs cursor-help hover:text-blue-600 dark:hover:text-blue-400 transition-colors" 
            title={log.path}
            style={{ 
              display: 'block',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {truncatedPath}
          </span>
        );
      case 'status':
        return <Badge variant={getStatusBadgeVariant(log.status)}>{log.status}</Badge>;
      case 'responseTime':
        const responseTime = formatResponseTime(log.responseTime);
        return <span className={`font-mono text-xs ${responseTime.color}`}>{responseTime.value}{responseTime.unit}</span>;
      case 'serviceName':
        return <div className="flex items-center gap-1"><Server className="h-3 w-3 text-muted-foreground" /><span className="text-xs">{log.serviceName}</span></div>;
      case 'routerName':
        return <div className="flex items-center gap-1"><Router className="h-3 w-3 text-muted-foreground" /><span className="text-xs">{log.routerName}</span></div>;
      case 'requestAddr':
        return <div className="flex items-center gap-1"><Network className="h-3 w-3 text-muted-foreground" /><span className="text-xs font-mono max-w-32 truncate" title={log.requestAddr}>{log.requestAddr || '-'}</span></div>;
      case 'requestHost':
        return <div className="flex items-center gap-1"><ExternalLink className="h-3 w-3 text-muted-foreground" /><span className="text-xs font-mono max-w-32 truncate" title={log.requestHost}>{log.requestHost || '-'}</span></div>;
      case 'country':
        return log.country ? <div className="flex items-center gap-1"><Globe className="h-3 w-3 text-muted-foreground" /><span className="text-xs">{log.countryCode} - {log.city}</span></div> : null;
      case 'size':
        return <span className="text-xs">{(log.size / 1024).toFixed(1)} KB</span>;
      default:
        return <span className="text-xs">{String(log[column as keyof LogEntry] ?? '-')}</span>;
    }
  };
  
  return (
    <div className="space-y-4">
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
              Hide unknown service/router
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="hide-private-ips" 
              checked={hidePrivateIPs}
              onCheckedChange={(checked) => setHidePrivateIPs(checked as boolean)}
            />
            <Label 
              htmlFor="hide-private-ips" 
              className="text-sm font-normal cursor-pointer"
            >
              Hide private IPs
            </Label>
          </div>
          {shouldUseRealtimeLogs && (
            <Badge variant="secondary" className="text-xs">
              Real-time
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Path length:</span>
            <Select value={pathTruncateLength.toString()} onValueChange={(value) => setPathTruncateLength(parseInt(value))}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="80">80</SelectItem>
                <SelectItem value="120">120</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {(Object.keys(columnNames) as Array<string>).map(key => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={columnVisibility[key]}
                  onCheckedChange={checked =>
                    setColumnVisibility(prev => ({ ...prev, [key]: checked }))
                  }
                >
                  {columnNames[key]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.map(column => (
                <TableHead 
                  key={column}
                  className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={() => handleSort(column as SortColumn)}
                >
                  <div className="flex items-center gap-1">
                    {columnNames[column]}
                    {getSortIcon(column as SortColumn)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !shouldUseRealtimeLogs ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} className="h-24 text-center text-muted-foreground">
                  Loading logs...
                </TableCell>
              </TableRow>
            ) : sortedLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} className="h-24 text-center text-muted-foreground">
                  No logs found. {hideUnknown && "Try disabling the 'Hide unknown' filter."}
                </TableCell>
              </TableRow>
            ) : (
              sortedLogs.map((log) => (
                <TableRow key={log.id}>
                  {visibleColumns.map(column => (
                    <TableCell key={column}>
                      {renderCellContent(log, column as keyof LogEntry)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
                return <span key={`dots-${index}`} className="px-2 py-1 text-muted-foreground">...</span>;
              }
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? "secondary" : "outline"}
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