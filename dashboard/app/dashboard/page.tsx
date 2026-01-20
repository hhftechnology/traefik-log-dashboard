'use client';

import { ServerOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLogFetcher } from '@/lib/hooks/useLogFetcher';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { DashboardShell } from '@/components/layout/DashboardShell';
import DashboardWithFilters from '@/components/dashboard/DashboardWithFilters';

export default function DashboardPage() {
  const {
    logs,
    loading,
    error,
    connected,
    lastUpdate,
    isPaused,
    setIsPaused,
    agentId,
    agentName
  } = useLogFetcher();

  if (loading) {
    return (
      <DashboardShell title="Dashboard" showControls={false}>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Connecting to agent...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (error && !connected) {
    const isNoAgentError = error.includes('No agent selected or available');

    return (
      <DashboardShell title="Dashboard" showControls={false}>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center max-w-md mx-auto p-8 bg-card rounded-xl shadow-sm border">
            {isNoAgentError ? (
              <>
                <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
                  <ServerOff className="w-8 h-8 text-destructive" />
                </div>
                <h2 className="text-2xl font-bold mb-3">
                  No Agents Configured
                </h2>
                <p className="text-muted-foreground mb-6">
                  There are no Traefik agents currently configured or available. Please configure an agent to start collecting logs.
                </p>
                <Button
                  onClick={() => window.location.href = '/settings/agents'}
                >
                  Configure Agent
                </Button>
              </>
            ) : (
              <>
                <div className="text-destructive text-6xl mb-4">⚠</div>
                <h2 className="text-2xl font-bold mb-2">
                  Connection Error
                </h2>
                <p className="text-muted-foreground mb-4">{error}</p>
                <p className="text-sm text-muted-foreground">
                  Make sure the agent is running and accessible
                </p>
              </>
            )}
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Dashboard"
      connected={connected}
      lastUpdate={lastUpdate}
      isPaused={isPaused}
      onTogglePause={() => setIsPaused(!isPaused)}
      logsCount={logs.length}
      showControls={true}
      agentName={agentName}
    >
      <ErrorBoundary>
        <DashboardWithFilters
          logs={logs}
          demoMode={false}
          agentId={agentId || undefined}
          agentName={agentName || undefined}
        />
      </ErrorBoundary>
    </DashboardShell>
  );
}
