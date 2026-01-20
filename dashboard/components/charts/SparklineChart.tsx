'use client';

import React from 'react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
} from 'recharts';

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
}

function Sparkline({ data, color = 'var(--primary)', height = 50 }: SparklineProps) {
  const chartData = data.map((value, index) => ({
    index,
    value,
  }));

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`sparklineGradient-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#sparklineGradient-${color.replace(/[^a-z0-9]/gi, '')})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default React.memo(Sparkline);
