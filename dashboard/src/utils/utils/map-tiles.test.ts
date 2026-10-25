import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAP_TILE_ATTRIBUTION,
  DEFAULT_MAP_TILE_URL,
  DEFAULT_MAP_TILE_URL_DARK,
  isRasterTileUrl,
  resolveMapTileAttribution,
  resolveMapTileUrl,
} from './map-tiles';

const CARTO_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
const OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

describe('isRasterTileUrl', () => {
  it('treats XYZ templates as raster', () => {
    expect(isRasterTileUrl(CARTO_LIGHT)).toBe(true);
    expect(isRasterTileUrl(OSM)).toBe(true);
  });

  it('treats other URLs as MapLibre styles', () => {
    expect(isRasterTileUrl(DEFAULT_MAP_TILE_URL)).toBe(false);
    expect(isRasterTileUrl('https://example.com/style.json')).toBe(false);
  });
});

describe('resolveMapTileUrl', () => {
  it('defaults to OpenFreeMap', () => {
    expect(resolveMapTileUrl(false)).toBe(DEFAULT_MAP_TILE_URL);
    expect(resolveMapTileUrl(true)).toBe(DEFAULT_MAP_TILE_URL_DARK);
    expect(resolveMapTileUrl(false, { mapTileUrl: '', mapTileUrlDark: '' })).toBe(DEFAULT_MAP_TILE_URL);
    expect(resolveMapTileUrl(true, { mapTileUrl: '', mapTileUrlDark: '' })).toBe(DEFAULT_MAP_TILE_URL_DARK);
  });

  it('uses the configured URLs per theme', () => {
    const config = { mapTileUrl: OSM, mapTileUrlDark: CARTO_LIGHT };
    expect(resolveMapTileUrl(false, config)).toBe(OSM);
    expect(resolveMapTileUrl(true, config)).toBe(CARTO_LIGHT);
  });

  it('falls back to the light URL in dark mode', () => {
    expect(resolveMapTileUrl(true, { mapTileUrl: OSM })).toBe(OSM);
  });
});

describe('resolveMapTileAttribution', () => {
  it('defaults to the OpenFreeMap attribution', () => {
    expect(resolveMapTileAttribution()).toBe(DEFAULT_MAP_TILE_ATTRIBUTION);
    expect(resolveMapTileAttribution({ mapTileAttribution: '' })).toBe(DEFAULT_MAP_TILE_ATTRIBUTION);
  });

  it('uses the configured attribution', () => {
    expect(resolveMapTileAttribution({ mapTileAttribution: '&copy; OSM' })).toBe('&copy; OSM');
  });
});
