import {
    createElementObject,
    createLayerComponent,
    type LayerProps,
} from "@react-leaflet/core"
import { MaplibreGL } from "@maplibre/maplibre-gl-leaflet"
import type { MaplibreGL as LMaplibreGL } from "leaflet"
import { setWorkerUrl } from "maplibre-gl"
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url"
import "maplibre-gl/dist/maplibre-gl.css"

// MapLibre looks for its worker next to its own module, which no longer
// exists once bundled, so point it at the emitted asset instead.
setWorkerUrl(maplibreWorkerUrl)

interface MapLibreTileLayerProps extends LayerProps {
    url: string
}

const MapLibreTileLayer = createLayerComponent<
    LMaplibreGL,
    MapLibreTileLayerProps
>(
    function createMapLibreTileLayer({ url, attribution }, context) {
        const layer = new MaplibreGL({
            style: url,
            // Overrides the style's own source attributions.
            attributionControl: attribution
                ? { customAttribution: attribution }
                : undefined,
        })
        // MapLibre's CSS makes the container position: relative, which
        // stretches the tile pane over the map's controls. Lay it out like a
        // raster tile layer instead, letting pointer events reach Leaflet.
        layer.on("add", () => {
            Object.assign(layer.getContainer().style, {
                position: "absolute",
                pointerEvents: "none",
            })
        })
        return createElementObject(layer, context)
    },
    function updateMapLibreTileLayer(layer, props, prevProps) {
        if (props.url !== prevProps.url) {
            layer.getMaplibreMap()?.setStyle(props.url)
        }
    }
)

export { MapLibreTileLayer }
