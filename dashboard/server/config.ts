// Runtime configuration built once at startup from environment variables.
// Extracted to a separate module to avoid circular dependencies.

function buildRuntimeConfig(): Record<string, unknown> {
  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      const v = process.env[k];
      if (v) return v;
    }
    return '';
  };

  const toBool = (val: string, fallback: boolean): boolean => {
    const v = val.toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(v)) return true;
    if (['0', 'false', 'no', 'off'].includes(v)) return false;
    return fallback;
  };

  const toInt = (val: string, fallback: number): number => {
    const n = parseInt(val, 10);
    return isNaN(n) ? fallback : n;
  };

  const toList = (val: string, fallback: string[]): string[] => {
    if (!val.trim()) return fallback;
    const items = val
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length > 0 ? items : fallback;
  };

  const basePath = pick('BASE_PATH', 'VITE_BASE_PATH');
  const baseDomain = pick('BASE_DOMAIN', 'VITE_BASE_DOMAIN');
  const showDemoRaw = pick('SHOW_DEMO_PAGE', 'DASHBOARD_SHOW_DEMO_PAGE');
  const refreshRaw = pick('DASHBOARD_REFRESH_INTERVAL_MS', 'REFRESH_INTERVAL_MS');
  const maxLogsRaw = pick('DASHBOARD_MAX_LOGS_DISPLAY', 'MAX_LOGS_DISPLAY');
  const maxHistoryLoadRaw = pick('DASHBOARD_MAX_HISTORY_LOAD', 'MAX_HISTORY_LOAD');
  const trafficTopItemsRaw = pick('DASHBOARD_TRAFFIC_TOP_ITEMS_LIMIT');
  const parserTrendWindowRaw = pick('DASHBOARD_PARSER_TREND_WINDOW_MINUTES');
  const agentsEnvOnlyRaw = pick('DASHBOARD_AGENTS_ENV_ONLY');
  const VALID_DENSITIES = new Set(['compact', 'comfortable']);
  const rawDensity = pick('DASHBOARD_DENSITY', 'UI_DENSITY');
  const density = VALID_DENSITIES.has(rawDensity) ? rawDensity : 'comfortable';
  const agentUrl = pick('AGENT_API_URL', 'AGENT_URL');
  const agentToken = pick('AGENT_API_TOKEN', 'AGENT_TOKEN');
  const frontendAgentUrl = pick('DASHBOARD_DEFAULT_AGENT_URL');
  const skipIntroPageRaw = pick('DASHBOARD_SKIP_INTRO');
  const hideInternalTrafficDefaultRaw = pick('DASHBOARD_HIDE_INTERNAL_TRAFFIC_DEFAULT');
  const internalNoisePathPrefixesRaw = pick('DASHBOARD_INTERNAL_NOISE_PATH_PREFIXES');
  const internalNoiseServicePatternsRaw = pick('DASHBOARD_INTERNAL_NOISE_SERVICE_PATTERNS');

  const defaultInternalNoisePathPrefixes = [
    '/api/system/resources',
    '/api/logs/status',
    '/api/location',
    '/api/dashboard/agents/check-status',
  ];
  const defaultInternalNoiseServicePatterns = [
    'dashboard',
    'agent',
    'traefik-log-dashboard',
    'log-dashboard',
  ];

  const DEFAULTS = {
    REFRESH_INTERVAL_MS: 5000,
    MAX_LOGS_DISPLAY: 1000,
    MAX_HISTORY_LOAD: 5000,
    TRAFFIC_TOP_ITEMS_LIMIT: 10,
    PARSER_TREND_WINDOW_MINUTES: 30,
  };

  return {
    basePath,
    baseDomain,
    showDemoPage: toBool(showDemoRaw, true),
    skipIntroPage: toBool(skipIntroPageRaw, false),
    refreshIntervalMs: toInt(refreshRaw, DEFAULTS.REFRESH_INTERVAL_MS),
    maxLogsDisplay: toInt(maxLogsRaw, DEFAULTS.MAX_LOGS_DISPLAY),
    maxHistoryLoad: toInt(maxHistoryLoadRaw, DEFAULTS.MAX_HISTORY_LOAD),
    trafficTopItemsLimit: Math.max(3, Math.min(200, toInt(trafficTopItemsRaw, DEFAULTS.TRAFFIC_TOP_ITEMS_LIMIT))),
    parserTrendWindowMinutes: Math.max(15, Math.min(30, toInt(parserTrendWindowRaw, DEFAULTS.PARSER_TREND_WINDOW_MINUTES))),
    agentsEnvOnly: toBool(agentsEnvOnlyRaw, false),
    hideInternalTrafficDefault: toBool(hideInternalTrafficDefaultRaw, true),
    internalNoisePathPrefixes: toList(internalNoisePathPrefixesRaw, defaultInternalNoisePathPrefixes),
    internalNoiseServicePatterns: toList(internalNoiseServicePatternsRaw, defaultInternalNoiseServicePatterns),
    chartPalette: [
      'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
      'var(--chart-4)', 'var(--chart-5)',
    ],
    density,
    themeTokens: {},
    defaultAgentUrl: frontendAgentUrl,
    defaultAgentConfigured: !!agentToken,
  };
}

export const runtimeConfig = buildRuntimeConfig();
