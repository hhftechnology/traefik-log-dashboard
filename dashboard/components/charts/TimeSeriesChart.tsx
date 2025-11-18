'use client';

import { useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { TimeSeriesPoint } from '@/lib/types';
import { useTheme } from '@/lib/contexts/ThemeContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const getCSSVariable = (variable: string): string => {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
};

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
}

export default function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  const chartRef = useRef<ChartJS<'line'>>(null);
  const { resolvedTheme } = useTheme();

  const labels = data.map(point => {
    const date = new Date(point.timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  });

  const values = data.map(point => point.value);

  const primaryColor = `oklch(${getCSSVariable('--primary')})`;
  const primaryColorWithAlpha = `oklch(${getCSSVariable('--primary')} / 0.1)`;
  const textColor = `oklch(${getCSSVariable('--muted-foreground')})`;
  const gridColor = `oklch(${getCSSVariable('--border')})`;
  const tooltipBg = resolvedTheme === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)';
  const tooltipTextColor = resolvedTheme === 'dark' ? '#000' : '#fff';
  const tooltipBorder = resolvedTheme === 'dark' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Requests',
        data: values,
        borderColor: primaryColor,
        backgroundColor: primaryColorWithAlpha,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: tooltipBg,
        padding: 12,
        titleColor: tooltipTextColor,
        bodyColor: tooltipTextColor,
        borderColor: tooltipBorder,
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          maxRotation: 0,
          autoSkipPadding: 20,
          color: textColor,
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: gridColor },
        ticks: {
          precision: 0,
          color: textColor,
        },
      },
    },
    interaction: { mode: 'nearest' as const, axis: 'x' as const, intersect: false },
  };

  return <Line ref={chartRef} data={chartData} options={options} />;
}