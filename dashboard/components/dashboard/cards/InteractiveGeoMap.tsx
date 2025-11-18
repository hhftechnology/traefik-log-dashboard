'use client';

import { useState } from 'react';
import { MapPin, Globe } from 'lucide-react';
import Card from '@/components/ui/DashboardCard';
import { GeoLocation } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

interface Props {
  locations: GeoLocation[];
}

export default function InteractiveGeoMap({ locations }: Props) {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  if (!locations || locations.length === 0) {
    return (
      <Card title="Interactive Geographic Map" icon={<Globe className="w-5 h-5 text-primary" />}>
        <div className="text-center py-8 text-muted-foreground">No geographic data available</div>
      </Card>
    );
  }

  const validLocations = locations.filter(
    loc => loc.country !== 'Unknown' && loc.country !== 'Private' && loc.country !== 'Private Network'
  );
  
  const totalRequests = validLocations.reduce((sum, loc) => sum + loc.count, 0);
  const maxCount = Math.max(...validLocations.map(loc => loc.count));

  const topLocations = validLocations.slice(0, 15);
  const selectedLocation = selectedCountry 
    ? validLocations.find(loc => loc.country === selectedCountry)
    : null;

  // ✅ Fixed: If country is already a 2-letter code, return it; otherwise try to map it
  const getCountryCode = (country: string): string => {
    // If already a 2-letter ISO code, return as-is
    if (country && country.length === 2) {
      return country.toUpperCase();
    }
    
    // Fallback mapping for full names (kept for backwards compatibility)
    const codes: { [key: string]: string } = {
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
    if (intensity > 75) return 'bg-primary border-primary';
    if (intensity > 50) return 'bg-primary/80 border-primary';
    if (intensity > 25) return 'bg-primary/60 border-primary/80';
    return 'bg-primary/40 border-primary/60';
  };

  const getTextColor = (count: number): string => {
    const intensity = (count / maxCount) * 100;
    if (intensity > 75) return 'text-primary';
    if (intensity > 50) return 'text-primary/90';
    if (intensity > 25) return 'text-primary/70';
    return 'text-primary/50';
  };

  return (
    <Card title="Interactive Geographic Map" icon={<Globe className="w-5 h-5 text-primary" />}>
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-accent to-background rounded-lg p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-muted-foreground">Total Locations</div>
              <div className="text-3xl font-bold text-primary">{validLocations.length}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Total Requests</div>
              <div className="text-3xl font-bold text-foreground">{formatNumber(totalRequests)}</div>
            </div>
          </div>

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
                      ? 'bg-primary border-primary shadow-lg scale-105'
                      : `${getHeatColor(location.count)} hover:shadow-md`
                    }
                  `}
                  title={`${location.country}: ${formatNumber(location.count)} requests (${percentage.toFixed(1)}%)`}
                >
                  <div className={`text-xs font-bold mb-1 ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}>
                    {getCountryCode(location.country)}
                  </div>
                  <div className={`text-lg font-bold ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}>
                    {(percentage).toFixed(0)}%
                  </div>
                  <div className={`text-xs ${isSelected ? 'text-primary-foreground opacity-90' : 'text-muted-foreground'}`}>
                    {formatNumber(location.count)}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>Heat: </span>
            <div className="flex-1 mx-3 h-2 rounded-full bg-gradient-to-r from-primary/40 via-primary/80 to-primary"></div>
            <span>Low → High</span>
          </div>
        </div>

        {selectedLocation && (
          <div className="bg-card rounded-lg p-4 border-2 border-primary shadow-md">
            <div className="flex items-center gap-3 mb-3">
              <MapPin className="w-5 h-5 text-primary" />
              <div>
                <div className="text-lg font-bold text-foreground">{selectedLocation.country}</div>
                {selectedLocation.city && (
                  <div className="text-sm text-muted-foreground">{selectedLocation.city}</div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Requests</div>
                <div className="text-2xl font-bold text-foreground">{formatNumber(selectedLocation.count)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Percentage</div>
                <div className="text-2xl font-bold text-primary">
                  {((selectedLocation.count / totalRequests) * 100).toFixed(2)}%
                </div>
              </div>
            </div>
            {selectedLocation.latitude && selectedLocation.longitude && (
              <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                📍 {selectedLocation.latitude.toFixed(4)}°, {selectedLocation.longitude.toFixed(4)}°
              </div>
            )}
          </div>
        )}

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
                    ? 'bg-primary/10 border-primary shadow-md'
                    : 'bg-card border-border hover:bg-accent hover:border-border'
                  }
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-accent text-primary'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className={`font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                      {location.country}
                    </span>
                    {location.city && (
                      <span className="text-sm text-muted-foreground">• {location.city}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{formatNumber(location.count)}</span>
                    <span className={`font-bold ${getTextColor(location.count)}`}>
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isSelected ? 'bg-primary' : 'bg-primary/80'
                    }`}
                    style={{ width: `${(location.count / maxCount) * 100}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}