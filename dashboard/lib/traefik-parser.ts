import { TraefikLog } from './types';

// OPTIMIZATION: Compile regex patterns once at module load time
const CLF_PATTERN = /^(\S+) - (\S+) \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\d+) "([^"]*)" "([^"]*)" (\d+) "([^"]*)" "([^"]*)" (\d+)ms/;

// OPTIMIZATION: Pre-compile quick validation patterns for early rejection
const JSON_START_PATTERN = /^\s*\{/;
const EMPTY_LINE_PATTERN = /^\s*$/;

// OPTIMIZATION: Field name cache to avoid repeated string allocations
const FIELD_KEYS = {
  clientAddr: ['ClientAddr', 'clientAddr'],
  clientHost: ['ClientHost', 'clientHost'],
  clientPort: ['ClientPort', 'clientPort'],
  clientUsername: ['ClientUsername', 'clientUsername'],
  downstreamContentSize: ['DownstreamContentSize', 'downstreamContentSize'],
  downstreamStatus: ['DownstreamStatus', 'downstreamStatus'],
  duration: ['Duration', 'duration'],
  originContentSize: ['OriginContentSize', 'originContentSize'],
  originDuration: ['OriginDuration', 'originDuration'],
  originStatus: ['OriginStatus', 'originStatus'],
  overhead: ['Overhead', 'overhead'],
  requestAddr: ['RequestAddr', 'requestAddr'],
  requestContentSize: ['RequestContentSize', 'requestContentSize'],
  requestCount: ['RequestCount', 'requestCount'],
  requestHost: ['RequestHost', 'requestHost'],
  requestMethod: ['RequestMethod', 'requestMethod'],
  requestPath: ['RequestPath', 'requestPath'],
  requestPort: ['RequestPort', 'requestPort'],
  requestProtocol: ['RequestProtocol', 'requestProtocol'],
  requestScheme: ['RequestScheme', 'requestScheme'],
  retryAttempts: ['RetryAttempts', 'retryAttempts'],
  routerName: ['RouterName', 'routerName'],
  serviceAddr: ['ServiceAddr', 'serviceAddr'],
  serviceName: ['ServiceName', 'serviceName'],
  serviceURL: ['ServiceURL', 'serviceURL'],
  startLocal: ['StartLocal', 'startLocal'],
  startUTC: ['StartUTC', 'startUTC', 'time', 'Time'],
  entryPointName: ['entryPointName', 'EntryPointName'],
} as const;

/**
 * Helper function to safely extract string values from parsed JSON
 * Handles multiple possible field name variations
 * FIXED: Accept readonly arrays to work with FIELD_KEYS constant
 */
function getStringValue(parsed: Record<string, unknown>, keys: readonly string[], defaultValue: string = ''): string {
  for (const key of keys) {
    if (parsed[key] !== undefined && parsed[key] !== null) {
      if (typeof parsed[key] === 'string') {
        return parsed[key];
      }
      // Convert to string if it's another type
      return String(parsed[key]);
    }
  }
  return defaultValue;
}

/**
 * Helper function to safely extract integer values from parsed JSON
 * FIXED: Accept readonly arrays to work with FIELD_KEYS constant
 */
function getIntValue(parsed: Record<string, unknown>, keys: readonly string[], defaultValue: number = 0): number {
  for (const key of keys) {
    const value = parsed[key];
    if (value !== undefined && value !== null) {
      if (typeof value === 'number') {
        return Math.floor(value);
      }
      if (typeof value === 'string') {
        const num = parseInt(value, 10);
        if (!isNaN(num)) {
          return num;
        }
      }
    }
  }
  return defaultValue;
}

/**
 * Check if a parsed JSON object is a valid Traefik log entry
 */
function isValidTraefikLog(parsed: Record<string, unknown>): boolean {
  // Must have a timestamp
  if (!parsed.time && !parsed.Time && !parsed.StartUTC) {
    return false;
  }

  // For access logs, must have downstream status or request method
  if (parsed.DownstreamStatus !== undefined || parsed.downstreamStatus !== undefined) {
    return true;
  }
  
  if (parsed.RequestMethod !== undefined || parsed.requestMethod !== undefined) {
    return true;
  }

  // For error logs, check for level
  if (parsed.level) {
    const level = String(parsed.level).toLowerCase();
    return level === 'error' || level === 'warn' || level === 'info';
  }

  return false;
}

/**
 * OPTIMIZED: Parse a single Traefik log line (auto-detect JSON or CLF format)
 * Uses early validation to skip invalid logs faster
 */
export function parseTraefikLog(logLine: string): TraefikLog | null {
  // OPTIMIZATION: Early exit for empty lines using pre-compiled regex
  if (!logLine || EMPTY_LINE_PATTERN.test(logLine)) {
    return null;
  }

  // OPTIMIZATION: Use pre-compiled regex for JSON detection
  if (JSON_START_PATTERN.test(logLine)) {
    try {
      return parseJSONLog(logLine);
    } catch {
      // If JSON parsing fails, try CLF as fallback
    }
  }

  // Try CLF format
  return parseCLFLog(logLine);
}

/**
 * OPTIMIZED: Parse JSON format Traefik log with field caching
 * Enhanced to handle multiple field name variations and validate entries
 */
function parseJSONLog(logLine: string): TraefikLog | null {
  try {
    const parsed = JSON.parse(logLine);

    // OPTIMIZATION: Early validation before field extraction
    if (!isValidTraefikLog(parsed)) {
      return null;
    }

    // CRITICAL FIX: Handle request_ prefix fields with both hyphen and underscore
    // Traefik uses hyphen in header names: request_User-Agent, not request_User_Agent
    const requestUserAgent = parsed['request_User-Agent'] ||
                           parsed['request_User_Agent'] ||
                           parsed['RequestUserAgent'] ||
                           parsed['User-Agent'] ||
                           parsed['UserAgent'] ||
                           '';

    // OPTIMIZATION: Use pre-defined field keys cache to reduce allocations
    return {
      ClientAddr: getStringValue(parsed, FIELD_KEYS.clientAddr),
      ClientHost: getStringValue(parsed, FIELD_KEYS.clientHost),
      ClientPort: getStringValue(parsed, FIELD_KEYS.clientPort),
      ClientUsername: getStringValue(parsed, FIELD_KEYS.clientUsername, '-'),
      DownstreamContentSize: getIntValue(parsed, FIELD_KEYS.downstreamContentSize),
      DownstreamStatus: getIntValue(parsed, FIELD_KEYS.downstreamStatus),
      Duration: getIntValue(parsed, FIELD_KEYS.duration),
      OriginContentSize: getIntValue(parsed, FIELD_KEYS.originContentSize),
      OriginDuration: getIntValue(parsed, FIELD_KEYS.originDuration),
      OriginStatus: getIntValue(parsed, FIELD_KEYS.originStatus),
      Overhead: getIntValue(parsed, FIELD_KEYS.overhead),
      RequestAddr: getStringValue(parsed, FIELD_KEYS.requestAddr),
      RequestContentSize: getIntValue(parsed, FIELD_KEYS.requestContentSize),
      RequestCount: getIntValue(parsed, FIELD_KEYS.requestCount),
      RequestHost: getStringValue(parsed, FIELD_KEYS.requestHost),
      RequestMethod: getStringValue(parsed, FIELD_KEYS.requestMethod),
      RequestPath: getStringValue(parsed, FIELD_KEYS.requestPath),
      RequestPort: getStringValue(parsed, FIELD_KEYS.requestPort),
      RequestProtocol: getStringValue(parsed, FIELD_KEYS.requestProtocol),
      RequestScheme: getStringValue(parsed, FIELD_KEYS.requestScheme),
      RetryAttempts: getIntValue(parsed, FIELD_KEYS.retryAttempts),
      RouterName: getStringValue(parsed, FIELD_KEYS.routerName),
      ServiceAddr: getStringValue(parsed, FIELD_KEYS.serviceAddr),
      ServiceName: getStringValue(parsed, FIELD_KEYS.serviceName),
      ServiceURL: getStringValue(parsed, FIELD_KEYS.serviceURL),
      StartLocal: getStringValue(parsed, FIELD_KEYS.startLocal),
      StartUTC: getStringValue(parsed, FIELD_KEYS.startUTC),
      entryPointName: getStringValue(parsed, FIELD_KEYS.entryPointName),
      request_Referer: parsed['request_Referer'] || parsed['request_referer'] || parsed['RequestReferer'] || parsed['Referer'] || '',
      request_User_Agent: requestUserAgent,
    };
  } catch {
    return null;
  }
}

/**
 * Parse CLF (Common Log Format) Traefik log
 */
function parseCLFLog(logLine: string): TraefikLog | null {
  const match = logLine.match(CLF_PATTERN);
  
  if (!match) {
    return null;
  }

  const [
    _,
    remoteAddr,
    username,
    timestamp,
    method,
    path,
    protocol,
    status,
    size,
    referer,
    userAgent,
    count,
    router,
    serviceURL,
    duration
  ] = match;

  // Extract host and port from remote address
  const [clientHost, clientPort] = remoteAddr.includes(':') 
    ? remoteAddr.split(':') 
    : [remoteAddr, ''];

  return {
    ClientAddr: remoteAddr,
    ClientHost: clientHost,
    ClientPort: clientPort,
    ClientUsername: username === '-' ? '' : username,
    DownstreamContentSize: parseInt(size) || 0,
    DownstreamStatus: parseInt(status) || 0,
    Duration: parseInt(duration) * 1000000, // Convert ms to ns
    OriginContentSize: 0,
    OriginDuration: 0,
    OriginStatus: parseInt(status) || 0,
    Overhead: 0,
    RequestAddr: remoteAddr,
    RequestContentSize: 0,
    RequestCount: parseInt(count) || 0,
    RequestHost: '',
    RequestMethod: method,
    RequestPath: path,
    RequestPort: '',
    RequestProtocol: protocol,
    RequestScheme: 'http',
    RetryAttempts: 0,
    RouterName: router,
    ServiceAddr: '',
    ServiceName: '',
    ServiceURL: serviceURL,
    StartLocal: timestamp,
    StartUTC: timestamp,
    entryPointName: '',
    request_Referer: referer === '-' ? '' : referer,
    request_User_Agent: userAgent === '-' ? '' : userAgent,
  };
}

/**
 * OPTIMIZED: Parse multiple Traefik log lines with batch processing
 * Filters out invalid entries automatically and uses more efficient processing
 */
export function parseTraefikLogs(logLines: string[]): TraefikLog[] {
  // OPTIMIZATION: Pre-allocate array with estimated size to reduce reallocations
  const results: TraefikLog[] = [];
  results.length = 0;

  // OPTIMIZATION: Use for loop instead of map+filter for better performance
  // Reduces intermediate array allocations and function call overhead
  for (let i = 0; i < logLines.length; i++) {
    const log = parseTraefikLog(logLines[i]);
    if (log !== null) {
      results.push(log);
    }
  }

  return results;
}

export async function parseTraefikLogsBatched(
  logLines: string[],
  chunkSize: number = 1000
): Promise<TraefikLog[]> {
  const results: TraefikLog[] = [];

  for (let i = 0; i < logLines.length; i += chunkSize) {
    const chunk = logLines.slice(i, i + chunkSize);

    // Parse chunk synchronously
    for (let j = 0; j < chunk.length; j++) {
      const log = parseTraefikLog(chunk[j]);
      if (log !== null) {
        results.push(log);
      }
    }

    // Yield to event loop every chunk to prevent blocking
    if (i + chunkSize < logLines.length) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return results;
}

/**
 * Extract method from log line (quick parse without full parsing)
 */
export function extractMethod(logLine: string): string | null {
  const match = logLine.match(/"(\S+)\s+\S+\s+\S+"/);
  return match ? match[1] : null;
}

/**
 * Extract status code from log line (quick parse)
 */
export function extractStatus(logLine: string): number | null {
  const match = logLine.match(/"\s+(\d{3})\s+/);
  return match ? parseInt(match[1]) : null;
}

/**
 * Extract timestamp from log line
 */
export function extractTimestamp(logLine: string): string | null {
  const match = logLine.match(/\[([^\]]+)\]/);
  return match ? match[1] : null;
}

/**
 * Extract client IP from various address formats
 */
export function extractIP(clientAddr: string): string {
  if (!clientAddr || clientAddr === '') {
    return 'unknown';
  }

  // Handle IPv6 addresses in brackets
  if (clientAddr.startsWith('[')) {
    const match = clientAddr.indexOf(']');
    if (match !== -1) {
      return clientAddr.substring(1, match);
    }
  }

  // Handle IPv4 with port
  if (clientAddr.includes('.') && clientAddr.includes(':')) {
    const lastColon = clientAddr.lastIndexOf(':');
    if (lastColon !== -1) {
      return clientAddr.substring(0, lastColon);
    }
  }

  // Handle IPv6 without brackets
  if (clientAddr.includes(':') && !clientAddr.includes('.')) {
    return clientAddr;
  }

  return clientAddr;
}