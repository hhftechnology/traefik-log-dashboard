"use client"

import { cn } from "@/lib/utils"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import type { BBox, Feature, FeatureCollection, Point } from "geojson"
import { MapPinIcon, SearchIcon } from "lucide-react"
import * as React from "react"

interface PlaceFeatureProperties {
    osm_id: number
    osm_type: "N" | "W" | "R"
    osm_key: string
    osm_value: string
    type: string
    name?: string
    housenumber?: string
    street?: string
    locality?: string
    district?: string
    postcode?: string
    city?: string
    county?: string
    state?: string
    country?: string
    countrycode?: string
    extent?: [number, number, number, number]
    extra?: Record<string, string>
}
type PlaceFeature = Feature<Point, PlaceFeatureProperties>
type PlaceFeatureCollection = FeatureCollection<Point, PlaceFeatureProperties>

/**
 * Query parameters for Photon geocoding API
 * @see https://github.com/komoot/photon#photon-api
 */
interface PlaceSearchOptions {
    /** Search text (address, place name, or POI) */
    query: string
    /** Preferred language for results (e.g., "en", "de", "fr") */
    lang?: string
    /** Maximum number of results to return */
    limit?: number
    /**
     * Bounding box used to restrict results.
     * Format: [minLongitude, minLatitude, maxLongitude, maxLatitude]
     */
    bbox?: BBox
    /** Latitude used to bias results toward a specific location */
    lat?: number
    /** Longitude used to bias results toward a specific location */
    lon?: number
    /**
     * Zoom level used for location biasing.
     * Higher values increase locality.
     */
    zoom?: number
    /**
     * Strength of the location bias.
     */
    locationBiasScale?: number
}

interface PlaceAutocompleteProps
    extends Omit<PlaceSearchOptions, "query">,
        Omit<React.ComponentProps<"input">, "value" | "onChange"> {
    debounceMs?: number
    value?: string
    defaultValue?: string
    onChange?: (value: string) => void
    onPlaceSelect?: (feature: PlaceFeature) => void
    onResultsChange?: (results: PlaceFeature[]) => void
}

function formatAddress(properties: PlaceFeatureProperties) {
    const parts = []

    if (properties.name) {
        parts.push(properties.name)
    }

    if (properties.housenumber && properties.street) {
        parts.push(`${properties.housenumber} ${properties.street}`)
    } else if (properties.street) {
        parts.push(properties.street)
    }

    if (properties.city) {
        parts.push(properties.city)
    } else if (properties.locality) {
        parts.push(properties.locality)
    }

    if (properties.state && properties.state !== properties.city) {
        parts.push(properties.state)
    }

    if (properties.country) {
        parts.push(properties.country)
    }

    return [...new Set(parts)].join(", ")
}

function buildSearchUrl({
    query,
    bbox,
    lang,
    lat,
    limit,
    locationBiasScale,
    lon,
    zoom,
}: PlaceSearchOptions) {
    const url = new URL("https://photon.komoot.io/api")
    url.searchParams.set("q", query)

    if (lang) {
        url.searchParams.set("lang", lang)
    }

    if (limit) {
        url.searchParams.set("limit", String(limit))
    }

    if (bbox) {
        url.searchParams.set("bbox", bbox.join(","))
    }

    if (lat !== undefined && lon !== undefined) {
        url.searchParams.set("lat", String(lat))
        url.searchParams.set("lon", String(lon))
    }

    if (zoom !== undefined) {
        url.searchParams.set("zoom", String(zoom))
    }

    if (locationBiasScale !== undefined) {
        url.searchParams.set("location_bias_scale", String(locationBiasScale))
    }

    return String(url)
}

function useDebounce<T>(value: T, delay: number = 300) {
    const [debouncedValue, setDebouncedValue] = React.useState<T>(value)

    React.useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay)
        return () => clearTimeout(timer)
    }, [value, delay])

    return debouncedValue
}

function usePlaceSearch({
    debounceMs,
    query,
    ...props
}: {
    debounceMs: number
} & PlaceSearchOptions) {
    const [results, setResults] = React.useState<PlaceFeature[]>([])
    const [isLoading, setIsLoading] = React.useState(false)
    const [error, setError] = React.useState<Error | null>(null)
    const [hasSearched, setHasSearched] = React.useState(false)

    const debouncedQuery = useDebounce(query, debounceMs)

    React.useEffect(() => {
        if (!debouncedQuery.trim()) {
            setResults([])
            setIsLoading(false)
            setHasSearched(false)
            return
        }

        const abortController = new AbortController()

        async function fetchResults() {
            setIsLoading(true)
            setError(null)
            setHasSearched(true)

            try {
                const url = buildSearchUrl({ query: debouncedQuery, ...props })
                const response = await fetch(url, {
                    signal: abortController.signal,
                })

                if (!response.ok) {
                    throw new Error(
                        `Photon API error: ${response.status} ${response.statusText}`
                    )
                }

                const data: PlaceFeatureCollection = await response.json()
                const addressOsmIds = new Set()
                const dedupedFeatures = data.features.filter((feature) => {
                    const id = feature.properties.osm_id
                    if (addressOsmIds.has(id)) return false
                    addressOsmIds.add(id)
                    return true
                })
                setResults(dedupedFeatures)
            } catch (err) {
                if (err instanceof Error && err.name !== "AbortError") {
                    setError(err)
                    setResults([])
                }
            } finally {
                setIsLoading(false)
            }
        }

        fetchResults()

        return () => abortController.abort()
    }, [
        debouncedQuery,
        props.lang,
        props.limit,
        props.bbox,
        props.lat,
        props.lon,
        props.zoom,
        props.locationBiasScale,
    ])

    return { results, isLoading, error, hasSearched }
}

function PlaceAutocomplete({
    debounceMs = 300,
    lang,
    limit = 5,
    bbox,
    lat,
    lon,
    zoom,
    locationBiasScale,
    className,
    value: controlledValue,
    defaultValue = "",
    onChange: controlledOnChange,
    onPlaceSelect,
    onResultsChange,
    ...props
}: PlaceAutocompleteProps) {
    const [internalValue, setInternalValue] = React.useState(defaultValue)
    const [searchQuery, setSearchQuery] = React.useState("")

    const isControlled = controlledValue !== undefined
    const displayValue = isControlled ? controlledValue : internalValue

    const { results, isLoading, error, hasSearched } = usePlaceSearch({
        query: searchQuery,
        debounceMs,
        lang,
        limit,
        bbox,
        lat,
        lon,
        zoom,
        locationBiasScale,
    })

    React.useEffect(() => {
        onResultsChange?.(results)
    }, [results, onResultsChange])

    const hasNoResults =
        hasSearched && !isLoading && !error && results.length === 0
    const showCommandList = error || hasNoResults || results.length > 0

    return (
        <Command
            className={cn("h-fit overflow-visible", className)}
            shouldFilter={false}
            loop>
            <div className="relative">
                <InputGroup
                    className={cn(
                        "!border-input !bg-popover !ring-0",
                        showCommandList && "rounded-b-none"
                    )}>
                    <InputGroupAddon>
                        <SearchIcon />
                    </InputGroupAddon>
                    <InputGroupInput
                        placeholder="Search"
                        value={displayValue}
                        onChange={(event) => {
                            const newValue = event.target.value
                            if (!isControlled) {
                                setInternalValue(newValue)
                            }
                            setSearchQuery(newValue)
                            controlledOnChange?.(newValue)
                        }}
                        {...props}
                    />
                    {isLoading && (
                        <InputGroupAddon align="inline-end">
                            <Spinner />
                        </InputGroupAddon>
                    )}
                </InputGroup>
                {showCommandList && (
                    <CommandList
                        data-state={showCommandList ? "open" : "closed"}
                        className={cn(
                            "bg-popover border-input absolute top-full right-0 left-0 rounded-b-md border border-t-0 shadow-md",
                            "data-[state=open]:animate-in data-[state=closed]:animate-out",
                            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                            "data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2"
                        )}>
                        {error && (
                            <CommandEmpty>Error: {error.message}</CommandEmpty>
                        )}
                        {hasNoResults && (
                            <CommandEmpty>
                                Cannot find {displayValue}.
                            </CommandEmpty>
                        )}
                        {results.length > 0 && (
                            <CommandGroup>
                                {results.map((feature) => {
                                    const formattedAddress = formatAddress(
                                        feature.properties
                                    )
                                    return (
                                        <CommandItem
                                            key={feature.properties.osm_id}
                                            value={String(
                                                feature.properties.osm_id
                                            )}
                                            onSelect={() => {
                                                const formattedAddress =
                                                    formatAddress(
                                                        feature.properties
                                                    )

                                                if (!isControlled) {
                                                    setInternalValue(
                                                        formattedAddress
                                                    )
                                                }

                                                setSearchQuery("")
                                                controlledOnChange?.(
                                                    formattedAddress
                                                )
                                                onPlaceSelect?.(feature)
                                            }}>
                                            <MapPinIcon />
                                            <div className="flex flex-col items-start text-start">
                                                <span className="font-medium">
                                                    {feature.properties.name ||
                                                        feature.properties
                                                            .street ||
                                                        "Unknown"}
                                                </span>
                                                <span className="text-muted-foreground text-xs">
                                                    {formattedAddress}
                                                </span>
                                            </div>
                                        </CommandItem>
                                    )
                                })}
                            </CommandGroup>
                        )}
                    </CommandList>
                )}
            </div>
        </Command>
    )
}

export { PlaceAutocomplete, type PlaceAutocompleteProps, type PlaceFeature }
