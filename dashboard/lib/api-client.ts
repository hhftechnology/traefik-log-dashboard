import {
  LogsResponse,
  SystemStats,
  LogSizesResponse,
  StatusResponse,
} from './types';
import { getBaseOrigin, withBasePath } from './utils/base-url';

export class APIClient {
  private baseOrigin: string;
  private authToken?: string;

  constructor(baseURL?: string, authToken?: string) {
    // Default to empty string to use same-origin unless a base domain is provided
    this.baseOrigin = (baseURL || getBaseOrigin()).replace(/\/$/, '');
    this.authToken = authToken;
  }

  private buildApiUrl(endpoint: string): string {
    const path = withBasePath(endpoint);
    return `${this.baseOrigin}${path}`;
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      // Add cache control headers to prevent stale data
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const url = this.buildApiUrl(endpoint);
    // Add timestamp to prevent caching
    const urlWithTimestamp = `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;

    // FIX: Add timeout to prevent infinite hanging
    // Use provided signal or create a new AbortController with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    // Combine signals if one was provided
    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(urlWithTimestamp, {
        ...options,
        headers,
        cache: 'no-store', // Prevent browser caching
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API Error: ${response.status} - ${error}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get agent status
   */
  async getStatus(): Promise<StatusResponse> {
    return this.fetch<StatusResponse>('/api/logs/status');
  }

  /**
   * Get access logs
   */
  async getAccessLogs(
    position: number = 0,
    lines: number = 1000,
    options: { signal?: AbortSignal } = {}
  ): Promise<LogsResponse> {
    const params = new URLSearchParams({
      position: position.toString(),
      lines: lines.toString(),
    });
    return this.fetch<LogsResponse>(`/api/logs/access?${params}`, { signal: options.signal });
  }

  /**
   * Get error logs
   */
  async getErrorLogs(
    position: number = 0,
    lines: number = 100
  ): Promise<LogsResponse> {
    const params = new URLSearchParams({
      position: position.toString(),
      lines: lines.toString(),
    });
    return this.fetch<LogsResponse>(`/api/logs/error?${params}`);
  }

  /**
   * Get specific log file
   */
  async getLog(
    filename: string,
    position: number = 0,
    lines: number = 100
  ): Promise<LogsResponse> {
    const params = new URLSearchParams({
      filename,
      position: position.toString(),
      lines: lines.toString(),
    });
    return this.fetch<LogsResponse>(`/api/logs/get?${params}`);
  }

  /**
   * Get system resources
   */
  async getSystemResources(): Promise<SystemStats> {
    return this.fetch<SystemStats>('/api/system/resources');
  }

  /**
   * Get log file sizes
   */
  async getLogSizes(): Promise<LogSizesResponse> {
    return this.fetch<LogSizesResponse>('/api/system/logs');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.fetch('/api/logs/status');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set auth token
   */
  setAuthToken(token: string) {
    this.authToken = token;
  }

  /**
   * Set base URL
   */
  setBaseURL(url: string) {
    this.baseOrigin = url.replace(/\/$/, '');
  }

  /**
 * Lookup locations for IP addresses using Dashboard's local GeoIP database
 * REFACTOR: Changed from calling agent to using local dashboard endpoint
 */
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
  // FIX: Add timeout to prevent infinite hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch(this.buildApiUrl('/api/location/lookup'), {
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
    clearTimeout(timeoutId);
  }
}

/**
 * Get location service status
 */
async getLocationStatus(): Promise<{
  enabled: boolean;
  available: boolean;
  city_db: string;
  country_db: string;
}> {
  return this.fetch('/api/location/status');
}
}

// Default client instance
export const apiClient = new APIClient();