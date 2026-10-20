// Tracé du voyage : une courbe douce d'une étape à la suivante, dans l'ordre du
// récit harmonisé. Ce ne sont pas des itinéraires routiers : on relie des lieux.
import { positionAu } from '../chronologie';
import { etapes, lieuParId } from '../donnees';
import type { Phase } from '../types';

export const COULEURS_PHASES: Record<Phase, string> = {
  enfance: '#4f6f86',
  ministere: '#8b5e3c',
  'vers-jerusalem': '#a0522d',
  passion: '#7a1616',
  resurrection: '#b8892b',
};

const ECHANTILLONS = 32;

type Point = [number, number];

/** [lat, lon] → [lon, lat] */
export const lngLat = (id: string): Point => {
  const [lat, lon] = lieuParId.get(id)!.coord;
  return [lon, lat];
};

/** Arc de A vers B, bombé vers la droite du sens de marche : un aller-retour trace deux arcs distincts. */
export function arc(a: Point, b: Point): Point[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (Math.hypot(dx, dy) < 1e-6) return [a, b];
  const c: Point = [(a[0] + b[0]) / 2 + dy * 0.18, (a[1] + b[1]) / 2 - dx * 0.18];
  const pts: Point[] = [];
  for (let k = 0; k <= ECHANTILLONS; k++) {
    const t = k / ECHANTILLONS;
    const m = 1 - t;
    pts.push([m * m * a[0] + 2 * m * t * c[0] + t * t * b[0], m * m * a[1] + 2 * m * t * c[1] + t * t * b[1]]);
  }
  return pts;
}

/** Segment i : de l'étape i à l'étape i + 1, coloré selon la phase d'arrivée. */
export const SEGMENTS = etapes.slice(1).map((e, k) => ({
  phase: e.phase,
  points: arc(lngLat(etapes[k].lieu), lngLat(e.lieu)),
}));

function tronquer(points: Point[], f: number): Point[] {
  if (f >= 1) return points;
  const x = f * (points.length - 1);
  const n = Math.floor(x);
  const r = x - n;
  const fin = points[n + 1] ?? points[n];
  return [...points.slice(0, n + 1), [points[n][0] + (fin[0] - points[n][0]) * r, points[n][1] + (fin[1] - points[n][1]) * r]];
}

/** Le tracé parcouru jusqu'à la position `u` du curseur, et la position de la tête. */
export function traceAu(u: number): { parcouru: GeoJSON.FeatureCollection; tete: Point } {
  const { i, f } = positionAu(u);
  const features: GeoJSON.Feature[] = [];
  for (let k = 0; k < i; k++) {
    features.push({ type: 'Feature', properties: { phase: SEGMENTS[k].phase }, geometry: { type: 'LineString', coordinates: SEGMENTS[k].points } });
  }
  let tete = lngLat(etapes[i].lieu);
  if (f > 0 && SEGMENTS[i]) {
    const partiel = tronquer(SEGMENTS[i].points, f);
    tete = partiel[partiel.length - 1];
    features.push({ type: 'Feature', properties: { phase: SEGMENTS[i].phase }, geometry: { type: 'LineString', coordinates: partiel } });
  }
  return { parcouru: { type: 'FeatureCollection', features: vieillir(features) }, tete };
}

/**
 * Âge de chaque segment (0 = le plus récent) : les plus anciens s'estompent
 * sur la carte, et le dernier (`courant`) est animé.
 */
function vieillir(features: GeoJSON.Feature[]): GeoJSON.Feature[] {
  const n = features.length;
  return features.map((f, k) => ({ ...f, properties: { ...f.properties, age: n - 1 - k, courant: k === n - 1 } }));
}

/** Le voyage complet, en filigrane. */
export const TRACE_COMPLETE: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: SEGMENTS.map((s) => ({ type: 'Feature', properties: { phase: s.phase }, geometry: { type: 'LineString', coordinates: s.points } })),
};

const cacheSelon = new Map<string, { i: number; phase: Phase; points: Point[] }[]>();

/**
 * Mode comparer : le voyage tel qu'un seul évangile le raconte, en reliant
 * ses étapes dans l'ordre harmonisé (`indices` : étapes racontées).
 */
export function traceSelon(indices: number[], u: number): { parcouru: GeoJSON.FeatureCollection; tete: Point | null } {
  const cle = indices.join(',');
  let segments = cacheSelon.get(cle);
  if (!segments) {
    segments = indices.slice(1).map((j, k) => ({
      i: j,
      phase: etapes[j].phase,
      points: arc(lngLat(etapes[indices[k]].lieu), lngLat(etapes[j].lieu)),
    }));
    cacheSelon.set(cle, segments);
  }
  const { i } = positionAu(u);
  const atteints = segments.filter((s) => s.i <= i);
  const derniere = [...indices].reverse().find((j) => j <= i);
  return {
    parcouru: {
      type: 'FeatureCollection',
      // En comparaison, tout le récit compte autant : pas d'estompage ni d'animation.
      features: atteints.map((s) => ({
        type: 'Feature',
        properties: { phase: s.phase, age: 0, courant: false },
        geometry: { type: 'LineString', coordinates: s.points },
      })),
    },
    tete: derniere === undefined ? null : lngLat(etapes[derniere].lieu),
  };
}
