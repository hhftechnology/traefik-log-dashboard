// dashboard/components/ui/Header.tsx
'use client';

import Link from 'next/link';
import { Activity, Home, Github, Settings, Filter, Bell } from 'lucide-react';
import { Button } from './button';
import { Badge } from './badge';
import AgentSelector from './AgentSelector';
import { useAgents } from '@/lib/contexts/AgentContext';
import { useEffect, useState } from 'react';


interface HeaderProps {
  title: string;                // Required
  connected?: boolean;          // Optional
  demoMode?: boolean;           // Optional
  lastUpdate?: Date | null;     // Optional
  showAgentSelector?: boolean;  // Optional
}

export default function Header({ 
  title, 
  connected = false, 
  demoMode = false, 
  lastUpdate,
  showAgentSelector = true 
}: HeaderProps) {
  const { selectedAgent } = useAgents();
  const [alertCount, setAlertCount] = useState<number>(0);

  useEffect(() => {
    if (demoMode) return;

    const fetchAlertStats = async () => {
      try {
        const res = await fetch('/api/alerts/stats');
        if (res.ok) {
          const data = await res.json();
          setAlertCount(data.last24h || 0);
        }
      } catch (error) {
        console.error('Failed to fetch alert stats:', error);
      }
    };

    fetchAlertStats();
    const interval = setInterval(fetchAlertStats, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [demoMode]);

  return (
    <header className="bg-white border-b border-red-200 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left Section: Logo and Title */}
          <div className="flex items-center gap-3 min-w-0">
            <Activity className="w-8 h-8 text-red-600 flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 truncate">{title}</h1>
              {demoMode && (
                <Badge variant="secondary" className="mt-0.5 bg-red-100 text-red-700 border-red-300">
                  Demo Mode - Simulated Data
                </Badge>
              )}
            </div>
          </div>

          {/* Center Section: Agent Selector */}
          {showAgentSelector && !demoMode && (
            <div className="hidden lg:flex items-center flex-1 justify-center max-w-md">
              <AgentSelector />
            </div>
          )}

          {/* Right Section: Status and Actions */}
          <div className="flex items-center gap-4 flex-shrink-0">
            {/* Connection Status */}
            {!demoMode && connected !== undefined && (
              <div className="hidden md:flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-600">
                  {connected ? (
                    <>
                      Connected
                      {selectedAgent && (
                        <span className="ml-1 text-xs text-gray-500">
                          (Agent #{selectedAgent.number})
                        </span>
                      )}
                    </>
                  ) : (
                    'Disconnected'
                  )}
                </span>
              </div>
            )}

            {/* Last Update */}
            {lastUpdate && (
              <div className="hidden xl:block text-xs text-gray-500">
                Last update: {lastUpdate.toLocaleTimeString()}
              </div>
            )}

            {/* Action Links */}
            <a
              href="https://github.com/hhftechnology/traefik-log-dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="GitHub Repository"
            >
              <Github className="w-5 h-5" />
              <span className="text-sm font-medium hidden sm:inline">GitHub</span>
            </a>

            <a
              href="https://discord.gg/xCtMFeUKf9"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Join Discord"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span className="text-sm font-medium hidden sm:inline">Discord</span>
            </a>

            <Button asChild variant="secondary" className="border-red-300 text-red-700 hover:bg-red-50">
              <Link href="/" className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Home</span>
              </Link>
            </Button>

            {/* Alert Stats Button */}
            {!demoMode && (
              <Button
                asChild
                variant="secondary"
                size="icon"
                className="border-red-300 text-red-700 hover:bg-red-50 relative"
                title="Alerts"
              >
                <Link href="/settings/alerts">
                  <Bell className="w-4 h-4" />
                  {alertCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] text-white">
                      {alertCount > 99 ? '99+' : alertCount}
                    </span>
                  )}
                </Link>
              </Button>
            )}

            {/* Filter Settings Button (visible when not in demo mode) */}
            {!demoMode && (
              <Button
                asChild
                variant="secondary"
                size="icon"
                className="border-red-300 text-red-700 hover:bg-red-50"
                title="Log Filters"
              >
                <Link href="/settings/filters">
                  <Filter className="w-4 h-4" />
                </Link>
              </Button>
            )}

            {/* Settings Button (visible only when not in demo mode) */}
            {!demoMode && showAgentSelector && (
              <Button
                asChild
                variant="secondary"
                size="icon"
                className="border-red-300 text-red-700 hover:bg-red-50"
                title="Agent Settings"
              >
                <Link href="/settings">
                  <Settings className="w-4 h-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Agent Selector */}
        {showAgentSelector && !demoMode && (
          <div className="lg:hidden mt-3">
            <AgentSelector className="w-full" />
          </div>
        )}
      </div>
    </header>
  );
}