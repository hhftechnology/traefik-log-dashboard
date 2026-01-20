import { NextRequest, NextResponse } from 'next/server';
import maxmind, { CityResponse, Reader } from 'maxmind';
import * as geolite2 from 'geolite2-redist';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

let reader: Reader<CityResponse> | null = null;
let readerPromise: Promise<Reader<CityResponse>> | null = null;

async function getReader(): Promise<Reader<CityResponse>> {
  // Return cached reader
  if (reader) return reader;

  // Return in-progress promise to avoid race conditions
  if (readerPromise) return readerPromise;

  // Create new reader using geolite2-redist API
  readerPromise = geolite2.open<Reader<CityResponse>>('GeoLite2-City' as geolite2.GeoIpDbName, (path) =>
    maxmind.open<CityResponse>(path)
  );

  try {
    reader = await readerPromise;
    console.warn('[GeoIP] Database loaded successfully');
    return reader;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[GeoIP] Failed to load database:', errorMessage);
    // Log additional details for directory permission issues
    if (errorMessage.includes('ENOENT') || errorMessage.includes('mkdir')) {
      console.error('[GeoIP] Directory creation issue detected. Ensure /app/node_modules/geolite2-redist/dbs-tmp exists and is writable.');
    }
    readerPromise = null;
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ips }: { ips: string[] } = body;

    if (!ips || !Array.isArray(ips) || ips.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: ips array is required' },
        { status: 400 }
      );
    }

    // Limit to 1000 IPs per request
    if (ips.length > 1000) {
      return NextResponse.json(
        { error: 'Too many IPs (max 1000)' },
        { status: 400 }
      );
    }

    let lookup: Reader<CityResponse> | null = null;

    try {
      lookup = await getReader();
    } catch {
      return NextResponse.json(
        { error: 'GeoIP database not available' },
        { status: 503 }
      );
    }

    if (!lookup) {
      return NextResponse.json(
        { error: 'GeoIP database not available' },
        { status: 503 }
      );
    }

    const locations = [];

    for (const ip of ips) {
      try {
        const result = lookup.get(ip);

        if (result && result.country) {
          locations.push({
            ipAddress: ip,
            country: result.country.iso_code,
            city: result.city?.names?.en,
            latitude: result.location?.latitude,
            longitude: result.location?.longitude,
          });
        }
      } catch {
        // Ignore invalid IPs
        continue;
      }
    }

    const res = NextResponse.json({ locations });
    res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    return res;
  } catch (error) {
    console.error('Location lookup API error:', error);
    return NextResponse.json(
      { error: 'Failed to lookup locations', details: String(error) },
      { status: 500 }
    );
  }
}
