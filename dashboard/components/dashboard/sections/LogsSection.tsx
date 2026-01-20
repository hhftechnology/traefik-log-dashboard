'use client';

import { memo, useState, useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FileText, AlertCircle, Clock, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TraefikLog, ErrorLog } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

interface LogsSectionProps {
  logs: TraefikLog[];
  errors: ErrorLog[];
}

type ColumnKey = 'time' | 'clientIP' | 'method' | 'path' | 'status' | 'duration' | 'service' | 'router' | 'country' | 'city' | 'host' | 'size';

const allColumns: { key: ColumnKey; label: string; default: boolean }[] = [
  { key: 'time', label: 'Time', default: true },
  { key: 'clientIP', label: 'Client IP', default: true },
  { key: 'method', label: 'Method', default: true },
  { key: 'path', label: 'Path', default: true },
  { key: 'status', label: 'Status', default: true },
  { key: 'duration', label: 'Duration', default: true },
  { key: 'service', label: 'Service', default: true },
  { key: 'router', label: 'Router', default: false },
  { key: 'country', label: 'Country', default: false },
  { key: 'city', label: 'City', default: false },
  { key: 'host', label: 'Host', default: false },
  { key: 'size', label: 'Size', default: false },
];

function getMethodColor(method: string): string {
  switch (method?.toUpperCase()) {
    case 'GET': return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300';
    case 'POST': return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300';
    case 'PUT': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300';
    case 'DELETE': return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300';
    case 'PATCH': return 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300';
  if (status >= 300 && status < 400) return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300';
  if (status >= 400 && status < 500) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300';
  if (status >= 500) return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300';
  return 'bg-gray-100 text-gray-700';
}

function formatDuration(ns: number): string {
  if (ns < 1000) return `${ns}ns`;
  if (ns < 1000000) return `${(ns / 1000).toFixed(1)}µs`;
  if (ns < 1000000000) return `${(ns / 1000000).toFixed(1)}ms`;
  return `${(ns / 1000000000).toFixed(2)}s`;
}

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString();
  } catch {
    return dateStr;
  }
}

function LogsSection({ logs, errors }: LogsSectionProps) {
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    new Set(allColumns.filter(c => c.default).map(c => c.key))
  );

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
  });

  const toggleColumn = useCallback((key: ColumnKey) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const columns = useMemo(() =>
    allColumns.filter(c => visibleColumns.has(c.key)),
    [visibleColumns]
  );

  return (
    <div className="space-y-6">
      {/* Errors Card */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">Recent Errors</CardTitle>
          <AlertCircle className="h-5 w-5 text-destructive" />
        </CardHeader>
        <CardContent>
          {errors.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mx-auto mb-3">
                  <AlertCircle className="h-6 w-6 text-green-600" />
                </div>
                <p>No errors recorded</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {errors.slice(0, 10).map((error, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge variant={error.level === 'error' ? 'destructive' : 'secondary'} className="text-xs">
                      {error.level}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTime(error.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm font-mono text-foreground break-all">{error.message}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">Recent Logs</CardTitle>
            <Badge variant="outline" className="text-xs">
              {formatNumber(logs.length)} entries
            </Badge>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <span className="text-xs text-muted-foreground">Live</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  Columns
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {allColumns.map(col => (
                  <DropdownMenuCheckboxItem
                    key={col.key}
                    checked={visibleColumns.has(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <FileText className="h-5 w-5 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No logs available</p>
              </div>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              {/* Header */}
              <div className="bg-muted/50 border-b sticky top-0 z-10">
                <div className="flex text-xs font-medium text-muted-foreground">
                  {columns.map(col => (
                    <div
                      key={col.key}
                      className={`px-3 py-2 ${
                        col.key === 'path' ? 'flex-1 min-w-[200px]' :
                        col.key === 'time' ? 'w-24' :
                        col.key === 'clientIP' ? 'w-32' :
                        col.key === 'method' ? 'w-20' :
                        col.key === 'status' ? 'w-16' :
                        col.key === 'duration' ? 'w-24' :
                        col.key === 'service' ? 'w-32' :
                        'w-28'
                      }`}
                    >
                      {col.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Virtual List */}
              <div
                ref={parentRef}
                className="h-[400px] overflow-auto"
              >
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {virtualizer.getVirtualItems().map(virtualRow => {
                    const log = logs[virtualRow.index];
                    return (
                      <div
                        key={virtualRow.key}
                        className="absolute top-0 left-0 w-full flex items-center border-b hover:bg-muted/30 transition-colors"
                        style={{
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        {visibleColumns.has('time') && (
                          <div className="w-24 px-3 text-xs text-muted-foreground truncate">
                            {formatTime(log.StartLocal || log.StartUTC)}
                          </div>
                        )}
                        {visibleColumns.has('clientIP') && (
                          <div className="w-32 px-3 font-mono text-xs truncate">
                            {log.ClientHost || log.ClientAddr}
                          </div>
                        )}
                        {visibleColumns.has('method') && (
                          <div className="w-20 px-3">
                            <Badge className={`text-xs ${getMethodColor(log.RequestMethod)}`}>
                              {log.RequestMethod}
                            </Badge>
                          </div>
                        )}
                        {visibleColumns.has('path') && (
                          <div className="flex-1 min-w-[200px] px-3 font-mono text-xs truncate" title={log.RequestPath}>
                            {log.RequestPath}
                          </div>
                        )}
                        {visibleColumns.has('status') && (
                          <div className="w-16 px-3">
                            <Badge className={`text-xs ${getStatusColor(log.DownstreamStatus)}`}>
                              {log.DownstreamStatus}
                            </Badge>
                          </div>
                        )}
                        {visibleColumns.has('duration') && (
                          <div className="w-24 px-3 text-xs text-muted-foreground">
                            {formatDuration(log.Duration)}
                          </div>
                        )}
                        {visibleColumns.has('service') && (
                          <div className="w-32 px-3 text-xs truncate" title={log.ServiceName}>
                            {log.ServiceName || '-'}
                          </div>
                        )}
                        {visibleColumns.has('router') && (
                          <div className="w-28 px-3 text-xs truncate" title={log.RouterName}>
                            {log.RouterName || '-'}
                          </div>
                        )}
                        {visibleColumns.has('country') && (
                          <div className="w-28 px-3 text-xs truncate">
                            {log.geoCountry || '-'}
                          </div>
                        )}
                        {visibleColumns.has('city') && (
                          <div className="w-28 px-3 text-xs truncate">
                            {log.geoCity || '-'}
                          </div>
                        )}
                        {visibleColumns.has('host') && (
                          <div className="w-28 px-3 text-xs truncate" title={log.RequestHost}>
                            {log.RequestHost || '-'}
                          </div>
                        )}
                        {visibleColumns.has('size') && (
                          <div className="w-28 px-3 text-xs text-muted-foreground">
                            {log.DownstreamContentSize ? `${(log.DownstreamContentSize / 1024).toFixed(1)}KB` : '-'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default memo(LogsSection);
