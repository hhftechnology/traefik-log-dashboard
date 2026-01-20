'use client';

import React from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { TimeSeriesPoint } from '@/lib/types';

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
}

function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  const chartData = data.map(point => ({
    time: new Date(point.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    }),
    value: point.value,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          vertical={false}
        />
        <XAxis
          dataKey="time"
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          tickMargin={8}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          tickMargin={8}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--background)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
          labelStyle={{ color: 'var(--foreground)', fontWeight: 500 }}
          itemStyle={{ color: 'var(--primary)' }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#colorRequests)"
          dot={false}
          activeDot={{ r: 4, fill: 'var(--primary)' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default React.memo(TimeSeriesChart);
