import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Globe, RefreshCw } from "lucide-react";
import { Stats } from "@/hooks/useWebSocket";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { Tooltip as ReactTooltip } from "react-tooltip";
import { useMemo, useEffect, useState } from "react";

interface GeoMapProps {
  stats: Stats | null;
  geoDataVersion?: number; // Track geo data updates
}

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Country code to name mapping for common mismatches
const countryCodeMap: Record<string, string> = {
  'AD': 'Andorra',
  'AE': 'United Arab Emirates',
  'AF': 'Afghanistan',
  'AG': 'Antigua and Barbuda',
  'AL': 'Albania',
  'AM': 'Armenia',
  'AO': 'Angola',
  'AR': 'Argentina',
  'AT': 'Austria',
  'AU': 'Australia',
  'AZ': 'Azerbaijan',
  'BA': 'Bosnia and Herzegovina',
  'BB': 'Barbados',
  'BD': 'Bangladesh',
  'BE': 'Belgium',
  'BF': 'Burkina Faso',
  'BG': 'Bulgaria',
  'BH': 'Bahrain',
  'BI': 'Burundi',
  'BJ': 'Benin',
  'BN': 'Brunei',
  'BO': 'Bolivia',
  'BR': 'Brazil',
  'BS': 'Bahamas',
  'BT': 'Bhutan',
  'BW': 'Botswana',
  'BY': 'Belarus',
  'BZ': 'Belize',
  'CA': 'Canada',
  'CD': 'Congo, Democratic Republic of the',
  'CF': 'Central African Republic',
  'CG': 'Congo',
  'CH': 'Switzerland',
  'CI': 'Côte d Ivoire',
  'CL': 'Chile',
  'CM': 'Cameroon',
  'CN': 'China',
  'CO': 'Colombia',
  'CR': 'Costa Rica',
  'CU': 'Cuba',
  'CV': 'Cabo Verde',
  'CY': 'Cyprus',
  'CZ': 'Czechia',
  'DE': 'Germany',
  'DJ': 'Djibouti',
  'DK': 'Denmark',
  'DM': 'Dominica',
  'DO': 'Dominican Republic',
  'DZ': 'Algeria',
  'EC': 'Ecuador',
  'EE': 'Estonia',
  'EG': 'Egypt',
  'ER': 'Eritrea',
  'ES': 'Spain',
  'ET': 'Ethiopia',
  'FI': 'Finland',
  'FJ': 'Fiji',
  'FM': 'Micronesia',
  'FR': 'France',
  'GA': 'Gabon',
  'GB': 'United Kingdom',
  'GD': 'Grenada',
  'GE': 'Georgia',
  'GH': 'Ghana',
  'GM': 'Gambia',
  'GN': 'Guinea',
  'GQ': 'Equatorial Guinea',
  'GR': 'Greece',
  'GT': 'Guatemala',
  'GW': 'Guinea-Bissau',
  'GY': 'Guyana',
  'HN': 'Honduras',
  'HR': 'Croatia',
  'HT': 'Haiti',
  'HU': 'Hungary',
  'ID': 'Indonesia',
  'IE': 'Ireland',
  'IL': 'Israel',
  'IN': 'India',
  'IQ': 'Iraq',
  'IR': 'Iran',
  'IS': 'Iceland',
  'IT': 'Italy',
  'JM': 'Jamaica',
  'JO': 'Jordan',
  'JP': 'Japan',
  'KE': 'Kenya',
  'KG': 'Kyrgyzstan',
  'KH': 'Cambodia',
  'KI': 'Kiribati',
  'KM': 'Comoros',
  'KN': 'Saint Kitts and Nevis',
  'KP': 'North Korea',
  'KR': 'South Korea',
  'KW': 'Kuwait',
  'KZ': 'Kazakhstan',
  'LA': 'Laos',
  'LB': 'Lebanon',
  'LC': 'Saint Lucia',
  'LI': 'Liechtenstein',
  'LK': 'Sri Lanka',
  'LR': 'Liberia',
  'LS': 'Lesotho',
  'LT': 'Lithuania',
  'LU': 'Luxembourg',
  'LV': 'Latvia',
  'LY': 'Libya',
  'MA': 'Morocco',
  'MC': 'Monaco',
  'MD': 'Moldova',
  'ME': 'Montenegro',
  'MG': 'Madagascar',
  'MH': 'Marshall Islands',
  'MK': 'North Macedonia',
  'ML': 'Mali',
  'MM': 'Myanmar',
  'MN': 'Mongolia',
  'MR': 'Mauritania',
  'MT': 'Malta',
  'MU': 'Mauritius',
  'MV': 'Maldives',
  'MW': 'Malawi',
  'MX': 'Mexico',
  'MY': 'Malaysia',
  'MZ': 'Mozambique',
  'NA': 'Namibia',
  'NE': 'Niger',
  'NG': 'Nigeria',
  'NI': 'Nicaragua',
  'NL': 'Netherlands',
  'NO': 'Norway',
  'NP': 'Nepal',
  'NR': 'Nauru',
  'NZ': 'New Zealand',
  'OM': 'Oman',
  'PA': 'Panama',
  'PE': 'Peru',
  'PG': 'Papua New Guinea',
  'PH': 'Philippines',
  'PK': 'Pakistan',
  'PL': 'Poland',
  'PS': 'Palestine, State of',
  'PT': 'Portugal',
  'PW': 'Palau',
  'PY': 'Paraguay',
  'QA': 'Qatar',
  'RO': 'Romania',
  'RS': 'Serbia',
  'RU': 'Russia',
  'RW': 'Rwanda',
  'SA': 'Saudi Arabia',
  'SB': 'Solomon Islands',
  'SC': 'Seychelles',
  'SD': 'Sudan',
  'SE': 'Sweden',
  'SG': 'Singapore',
  'SI': 'Slovenia',
  'SK': 'Slovakia',
  'SL': 'Sierra Leone',
  'SM': 'San Marino',
  'SN': 'Senegal',
  'SO': 'Somalia',
  'SR': 'Suriname',
  'SS': 'South Sudan',
  'ST': 'Sao Tome and Principe',
  'SV': 'El Salvador',
  'SY': 'Syria',
  'SZ': 'Eswatini',
  'TD': 'Chad',
  'TG': 'Togo',
  'TH': 'Thailand',
  'TJ': 'Tajikistan',
  'TL': 'Timor-Leste',
  'TM': 'Turkmenistan',
  'TN': 'Tunisia',
  'TO': 'Tonga',
  'TR': 'Turkey',
  'TT': 'Trinidad and Tobago',
  'TV': 'Tuvalu',
  'TW': 'Taiwan',
  'TZ': 'Tanzania',
  'UA': 'Ukraine',
  'UG': 'Uganda',
  'UK': 'United Kingdom', // Non-ISO code, included as requested
  'US': 'United States of America',
  'UY': 'Uruguay',
  'UZ': 'Uzbekistan',
  'VA': 'Vatican City',
  'VC': 'Saint Vincent and the Grenadines',
  'VE': 'Venezuela',
  'VN': 'Vietnam',
  'VU': 'Vanuatu',
  'WS': 'Samoa',
  'YE': 'Yemen',
  'ZA': 'South Africa',
  'ZM': 'Zambia',
  'ZW': 'Zimbabwe'
};

export function GeoMap({ stats, geoDataVersion = 0 }: GeoMapProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  const hasCountryData = stats && stats.topCountries && stats.topCountries.length > 0;

  // Create a map of country names/codes to request counts
  // Use useMemo to recalculate only when stats or geoDataVersion changes
  const countryData = useMemo(() => {
    if (!hasCountryData) return {};
    
    return stats.topCountries.reduce((acc: Record<string, { count: number, countryCode: string }>, { country, countryCode, count }) => {
      // Store by country name
      acc[country] = { count, countryCode };
      // Also store by mapped name if available
      if (countryCodeMap[countryCode]) {
        acc[countryCodeMap[countryCode]] = { count, countryCode };
      }
      // Store by code as well for fallback
      acc[countryCode] = { count, countryCode };
      return acc;
    }, {});
  }, [hasCountryData, stats?.topCountries, geoDataVersion]); // Include geoDataVersion in dependencies

  // Monitor geo data version changes to show update indicator
  useEffect(() => {
    if (geoDataVersion > 0) {
      setIsUpdating(true);
      setLastUpdateTime(new Date());
      
      // Clear the updating indicator after a short delay
      const timer = setTimeout(() => {
        setIsUpdating(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [geoDataVersion]);

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
          {isUpdating && <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />}
        </CardTitle>
        <CardDescription>
          {hasCountryData 
            ? `Requests from ${stats.topCountries.length} countries`
            : "Requests by country"
          }
          {lastUpdateTime && (
            <span className="text-xs text-green-600 dark:text-green-400 ml-2">
              Updated at {lastUpdateTime.toLocaleTimeString()}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="w-full h-[400px]">
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
                 {geoDataVersion > 0 && (
                   <p className="text-sm mt-1 text-blue-600 dark:text-blue-400">
                     Geo database updated, processing new data...
                   </p>
                 )}
               </div>
             </div>
          ) : (
            <>
              <ComposableMap 
                key={`geomap-${geoDataVersion}`} // Force re-render on data version change
                data-tip=""
                projection="geoMercator"
                projectionConfig={{
                  scale: 140,
                  center: [0, 20]
                }}
                style={{ width: '100%', height: '100%' }}
              >
                <ZoomableGroup zoom={1} minZoom={0.5} maxZoom={8}>
                  <Geographies geography={geoUrl}>
                    {({ geographies }: { geographies: any[] }) =>
                      geographies.map((geo: any) => {
                        const geoName = geo.properties.name || geo.properties.NAME;
                        const geoCode = geo.properties.ISO_A2 || geo.properties.ISO_A3;
                        
                        const data = countryData[geoName] || 
                                   countryData[geoCode] || 
                                   { count: 0, countryCode: '' };
                        
                        return (
                          <Geography
                            key={`${geo.rsmKey}-${geoDataVersion}`} // Include version in key
                            geography={geo}
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
            </>
          )}
        </div>
      </CardContent>
      {hasCountryData && (
        <CardFooter className="flex-col items-start gap-y-4">
          {/* Legend */}
          <div className="flex w-full items-center justify-center gap-4 text-sm">
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
            {isUpdating && (
              <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span className="text-xs">Updating...</span>
              </div>
            )}
          </div>

          {/* Top Countries List */}
          <div className="w-full grid grid-cols-2 md:grid-cols-3 gap-2 text-sm pt-4 border-t">
            {stats.topCountries.slice(0, 6).map((country, idx) => (
              <div key={`${country.countryCode}-${idx}-${geoDataVersion}`} className="flex items-center justify-between p-2 rounded bg-muted/50">
                <span className="flex items-center gap-1">
                  <span className="font-mono text-xs">{country.countryCode ?? ''}</span>
                  <span className="text-muted-foreground">-</span>
                  <span className="truncate">{country.country}</span>
                </span>
                <span className="font-semibold">{country.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}