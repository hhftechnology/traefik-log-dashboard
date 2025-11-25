// dashboard/app/dashboard/page.tsx
'use client';

// dashboard/app/dashboard/page.tsx
'use client';

import DashboardWithFilters from '@/components/dashboard/DashboardWithFilters';
import Header from '@/components/ui/Header';
import { Button } from '@/components/ui/button';
import { Pause, Play, ServerOff } from 'lucide-react';
import { useLogFetcher } from '@/lib/hooks/useLogFetcher';

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
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50">
        <Header
          title="TRAEFIK LOG DASHBOARD"
          connected={false}
        />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Connecting to agent...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !connected) {
    const isNoAgentError = error.includes('No agent selected or available');

    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50">
        <Header
          title="TRAEFIK LOG DASHBOARD"
          connected={false}
        />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center max-w-md mx-auto p-8 bg-white rounded-xl shadow-sm border border-red-100">
              {isNoAgentError ? (
                <>
                  <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
                    <ServerOff className="w-8 h-8 text-red-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">
                    No Agents Configured
                  </h2>
                  <p className="text-gray-600 mb-6">
                    There are no Traefik agents currently configured or available. Please configure an agent to start collecting logs.
                  </p>
                  <Button 
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => window.location.href = '/settings'}
                  >
                    Configure Agent
                  </Button>
                </>
              ) : (
                <>
                  <div className="text-red-600 text-6xl mb-4">⚠</div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Connection Error
                  </h2>
                  <p className="text-gray-600 mb-4">{error}</p>
                  <p className="text-sm text-gray-500">
                    Make sure the agent is running and accessible
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-50">
      <Header
        title="TRAEFIK LOG DASHBOARD"
        connected={connected}
        lastUpdate={lastUpdate}
      />
      
      <div className="bg-white border-b border-red-200 px-4 py-3">
        <div className="container mx-auto flex items-center justify-between text-sm text-gray-600">
          <div>
            Showing <span className="font-semibold text-red-600">{logs.length}</span> logs
          </div>
          <div className="flex items-center gap-4">
            {lastUpdate && (
              <span>Last update: {lastUpdate.toLocaleTimeString()}</span>
            )}
            <Button
              onClick={() => setIsPaused(!isPaused)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {isPaused ? (
                <>
                  <Play className="w-4 h-4" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4" />
                  Pause
                </>
              )}
            </Button>
            <span className="flex items-center gap-1.5">
              {isPaused ? (
                <>
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  Auto-refresh paused
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                  Auto-refreshing every 5s
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      <DashboardWithFilters logs={logs} demoMode={false} agentId={agentId || undefined} agentName={agentName || undefined} />
    </div>
  );
}