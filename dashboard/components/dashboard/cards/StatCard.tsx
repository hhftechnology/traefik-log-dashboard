'use client';

import { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  change?: number;
}

export default function StatCard({
  title,
  value,
  description,
  icon,
  trend = 'neutral',
  change,
}: StatCardProps) {
  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-600 dark:text-green-400';
    if (trend === 'down') return 'text-primary dark:text-primary';
    return 'text-muted-foreground';
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm hover:shadow-md hover:border-border transition-all">
      <div className="flex items-center justify-between space-x-4">
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline space-x-2">
            <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
            {change !== undefined && (
              <span className={`text-xs font-medium ${getTrendColor()}`}>
                {change > 0 ? '+' : ''}{change.toFixed(1)}%
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 p-3 rounded-lg bg-accent">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}