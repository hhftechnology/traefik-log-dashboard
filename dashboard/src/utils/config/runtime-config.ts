export interface RuntimeConfig {
  basePath?: string;
  baseDomain?: string;
  showDemoPage?: boolean;
  refreshIntervalMs?: number;
  maxLogsDisplay?: number;
  trafficTopItemsLimit?: number;
  parserTrendWindowMinutes?: number;
  agentsEnvOnly?: boolean;
  hideInternalTrafficDefault?: boolean;
  internalNoisePathPrefixes?: string[];
  internalNoiseServicePatterns?: string[];
  density?: 'compact' | 'comfortable';
  chartPalette?: string[];
  themeTokens?: Record<string, string>;
  defaultAgentUrl?: string;
  defaultAgentConfigured?: boolean;
  mapTileUrl?: string;
  mapTileUrlDark?: string;
  mapTileAttribution?: string;
}

const buildTimeFallback: RuntimeConfig = {
  basePath: import.meta.env.VITE_BASE_PATH || '',
  baseDomain: import.meta.env.VITE_BASE_DOMAIN || '',
  defaultAgentUrl: import.meta.env.VITE_AGENT_API_URL || '',
};

export function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === 'undefined') return buildTimeFallback;
  const anyWindow = window as Window & { __DASHBOARD_CONFIG__?: RuntimeConfig };
  const runtime = anyWindow.__DASHBOARD_CONFIG__ ?? {};
  return { ...buildTimeFallback, ...runtime };
}
