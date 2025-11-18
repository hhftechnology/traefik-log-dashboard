'use client';

import { useRef } from 'react';
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	BarElement,
	Title,
	Tooltip,
	Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useTheme } from '@/lib/contexts/ThemeContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const getCSSVariable = (variable: string): string => {
	if (typeof window === 'undefined') return '';
	return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
};

interface BarChartProps {
	labels: string[];
	datasets: {
		label: string;
		data: number[];
		backgroundColor?: string | string[];
		borderColor?: string | string[];
		borderWidth?: number;
	}[];
	height?: number;
}

export default function BarChart({ labels, datasets, height = 300 }: BarChartProps) {
	const chartRef = useRef<ChartJS<'bar'>>(null);
	const { resolvedTheme } = useTheme();

	const chartData = { labels, datasets };

	const gridColor = `oklch(${getCSSVariable('--border')})`;
	const textColor = `oklch(${getCSSVariable('--muted-foreground')})`;
	const tooltipBg = resolvedTheme === 'dark' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)';
	const tooltipTextColor = resolvedTheme === 'dark' ? '#000' : '#fff';
	const tooltipBorder = resolvedTheme === 'dark' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';

	const options = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				display: datasets.length > 1,
				position: 'top' as const,
				labels: {
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
			},
		},
		scales: {
			x: {
				grid: { display: false },
				ticks: { color: textColor },
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
	};

	return (
		<div style={{ height }}>
			<Bar ref={chartRef} data={chartData} options={options} />
		</div>
	);
}