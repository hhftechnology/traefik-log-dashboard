/**
 * Shared chart configuration for Recharts
 * Centralized chart styling utilities
 */

/**
 * Common chart colors using CSS variables
 */
export const chartColors = {
  primary: 'var(--primary)',
  secondary: 'var(--secondary)',
  muted: 'var(--muted)',
  border: 'var(--border)',
  foreground: 'var(--foreground)',
  mutedForeground: 'var(--muted-foreground)',
  chart1: 'var(--chart-1)',
  chart2: 'var(--chart-2)',
  chart3: 'var(--chart-3)',
  chart4: 'var(--chart-4)',
  chart5: 'var(--chart-5)',
} as const;

/**
 * Common tooltip styles for Recharts
 */
export const tooltipStyles = {
  contentStyle: {
    backgroundColor: 'var(--background)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  },
  labelStyle: {
    color: 'var(--foreground)',
    fontWeight: 500,
  },
  itemStyle: {
    color: 'var(--muted-foreground)',
  },
} as const;

/**
 * Common axis styles for Recharts
 */
export const axisStyles = {
  tick: {
    fill: 'var(--muted-foreground)',
    fontSize: 12,
  },
  axisLine: false,
  tickLine: false,
  tickMargin: 8,
} as const;

/**
 * Common grid styles for Recharts
 */
export const gridStyles = {
  strokeDasharray: '3 3',
  stroke: 'var(--border)',
  vertical: false,
} as const;
