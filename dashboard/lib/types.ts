// Traefik Log Types
export interface TraefikLog {
  ClientAddr: string;
  ClientHost: string;
  ClientPort: string;
  ClientUsername: string;
  DownstreamContentSize: number;
  DownstreamStatus: number;
  Duration: number;
  OriginContentSize: number;
  OriginDuration: number;
  OriginStatus: number;
  Overhead: number;
  RequestAddr: string;
  RequestContentSize: number;
  RequestCount: number;
  RequestHost: string;
  RequestMethod: string;
  RequestPath: string;
  RequestPort: string;
  RequestProtocol: string;
  RequestScheme: string;
  RetryAttempts: number;
  RouterName: string;
  ServiceAddr: string;
  ServiceName: string;
  ServiceURL: string;
  StartLocal: string;
  StartUTC: string;
  entryPointName: string;
  request_Referer?: string;
  request_User_Agent?: string;
  // GeoIP fields (added by enrichment)
  geoCountry?: string;
  geoCity?: string;
}

// API Response Types
export interface LogPosition {
  Position: number;
  Filename: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  version: string;
}

export interface LogsResponse {
  logs: string[];
  positions: LogPosition[];
  agent?: AgentInfo;
}

export interface SystemStats {
  cpu: CPUStats;
  memory: MemoryStats;
  disk: DiskStats;
  uptime?: number;
  timestamp?: string;
  [key: string]: unknown; // Allow additional properties from agent
}

export interface CPUStats {
  model?: string;
  cores: number;
  speed?: number;
  usage_percent: number;
  coreUsage?: number[];
}

export interface MemoryStats {
  total: number;
  available: number;
  used: number;
  used_percent: number;
  free: number;
}

export interface DiskStats {
  total: number;
  used: number;
  free: number;
  used_percent: number;
}

export interface LogFileSize {
  name: string;
  size: number;
  extension: string;
}

export interface LogFilesSummary {
  total_size: number;
  log_files_size: number;
  compressed_files_size: number;
  total_files: number;
  log_files_count: number;
  compressed_files_count: number;
}

export interface LogSizesResponse {
  files: LogFileSize[];
  summary: LogFilesSummary;
}

export interface StatusResponse {
  status: string;
  access_path: string;
  access_path_exists: boolean;
  error_path: string;
  error_path_exists: boolean;
  system_monitoring: boolean;
  auth_enabled: boolean;
}

// Dashboard Metrics Types
export interface RequestMetrics {
  total: number;
  perSecond: number;
  change: number;
}

export interface ResponseTimeMetrics {
  average: number;
  p95: number;
  p99: number;
  change: number;
}

export interface StatusCodeMetrics {
  status2xx: number;
  status3xx: number;
  status4xx: number;
  status5xx: number;
  errorRate: number;
}

export interface RouteMetrics {
  path: string;
  count: number;
  avgDuration: number;
  method: string;
}

export interface BackendMetrics {
  name: string;
  requests: number;
  avgDuration: number;
  errorRate: number;
  url: string;
}

export interface RouterMetrics {
  name: string;
  requests: number;
  avgDuration: number;
  service: string;
}

export interface GeoLocation {
  country: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  count: number;
}

export interface UserAgentMetrics {
  browser: string;
  count: number;
  percentage: number;
}

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface ErrorLog {
  timestamp: string;
  level: string;
  message: string;
}

export interface AddressMetric {
  addr: string;
  count: number;
}

export interface HostMetric {
  host: string;
  count: number;
}

export interface ClientMetric {
  ip: string;
  count: number;
}

// Chart Data Types
export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  fill?: boolean;
  tension?: number;
}

// Dashboard State Types
export interface DashboardState {
  logs: TraefikLog[];
  metrics: DashboardMetrics;
  systemStats?: SystemStats;
  loading: boolean;
  error?: string;
  lastUpdate: Date;
}

export interface DashboardMetrics {
  requests: RequestMetrics;
  responseTime: ResponseTimeMetrics;
  statusCodes: StatusCodeMetrics;
  topRoutes: RouteMetrics[];
  backends: BackendMetrics[];
  routers: RouterMetrics[];
  geoLocations: GeoLocation[];
  userAgents: UserAgentMetrics[];
  timeline: TimeSeriesPoint[];
  errors: ErrorLog[];
  logs: TraefikLog[];
  topRequestAddresses: AddressMetric[];
  topRequestHosts: HostMetric[];
  topClientIPs: ClientMetric[];
}

// Config Types
export interface DashboardConfig {
  refreshInterval: number;
  maxLogs: number;
  agentUrl: string;
  authToken?: string;
  demoMode: boolean;
}

// Filter Types
export interface LogFilter {
  method?: string[];
  status?: number[];
  router?: string[];
  service?: string[];
  timeRange?: TimeRange;
  search?: string;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

// UI Component Props Types
export interface CardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  loading?: boolean;
}

export interface ChartProps {
  data: ChartData;
  height?: number;
  loading?: boolean;
  options?: Record<string, unknown>;
}