// dashboard/app/dashboard/demo/page.tsx
'use client';

import { useEffect, useState } from 'react';
import DashboardWithFilters from '@/components/dashboard/DashboardWithFilters';
import Header from '@/components/ui/Header';
import { generateTimeSeriesLogs } from '@/lib/demo';
import { TraefikLog } from '@/lib/types';

export default function DemoDashboardPage() {
  const [logs, setLogs] = useState<TraefikLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const initialLogs = generateTimeSeriesLogs(60, 10);
    setLogs(initialLogs);
    setLoading(false);

    const interval = setInterval(() => {
      setLogs(prevLogs => {
        const newLogs = generateTimeSeriesLogs(1, 10);
        const updatedLogs = [...newLogs, ...prevLogs].slice(0, 1000);
        setLastUpdate(new Date());
        return updatedLogs;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header title="TRAEFIK LOG DASHBOARD - Demo Mode" connected={true} demoMode={true} />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading demo dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        title="TRAEFIK LOG DASHBOARD - Demo Mode"
        connected={true}
        demoMode={true}
        lastUpdate={lastUpdate}
      />
      <DashboardWithFilters logs={logs} demoMode={true} /> 
    </div>
  );
}