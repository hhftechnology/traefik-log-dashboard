import axios from 'axios';
import NodeCache from 'node-cache';

// Cache geolocation data for 7 days (increased from 24 hours)
const geoCache = new NodeCache({ stdTTL: 604800 });

// Rate limiting tracker
let lastRequestTime = 0;
let requestCount = 0;
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 45;

// Queue for failed requests to retry later
const retryQueue = [];

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
    console.warn(`Rate limit reached for IP geolocation. Adding ${ip} to retry queue`);
    retryQueue.push(ip);
    return {
      country: 'Pending',
      city: 'Pending',
      countryCode: 'XX',
      lat: 0,
      lon: 0
    };
  }

  try {
    requestCount++;
    
    // Using ip-api.com free service
    const response = await axios.get(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,as,query`, {
      timeout: 5000 // Increased timeout
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
      return await tryFallbackService(ip);
    }
  } catch (error) {
    console.error(`Error getting geolocation for IP ${ip}:`, error.message);
    return await tryFallbackService(ip);
  }
}

async function tryFallbackService(ip) {
  try {
    // Try ipapi.co as fallback (also free, 1000 requests per day)
    const response = await axios.get(`https://ipapi.co/${ip}/json/`, {
      timeout: 5000
    });

    if (response.data && response.data.country_name) {
      const geoData = {
        country: response.data.country_name || 'Unknown',
        city: response.data.city || 'Unknown',
        countryCode: response.data.country_code || 'XX',
        lat: response.data.latitude || 0,
        lon: response.data.longitude || 0,
        region: response.data.region,
        timezone: response.data.timezone,
        isp: response.data.org
      };
      
      geoCache.set(ip, geoData);
      return geoData;
    }
  } catch (fallbackError) {
    console.error(`Fallback geolocation also failed for IP ${ip}`);
  }

  // Try third service - ipinfo.io
  try {
    const response = await axios.get(`https://ipinfo.io/${ip}/json`, {
      timeout: 5000
    });

    if (response.data && response.data.country) {
      const [lat, lon] = (response.data.loc || '0,0').split(',').map(Number);
      const geoData = {
        country: getCountryName(response.data.country),
        city: response.data.city || 'Unknown',
        countryCode: response.data.country || 'XX',
        lat: lat || 0,
        lon: lon || 0,
        region: response.data.region,
        timezone: response.data.timezone,
        isp: response.data.org
      };
      
      geoCache.set(ip, geoData);
      return geoData;
    }
  } catch (thirdError) {
    console.error(`All geolocation services failed for IP ${ip}`);
  }
  
  // Cache failed result to avoid repeated failed requests
  const failedData = {
    country: 'Unknown',
    city: 'Unknown',
    countryCode: 'XX',
    lat: 0,
    lon: 0
  };
  geoCache.set(ip, failedData, 3600); // Cache failures for only 1 hour
  return failedData;
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
    'TW': 'Taiwan',
    'IS': 'Iceland',
    'LU': 'Luxembourg',
    'MT': 'Malta',
    'CY': 'Cyprus',
    'EE': 'Estonia',
    'LV': 'Latvia',
    'LT': 'Lithuania',
    'SI': 'Slovenia',
    'SK': 'Slovakia',
    'BG': 'Bulgaria',
    'HR': 'Croatia',
    'RS': 'Serbia',
    'BA': 'Bosnia and Herzegovina',
    'AL': 'Albania',
    'MK': 'North Macedonia',
    'ME': 'Montenegro',
    'XK': 'Kosovo',
    'MD': 'Moldova',
    'BY': 'Belarus',
    'GE': 'Georgia',
    'AM': 'Armenia',
    'AZ': 'Azerbaijan',
    'KZ': 'Kazakhstan',
    'UZ': 'Uzbekistan',
    'TM': 'Turkmenistan',
    'KG': 'Kyrgyzstan',
    'TJ': 'Tajikistan',
    'MN': 'Mongolia',
    'PK': 'Pakistan',
    'BD': 'Bangladesh',
    'LK': 'Sri Lanka',
    'NP': 'Nepal',
    'BT': 'Bhutan',
    'MM': 'Myanmar',
    'LA': 'Laos',
    'KH': 'Cambodia',
    'BN': 'Brunei',
    'TL': 'Timor-Leste',
    'PG': 'Papua New Guinea',
    'FJ': 'Fiji',
    'SB': 'Solomon Islands',
    'VU': 'Vanuatu',
    'NC': 'New Caledonia',
    'PF': 'French Polynesia',
    'WS': 'Samoa',
    'TO': 'Tonga',
    'KI': 'Kiribati',
    'TV': 'Tuvalu',
    'NR': 'Nauru',
    'PW': 'Palau',
    'MH': 'Marshall Islands',
    'FM': 'Micronesia',
    'MA': 'Morocco',
    'DZ': 'Algeria',
    'TN': 'Tunisia',
    'LY': 'Libya',
    'SD': 'Sudan',
    'SS': 'South Sudan',
    'ET': 'Ethiopia',
    'ER': 'Eritrea',
    'DJ': 'Djibouti',
    'SO': 'Somalia',
    'UG': 'Uganda',
    'RW': 'Rwanda',
    'BI': 'Burundi',
    'TZ': 'Tanzania',
    'MW': 'Malawi',
    'MZ': 'Mozambique',
    'ZM': 'Zambia',
    'ZW': 'Zimbabwe',
    'BW': 'Botswana',
    'NA': 'Namibia',
    'SZ': 'Eswatini',
    'LS': 'Lesotho',
    'MG': 'Madagascar',
    'MU': 'Mauritius',
    'SC': 'Seychelles',
    'KM': 'Comoros',
    'AO': 'Angola',
    'CD': 'Democratic Republic of the Congo',
    'CG': 'Republic of the Congo',
    'GA': 'Gabon',
    'GQ': 'Equatorial Guinea',
    'CM': 'Cameroon',
    'CF': 'Central African Republic',
    'TD': 'Chad',
    'NE': 'Niger',
    'ML': 'Mali',
    'BF': 'Burkina Faso',
    'MR': 'Mauritania',
    'SN': 'Senegal',
    'GM': 'Gambia',
    'GW': 'Guinea-Bissau',
    'GN': 'Guinea',
    'SL': 'Sierra Leone',
    'LR': 'Liberia',
    'CI': 'Ivory Coast',
    'GH': 'Ghana',
    'TG': 'Togo',
    'BJ': 'Benin',
    'CV': 'Cape Verde',
    'ST': 'São Tomé and Príncipe',
    'PR': 'Puerto Rico',
    'DO': 'Dominican Republic',
    'HT': 'Haiti',
    'JM': 'Jamaica',
    'CU': 'Cuba',
    'BS': 'Bahamas',
    'BZ': 'Belize',
    'GT': 'Guatemala',
    'SV': 'El Salvador',
    'HN': 'Honduras',
    'NI': 'Nicaragua',
    'CR': 'Costa Rica',
    'PA': 'Panama',
    'VE': 'Venezuela',
    'GY': 'Guyana',
    'SR': 'Suriname',
    'GF': 'French Guiana',
    'PE': 'Peru',
    'EC': 'Ecuador',
    'BO': 'Bolivia',
    'PY': 'Paraguay',
    'UY': 'Uruguay',
    'FK': 'Falkland Islands',
    'GS': 'South Georgia and the South Sandwich Islands',
    'AQ': 'Antarctica'
  };
  
  return countryNames[code] || code;
}

// Export cache stats for monitoring
export function getGeoCacheStats() {
  return {
    keys: geoCache.keys().length,
    stats: geoCache.getStats(),
    retryQueueLength: retryQueue.length
  };
}

// Clear cache if needed
export function clearGeoCache() {
  geoCache.flushAll();
}

// Process retry queue
export async function processRetryQueue() {
  if (retryQueue.length === 0) return;
  
  const batch = retryQueue.splice(0, 40);
  console.log(`Processing ${batch.length} IPs from retry queue`);
  
  for (const ip of batch) {
    await getGeoLocation(ip);
  }
}

// Start retry processing every 2 minutes
setInterval(() => {
  processRetryQueue();
}, 120000);