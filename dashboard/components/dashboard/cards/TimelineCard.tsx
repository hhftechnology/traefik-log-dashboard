'use client';

import { LineChart } from 'lucide-react';
import Card from '@/components/ui/DashboardCard';
import { TimeSeriesPoint } from '@/lib/types';
import TimeSeriesChart from '@/components/charts/TimeSeriesChart';

interface TimelineCardProps {
  timeline: TimeSeriesPoint[];
}

export default function TimelineCard({ timeline }: TimelineCardProps) {
  if (!timeline || timeline.length === 0) {
    return (
      <Card title="Request Timeline" icon={<LineChart className="w-5 h-5 text-primary" />}>
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          No timeline data available
        </div>
      </Card>
    );
  }

  return (
    <Card title="Request Timeline" icon={<LineChart className="w-5 h-5 text-primary" />}>
      <div className="h-64 w-full">
        <TimeSeriesChart data={timeline} />
      </div>
      <div className="flex justify-between items-center mt-4 pt-4 border-t border-border text-xs text-muted-foreground">
        <span>{timeline[0]?.label || new Date(timeline[0]?.timestamp).toLocaleTimeString()}</span>
        <span className="font-medium text-primary">
          Peak: {Math.max(...timeline.map(t => t.value))} req/min
        </span>
        <span>{timeline[timeline.length - 1]?.label || new Date(timeline[timeline.length - 1]?.timestamp).toLocaleTimeString()}</span>
      </div>
    </Card>
  );
}