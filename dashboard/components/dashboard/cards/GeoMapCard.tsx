'use client';

import { MapPin } from 'lucide-react';
import Card from '@/components/ui/DashboardCard';
import { GeoLocation } from '@/lib/types';

interface GeoMapCardProps {
  locations: GeoLocation[];
}

export default function GeoMapCard({ locations }: GeoMapCardProps) {
  if (locations.length === 0) {
    return (
      <Card title="Geographic Distribution" icon={<MapPin className="w-5 h-5" />}>
        <div className="text-center py-8 text-muted-foreground">No geographic data available</div>
      </Card>
    );
  }

  const maxCount = Math.max(...locations.map(l => l.count));
  const topLocations = locations.slice(0, 10);

  return (
    <Card title="Geographic Distribution" icon={<MapPin className="w-5 h-5" />}>
      <div className="space-y-3">
        {topLocations.map((location, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-lg">{getCountryFlag(location.country)}</span>
                <span className="font-medium text-foreground">{location.country}</span>
                {location.city && (
                  <span className="text-muted-foreground">• {location.city}</span>
                )}
              </div>
              <span className="text-muted-foreground">{location.count}</span>
            </div>
            <div className="h-1.5 bg-accent rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground transition-all duration-300"
                style={{ width: `${(location.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌍';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}