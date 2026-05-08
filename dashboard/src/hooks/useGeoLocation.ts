import { useState, useEffect, useMemo } from 'react'; // eslint-disable-line no-restricted-syntax
import { TraefikLog, GeoLocation } from '@/utils/types';
import { aggregateGeoLocations } from '@/utils/location';
import { sortLogsByTime } from '@/utils/utils/log-utils';
import { extractIP, isPrivateIP } from '@/utils/utils/ip-utils';
import { apiClient } from '@/utils/api-client';
import { useConfig } from '@/utils/contexts/ConfigContext';

export type GeoDiagnosticReason =
  | 'no_logs'
  | 'all_filtered_by_internal_rules'
  | 'all_private_or_unknown'
  | 'provider_unavailable';

export interface GeoDiagnostic {
  reason: GeoDiagnosticReason;
  message: string;
  providerHint?: string;
}

interface UseGeoLocationOptions {
  totalLogs: number;
  filteredCount: number;
  hideInternalTraffic: boolean;
}

interface GeoStatusSummary {
  enabled: boolean;
  available: boolean;
  providerAvailable: boolean;
  localDBLoaded: boolean;
  localDBError?: string | null;
  providerError?: string | null;
}

interface GeoDiagnosticInput {
  totalLogs: number;
  visibleLogs: number;
  filteredCount: number;
  hideInternalTraffic: boolean;
  uniquePublicIPs: number;
  resolvedLocations: number;
  status: GeoStatusSummary | null;
}

function statusSummaryFromAPI(status: Awaited<ReturnType<typeof apiClient.getLocationStatus>>): GeoStatusSummary {
  return {
    enabled: status.enabled,
    available: status.available,
    providerAvailable: status.provider_available ?? true,
    localDBLoaded: status.local_db_loaded ?? false,
    localDBError: status.local_db_error,
    providerError: status.providers?.find((provider) => provider.last_error)?.last_error ?? null,
  };
}

function createProviderHint(status: GeoStatusSummary | null): string | undefined {
  if (!status) {
    return undefined;
  }

  if (!status.enabled) {
    return 'Geo lookup is disabled by configuration.';
  }

  if (status.localDBError) {
    return `Local GeoIP DB error: ${status.localDBError}`;
  }

  if (status.providerError) {
    return `Geo provider error: ${status.providerError}`;
  }

  if (!status.providerAvailable && !status.localDBLoaded) {
    return 'Geo providers are currently unavailable and no local DB is loaded.';
  }

  return undefined;
}

export function deriveGeoDiagnostic(input: GeoDiagnosticInput): GeoDiagnostic | null {
  if (input.totalLogs === 0) {
    return {
      reason: 'no_logs',
      message: 'No logs available yet. Generate traffic to populate geographic data.',
    };
  }

  if (
    input.visibleLogs === 0 &&
    input.filteredCount > 0 &&
    input.hideInternalTraffic
  ) {
    return {
      reason: 'all_filtered_by_internal_rules',
      message: 'All visible logs are currently filtered as internal traffic.',
    };
  }

  if (input.uniquePublicIPs === 0 || input.resolvedLocations === 0) {
    const providerUnavailable = Boolean(
      input.status &&
      input.status.enabled &&
      !input.status.available &&
      !input.status.localDBLoaded &&
      !input.status.providerAvailable,
    );

    if (providerUnavailable) {
      return {
        reason: 'provider_unavailable',
        message: 'Geo lookup providers are currently unavailable.',
        providerHint: createProviderHint(input.status),
      };
    }

    return {
      reason: 'all_private_or_unknown',
      message: 'Only private/unknown IPs are currently geolocated from this view.',
      providerHint: createProviderHint(input.status),
    };
  }

  return null;
}

export function useGeoLocation(logs: TraefikLog[], options: UseGeoLocationOptions) {
  const [geoLocations, setGeoLocations] = useState<GeoLocation[]>([]);
  const [isLoadingGeo, setIsLoadingGeo] = useState(false);
  const [diagnostic, setDiagnostic] = useState<GeoDiagnostic | null>(null);
  const [debouncedLogs, setDebouncedLogs] = useState(logs);
  const { config } = useConfig();

  // Debounce logs
  // eslint-disable-next-line no-restricted-syntax -- debounce requires dependency tracking
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLogs(logs);
    }, 2000);

    return () => clearTimeout(timer);
  }, [logs]);

  // PERFORMANCE FIX: Memoize sorted logs to prevent re-sorting on every render
  // REDUNDANCY FIX: Use shared utility function
  const sortedLogs = useMemo(() => {
    return sortLogsByTime(debouncedLogs, config.maxLogsDisplay);
  }, [debouncedLogs, config.maxLogsDisplay]);

  // Fetch GeoIP data
  // eslint-disable-next-line no-restricted-syntax -- data fetch with dependency tracking
  useEffect(() => {
    let isMounted = true;

    async function fetchGeoData() {
      const uniquePublicIPs = new Set<string>();
      for (const log of sortedLogs) {
        const clientAddr = log.ClientHost || log.ClientAddr || '';
        const ip = extractIP(clientAddr);
        if (ip && !isPrivateIP(ip)) {
          uniquePublicIPs.add(ip);
        }
      }

      if (sortedLogs.length === 0) {
        setGeoLocations([]);
        setDiagnostic(
          deriveGeoDiagnostic({
            totalLogs: options.totalLogs,
            visibleLogs: 0,
            filteredCount: options.filteredCount,
            hideInternalTraffic: options.hideInternalTraffic,
            uniquePublicIPs: 0,
            resolvedLocations: 0,
            status: null,
          }),
        );
        return;
      }

      setIsLoadingGeo(true);

      try {
        if (import.meta.env.DEV) {
          console.warn('Starting GeoIP lookup for', sortedLogs.length, 'logs');
        }

        const locations = await aggregateGeoLocations(sortedLogs);
        const resolvedLocations = locations.filter(
          (location) => location.country !== 'Unknown' && location.country !== 'Private',
        ).length;

        let statusSummary: GeoStatusSummary | null = null;
        if (resolvedLocations === 0) {
          try {
            const status = await apiClient.getLocationStatus();
            statusSummary = statusSummaryFromAPI(status);
          } catch (statusError) {
            if (import.meta.env.DEV) {
              console.warn('Failed to fetch GeoIP status for diagnostics:', statusError);
            }
          }
        }

        if (isMounted) {
          setGeoLocations(locations);
          setIsLoadingGeo(false);
          setDiagnostic(
            deriveGeoDiagnostic({
              totalLogs: options.totalLogs,
              visibleLogs: sortedLogs.length,
              filteredCount: options.filteredCount,
              hideInternalTraffic: options.hideInternalTraffic,
              uniquePublicIPs: uniquePublicIPs.size,
              resolvedLocations,
              status: statusSummary,
            }),
          );
          if (import.meta.env.DEV) {
            console.warn('GeoIP lookup complete:', locations.length, 'countries found');
          }
        }
      } catch (error) {
        console.error('Failed to fetch GeoIP data:', error);
        if (isMounted) {
          setGeoLocations([]);
          setIsLoadingGeo(false);
          setDiagnostic(
            deriveGeoDiagnostic({
              totalLogs: options.totalLogs,
              visibleLogs: sortedLogs.length,
              filteredCount: options.filteredCount,
              hideInternalTraffic: options.hideInternalTraffic,
              uniquePublicIPs: uniquePublicIPs.size,
              resolvedLocations: 0,
              status: null,
            }),
          );
        }
      }
    }

    fetchGeoData();

    return () => {
      isMounted = false;
    };
  }, [options.filteredCount, options.hideInternalTraffic, options.totalLogs, sortedLogs]); // PERFORMANCE FIX: Use memoized sortedLogs instead of debouncedLogs

  return { geoLocations, isLoadingGeo, diagnostic };
}
