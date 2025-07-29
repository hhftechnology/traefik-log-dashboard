import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe } from "lucide-react";
import { Stats } from "@/hooks/useWebSocket";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { Tooltip as ReactTooltip } from "react-tooltip";

interface GeoMapProps {
  stats: Stats | null;
}

const geoUrl = "https://raw.githubusercontent.com/deldersveld/topojson/master/world-countries.json";

export function GeoMap({ stats }: GeoMapProps) {
  if (!stats || !stats.topCountries) {
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
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No geographic data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const countryData = stats.topCountries.reduce((acc: Record<string, number>, { country, count }) => {
    acc[country] = count;
    return acc;
  }, {});

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
        </div>
        <ReactTooltip id="country-tooltip" />
      </CardContent>
    </Card>
  );
}
