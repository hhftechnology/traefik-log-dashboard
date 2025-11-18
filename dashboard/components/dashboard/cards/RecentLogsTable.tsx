'use client';

import { useState, useMemo } from 'react';
import { List, ChevronDown } from 'lucide-react';
import Card from '@/components/ui/DashboardCard';
import { TraefikLog } from '@/lib/types';

interface Props {
  logs: TraefikLog[];
}

const defaultColumns = [
  { id: 'StartUTC', header: 'Time', width: 'w-32' },
  { id: 'ClientHost', header: 'Client IP', width: 'w-36' },
  { id: 'RequestMethod', header: 'Method', width: 'w-20' },
  { id: 'RequestPath', header: 'Path', width: 'w-64' },
  { id: 'DownstreamStatus', header: 'Status', width: 'w-20' },
  { id: 'Duration', header: 'Resp. Time', width: 'w-24' },
  { id: 'ServiceName', header: 'Service', width: 'w-40' },
  { id: 'RouterName', header: 'Router', width: 'w-40' },
];

const optionalColumns = [
  { id: 'RequestHost', header: 'Host' },
  { id: 'RequestAddr', header: 'Request Addr' },
  { id: 'ClientPort', header: 'Client Port' },
  { id: 'RequestProtocol', header: 'Protocol' },
  { id: 'DownstreamContentSize', header: 'Content Size' },
  { id: 'OriginDuration', header: 'Origin Duration' },
  { id: 'Overhead', header: 'Overhead' },
  { id: 'request_User_Agent', header: 'User Agent' },
];

export default function RecentLogsTable({ logs }: Props) {
  const [visibleOptionalColumns, setVisibleOptionalColumns] = useState<Set<string>>(new Set());

  const toggleColumn = (id: string) => {
    setVisibleOptionalColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const visibleColumns = [
    ...defaultColumns,
    ...optionalColumns.filter(col => visibleOptionalColumns.has(col.id))
  ];

  const sortedLogs = useMemo(() => {
    return [...logs]
      .sort((a, b) => {
        const timeA = new Date(a.StartUTC || a.StartLocal).getTime();
        const timeB = new Date(b.StartUTC || b.StartLocal).getTime();
        return timeB - timeA;
      })
      .slice(0, 1000);
  }, [logs]);

  const formatDuration = (durationNs: number): string => {
    if (!durationNs) return 'N/A';
    const ms = durationNs / 1000000;
    return `${ms.toFixed(1)}ms`;
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const getStatusColor = (status: number): string => {
    if (status >= 200 && status < 300) return 'text-green-600 font-semibold';
    if (status >= 300 && status < 400) return 'text-blue-600 font-semibold';
    if (status >= 400 && status < 500) return 'text-yellow-600 font-semibold';
    if (status >= 500) return 'text-red-600 font-semibold';
    return 'text-gray-600';
  };

  const getMethodColor = (method: string): string => {
    switch (method) {
      case 'GET': return 'text-blue-600';
      case 'POST': return 'text-green-600';
      case 'PUT': return 'text-yellow-600';
      case 'DELETE': return 'text-red-600';
      case 'PATCH': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  const renderCell = (log: TraefikLog, columnId: string) => {
    const value = log[columnId as keyof TraefikLog];
    
    switch (columnId) {
      case 'StartUTC':
      case 'StartLocal':
        try {
          return <span className="text-xs text-foreground">{new Date(value as string).toLocaleTimeString()}</span>;
        } catch {
          return <span className="text-xs text-foreground">{String(value || 'N/A')}</span>;
        }
      
      case 'DownstreamStatus':
        return <span className={`text-xs font-semibold ${getStatusColor(value as number)}`}>{value || 'N/A'}</span>;
      
      case 'Duration':
      case 'OriginDuration':
      case 'Overhead':
        return <span className="font-mono text-xs text-foreground">{formatDuration(value as number)}</span>;

      case 'DownstreamContentSize':
      case 'RequestContentSize':
        return <span className="font-mono text-xs text-foreground">{formatBytes(value as number)}</span>;

      case 'ClientHost':
      case 'RequestAddr':
        return <span className="font-mono text-xs text-foreground">{value || 'N/A'}</span>;
      
      case 'RequestMethod':
        return <span className={`font-bold text-xs uppercase ${getMethodColor(value as string)}`}>{value}</span>;
      
      case 'RequestPath':
        return <span className="font-mono text-xs truncate max-w-md block text-foreground" title={value as string}>{value || '/'}</span>;

      case 'ServiceName':
      case 'RouterName':
        return <span className="text-xs truncate block text-foreground" title={value as string}>{value || 'N/A'}</span>;

      default:
        return <span className="text-xs truncate block text-foreground">{String(value || 'N/A')}</span>;
    }
  };

  if (!logs || logs.length === 0) {
    return (
      <Card title="Recent Logs" icon={<List className="w-5 h-5 text-primary" />}>
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          No logs available
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Recent Logs"
      icon={
        <div className="relative">
          <details className="relative">
            <summary className="flex items-center gap-1 cursor-pointer text-xs font-medium bg-accent hover:bg-accent px-3 py-1.5 rounded-md transition-colors list-none">
              <span className="text-primary">Additional Columns</span>
              <ChevronDown className="w-3.5 h-3.5 text-primary" />
            </summary>
            <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-50 p-2 space-y-1 max-h-80 overflow-y-auto">
              {optionalColumns.map(col => (
                <label
                  key={col.id}
                  className="flex items-center gap-2 text-sm px-2 py-1.5 hover:bg-accent rounded-md cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={visibleOptionalColumns.has(col.id)}
                    onChange={() => toggleColumn(col.id)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-foreground">{col.header}</span>
                </label>
              ))}
            </div>
          </details>
        </div>
      }
    >
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-border">
              {visibleColumns.map(col => (
                <th
                  key={col.id}
                  className={`text-left py-3 px-3 text-xs font-bold uppercase tracking-wider text-foreground bg-accent ${(col as any).width || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedLogs.slice(0, 100).map((log, idx) => (
              <tr
                key={`${log.StartUTC}-${idx}`}
                className="border-b border-border hover:bg-accent transition-colors"
              >
                {visibleColumns.map(col => (
                  <td
                    key={col.id}
                    className={`py-2.5 px-3 align-top ${(col as any).width || ''}`}
                  >
                    {renderCell(log, col.id)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {Math.min(100, sortedLogs.length)} of {sortedLogs.length} logs
          {sortedLogs.length === 1000 && ' (max 1000)'}
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-primary rounded-full animate-pulse"></span>
          Live updates
        </span>
      </div>
    </Card>
  );
}