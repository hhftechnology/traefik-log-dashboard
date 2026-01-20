'use client';

import React from 'react';
import {
  Bar,
  BarChart as RechartsBarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

interface Dataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
}

interface BarChartProps {
  labels: string[];
  datasets: Dataset[];
  height?: number;
}

function BarChart({ labels, datasets, height = 300 }: BarChartProps) {
  // Transform data to Recharts format
  const chartData = labels.map((label, index) => {
    const point: Record<string, string | number> = { name: label };
    datasets.forEach(dataset => {
      point[dataset.label] = dataset.data[index] || 0;
    });
    return point;
  });

  // Default colors using CSS variables
  const defaultColors = [
    'var(--primary)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
  ];

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
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
            cursor={{ fill: 'var(--muted)' }}
          />
          {datasets.length > 1 && (
            <Legend
              wrapperStyle={{ paddingTop: 20 }}
              iconType="circle"
            />
          )}
          {datasets.map((dataset, idx) => {
            const fill = Array.isArray(dataset.backgroundColor)
              ? dataset.backgroundColor[0]
              : dataset.backgroundColor || defaultColors[idx % defaultColors.length];

            return (
              <Bar
                key={dataset.label}
                dataKey={dataset.label}
                fill={fill}
                radius={[4, 4, 0, 0]}
              />
            );
          })}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default React.memo(BarChart);
