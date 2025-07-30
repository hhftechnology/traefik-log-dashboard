import axios from 'axios';
import NodeCache from 'node-cache';

// Cache geolocation data for 24 hours
const geoCache = new NodeCache({ stdTTL: 86400 });

// Rate limiting tracker
let lastRequestTime = 0;
let requestCount = 0;
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 45;

export async function getGeoLocation(ip) {
  // Check if it's a private IP
  if (isPrivateIP(ip)) {
    return {
      country: 'Private Network',
      city: 'Local',
      countryCode: 'XX',
      lat: 0,
      lon: 0
    };
  }

  // Check cache first
  const cached = geoCache.get(ip);
  if (cached) {
    return cached;
  }

  // Rate limiting check
  const now = Date.now();
  if (now - lastRequestTime > RATE_LIMIT_WINDOW) {
    requestCount = 0;
    lastRequestTime = now;
  }

  if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
    console.warn(`Rate limit reached for IP geolocation. Skipping ${ip}`);
    return null;
  }

  try {
    requestCount++;
    
    // Using ip-api.com free service (limited to 45 requests per minute)
    const response = await axios.get(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,as,query`, {
      timeout: 2000
    });

    if (response.data.status === 'success') {
      const geoData = {
        country: response.data.country || 'Unknown',
        city: response.data.city || response.data.regionName || 'Unknown',
        countryCode: response.data.countryCode || 'XX',
        lat: response.data.lat || 0,
        lon: response.data.lon || 0,
        region: response.data.regionName,
        timezone: response.data.timezone,
        isp: response.data.isp,
        org: response.data.org
      };

      // Cache the result
      geoCache.set(ip, geoData);
      return geoData;
    } else {
      console.warn(`Failed to geolocate IP ${ip}: ${response.data.message}`);
      
      // Cache null result to avoid repeated failed requests
      const failedData = {
        country: 'Unknown',
        city: 'Unknown',
        countryCode: 'XX',
        lat: 0,
        lon: 0
      };
      geoCache.set(ip, failedData);
      return failedData;
    }
  } catch (error) {
    console.error(`Error getting geolocation for IP ${ip}:`, error.message);
    
    // Try fallback service if primary fails
    try {
      const fallbackResponse = await axios.get(`https://ipinfo.io/${ip}/json`, {
        timeout: 2000
      });

      if (fallbackResponse.data && fallbackResponse.data.country) {
        const [lat, lon] = (fallbackResponse.data.loc || '0,0').split(',').map(Number);
        const geoData = {
          country: getCountryName(fallbackResponse.data.country),
          city: fallbackResponse.data.city || 'Unknown',
          countryCode: fallbackResponse.data.country || 'XX',
          lat: lat || 0,
          lon: lon || 0,
          region: fallbackResponse.data.region,
          timezone: fallbackResponse.data.timezone,
          isp: fallbackResponse.data.org
        };
        
        geoCache.set(ip, geoData);
        return geoData;
      }
    } catch (fallbackError) {
      console.error(`Fallback geolocation also failed for IP ${ip}`);
    }
    
    return null;
  }
}

function isPrivateIP(ip) {
  if (!ip || ip === 'unknown') return true;
  
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  
  return (
    ip === '127.0.0.1' ||
    ip === 'localhost' ||
    ip.startsWith('::') ||
    ip === '::1' ||
    (parts[0] === '10') ||
    (parts[0] === '172' && parseInt(parts[1]) >= 16 && parseInt(parts[1]) <= 31) ||
    (parts[0] === '192' && parts[1] === '168') ||
    (parts[0] === '169' && parts[1] === '254') // Link-local
  );
}

// Helper to convert country codes to names
function getCountryName(code) {
  const countryNames = {
    'US': 'United States',
    'GB': 'United Kingdom',
    'DE': 'Germany',
    'FR': 'France',
    'IT': 'Italy',
    'ES': 'Spain',
    'CA': 'Canada',
    'AU': 'Australia',
    'JP': 'Japan',
    'CN': 'China',
    'IN': 'India',
    'BR': 'Brazil',
    'RU': 'Russia',
    'NL': 'Netherlands',
    'SE': 'Sweden',
    'NO': 'Norway',
    'DK': 'Denmark',
    'FI': 'Finland',
    'PL': 'Poland',
    'CH': 'Switzerland',
    'AT': 'Austria',
    'BE': 'Belgium',
    'IE': 'Ireland',
    'SG': 'Singapore',
    'KR': 'South Korea',
    'MX': 'Mexico',
    'AR': 'Argentina',
    'CL': 'Chile',
    'CO': 'Colombia',
    'ZA': 'South Africa',
    'EG': 'Egypt',
    'NG': 'Nigeria',
    'KE': 'Kenya',
    'IL': 'Israel',
    'AE': 'United Arab Emirates',
    'SA': 'Saudi Arabia',
    'TR': 'Turkey',
    'UA': 'Ukraine',
    'CZ': 'Czech Republic',
    'HU': 'Hungary',
    'GR': 'Greece',
    'PT': 'Portugal',
    'RO': 'Romania',
    'TH': 'Thailand',
    'VN': 'Vietnam',
    'PH': 'Philippines',
    'ID': 'Indonesia',
    'MY': 'Malaysia',
    'NZ': 'New Zealand',
    'HK': 'Hong Kong',
    'TW': 'Taiwan'
  };
  
  return countryNames[code] || code;
}

// Export cache stats for monitoring
export function getGeoCacheStats() {
  return {
    keys: geoCache.keys().length,
    stats: geoCache.getStats()
  };
}

// Clear cache if needed
export function clearGeoCache() {
  geoCache.flushAll();
}