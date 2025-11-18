'use client';

import { AlertCircle } from 'lucide-react';
import Card from '@/components/ui/DashboardCard';
import { ErrorLog } from '@/lib/types';

interface Props {
  errors: ErrorLog[];
}

export default function ErrorsCard({ errors }: Props) {
  if (!errors || errors.length === 0) {
    return (
      <Card title="Recent Errors" icon={<AlertCircle className="w-5 h-5 text-primary" />}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No errors detected</p>
          <p className="text-xs text-muted-foreground mt-1">All systems operating normally</p>
        </div>
      </Card>
    );
  }

  const recentErrors = errors.slice(0, 10);

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return 'bg-primary/10 text-primary border-border font-semibold';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300 font-semibold';
      default:
        return 'bg-accent text-foreground border-border font-medium';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <Card title="Recent Errors" icon={<AlertCircle className="w-5 h-5 text-primary" />}>
      <div className="space-y-3">
        {recentErrors.map((error, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
          >
            <div className="flex-shrink-0 mt-0.5">
              <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getLevelColor(error.level)}`}>
                {error.level}
              </span>
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-sm font-mono leading-tight break-words text-foreground">
                {error.message}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatTimestamp(error.timestamp)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}