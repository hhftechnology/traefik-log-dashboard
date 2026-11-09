import { useState } from 'react';
import { useMountEffect } from '@/hooks/useMountEffect';
import { dashboardAuthHeaders, setDashboardApiToken } from '@/utils/dashboard-auth';

type GateState = 'checking' | 'ready' | 'needed' | 'unconfigured';

export function DashboardAuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>('checking');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  useMountEffect(() => {
    let cancelled = false;
    fetch('/api/dashboard/agents', {
      headers: dashboardAuthHeaders(),
      cache: 'no-store',
    })
      .then((response) => {
        if (cancelled) return;
        if (response.status === 503) {
          setState('unconfigured');
          return;
        }
        if (response.status === 401) {
          setState('needed');
          return;
        }
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('needed');
      });
    return () => {
      cancelled = true;
    };
  });

  if (state === 'checking') {
    return <p className="p-8 text-sm text-muted-foreground">Checking dashboard access…</p>;
  }

  if (state === 'unconfigured') {
    return (
      <div className="mx-auto max-w-lg p-8">
        <h1 className="text-xl font-semibold">Dashboard API token required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set <code>DASHBOARD_API_TOKEN</code> on the dashboard server, then reload this page.
        </p>
      </div>
    );
  }

  if (state === 'needed') {
    return (
      <form
        className="mx-auto max-w-lg p-8"
        onSubmit={(event) => {
          event.preventDefault();
          const value = token.trim();
          if (!value) {
            setError('Enter the dashboard API token.');
            return;
          }
          setDashboardApiToken(value);
          setState('checking');
          fetch('/api/dashboard/agents', {
            headers: { Authorization: `Bearer ${value}` },
            cache: 'no-store',
          })
            .then((response) => {
              if (response.status === 401) {
                setError('That token was rejected.');
                setState('needed');
                return;
              }
              if (response.status === 503) {
                setState('unconfigured');
                return;
              }
              setError('');
              setState('ready');
            })
            .catch(() => {
              setError('Could not reach the dashboard API.');
              setState('needed');
            });
        }}
      >
        <h1 className="text-xl font-semibold">Sign in to the dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Management routes require the <code>DASHBOARD_API_TOKEN</code> configured on the server.
          The token stays in this browser session and is not stored on the server.
        </p>
        <label className="mt-4 block text-sm font-medium" htmlFor="dashboard-api-token">
          Dashboard API token
        </label>
        <input
          id="dashboard-api-token"
          type="password"
          autoComplete="current-password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 font-mono text-sm"
        />
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        <button type="submit" className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">
          Continue
        </button>
      </form>
    );
  }

  return <>{children}</>;
}
