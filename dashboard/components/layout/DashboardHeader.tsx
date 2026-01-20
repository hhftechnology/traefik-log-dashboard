'use client';

import { Moon, Sun, Wifi, WifiOff, Pause, Play, RefreshCw } from 'lucide-react';
import { useTheme } from 'next-themes';
import { SidebarTrigger } from '@/components/ui/ui-sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Badge } from '@/components/ui/badge';
import AgentSelector from '@/components/ui/AgentSelector';

interface DashboardHeaderProps {
  title?: string;
  connected?: boolean;
  lastUpdate?: Date | null;
  isPaused?: boolean;
  onTogglePause?: () => void;
  logsCount?: number;
  showControls?: boolean;
  agentName?: string | null;
}

export function DashboardHeader({
  title = 'Dashboard',
  connected = true,
  lastUpdate,
  isPaused = false,
  onTogglePause,
  logsCount,
  showControls = false,
  agentName,
}: DashboardHeaderProps) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium">{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        {showControls && (
          <>
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              {connected ? (
                <Badge variant="outline" className="gap-1.5 text-green-600 border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                  <Wifi className="h-3 w-3" />
                  <span className="hidden sm:inline">Connected</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1.5 text-red-600 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
                  <WifiOff className="h-3 w-3" />
                  <span className="hidden sm:inline">Disconnected</span>
                </Badge>
              )}
            </div>

            {/* Agent Name */}
            {agentName && (
              <Badge variant="secondary" className="hidden md:flex">
                {agentName}
              </Badge>
            )}

            {/* Logs Count */}
            {logsCount !== undefined && logsCount > 0 && (
              <Badge variant="outline" className="hidden sm:flex">
                {logsCount.toLocaleString()} logs
              </Badge>
            )}

            {/* Last Update */}
            {lastUpdate && (
              <span className="text-xs text-muted-foreground hidden lg:flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                {lastUpdate.toLocaleTimeString()}
              </span>
            )}

            {/* Pause/Resume Button */}
            {onTogglePause && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onTogglePause}
                className="h-8 w-8"
                title={isPaused ? 'Resume updates' : 'Pause updates'}
              >
                {isPaused ? (
                  <Play className="h-4 w-4 text-green-600" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
              </Button>
            )}

            <Separator orientation="vertical" className="h-4" />
          </>
        )}

        {/* Agent Selector */}
        <AgentSelector />

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="h-8 w-8"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>
    </header>
  );
}
