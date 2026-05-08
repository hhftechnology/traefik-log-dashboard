import {
  LogsResponse,
  SystemStatsResponse,
  LogSizesResponse,
  StatusResponse,
  TraefikLog,
} from './types';
import { getBaseOrigin, withBasePath } from './utils/base-url';
import { getRuntimeConfig } from './config/runtime-config';

interface AgentRequestInput {
  agentId: string;
  signal?: AbortSignal;
}

interface AccessLogsRequestInput extends AgentRequestInput {
  position?: number;
  lines?: number;
}

interface ErrorLogsRequestInput extends AgentRequestInput {
  position?: number;
  lines?: number;
}

interface SingleLogRequestInput extends AgentRequestInput {
  filename: string;
  position?: number;
  lines?: number;
}

interface FetchJSONInput {
  endpoint: string;
  options?: RequestInit;
  timeoutMs?: number;
  agentId?: string;
  /** Number of retry attempts for transient failures (default: 0 — no retries). */
  retries?: number;
}

export class APIClient {
  private baseOrigin: string;

  constructor(baseURL?: string) {
    this.baseOrigin = (baseURL || getBaseOrigin()).replace(/\/$/, '');
  }

  private buildApiURL(endpoint: string): string {
    const path = withBasePath(endpoint);
    return `${this.baseOrigin}${path}`;
  }

  private async fetchJSON<T>(input: FetchJSONInput): Promise<T> {
    const maxRetries = input.retries ?? 0;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const options = input.options ?? {};
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        ...((options.headers as Record<string, string>) || {}),
      };

      if (input.agentId) {
        headers['X-Agent-Id'] = input.agentId;
      }

      const url = this.buildApiURL(input.endpoint);
      const urlWithTimestamp = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
      const controller = new AbortController();
      const timeoutID = setTimeout(() => controller.abort(), input.timeoutMs ?? 15000);

      if (options.signal) {
        options.signal.addEventListener('abort', () => controller.abort(), { once: true });
      }

      try {
        const response = await fetch(urlWithTimestamp, {
          ...options,
          headers,
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`API Error: ${response.status} - ${error}`);
        }

        return response.json();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Never retry aborts or client errors (4xx)
        if (lastError.name === 'AbortError') throw lastError;
        if (lastError.message.startsWith('API Error: 4')) throw lastError;

        // Retry on network errors and 5xx with exponential backoff
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }
      } finally {
        clearTimeout(timeoutID);
      }
    }

    throw lastError!;
  }

  async getStatus(input: AgentRequestInput): Promise<StatusResponse> {
    try {
      return await this.fetchJSON<StatusResponse>({
        endpoint: '/api/logs/status',
        agentId: input.agentId,
        options: { signal: input.signal },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const isNotFound = message.includes('API Error: 404');
      if (!isNotFound) {
        throw error;
      }

      // Compatibility fallback: older/partial agents may not expose /api/logs/status.
      // If /api/system/resources works, treat agent as reachable and suppress hard failure.
      const resources = await this.getSystemResources(input);
      const systemMonitoring =
        !(typeof resources === 'object' && resources !== null && 'status' in resources && (resources as { status?: string }).status === 'disabled');

      return {
        status: 'ok',
        access_path: '',
        access_path_exists: false,
        error_path: '',
        error_path_exists: false,
        system_monitoring: systemMonitoring,
        auth_enabled: true,
      };
    }
  }

  async getAccessLogs(input: AccessLogsRequestInput): Promise<LogsResponse> {
    const config = getRuntimeConfig();
    const params = new URLSearchParams({
      position: String(input.position ?? 0),
      lines: String(input.lines ?? config.maxLogsDisplay ?? 1000),
    });

    return this.fetchJSON<LogsResponse>({
      endpoint: `/api/logs/access?${params}`,
      agentId: input.agentId,
      options: { signal: input.signal },
      retries: 2,
    });
  }

  async getErrorLogs(input: ErrorLogsRequestInput): Promise<LogsResponse> {
    const params = new URLSearchParams({
      position: String(input.position ?? 0),
      lines: String(input.lines ?? 100),
    });

    return this.fetchJSON<LogsResponse>({
      endpoint: `/api/logs/error?${params}`,
      agentId: input.agentId,
      options: { signal: input.signal },
      retries: 2,
    });
  }

  async getLog(input: SingleLogRequestInput): Promise<LogsResponse> {
    const params = new URLSearchParams({
      filename: input.filename,
      position: String(input.position ?? 0),
      lines: String(input.lines ?? 100),
    });

    return this.fetchJSON<LogsResponse>({
      endpoint: `/api/logs/get?${params}`,
      agentId: input.agentId,
      options: { signal: input.signal },
    });
  }

  async getSystemResources(input: AgentRequestInput): Promise<SystemStatsResponse> {
    return this.fetchJSON<SystemStatsResponse>({
      endpoint: '/api/system/resources',
      agentId: input.agentId,
      options: { signal: input.signal },
      retries: 2,
    });
  }

  async *streamAccessLogs(input: AgentRequestInput): AsyncGenerator<TraefikLog, void, unknown> {
    const headers: Record<string, string> = {
      'Cache-Control': 'no-cache',
      Accept: 'text/event-stream',
      'X-Agent-Id': input.agentId,
    };

    const url = this.buildApiURL('/api/logs/stream');
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: input.signal,
      cache: 'no-store',
    });

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '');
      throw new Error(`Stream error: ${response.status} ${text}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const eventChunk of events) {
          const lines = eventChunk.split('\n');
          let eventName = 'message';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventName = line.slice(7).trim() || 'message';
              continue;
            }
            if (!line.startsWith('data: ')) {
              continue;
            }
            if (eventName === 'cursor') {
              continue;
            }
            try {
              yield JSON.parse(line.slice(6)) as TraefikLog;
            } catch {
              // Ignore malformed stream lines.
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async getLogSizes(input: AgentRequestInput): Promise<LogSizesResponse> {
    return this.fetchJSON<LogSizesResponse>({
      endpoint: '/api/system/logs',
      agentId: input.agentId,
      options: { signal: input.signal },
    });
  }

  async healthCheck(input: AgentRequestInput): Promise<boolean> {
    try {
      await this.getStatus(input);
      return true;
    } catch {
      return false;
    }
  }

  setBaseURL(url: string): void {
    const normalized = url.replace(/\/$/, '');
    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      normalized.startsWith('http://')
    ) {
      this.baseOrigin = '';
      return;
    }
    this.baseOrigin = normalized;
  }

  async lookupLocations(ips: string[]): Promise<{
    locations: Array<{
      ipAddress: string;
      country: string;
      city?: string;
      latitude?: number;
      longitude?: number;
    }>;
    count?: number;
  }> {
    const controller = new AbortController();
    const timeoutID = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(this.buildApiURL('/api/location/lookup'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ips }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Location lookup failed: ${response.statusText}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeoutID);
    }
  }

  async getLocationStatus(): Promise<{
    enabled: boolean;
    available: boolean;
    provider?: string | null;
    provider_available?: boolean;
    local_db_path?: string | null;
    local_db_loaded?: boolean;
    local_db_error?: string | null;
    providers?: Array<{
      base_url: string;
      available: boolean;
      cooldown_until: number | null;
      last_error: string | null;
      consecutive_failures: number;
      success_count: number;
      failure_count: number;
    }>;
  }> {
    return this.fetchJSON({
      endpoint: '/api/location/status',
    });
  }
}

export const apiClient = new APIClient();
