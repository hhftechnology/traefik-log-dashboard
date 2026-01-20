'use client';

import { memo } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/skeleton';
import { GeoLocation } from '@/lib/types';

// Dynamic import to avoid SSR issues with map
const InteractiveGeoMap = dynamic(
  () => import('../cards/InteractiveGeoMap'),
  {
    loading: () => (
      <div className="h-[500px] rounded-lg border bg-card p-6">
        <Skeleton className="h-full w-full" />
      </div>
    ),
    ssr: false,
  }
);

interface GeographySectionProps {
  locations: GeoLocation[];
  isLoading?: boolean;
}

function GeographySection({ locations, isLoading }: GeographySectionProps) {
  return (
    <div className="space-y-6">
      {/* The InteractiveGeoMap component includes its own Card wrapper and all necessary UI */}
      <InteractiveGeoMap locations={locations} />

      {isLoading && (
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Loading additional location data...</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default memo(GeographySection);
