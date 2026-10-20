// Mode comparer : quelles étapes chaque évangile raconte-t-il, et avec quelles références ?
import { etapes } from './donnees';
import type { Etape } from './types';

export const EVANGILES = ['Mt', 'Mc', 'Lc', 'Jn'] as const;
export type Evangile = (typeof EVANGILES)[number];

export const NOMS_EVANGILES: Record<Evangile, string> = {
  Mt: 'Matthieu',
  Mc: 'Marc',
  Lc: 'Luc',
  Jn: 'Jean',
};

/** Références d'une étape pour un évangile donné (vide s'il n'en parle pas). */
export const referencesSelon = (e: Etape, g: Evangile) => e.references.filter((r) => r.split(' ')[0] === g);

export const raconte = (e: Etape, g: Evangile) => referencesSelon(e, g).length > 0;

/** Indices (dans etapes) des étapes racontées par l'évangile. */
export const indicesSelon = (g: Evangile) => etapes.flatMap((e, i) => (raconte(e, g) ? [i] : []));

/** Étapes dont le récit diffère selon les évangiles (le champ `variante` fait foi). */
export const etapesAVariante = etapes.filter((e) => e.variante);
