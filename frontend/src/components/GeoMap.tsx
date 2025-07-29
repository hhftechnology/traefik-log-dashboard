import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe } from "lucide-react";
import { Stats } from "@/hooks/useWebSocket";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { Tooltip as ReactTooltip } from "react-tooltip";

interface GeoMapProps {
  stats: Stats | null;
}

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export function GeoMap({ stats }: GeoMapProps) {
  const hasCountryData = stats && stats.topCountries && stats.topCountries.length > 0;

  const countryData = hasCountryData ? stats.topCountries.reduce((acc: Record<string, number>, { country, count }) => {
    acc[country] = count;
    return acc;
  }, {}) : {};

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Geographic Distribution
        </CardTitle>
        <CardDescription>Requests by country</CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ width: "100%", height: "400px" }}>
          {!stats ? (
             <div className="h-full flex items-center justify-center text-muted-foreground">Loading map data...</div>
          ) : !hasCountryData ? (
             <div className="h-full flex items-center justify-center text-muted-foreground">Processing geolocation data... This may take a few minutes.</div>
          ) : (
            <>
              <ComposableMap data-tip="">
                <ZoomableGroup>
                  <Geographies geography={geoUrl}>
                    {({ geographies }: { geographies: any[] }) =>
                      geographies.map((geo: any) => {
                        const count = countryData[geo.properties.name] || 0;
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            data-tooltip-id="country-tooltip"
                            data-tooltip-content={`${geo.properties.name}: ${count} requests`}
                            style={{
                              default: {
                                fill: count > 0 ? "#3b82f6" : "#D6D6DA",
                                outline: "none"
                              },
                              hover: {
                                fill: "#60a5fa",
                                outline: "none"
                              },
                              pressed: {
                                fill: "#2563eb",
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
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
