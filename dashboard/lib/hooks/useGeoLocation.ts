import { useState, useEffect } from 'react';
import { TraefikLog, GeoLocation } from '@/lib/types';
import { aggregateGeoLocations } from '@/lib/location';

export function useGeoLocation(logs: TraefikLog[]) {
  const [geoLocations, setGeoLocations] = useState<GeoLocation[]>([]);
  const [isLoadingGeo, setIsLoadingGeo] = useState(false);
  const [debouncedLogs, setDebouncedLogs] = useState(logs);

  // Debounce logs
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLogs(logs);
    }, 2000);

    return () => clearTimeout(timer);
  }, [logs]);

  // Fetch GeoIP data
  useEffect(() => {
    let isMounted = true;

    async function fetchGeoData() {
      if (debouncedLogs.length === 0) {
        setGeoLocations([]);
        return;
      }

      setIsLoadingGeo(true);
      
      try {
        const sortedLogs = [...debouncedLogs]
          .sort((a, b) => {
            const timeA = new Date(a.StartUTC || a.StartLocal).getTime();
            const timeB = new Date(b.StartUTC || b.StartLocal).getTime();
            return timeB - timeA;
          })
          .slice(0, 1000);

        console.log('Starting GeoIP lookup for', sortedLogs.length, 'logs');
        
        const locations = await aggregateGeoLocations(sortedLogs);
        
        if (isMounted) {
          setGeoLocations(locations);
          setIsLoadingGeo(false);
          console.log('GeoIP lookup complete:', locations.length, 'countries found');
        }
      } catch (error) {
        console.error('Failed to fetch GeoIP data:', error);
        if (isMounted) {
          setGeoLocations([]);
          setIsLoadingGeo(false);
        }
      }
    }

    fetchGeoData();

    return () => {
      isMounted = false;
    };
  }, [debouncedLogs]);

  return { geoLocations, isLoadingGeo };
}
