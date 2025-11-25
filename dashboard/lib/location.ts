import { GeoLocation, TraefikLog } from './types';
import { apiClient } from './api-client';

/**
 * Extract IP address from client address string
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

/**
 * Check if IP is private/local
 */
export function isPrivateIP(ip: string): boolean {
  if (!ip) return true;
  
  return (
    ip.startsWith('10.') ||
    ip.startsWith('172.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('127.') ||
    ip === 'localhost' ||
    ip === '::1' ||
    ip.startsWith('fe80:') ||
    ip.startsWith('fc00:') ||
    ip.startsWith('fd00:')
  );
}

// Country coordinates for map visualization
const COUNTRY_COORDS: Record<string, { lat: number; lon: number }> = {
  'US': { lat: 37.0902, lon: -95.7129 },
  'GB': { lat: 55.3781, lon: -3.4360 },
  'DE': { lat: 51.1657, lon: 10.4515 },
  'FR': { lat: 46.2276, lon: 2.2137 },
  'ES': { lat: 40.4637, lon: -3.7492 },
  'IT': { lat: 41.8719, lon: 12.5674 },
  'NL': { lat: 52.1326, lon: 5.2913 },
  'PL': { lat: 51.9194, lon: 19.1451 },
  'CN': { lat: 35.8617, lon: 104.1954 },
  'AU': { lat: -25.2744, lon: 133.7751 },
  'SG': { lat: 1.3521, lon: 103.8198 },
  'JP': { lat: 36.2048, lon: 138.2529 },
  'IN': { lat: 20.5937, lon: 78.9629 },
  'KR': { lat: 35.9078, lon: 127.7669 },
  'BR': { lat: -14.2350, lon: -51.9253 },
  'ZA': { lat: -30.5595, lon: 22.9375 },
  'EG': { lat: 26.8206, lon: 30.8025 },
  'HK': { lat: 22.3193, lon: 114.1694 },
  'CA': { lat: 56.1304, lon: -106.3468 },
  'MX': { lat: 23.6345, lon: -102.5528 },
  'TR': { lat: 38.9637, lon: 35.2433 },
  'SA': { lat: 23.8859, lon: 45.0792 },
  'AE': { lat: 23.4241, lon: 53.8478 },
  'AR': { lat: -38.4161, lon: -63.6167 },
  'RU': { lat: 61.5240, lon: 105.3188 },
  'ID': { lat: -0.7893, lon: 113.9213 },
  'TH': { lat: 15.8700, lon: 100.9925 },
  'VN': { lat: 14.0583, lon: 108.2772 },
  'PH': { lat: 12.8797, lon: 121.7740 },
  'MY': { lat: 4.2105, lon: 101.9758 },
  'MM': { lat: 21.9162, lon: 95.9560 },
  'LK': { lat: 7.8731, lon: 80.7718 },
  'PK': { lat: 30.3753, lon: 69.3451 },
  'BD': { lat: 23.6850, lon: 90.3563 },
  'IR': { lat: 32.4279, lon: 53.6880 },
  'IQ': { lat: 33.2232, lon: 43.6793 },
  'IL': { lat: 31.0461, lon: 34.8516 },
  'NZ': { lat: -40.9006, lon: 174.8860 },
  'SE': { lat: 60.1282, lon: 18.6435 },
  'NO': { lat: 60.4720, lon: 8.4689 },
  'DK': { lat: 56.2639, lon: 9.5018 },
  'FI': { lat: 61.9241, lon: 25.7482 },
  'BE': { lat: 50.5039, lon: 4.4699 },
  'CH': { lat: 46.8182, lon: 8.2275 },
  'AT': { lat: 47.5162, lon: 14.5501 },
  'PT': { lat: 39.3999, lon: -8.2245 },
  'GR': { lat: 39.0742, lon: 21.8243 },
  'IE': { lat: 53.4129, lon: -8.2439 },
  'RO': { lat: 45.9432, lon: 24.9668 },
  'CZ': { lat: 49.8175, lon: 15.4730 },
  'HU': { lat: 47.1625, lon: 19.5033 },
  'UA': { lat: 48.3794, lon: 31.1656 },
  'CO': { lat: 4.5709, lon: -74.2973 },
  'CL': { lat: -35.6751, lon: -71.5430 },
  'PE': { lat: -9.1900, lon: -75.0152 },
  'VE': { lat: 6.4238, lon: -66.5897 },
  'KE': { lat: -0.0236, lon: 37.9062 },
  'NG': { lat: 9.0820, lon: 8.6753 },
  'MA': { lat: 31.7917, lon: -7.0926 },
  'DZ': { lat: 28.0339, lon: 1.6596 },
  'TW': { lat: 23.6978, lon: 120.9605 },
  'NP': { lat: 28.3949, lon: 84.1240 },
};

/**
 * Get coordinates for a country by ISO code
 */
export function getCountryCoordinates(countryCode: string): { lat: number; lon: number } | null {
  return COUNTRY_COORDS[countryCode] || null;
}

/**
 * Lookup locations from agent API
 */
async function lookupLocationsFromAgent(ips: string[]): Promise<Map<string, any>> {
  try {
    const data = await apiClient.lookupLocations(ips);
    const locations = data.locations || [];

    // Convert to Map for easy lookup
    const locationMap = new Map();
    locations.forEach((loc: any) => {
      locationMap.set(loc.ipAddress, {
        country: loc.country || 'Unknown',
        city: loc.city,
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
    });

    return locationMap;
  } catch (error) {
    console.error('Failed to lookup locations from agent:', error);
    return new Map();
  }
}

/**
 * Main function: Aggregate geo locations from logs using agent API
 * This is simplified - no rate limiting needed since agent handles it
 */
export async function aggregateGeoLocations(
  logs: TraefikLog[],
  onProgress?: (current: number, total: number) => void
): Promise<GeoLocation[]> {
  // Extract unique IPs from logs
  const uniqueIPs = new Set<string>();
  
  for (const log of logs) {
    const clientAddr = log.ClientHost || log.ClientAddr || '';
    if (!clientAddr) continue;
    
    const ip = extractIP(clientAddr);
    if (ip && !isPrivateIP(ip)) {
      uniqueIPs.add(ip);
    }
  }
  
  // If no valid IPs, return empty
  if (uniqueIPs.size === 0) {
    return [];
  }

  console.log(`Looking up ${uniqueIPs.size} unique IPs`);

  // Call agent API for location lookups (it handles batching internally)
  if (onProgress) {
    onProgress(1, 1);
  }

  const locationMap = await lookupLocationsFromAgent(Array.from(uniqueIPs));

  // Count requests per country
  const countryMap = new Map<string, { 
    count: number; 
    city?: string; 
    lat?: number; 
    lon?: number 
  }>();
  
  for (const log of logs) {
    const clientAddr = log.ClientHost || log.ClientAddr || '';
    if (!clientAddr) continue;
    
    const ip = extractIP(clientAddr);
    
    if (isPrivateIP(ip)) {
      // Handle private IPs
      const existing = countryMap.get('Private') || { count: 0 };
      countryMap.set('Private', { count: existing.count + 1 });
      continue;
    }
    
    const geoData = locationMap.get(ip);
    if (!geoData) continue;
    
    const country = geoData.country;
    const existing = countryMap.get(country);
    
    if (existing) {
      existing.count++;
    } else {
      // Use coordinates from lookup or fallback to country map
      const coords = getCountryCoordinates(country) || { 
        lat: geoData.latitude, 
        lon: geoData.longitude 
      };
      
      countryMap.set(country, {
        count: 1,
        city: geoData.city,
        lat: coords?.lat || geoData.latitude,
        lon: coords?.lon || geoData.longitude,
      });
    }
  }

  if (onProgress) {
    onProgress(0, 0); // Reset progress
  }
  
  // Convert to GeoLocation array
  const locations = Array.from(countryMap.entries())
    .map(([country, data]) => ({
      country,
      count: data.count,
      city: data.city,
      latitude: data.lat,
      longitude: data.lon,
    }))
    .sort((a, b) => b.count - a.count);

  console.log(`Location lookup complete: ${locations.length} countries found`);

  return locations;
}

/**
 * Format geo location for display
 */
export function formatGeoLocation(location: GeoLocation): string {
  return `${location.country} (${location.count})`;
}

/**
 * Get top N countries by request count (excluding Unknown/Private)
 */
export function getTopCountries(locations: GeoLocation[], limit: number = 10): GeoLocation[] {
  return locations
    .filter(loc => loc.country !== 'Unknown' && loc.country !== 'Private')
    .slice(0, limit);
}

/**
 * Enrich logs with geolocation data (country and city)
 * This adds geoCountry and geoCity fields to each log
 */
export async function enrichLogsWithGeoLocation(logs: TraefikLog[]): Promise<TraefikLog[]> {
  // Extract unique IPs from logs
  const uniqueIPs = new Set<string>();

  for (const log of logs) {
    const clientAddr = log.ClientHost || log.ClientAddr || '';
    if (!clientAddr) continue;

    const ip = extractIP(clientAddr);
    if (ip && !isPrivateIP(ip)) {
      uniqueIPs.add(ip);
    }
  }

  // If no valid IPs, return logs as-is
  if (uniqueIPs.size === 0) {
    return logs;
  }

  // Lookup locations from agent API
  const locationMap = await lookupLocationsFromAgent(Array.from(uniqueIPs));

  // Enrich logs with geolocation data
  return logs.map(log => {
    const clientAddr = log.ClientHost || log.ClientAddr || '';
    if (!clientAddr) return log;

    const ip = extractIP(clientAddr);

    if (isPrivateIP(ip)) {
      return {
        ...log,
        geoCountry: 'Private',
        geoCity: undefined,
      };
    }

    const geoData = locationMap.get(ip);
    if (!geoData) {
      return {
        ...log,
        geoCountry: 'Unknown',
        geoCity: undefined,
      };
    }

    return {
      ...log,
      geoCountry: geoData.country || 'Unknown',
      geoCity: geoData.city,
    };
  });
}