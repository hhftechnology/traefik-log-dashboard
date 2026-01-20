'use client';

import React from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

interface PieChartProps {
  labels: string[];
  data: number[];
  backgroundColor?: string[];
  height?: number;
}

function PieChart({
  labels,
  data,
  backgroundColor = [
    'var(--primary)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
    'var(--muted)',
  ],
  height = 300,
}: PieChartProps) {
  // Transform data to Recharts format
  const chartData = labels.map((label, index) => ({
    name: label,
    value: data[index] || 0,
  }));

  const total = data.reduce((sum, val) => sum + val, 0);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      const percentage = ((item.value / total) * 100).toFixed(1);
      return (
        <div
          style={{
            backgroundColor: 'var(--background)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '8px 12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}
        >
          <p style={{ color: 'var(--foreground)', fontWeight: 500, margin: 0 }}>
            {item.name}
          </p>
          <p style={{ color: 'var(--muted-foreground)', margin: '4px 0 0 0', fontSize: '14px' }}>
            {item.value.toLocaleString()} ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            stroke="var(--background)"
            strokeWidth={2}
          >
            {chartData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={backgroundColor[index % backgroundColor.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span style={{ color: 'var(--foreground)', fontSize: '12px' }}>
                {value}
              </span>
            )}
          />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default React.memo(PieChart);
