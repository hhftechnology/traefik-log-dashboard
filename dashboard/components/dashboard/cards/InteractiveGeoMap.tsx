'use client';

import { useState, useMemo } from 'react';
import { MapPin, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { GeoLocation } from '@/lib/types';
import { formatNumber } from '@/lib/utils';
import {
  Map,
  MapTileLayer,
  MapMarker,
  MapPopup,
  MapZoomControl,
  MapMarkerClusterGroup,
} from '@/components/ui/map';
import type { LatLngExpression } from 'leaflet';

interface Props {
  locations: GeoLocation[];
}

// Country coordinates for marker placement when lat/lng not available
const COUNTRY_COORDS: Record<string, [number, number]> = {
  'US': [37.0902, -95.7129],
  'GB': [55.3781, -3.4360],
  'DE': [51.1657, 10.4515],
  'FR': [46.2276, 2.2137],
  'ES': [40.4637, -3.7492],
  'IT': [41.8719, 12.5674],
  'NL': [52.1326, 5.2913],
  'PL': [51.9194, 19.1451],
  'CN': [35.8617, 104.1954],
  'AU': [-25.2744, 133.7751],
  'SG': [1.3521, 103.8198],
  'JP': [36.2048, 138.2529],
  'IN': [20.5937, 78.9629],
  'KR': [35.9078, 127.7669],
  'BR': [-14.2350, -51.9253],
  'ZA': [-30.5595, 22.9375],
  'EG': [26.8206, 30.8025],
  'HK': [22.3193, 114.1694],
  'CA': [56.1304, -106.3468],
  'MX': [23.6345, -102.5528],
  'TR': [38.9637, 35.2433],
  'RU': [61.5240, 105.3188],
  'SE': [60.1282, 18.6435],
  'NO': [60.4720, 8.4689],
  'FI': [61.9241, 25.7482],
  'CH': [46.8182, 8.2275],
  'AT': [47.5162, 14.5501],
  'BE': [50.5039, 4.4699],
  'PT': [39.3999, -8.2245],
  'IE': [53.4129, -8.2439],
  'TW': [23.6978, 120.9605],
  'TH': [15.8700, 100.9925],
  'VN': [14.0583, 108.2772],
  'ID': [-0.7893, 113.9213],
  'MY': [4.2105, 101.9758],
  'PH': [12.8797, 121.7740],
  'NZ': [-40.9006, 174.8860],
};

export default function InteractiveGeoMap({ locations }: Props) {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const validLocations = useMemo(() =>
    locations.filter(
      (loc) => loc.country !== 'Unknown' && loc.country !== 'Private' && loc.country !== 'Private Network'
    ),
    [locations]
  );

  const totalRequests = useMemo(() =>
    validLocations.reduce((sum, loc) => sum + loc.count, 0),
    [validLocations]
  );

  const maxCount = useMemo(() =>
    Math.max(...validLocations.map(loc => loc.count), 1),
    [validLocations]
  );

  const topLocations = useMemo(() =>
    validLocations.slice(0, 15),
    [validLocations]
  );

  const selectedLocation = useMemo(() =>
    selectedCountry ? validLocations.find(loc => loc.country === selectedCountry) : null,
    [selectedCountry, validLocations]
  );

  const getCountryCode = (country: string): string => {
    if (country && country.length === 2) {
      return country.toUpperCase();
    }
    const codes: Record<string, string> = {
      'United States': 'US',
      'United Kingdom': 'GB',
      'Germany': 'DE',
      'France': 'FR',
      'Japan': 'JP',
      'China': 'CN',
      'India': 'IN',
      'Brazil': 'BR',
      'Canada': 'CA',
      'Australia': 'AU',
      'Russia': 'RU',
      'South Korea': 'KR',
      'Spain': 'ES',
      'Italy': 'IT',
      'Netherlands': 'NL',
      'Taiwan': 'TW',
      'Singapore': 'SG',
      'Hong Kong': 'HK',
    };
    return codes[country] || country.substring(0, 2).toUpperCase();
  };

  const getHeatColor = (count: number): string => {
    const intensity = (count / maxCount) * 100;
    if (intensity > 75) return 'bg-red-600 border-red-700';
    if (intensity > 50) return 'bg-red-500 border-red-600';
    if (intensity > 25) return 'bg-red-400 border-red-500';
    return 'bg-red-300 border-red-400';
  };

  const getTextColor = (count: number): string => {
    const intensity = (count / maxCount) * 100;
    if (intensity > 75) return 'text-red-600';
    if (intensity > 50) return 'text-red-500';
    if (intensity > 25) return 'text-red-400';
    return 'text-red-300';
  };

  // Markers for locations with coordinates
  const markers = useMemo(() => {
    return validLocations
      .map(loc => {
        const code = getCountryCode(loc.country);
        const coords = loc.latitude && loc.longitude
          ? [loc.latitude, loc.longitude] as [number, number]
          : COUNTRY_COORDS[code];

        if (!coords) return null;

        return {
          id: loc.country,
          position: coords as LatLngExpression,
          count: loc.count,
          city: loc.city,
          country: loc.country,
          percentage: totalRequests > 0 ? ((loc.count / totalRequests) * 100).toFixed(1) : '0',
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }, [validLocations, totalRequests]);

  // Calculate map center based on markers
  const mapCenter = useMemo((): LatLngExpression => {
    if (markers.length === 0) return [20, 0];
    const avgLat = markers.reduce((sum, m) => sum + (m.position as [number, number])[0], 0) / markers.length;
    const avgLng = markers.reduce((sum, m) => sum + (m.position as [number, number])[1], 0) / markers.length;
    return [avgLat, avgLng];
  }, [markers]);

  if (!locations || locations.length === 0) {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide">Geographic Distribution</CardTitle>
          <div className="text-primary"><Globe className="w-5 h-5" /></div>
        </CardHeader>
        <CardContent>
          <div className="w-full h-[350px] border rounded-lg overflow-hidden bg-slate-50 dark:bg-neutral-900 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <Globe className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No geographic data available yet</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide">Geographic Distribution</CardTitle>
        <div className="text-primary"><Globe className="w-5 h-5 text-red-600" /></div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Map Visualization */}
          <div className="w-full h-[400px] border rounded-lg overflow-hidden relative">
            <Map center={mapCenter} zoom={2} className="h-full w-full">
              <MapTileLayer />
              <MapZoomControl />
              <MapMarkerClusterGroup
                icon={(count) => (
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500 text-white font-bold text-sm border-2 border-white shadow-lg">
                    {count}
                  </div>
                )}
              >
                {markers.map((marker) => (
                  <MapMarker
                    key={marker.id}
                    position={marker.position}
                    icon={
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full border-2 border-white shadow-lg cursor-pointer transition-transform hover:scale-110 ${
                          selectedCountry === marker.id ? 'bg-red-700 scale-110' : 'bg-red-500'
                        }`}
                        onClick={() => setSelectedCountry(selectedCountry === marker.id ? null : marker.id)}
                      >
                        <MapPin className="w-4 h-4 text-white" />
                      </div>
                    }
                    iconAnchor={[16, 16]}
                    popupAnchor={[0, -16]}
                  >
                    <MapPopup>
                      <div className="min-w-[180px]">
                        <div className="font-bold text-base mb-1">{marker.country}</div>
                        {marker.city && (
                          <div className="text-sm text-muted-foreground mb-2">{marker.city}</div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Requests:</span>
                          <span className="font-semibold">{formatNumber(marker.count)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Share:</span>
                          <span className="font-semibold text-red-600">{marker.percentage}%</span>
                        </div>
                      </div>
                    </MapPopup>
                  </MapMarker>
                ))}
              </MapMarkerClusterGroup>
            </Map>
          </div>

          {/* Stats Summary */}
          <div className="bg-gradient-to-br from-red-50 to-white dark:from-red-950/20 dark:to-neutral-900 rounded-lg p-6 border border-red-200 dark:border-red-900/50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Locations</div>
                <div className="text-3xl font-bold text-red-600">{validLocations.length}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Requests</div>
                <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatNumber(totalRequests)}</div>
              </div>
            </div>

            {/* Country Grid */}
            <div className="grid grid-cols-5 gap-2">
              {topLocations.map((location, idx) => {
                const percentage = (location.count / totalRequests) * 100;
                const isSelected = selectedCountry === location.country;

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedCountry(isSelected ? null : location.country)}
                    className={`
                      relative group p-3 rounded-lg border-2 transition-all transform hover:scale-105
                      ${isSelected
                        ? 'bg-red-600 border-red-700 shadow-lg scale-105'
                        : `${getHeatColor(location.count)} hover:shadow-md`
                      }
                    `}
                    title={`${location.country}: ${formatNumber(location.count)} requests (${percentage.toFixed(1)}%)`}
                  >
                    <div className={`text-xs font-bold mb-1 ${isSelected ? 'text-white' : 'text-gray-700 dark:text-gray-200'}`}>
                      {getCountryCode(location.country)}
                    </div>
                    <div className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
                      {(percentage).toFixed(0)}%
                    </div>
                    <div className={`text-xs ${isSelected ? 'text-white opacity-90' : 'text-gray-600 dark:text-gray-400'}`}>
                      {formatNumber(location.count)}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Heat legend */}
            <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Heat: </span>
              <div className="flex-1 mx-3 h-2 rounded-full bg-gradient-to-r from-red-300 via-red-500 to-red-600"></div>
              <span>Low → High</span>
            </div>
          </div>

          {/* Selected Location Details */}
          {selectedLocation && (
            <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border-2 border-red-600 shadow-md">
              <div className="flex items-center gap-3 mb-3">
                <MapPin className="w-5 h-5 text-red-600" />
                <div>
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{selectedLocation.country}</div>
                  {selectedLocation.city && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">{selectedLocation.city}</div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Requests</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatNumber(selectedLocation.count)}</div>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Percentage</div>
                  <div className="text-2xl font-bold text-red-600">
                    {((selectedLocation.count / totalRequests) * 100).toFixed(2)}%
                  </div>
                </div>
              </div>
              {selectedLocation.latitude && selectedLocation.longitude && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                  Coordinates: {selectedLocation.latitude.toFixed(4)}°, {selectedLocation.longitude.toFixed(4)}°
                </div>
              )}
            </div>
          )}

          {/* Location List */}
          <div className="space-y-2">
            {topLocations.map((location, idx) => {
              const percentage = (location.count / totalRequests) * 100;
              const isSelected = selectedCountry === location.country;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedCountry(isSelected ? null : location.country)}
                  className={`
                    w-full text-left p-3 rounded-lg border transition-all
                    ${isSelected
                      ? 'bg-red-100 dark:bg-red-950/30 border-red-600 shadow-md'
                      : 'bg-white dark:bg-neutral-900 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/20 hover:border-red-300'
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded ${
                        isSelected ? 'bg-red-600 text-white' : 'bg-red-50 dark:bg-red-900/30 text-red-600'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className={`font-semibold ${isSelected ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
                        {location.country}
                      </span>
                      {location.city && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">• {location.city}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-600 dark:text-gray-400">{formatNumber(location.count)}</span>
                      <span className={`font-bold ${getTextColor(location.count)}`}>
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isSelected ? 'bg-red-600' : 'bg-red-500'
                      }`}
                      style={{ width: `${(location.count / maxCount) * 100}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
