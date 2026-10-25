import type { RuntimeConfig } from '@/utils/config/runtime-config';

// OpenFreeMap vector styles: no API key, no request limits.
export const DEFAULT_MAP_TILE_URL = 'https://tiles.openfreemap.org/styles/positron';
export const DEFAULT_MAP_TILE_URL_DARK = 'https://tiles.openfreemap.org/styles/dark';
export const DEFAULT_MAP_TILE_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer">&copy; OpenMapTiles</a> ' +
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">&copy; OpenStreetMap</a>';

/** Raster XYZ templates contain `{z}`; anything else is treated as a MapLibre style URL. */
export function isRasterTileUrl(url: string): boolean {
  return url.includes('{z}');
}

/** Picks the basemap URL for the current theme from runtime config, with OpenFreeMap defaults. */
export function resolveMapTileUrl(
  isDark: boolean,
  { mapTileUrl, mapTileUrlDark }: RuntimeConfig = {},
): string {
  return isDark
    ? mapTileUrlDark || mapTileUrl || DEFAULT_MAP_TILE_URL_DARK
    : mapTileUrl || DEFAULT_MAP_TILE_URL;
}

export function resolveMapTileAttribution({ mapTileAttribution }: RuntimeConfig = {}): string {
  return mapTileAttribution || DEFAULT_MAP_TILE_ATTRIBUTION;
}

let webGL2Supported: boolean | undefined;

/** MapLibre needs WebGL2; checked once per page load. */
export function supportsWebGL2(): boolean {
  if (webGL2Supported === undefined) {
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      webGL2Supported = !!gl;
    } catch {
      webGL2Supported = false;
    }
  }
  return webGL2Supported;
}
