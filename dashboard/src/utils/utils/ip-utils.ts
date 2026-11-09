/**
 * Shared IP utility functions
 * Consolidated from location.ts and filter-utils.ts to eliminate duplication
 */

/**
 * Check if an IP is private/local
 * Uses the more complete IPv6-aware version from location.ts
 */
export function isPrivateIP(ip: string): boolean {
  if (!ip) return true;

  // 172.16.0.0/12 requires second octet precision.
  if (ip.startsWith('172.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      const second = parseInt(parts[1], 10);
      return Number.isFinite(second) && second >= 16 && second <= 31;
    }
    return false;
  }

  // Other IPv4 private ranges
  if (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('127.') ||
    ip === 'localhost'
  ) {
    return true;
  }
  
  // IPv6 private/local addresses
  if (
    ip === '::1' ||
    ip.startsWith('fe80:') ||
    ip.startsWith('fc00:') ||
    ip.startsWith('fd00:')
  ) {
    return true;
  }
  
  return false;
}

/**
 * Check if an IPv4 address matches a CIDR range or exact IP
 */
export function matchesIPRange(ip: string, range: string): boolean {
  if (!ip || !range) return false;

  // Exact match
  if (ip === range) return true;

  // CIDR match (IPv4 only)
  if (range.includes('/')) {
    const [subnet, prefixStr] = range.split('/');
    const prefix = parseInt(prefixStr, 10);
    if (!Number.isFinite(prefix) || prefix < 0 || prefix > 32) return false;

    const ipNum = ipToNumber(ip);
    const subnetNum = ipToNumber(subnet);
    if (ipNum === null || subnetNum === null) return false;

    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (ipNum & mask) === (subnetNum & mask);
  }

  return false;
}

function ipToNumber(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (const part of parts) {
    const octet = parseInt(part, 10);
    if (!Number.isFinite(octet) || octet < 0 || octet > 255) return null;
    num = (num << 8) + octet;
  }
  return num >>> 0;
}

/**
 * Check if an IP matches any entry in a list of CIDR ranges or exact IPs
 */
export function matchesAnyIPRange(ip: string, ranges: string[]): boolean {
  return ranges.some((range) => matchesIPRange(ip, range.trim()));
}

/**
 * Extract IP address from client address string
 * Handles IPv6 addresses and port numbers
 */
export function extractIP(clientAddr: string): string {
  if (!clientAddr) return '';
  const value = clientAddr.trim();

  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    if (end > 1) {
      return value.slice(1, end);
    }
  }

  // IPv4 with a numeric port. Fully written IPv6 has multiple colons and must
  // keep every hextet; only the bracket form above carries a port.
  const lastColon = value.lastIndexOf(':');
  if (lastColon > 0 && value.includes('.')) {
    const host = value.slice(0, lastColon);
    const port = value.slice(lastColon + 1);
    if (/^\d+$/.test(port) && host.split('.').length === 4) {
      return host;
    }
  }

  return value;
}

