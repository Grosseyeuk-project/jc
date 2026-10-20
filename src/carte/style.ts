import type { StyleSpecification } from 'maplibre-gl';
import frontieres from '../data/frontieres.json';

// Palette parchemin. Les mêmes teintes sont reprises dans style.css.
export const COULEURS = {
  terre: '#efe2c2',
  eau: '#b9c8bd',
  eauContour: '#7f8f7d',
  fleuve: '#7d978f',
  ombre: '#5e4529',
  lumiere: '#fbf3dc',
  accent: '#8a6d47',
  frontiere: '#8b5e3c',
};

// Une teinte légère par région, comme des aplats de lavis.
const TEINTES: Record<string, string> = {
  galilee: '#9fae6a',
  samarie: '#c9a35d',
  judee: '#c47f52',
  idumee: '#b99b7a',
  peree: '#a7a15a',
  decapole: '#8c9cb0',
  philippe: '#a08aa6',
  phenicie: '#7fa3a1',
};

export const BBOX_RELIEF: [number, number, number, number] = [30.8, 29.4, 37.2, 34.2];

/** `base` : adresse absolue du site, terminée par « / ». */
export function creerStyle(base: string): StyleSpecification {
  // Concaténation simple : new URL() encoderait les accolades de {z}/{x}/{y}.
  const url = (chemin: string) => base + chemin;
  return {
    version: 8,
    sources: {
      relief: {
        type: 'raster-dem',
        tiles: [url('relief/{z}/{x}/{y}.png')],
        encoding: 'terrarium',
        tileSize: 256,
        minzoom: 5,
        maxzoom: 9,
        bounds: BBOX_RELIEF,
        attribution: 'Relief : Mapzen Terrain Tiles (SRTM, NASA)',
      },
      frontieres: {
        type: 'geojson',
        data: frontieres as GeoJSON.FeatureCollection,
      },
      mer: { type: 'geojson', data: url('geo/mer.geojson'), attribution: 'Natural Earth' },
      lacs: { type: 'geojson', data: url('geo/lacs.geojson') },
      fleuves: { type: 'geojson', data: url('geo/fleuves.geojson') },
    },
    layers: [
      { id: 'terre', type: 'background', paint: { 'background-color': COULEURS.terre } },
      {
        id: 'relief',
        type: 'hillshade',
        source: 'relief',
        paint: {
          'hillshade-shadow-color': COULEURS.ombre,
          'hillshade-highlight-color': COULEURS.lumiere,
          'hillshade-accent-color': COULEURS.accent,
          'hillshade-exaggeration': ['interpolate', ['linear'], ['zoom'], 6, 0.55, 11, 0.35],
          'hillshade-illumination-direction': 315,
        },
      },
      {
        id: 'regions-aplat',
        type: 'fill',
        source: 'frontieres',
        paint: {
          'fill-color': ['match', ['get', 'id'], ...Object.entries(TEINTES).flat(), '#bbb'] as never,
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.17, 11, 0.06],
        },
      },
      {
        id: 'regions-trait',
        type: 'line',
        source: 'frontieres',
        paint: {
          'line-color': COULEURS.frontiere,
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 10, 1.6],
          'line-dasharray': [4, 2],
          'line-opacity': 0.75,
        },
      },
      // La mer et les lacs passent par-dessus les régions : les tracés faits à la main
      // peuvent déborder sur l'eau sans que cela se voie.
      {
        id: 'mer',
        type: 'fill',
        source: 'mer',
        paint: { 'fill-color': COULEURS.eau },
      },
      {
        id: 'mer-cote',
        type: 'line',
        source: 'mer',
        paint: { 'line-color': COULEURS.eauContour, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 11, 2] },
      },
      {
        id: 'fleuves',
        type: 'line',
        source: 'fleuves',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': COULEURS.fleuve, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 11, 3] },
      },
      { id: 'lacs', type: 'fill', source: 'lacs', paint: { 'fill-color': COULEURS.eau } },
      {
        id: 'lacs-rive',
        type: 'line',
        source: 'lacs',
        paint: { 'line-color': COULEURS.eauContour, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.6, 11, 1.6] },
      },
    ],
  };
}
