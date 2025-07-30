import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe } from "lucide-react";
import { Stats } from "@/hooks/useWebSocket";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { useState } from "react";

interface GeoMapProps {
  stats: Stats | null;
}

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Country code to name mapping for common mismatches
const countryCodeMap: Record<string, string> = {
  'US': 'United States of America',
  'UK': 'United Kingdom',
  'GB': 'United Kingdom',
  'NL': 'Netherlands',
  'DE': 'Germany',
  'FR': 'France',
  'SG': 'Singapore',
  'IN': 'India',
  'CN': 'China',
  'JP': 'Japan',
  'KR': 'South Korea',
  'AU': 'Australia',
  'NZ': 'New Zealand',
  'CA': 'Canada',
  'BR': 'Brazil',
  'MX': 'Mexico',
  'ES': 'Spain',
  'IT': 'Italy',
  'CH': 'Switzerland',
  'SE': 'Sweden',
  'NO': 'Norway',
  'DK': 'Denmark',
  'FI': 'Finland',
  'PL': 'Poland',
  'RU': 'Russia',
  'UA': 'Ukraine',
  'ZA': 'South Africa',
  'EG': 'Egypt',
  'NG': 'Nigeria',
  'KE': 'Kenya',
  'IL': 'Israel',
  'SA': 'Saudi Arabia',
  'AE': 'United Arab Emirates',
  'TR': 'Turkey',
  'AR': 'Argentina',
  'CL': 'Chile',
  'CO': 'Colombia',
  'VE': 'Venezuela',
  'PE': 'Peru',
};

export function GeoMap({ stats }: GeoMapProps) {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const hasCountryData = stats && stats.topCountries && stats.topCountries.length > 0;

  // Create a map of country names/codes to request counts
  const countryData = hasCountryData ? stats.topCountries.reduce((acc: Record<string, { count: number, countryCode: string }>, { country, countryCode, count }) => {
    // Store by country name
    acc[country] = { count, countryCode };
    // Also store by mapped name if available
    if (countryCodeMap[countryCode]) {
      acc[countryCodeMap[countryCode]] = { count, countryCode };
    }
    // Store by code as well for fallback
    acc[countryCode] = { count, countryCode };
    return acc;
  }, {}) : {};

  // Get color intensity based on request count
  const getCountryFillColor = (count: number) => {
    if (!hasCountryData || count === 0) return "#E5E7EB";
    const maxCount = Math.max(...stats!.topCountries.map(c => c.count));
    const intensity = count / maxCount;
    
    // Use a blue gradient
    if (intensity > 0.8) return "#1e40af";
    if (intensity > 0.6) return "#2563eb";
    if (intensity > 0.4) return "#3b82f6";
    if (intensity > 0.2) return "#60a5fa";
    if (intensity > 0.1) return "#93bbfc";
    return "#dbeafe";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Geographic Distribution
        </CardTitle>
        <CardDescription>
          {hasCountryData 
            ? `Requests from ${stats.topCountries.length} countries`
            : "Requests by country"
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ width: "100%", height: "400px" }}>
          {!stats ? (
             <div className="h-full flex items-center justify-center text-muted-foreground">
               Loading map data...
             </div>
          ) : !hasCountryData ? (
             <div className="h-full flex items-center justify-center text-muted-foreground">
               <div className="text-center">
                 <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                 <p>Processing geolocation data...</p>
                 <p className="text-sm mt-2">This may take a few minutes for the initial load.</p>
               </div>
             </div>
          ) : (
            <>
              <ComposableMap 
                data-tip=""
                projection="geoMercator"
                projectionConfig={{
                  scale: 140,
                  center: [0, 20]
                }}
              >
                <ZoomableGroup zoom={1} minZoom={0.5} maxZoom={8}>
                  <Geographies geography={geoUrl}>
                    {({ geographies }: { geographies: any[] }) =>
                      geographies.map((geo: any) => {
                        const geoName = geo.properties.name || geo.properties.NAME;
                        const geoCode = geo.properties.ISO_A2 || geo.properties.ISO_A3;
                        
                        // Try to find country data by name, mapped name, or code
                        const data = countryData[geoName] || 
                                   countryData[geoCode] || 
                                   { count: 0, code: '' };
                        
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            onMouseEnter={() => setHoveredCountry(geo.rsmKey)}
                            onMouseLeave={() => setHoveredCountry(null)}
                            data-tooltip-id="country-tooltip"
                            data-tooltip-content={`${geoName}: ${data.count.toLocaleString()} requests`}
                            style={{
                              default: {
                                fill: getCountryFillColor(data.count),
                                stroke: "#9CA3AF",
                                strokeWidth: 0.5,
                                outline: "none"
                              },
                              hover: {
                                fill: data.count > 0 ? "#1e40af" : "#D1D5DB",
                                stroke: "#6B7280",
                                strokeWidth: 1,
                                outline: "none",
                                cursor: data.count > 0 ? "pointer" : "default"
                              },
                              pressed: {
                                fill: "#1e3a8a",
                                outline: "none"
                              }
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ZoomableGroup>
              </ComposableMap>
              <ReactTooltip id="country-tooltip" />
              
              {/* Legend */}
              <div className="mt-4 flex items-center justify-center gap-4 text-sm">
                <span className="text-muted-foreground">Requests:</span>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-[#dbeafe]" />
                  <span>Low</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-[#3b82f6]" />
                  <span>Medium</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-[#1e40af]" />
                  <span>High</span>
                </div>
              </div>

              {/* Top Countries List */}
              {stats.topCountries.length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  {stats.topCountries.slice(0, 6).map((country, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <span className="flex items-center gap-1">
                        <span className="font-mono text-xs">{country.countryCode ?? ''}</span>
                        <span className="text-muted-foreground">-</span>
                        <span className="truncate">{country.country}</span>
                      </span>
                      <span className="font-semibold">{country.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}