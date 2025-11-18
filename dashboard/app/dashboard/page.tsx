// dashboard/app/dashboard/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import DashboardWithFilters from '@/components/dashboard/DashboardWithFilters'; 
import Header from '@/components/ui/Header';
import { TraefikLog } from '@/lib/types';
import { parseTraefikLogs } from '@/lib/traefik-parser';
import { Button } from '@/components/ui/button';
import { Pause, Play } from 'lucide-react';

export default function DashboardPage() {
  const [logs, setLogs] = useState<TraefikLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const positionRef = useRef<number>(-1);
  const isFirstFetch = useRef(true);
  
  // ADDED: Track seen log entries by unique ID to prevent duplicates
  const seenLogsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fetchLogs = async () => {
      // Don't fetch if paused
      if (isPaused) return;
      
      try {
        const position = positionRef.current ?? -1;
        
        // FIX: Remove period parameter to use position-based incremental reading only
        // This prevents conflicts between period filtering and position tracking
        const response = await fetch(
          `/api/logs/access?position=${position}&lines=1000`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.logs && data.logs.length > 0) {
          const parsedLogs = parseTraefikLogs(data.logs);
          
          // FIX: Deduplicate logs using composite unique key
          // Using StartUTC + RequestCount + RequestPath + ClientHost for uniqueness
          const newUniqueLogs = parsedLogs.filter(log => {
            // Create a composite key from multiple fields to ensure uniqueness
            const logKey = `${log.StartUTC || log.StartLocal}-${log.RequestCount}-${log.RequestPath}-${log.ClientHost}`;
            
            if (seenLogsRef.current.has(logKey)) {
              return false; // Skip duplicate
            }
            
            seenLogsRef.current.add(logKey);
            return true;
          });

          // Only update state if we have new unique logs
          if (newUniqueLogs.length > 0) {
            setLogs((prevLogs: TraefikLog[]) => {
              if (isFirstFetch.current) {
                isFirstFetch.current = false;
                return newUniqueLogs;
              }
              // Append only new unique logs and keep last 1000
              return [...prevLogs, ...newUniqueLogs].slice(-1000);
            });
          }
        }

        // Update position for next incremental read
        if (data.positions && data.positions.length > 0 && typeof data.positions[0].Position === 'number') {
          positionRef.current = data.positions[0].Position;
        }

        setConnected(true);
        setError(null);
        setLastUpdate(new Date());
      } catch (err) {
        console.error('Error fetching logs:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch logs');
        setConnected(false);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchLogs();
    
    // Set up interval for auto-refresh
    const interval = setInterval(fetchLogs, 5000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [isPaused]); // Re-run effect when isPaused changes

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header
          title="TRAEFIK LOG DASHBOARD"
          connected={false}
        />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Connecting to agent...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !connected) {
    return (
      <div className="min-h-screen bg-background">
        <Header
          title="TRAEFIK LOG DASHBOARD"
          connected={false}
        />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-destructive text-6xl mb-4">⚠</div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Connection Error
              </h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <p className="text-sm text-muted-foreground/80">
                Make sure the agent is running and accessible
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        title="TRAEFIK LOG DASHBOARD"
        connected={connected}
        lastUpdate={lastUpdate}
      />

      <div className="bg-card border-b border-border px-4 py-3">
        <div className="container mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div>
            Showing <span className="font-semibold text-primary">{logs.length}</span> logs
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
                  <div className="w-2 h-2 bg-muted rounded-full"></div>
                  Auto-refresh paused
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                  Auto-refreshing every 5s
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      <DashboardWithFilters logs={logs} demoMode={false} />
    </div>
  );
}