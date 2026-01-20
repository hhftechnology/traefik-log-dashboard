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
  
  // IPv4 private ranges
  if (
    ip.startsWith('10.') ||
    ip.startsWith('172.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('127.') ||
    ip === 'localhost'
  ) {
    // Check 172.16.0.0/12 range more precisely
    if (ip.startsWith('172.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        const second = parseInt(parts[1], 10);
        if (second >= 16 && second <= 31) {
          return true;
        }
      }
    }
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
 * Extract IP address from client address string
 * Handles IPv6 addresses and port numbers
 */
export function extractIP(clientAddr: string): string {
  if (!clientAddr) return '';
  
  // Handle IPv6 addresses
  if (clientAddr.includes('[')) {
    const match = clientAddr.match(/\[([^\]]+)\]/);
    return match ? match[1] : clientAddr;
  }
  
  // Remove port for IPv4
  const lastColonIndex = clientAddr.lastIndexOf(':');
  if (lastColonIndex > 0 && !clientAddr.includes('::')) {
    return clientAddr.substring(0, lastColonIndex);
  }
  
  return clientAddr;
}

