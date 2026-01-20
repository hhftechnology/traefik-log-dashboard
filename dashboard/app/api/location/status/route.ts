import { NextResponse } from 'next/server';
import maxmind, { CityResponse, Reader } from 'maxmind';
import * as geolite2 from 'geolite2-redist';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Check GeoIP database status
 */
export async function GET() {
  try {
    let available = false;
    let dbLocation = 'geolite2-redist (lazy loading)';

    try {
      // Try to open the database using geolite2-redist
      const reader = await geolite2.open<Reader<CityResponse>>('GeoLite2-City' as geolite2.GeoIpDbName, (path) => {
        dbLocation = path;
        return maxmind.open<CityResponse>(path);
      });

      if (reader) {
        available = true;
      }
    } catch (err) {
      console.error('[GeoIP] Database check failed:', err);
      available = false;
    }

    const data = {
      enabled: true,
      available: available,
      database: dbLocation,
      message: available
        ? 'GeoIP database available (geolite2-redist)'
        : 'GeoIP database will be downloaded on first use',
    };

    const res = NextResponse.json(data);
    res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.headers.set('Pragma', 'no-cache');
    res.headers.set('Expires', '0');

    return res;
  } catch (error) {
    console.error('Location status API error:', error);
    return NextResponse.json(
      {
        enabled: true,
        available: false,
        error: 'Failed to check location status',
        details: String(error)
      },
      { status: 500 }
    );
  }
}
