import axios from 'axios';
import NodeCache from 'node-cache';

// Cache geolocation data for 24 hours
const geoCache = new NodeCache({ stdTTL: 86400 });

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

  try {
    // Using ip-api.com free service (limited to 45 requests per minute)
    const response = await axios.get(`http://ip-api.com/json/${ip}`, {
      timeout: 2000
    });

    if (response.data.status === 'success') {
      const geoData = {
        country: response.data.country,
        city: response.data.city,
        countryCode: response.data.countryCode,
        lat: response.data.lat,
        lon: response.data.lon
      };

      // Cache the result
      geoCache.set(ip, geoData);
      return geoData;
    }

    return null;
  } catch (error) {
    console.error(`Error getting geolocation for IP ${ip}:`, error.message);
    return null;
  }
}

function isPrivateIP(ip) {
  const parts = ip.split('.');
  return (
    ip === '127.0.0.1' ||
    ip === 'localhost' ||
    (parts[0] === '10') ||
    (parts[0] === '172' && parseInt(parts[1]) >= 16 && parseInt(parts[1]) <= 31) ||
    (parts[0] === '192' && parts[1] === '168')
  );
}