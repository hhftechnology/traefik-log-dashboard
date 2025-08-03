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
import { 
  Globe, 
  Server, 
  Router, 
  Network, 
  ExternalLink, 
  ChevronUp, 
  ChevronDown, 
  ChevronsUpDown, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Settings,
  Wifi,
  WifiOff,
  Info
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";

interface LogTableProps {
  logs: LogEntry[];
  isConnected: boolean;
}

type SortColumn = keyof LogEntry;
type SortDirection = 'asc' | 'desc' | null;

export function LogTable({ logs: realtimeLogs, isConnected }: LogTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(200);
  const [hideUnknown, setHideUnknown] = useState(false);
  const [hidePrivateIPs, setHidePrivateIPs] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection | null>(null);
  const [pathTruncateLength, setPathTruncateLength] = useState(50);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Debug: Log when logs prop changes
  useEffect(() => {
    console.log(`[LogTable] Received ${realtimeLogs.length} logs from WebSocket`);
  }, [realtimeLogs.length]);

  // Column visibility state - show essential columns by default
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    timestamp: true,
    clientIP: true,
    method: true,
    path: true,
    status: true,
    responseTime: true,
    serviceName: true,
    routerName: true,
    requestAddr: true,
    requestHost: true,
    size: true,
    country: true,
    // Hide less important columns by default
    id: false,
    host: false,
    userAgent: false,
    city: false,
    countryCode: false,
    lat: false,
    lon: false,
    // Hide all detailed fields by default
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
  };

  const visibleColumns = useMemo(() => {
    return (Object.keys(columnVisibility) as Array<keyof LogEntry>).filter(key => columnVisibility[key]);
  }, [columnVisibility]);

  // Helper function to check if IP is private
  const isPrivateIP = (ip: string) => {
    if (ip === "" || ip === "unknown") return true;
    const parts = ip.split(".");
    if (parts.length !== 4) return false;
    return ip === "127.0.0.1" ||
      ip === "localhost" ||
      ip.startsWith("::") ||
      ip === "::1" ||
      parts[0] === "10" ||
      (parts[0] === "172" && parseInt(parts[1]) >= 16 && parseInt(parts[1]) <= 31) ||
      (parts[0] === "192" && parts[1] === "168") ||
      (parts[0] === "169" && parts[1] === "254");
  };

  // Apply filters to real-time logs with useMemo for performance
  const filteredLogs = useMemo(() => {
    const filtered = realtimeLogs.filter(log => {
      if (hideUnknown && (log.serviceName === "unknown" || log.routerName === "unknown")) {
        return false;
      }
      if (hidePrivateIPs && isPrivateIP(log.clientIP)) {
        return false;
      }
      return true;
    });
    
    console.log(`[LogTable] Filtered ${realtimeLogs.length} -> ${filtered.length} logs (hideUnknown: ${hideUnknown}, hidePrivateIPs: ${hidePrivateIPs})`);
    return filtered;
  }, [realtimeLogs, hideUnknown, hidePrivateIPs]);

  // Apply sorting with useMemo for performance
  const sortedLogs = useMemo(() => {
    if (!sortColumn || !sortDirection) {
      return filteredLogs;
    }

    const sorted = [...filteredLogs].sort((a, b) => {
      let aValue = a[sortColumn];
      let bValue = b[sortColumn];
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue || '').toLowerCase();
      const bStr = String(bValue || '').toLowerCase();
      
      if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    console.log(`[LogTable] Sorted ${filteredLogs.length} logs by ${sortColumn} ${sortDirection}`);
    return sorted;
  }, [filteredLogs, sortColumn, sortDirection]);

  // Calculate pagination
  const totalLogs = sortedLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalLogs / pageSize));
  
  // Auto-scroll to first page when new logs arrive (if enabled)
  useEffect(() => {
    if (autoScroll && realtimeLogs.length > 0) {
      setCurrentPage(1);
    }
  }, [realtimeLogs.length, autoScroll]);

  // Calculate display logs for current page
  const startIndex = Math.max(0, (currentPage - 1) * pageSize);
  const endIndex = Math.min(startIndex + pageSize, totalLogs);
  const displayLogs = sortedLogs.slice(startIndex, endIndex);

  console.log(`[LogTable] Displaying ${displayLogs.length} logs (page ${currentPage}/${totalPages}, range ${startIndex}-${endIndex})`);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [hideUnknown, hidePrivateIPs, pageSize]);

  // Ensure current page is valid
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (currentPage < 1 && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

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

  const getStatusBadgeVariant = (status: number) => {
    if (status >= 200 && status < 300) return "success";
    if (status >= 300 && status < 400) return "secondary";
    if (status >= 400 && status < 500) return "warning";
    if (status >= 500) return "destructive";
    return "default";
  };

  const getMethodBadgeVariant = (method: string) => {
    switch (method) {
      case "GET": return "secondary";
      case "POST": return "default";
      case "PUT":
      case "PATCH": return "warning";
      case "DELETE": return "destructive";
      default: return "outline";
    }
  };

  const formatResponseTime = (time: number) => {
    if (time < 100) return { value: time.toFixed(0), unit: "ms", color: "text-green-600 dark:text-green-400" };
    if (time < 1000) return { value: time.toFixed(0), unit: "ms", color: "text-yellow-600 dark:text-yellow-400" };
    return { value: (time / 1000).toFixed(2), unit: "s", color: "text-red-600 dark:text-red-400" };
  };

  const renderCellContent = (log: LogEntry, column: string) => {
    const value = log[column as keyof LogEntry];
    
    switch (column) {
      case 'timestamp':
        return (
          <span className="font-mono text-xs" title={log.timestamp}>
            {format(new Date(log.timestamp), "HH:mm:ss")}
          </span>
        );
      case 'method':
        return <Badge variant={getMethodBadgeVariant(log.method)}>{log.method}</Badge>;
      case 'path':
        const truncatedPath = log.path.length > pathTruncateLength 
          ? `${log.path.substring(0, pathTruncateLength)}...` 
          : log.path;
        return (
          <span 
            className="max-w-xs font-mono text-xs cursor-help hover:text-blue-600 dark:hover:text-blue-400 transition-colors block truncate" 
            title={log.path}
          >
            {truncatedPath}
          </span>
        );
      case 'status':
        return <Badge variant={getStatusBadgeVariant(log.status)}>{log.status}</Badge>;
      case 'responseTime':
        const responseTime = formatResponseTime(log.responseTime);
        return (
          <span className={`font-mono text-xs ${responseTime.color}`}>
            {responseTime.value}{responseTime.unit}
          </span>
        );
      case 'serviceName':
        return (
          <div className="flex items-center gap-1">
            <Server className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs">{log.serviceName}</span>
          </div>
        );
      case 'routerName':
        return (
          <div className="flex items-center gap-1">
            <Router className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs">{log.routerName}</span>
          </div>
        );
      case 'requestAddr':
        return (
          <div className="flex items-center gap-1">
            <Network className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-mono max-w-32 truncate" title={log.requestAddr}>
              {log.requestAddr || '-'}
            </span>
          </div>
        );
      case 'requestHost':
        return (
          <div className="flex items-center gap-1">
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs font-mono max-w-32 truncate" title={log.requestHost}>
              {log.requestHost || '-'}
            </span>
          </div>
        );
      case 'country':
        return log.country ? (
          <div className="flex items-center gap-1">
            <Globe className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs">{log.countryCode} - {log.city}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        );
      case 'size':
        return <span className="text-xs">{(log.size / 1024).toFixed(1)} KB</span>;
      default:
        return <span className="text-xs">{String(value ?? '-')}</span>;
    }
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
            <Label htmlFor="hide-unknown" className="text-sm font-normal cursor-pointer">
              Hide unknown service/router
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="hide-private-ips" 
              checked={hidePrivateIPs}
              onCheckedChange={(checked) => setHidePrivateIPs(checked as boolean)}
            />
            <Label htmlFor="hide-private-ips" className="text-sm font-normal cursor-pointer">
              Hide private IPs
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="auto-scroll" 
              checked={autoScroll}
              onCheckedChange={(checked) => setAutoScroll(checked as boolean)}
            />
            <Label htmlFor="auto-scroll" className="text-sm font-normal cursor-pointer">
              Auto-scroll to new logs
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="debug-info" 
              checked={showDebugInfo}
              onCheckedChange={(checked) => setShowDebugInfo(checked as boolean)}
            />
            <Label htmlFor="debug-info" className="text-sm font-normal cursor-pointer">
              Show debug info
            </Label>
          </div>
          
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge variant="success" className="gap-1">
                <Wifi className="h-3 w-3" />
                Real-time
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <WifiOff className="h-3 w-3" />
                Disconnected
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {totalLogs} filtered logs (Total: {realtimeLogs.length})
            </span>
          </div>
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
                <Settings className="h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 max-h-96 overflow-y-auto">
              {Object.entries(columnNames).map(([key, name]) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={columnVisibility[key]}
                  onCheckedChange={checked =>
                    setColumnVisibility(prev => ({ ...prev, [key]: checked }))
                  }
                >
                  {name}
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
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
                <SelectItem value="500">500</SelectItem>
                <SelectItem value="1000">1000</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">entries</span>
          </div>
          
          <div className="text-sm text-muted-foreground">
            Showing {totalLogs > 0 ? startIndex + 1 : 0} to {endIndex} of {totalLogs} entries
          </div>
        </div>
      </div>

      {showDebugInfo && (
        <div className="bg-muted p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-4 w-4" />
            <span className="font-semibold">Debug Information</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Raw logs from WebSocket:</strong> {realtimeLogs.length}
            </div>
            <div>
              <strong>After filtering:</strong> {filteredLogs.length}
            </div>
            <div>
              <strong>After sorting:</strong> {sortedLogs.length}
            </div>
            <div>
              <strong>Current page:</strong> {currentPage} / {totalPages}
            </div>
            <div>
              <strong>Page size:</strong> {pageSize}
            </div>
            <div>
              <strong>Display range:</strong> {startIndex + 1} - {endIndex}
            </div>
            <div>
              <strong>Actually displaying:</strong> {displayLogs.length}
            </div>
            <div>
              <strong>Connection status:</strong> {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
        </div>
      )}

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
            {displayLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} className="h-24 text-center text-muted-foreground">
                  {!isConnected ? (
                    <div className="flex items-center justify-center gap-2">
                      <WifiOff className="h-4 w-4" />
                      <span>WebSocket disconnected. Attempting to reconnect...</span>
                    </div>
                  ) : realtimeLogs.length === 0 ? (
                    "No logs available. Waiting for incoming requests..."
                  ) : (
                    "No logs match the current filters"
                  )}
                </TableCell>
              </TableRow>
            ) : (
              displayLogs.map((log) => (
                <TableRow key={log.id} className="hover:bg-muted/50">
                  {visibleColumns.map(column => (
                    <TableCell key={column} className="py-2 px-4">
                      {renderCellContent(log, column)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Total {totalLogs} filtered entries • Page {currentPage} of {totalPages}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              title="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              title="Previous page"
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
              disabled={currentPage === totalPages}
              title="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon" 
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              title="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}