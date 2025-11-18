'use client';

import { useRef } from 'react';
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useTheme } from '@/lib/contexts/ThemeContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement);

const getCSSVariable = (variable: string): string => {
	if (typeof window === 'undefined') return '';
	return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
};

interface SparklineProps {
	data: number[];
	color?: string;
	height?: number;
}

export default function Sparkline({ data, color, height = 50 }: SparklineProps) {
	const chartRef = useRef<ChartJS<'line'>>(null);
	const { resolvedTheme } = useTheme();

	const stroke = color || `oklch(${getCSSVariable('--primary')})`;
	const fill = color
		? color.replace('rgb', 'rgba').replace(')', ', 0.1)')
		: `oklch(${getCSSVariable('--primary')} / 0.1)`;

	const chartData = {
		labels: data.map((_, i) => i.toString()),
		datasets: [
			{
				data,
				borderColor: stroke,
				backgroundColor: fill,
				fill: true,
				tension: 0.4,
				pointRadius: 0,
				borderWidth: 2,
			},
		],
	};

	const options = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: { display: false },
			tooltip: { enabled: false },
		},
		scales: { x: { display: false }, y: { display: false } },
		interaction: { mode: 'nearest' as const, intersect: false },
	};

	return (
		<div style={{ height }}>
			<Line ref={chartRef} data={chartData} options={options} />
		</div>
	);
}