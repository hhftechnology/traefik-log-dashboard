// dashboard/lib/utils/filter-utils.ts

import { TraefikLog } from '../types';
import { FilterSettings, FilterCondition } from '../types/filter';

/**
 * Check if an IP is private
 */
function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;

  const first = parseInt(parts[0]);
  const second = parseInt(parts[1]);

  // 10.0.0.0/8
  if (first === 10) return true;

  // 172.16.0.0/12
  if (first === 172 && second >= 16 && second <= 31) return true;

  // 192.168.0.0/16
  if (first === 192 && second === 168) return true;

  // 127.0.0.0/8 (localhost)
  if (first === 127) return true;

  return false;
}

/**
 * Extract real IP from headers based on proxy settings
 */
function getRealIP(log: TraefikLog, settings: FilterSettings): string {
  let ip = log.ClientHost || log.ClientAddr || '';

  // Strip port if present
  if (ip.includes(':')) {
    ip = ip.split(':')[0];
  }

  // Check proxy headers in order of precedence
  if (settings.proxySettings.enableCFHeaders) {
    // Cloudflare CF-Connecting-IP header
    const cfIP = (log as any).request_CF_Connecting_IP;
    if (cfIP) return cfIP;
  }

  if (settings.proxySettings.enableXRealIP) {
    const xRealIP = (log as any).request_X_Real_IP;
    if (xRealIP) return xRealIP;
  }

  if (settings.proxySettings.enableXForwardedFor) {
    const xForwardedFor = (log as any).request_X_Forwarded_For;
    if (xForwardedFor) {
      // X-Forwarded-For can be a comma-separated list; take the first IP
      return xForwardedFor.split(',')[0].trim();
    }
  }

  // Check custom headers
  for (const header of settings.proxySettings.customHeaders) {
    const headerValue = (log as any)[`request_${header.replace(/-/g, '_')}`];
    if (headerValue) return headerValue;
  }

  return ip;
}

/**
 * Check if a log entry matches a filter condition
 */
function matchesCondition(log: any, condition: FilterCondition): boolean {
  if (!condition.enabled) return false;

  const fieldValue = String(log[condition.field] || '').toLowerCase();
  const conditionValue = condition.value.toLowerCase();

  switch (condition.operator) {
    case 'equals':
      return fieldValue === conditionValue;
    case 'not_equals':
      return fieldValue !== conditionValue;
    case 'contains':
      return fieldValue.includes(conditionValue);
    case 'starts_with':
      return fieldValue.startsWith(conditionValue);
    case 'ends_with':
      return fieldValue.endsWith(conditionValue);
    case 'regex':
      try {
        const regex = new RegExp(conditionValue);
        return regex.test(fieldValue);
      } catch {
        return false;
      }
    case 'greater_than':
      return parseFloat(fieldValue) > parseFloat(conditionValue);
    case 'less_than':
      return parseFloat(fieldValue) < parseFloat(conditionValue);
    default:
      return false;
  }
}

/**
 * Check if user agent appears to be a bot
 */
function isBot(userAgent: string): boolean {
  if (!userAgent) return false;
  
  const botPatterns = [
    'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget',
    'python-requests', 'go-http-client', 'java', 'apache-httpclient',
    'googlebot', 'bingbot', 'yandexbot', 'baiduspider', 'slackbot',
    'twitterbot', 'facebookexternalhit', 'linkedinbot', 'whatsapp'
  ];

  const lowerUA = userAgent.toLowerCase();
  return botPatterns.some(pattern => lowerUA.includes(pattern));
}

/**
 * Apply filter settings to logs array
 */
export function applyFilters(logs: TraefikLog[], settings: FilterSettings): TraefikLog[] {
  return logs.filter(log => {
    // Get real IP based on proxy settings
    const realIP = getRealIP(log, settings);

    // Filter excluded IPs
    if (settings.excludedIPs.includes(realIP)) {
      return false;
    }

    // Filter unknown IPs
    if (settings.excludeUnknownIPs && (!realIP || realIP === 'unknown')) {
      return false;
    }

    // Filter private IPs
    if (settings.excludePrivateIPs && isPrivateIP(realIP)) {
      return false;
    }

    // Filter unknown routers/services
    if (settings.excludeUnknownRoutersServices) {
      if (log.RouterName === 'Unknown' || log.ServiceName === 'Unknown') {
        return false;
      }
    }

    // Filter status codes
    if (settings.excludeStatusCodes.includes(log.DownstreamStatus)) {
      return false;
    }

    // Filter bots
    if (settings.excludeBots && isBot(log.request_User_Agent || '')) {
      return false;
    }

    // Filter paths
    for (const path of settings.excludePaths) {
      if (log.RequestPath && log.RequestPath.includes(path)) {
        return false;
      }
    }

    // Apply custom conditions with mode support
    // First check if any INCLUDE filters are active
    const includeFilters = settings.customConditions.filter(c => c.enabled && c.mode === 'include');
    const excludeFilters = settings.customConditions.filter(c => c.enabled && (!c.mode || c.mode === 'exclude'));

    // If there are active INCLUDE filters, log must match at least one of them
    if (includeFilters.length > 0) {
      const matchesAnyInclude = includeFilters.some(condition => matchesCondition(log, condition));
      if (!matchesAnyInclude) {
        return false; // Log doesn't match any include filter, so exclude it
      }
    }

    // Then check EXCLUDE filters - if any match, exclude the log
    for (const condition of excludeFilters) {
      if (matchesCondition(log, condition)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Get a summary of active filters
 */
export function getActiveFilterSummary(settings: FilterSettings): string[] {
  const summary: string[] = [];

  if (settings.excludedIPs.length > 0) {
    summary.push(`${settings.excludedIPs.length} IPs excluded`);
  }

  if (settings.excludeUnknownIPs) {
    summary.push('Unknown IPs excluded');
  }

  if (settings.excludePrivateIPs) {
    summary.push('Private IPs excluded');
  }

  if (settings.excludeUnknownRoutersServices) {
    summary.push('Unknown routers/services excluded');
  }

  if (settings.excludeStatusCodes.length > 0) {
    summary.push(`${settings.excludeStatusCodes.length} status codes excluded`);
  }

  if (settings.excludeBots) {
    summary.push('Bots excluded');
  }

  if (settings.excludePaths.length > 0) {
    summary.push(`${settings.excludePaths.length} paths excluded`);
  }

  const enabledCustom = settings.customConditions.filter(c => c.enabled).length;
  if (enabledCustom > 0) {
    summary.push(`${enabledCustom} custom conditions active`);
  }

  return summary;
}