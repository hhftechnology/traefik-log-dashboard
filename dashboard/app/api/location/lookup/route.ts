import { NextRequest, NextResponse } from 'next/server';
import maxmind, { Reader } from 'maxmind';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

let reader: Reader<any> | null = null;

async function getReader() {
  if (reader) return reader;
  
  try {
    // Try to locate the database file
    // In development/production it should be in node_modules
    const dbPath = path.join(process.cwd(), 'node_modules', 'geolite2-redist', 'dist', 'GeoLite2-City.mmdb');
    reader = await maxmind.open(dbPath);
    return reader;
  } catch (error) {
    console.error('Failed to open GeoIP database:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ips } = body;

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

    const lookup = await getReader();
    
    if (!lookup) {
      return NextResponse.json(
        { error: 'GeoIP database not available' },
        { status: 503 }
      );
    }

    const locations = [];

    for (const ip of ips) {
      try {
        // Skip private IPs check here as the library handles standard IPs
        // But we can add a quick check if needed, though the reader just returns null for private/unknown
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
      } catch (e) {
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