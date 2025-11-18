import React from 'react';

interface DashboardCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export default function DashboardCard({ title, icon, children, className = '' }: DashboardCardProps) {
  return (
    <div className={`bg-card border border-border rounded-lg p-6 hover:border-border transition-colors shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">{title}</h3>
        {icon && <div className="text-primary">{icon}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}