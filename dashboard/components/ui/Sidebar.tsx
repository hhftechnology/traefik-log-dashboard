'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Activity, BarChart3, Settings, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface SidebarProps {
	className?: string;
}

const navigation = [
	{ name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
	{ name: 'Demo', href: '/dashboard/demo', icon: Activity },
	{ name: 'Analytics', href: '/analytics', icon: BarChart3 },
	{ name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar({ className }: SidebarProps) {
	const [isOpen, setIsOpen] = useState(false);
	const pathname = usePathname();

	return (
		<>
			{/* Mobile menu button */}
			<Button
				onClick={() => setIsOpen(!isOpen)}
				variant="secondary"
				size="icon"
				className="lg:hidden fixed top-4 left-4 z-50"
				aria-label="Toggle navigation"
			>
				{isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
			</Button>

			{/* Overlay */}
			{isOpen && (
				<div onClick={() => setIsOpen(false)} className="lg:hidden fixed inset-0 bg-black/50 z-40" />
			)}

			{/* Sidebar */}
			<aside
				className={cn(
					'fixed top-0 left-0 z-40 h-screen w-64 bg-white dark:bg-black border-r border-border transition-transform',
					isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
					className
				)}
			>
				<div className="flex flex-col h-full">
					{/* Logo */}
					<div className="flex items-center gap-3 p-6 border-b border-border">
						<Activity className="w-8 h-8 text-black dark:text-white" />
						<div>
							<h2 className="text-lg font-bold text-gray-900 dark:text-white">Traefik Log Dashboard</h2>
							<p className="text-xs text-muted-foreground">v1.0.0</p>
						</div>
					</div>

					{/* Navigation */}
						<nav className="flex-1 p-4 space-y-2 overflow-y-auto">
						{navigation.map((item) => {
							const isActive = pathname === item.href;
							const Icon = item.icon;

							return (
								<Link
									key={item.name}
									href={item.href}
									onClick={() => setIsOpen(false)}
									className={cn(
										'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
										isActive
											? 'bg-black/5 text-black dark:bg-white/10 dark:text-white font-medium'
											: 'text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/10'
									)}
								>
									<Icon className="w-5 h-5" />
									<span>{item.name}</span>
								</Link>
							);
						})}
					</nav>

					{/* Footer */}
					<div className="p-4 border-t border-border">
						<div className="text-xs text-muted-foreground text-center">
							<p>© 2025 TRAEFIK LOG DASHBOARD</p>
							<p className="mt-1">MIT License</p>
						</div>
					</div>
				</div>
			</aside>
		</>
	);
}