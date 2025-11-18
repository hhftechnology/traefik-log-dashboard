'use client';

import { useRef } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Pie } from 'react-chartjs-2';
import type { TooltipItem } from 'chart.js';
import { useTheme } from '@/lib/contexts/ThemeContext';

ChartJS.register(ArcElement, Tooltip, Legend);

const getCSSVariable = (variable: string): string => {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
};

interface PieChartProps {
  labels: string[];
  data: number[];
  backgroundColor?: string[];
  height?: number;
}

export default function PieChart({
  labels,
  data,
  backgroundColor,
  height = 300
}: PieChartProps) {
  const chartRef = useRef<ChartJS<'pie'>>(null);
  const { resolvedTheme } = useTheme();

  // Generate default colors from CSS variables if not provided
  const defaultColors = [
    `oklch(${getCSSVariable('--chart-1')})`,
    `oklch(${getCSSVariable('--chart-2')})`,
    `oklch(${getCSSVariable('--chart-3')})`,
    `oklch(${getCSSVariable('--chart-4')})`,
    `oklch(${getCSSVariable('--chart-5')})`,
    `oklch(${getCSSVariable('--primary')})`,
  ];

  const colors = backgroundColor || defaultColors;
  const textColor = `oklch(${getCSSVariable('--muted-foreground')})`;
  const tooltipBg = resolvedTheme === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)';
  const tooltipTextColor = resolvedTheme === 'dark' ? '#000' : '#fff';
  const tooltipBorder = resolvedTheme === 'dark' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';

  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: colors,
        borderColor: colors,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          padding: 15,
          usePointStyle: true,
          pointStyle: 'circle',
          color: textColor,
        },
      },
      tooltip: {
        backgroundColor: tooltipBg,
        padding: 12,
        titleColor: tooltipTextColor,
        bodyColor: tooltipTextColor,
        borderColor: tooltipBorder,
        borderWidth: 1,
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
  };

  return (
    <div style={{ height }}>
      <Pie ref={chartRef} data={chartData} options={options} />
    </div>
  );
}