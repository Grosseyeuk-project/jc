// Échelle de la frise. Chaque étape a une position `u` ; l'écart entre deux
// étapes vaut 1, plus 0,3 par année écoulée. Les années d'enfance (1 av. J.-C.
// à l'an 26) tiennent ainsi dans un petit tiers, et le ministère (27-30), riche
// en étapes, occupe le reste : c'est l'« échelle élargie sur le ministère ».
import { etapes } from './donnees';

const PAS_ETAPE = 1;
const PAS_ANNEE = 0.3;

export const POSITIONS: number[] = [];
{
  let u = 0;
  etapes.forEach((e, i) => {
    if (i > 0) u += PAS_ETAPE + PAS_ANNEE * Math.max(0, e.annee - etapes[i - 1].annee);
    POSITIONS.push(u);
  });
}

export const U_MAX = POSITIONS[POSITIONS.length - 1];

const indexParId = new Map(etapes.map((e, i) => [e.id, i]));

export const uDeEtape = (id: string) => POSITIONS[indexParId.get(id) ?? 0];
export const indexDeEtape = (id: string) => indexParId.get(id) ?? -1;

/** Dernière étape atteinte à la position `u`, et avancée (0 à 1) vers la suivante. */
export function positionAu(u: number): { i: number; f: number } {
  const v = Math.min(Math.max(u, 0), U_MAX);
  let i = 0;
  while (i < POSITIONS.length - 1 && POSITIONS[i + 1] <= v + 1e-9) i++;
  if (i === POSITIONS.length - 1) return { i, f: 0 };
  return { i, f: (v - POSITIONS[i]) / (POSITIONS[i + 1] - POSITIONS[i]) };
}

/** Étape la plus proche de `u` (pour aimanter le curseur au relâchement). */
export function indexPlusProche(u: number): number {
  const { i, f } = positionAu(u);
  return f > 0.5 ? i + 1 : i;
}

/** Année affichée à la position `u` : les années défilent entre deux étapes éloignées. */
export function anneeAu(u: number): number {
  const { i, f } = positionAu(u);
  const a = etapes[i].annee;
  if (f === 0) return a;
  const b = etapes[i + 1].annee;
  return Math.floor(a + f * (b - a) + 1e-9);
}

/** Repères d'années pour la frise : la première étape de chaque année. */
export const REPERES_ANNEES = etapes
  .map((e, i) => ({ annee: e.annee, u: POSITIONS[i] }))
  .filter((r, i, t) => i === 0 || r.annee !== t[i - 1].annee);

/** Bornes de chaque phase sur la frise. */
export const PHASES = (() => {
  const res: { phase: (typeof etapes)[number]['phase']; debut: number; fin: number }[] = [];
  etapes.forEach((e, i) => {
    const dernier = res[res.length - 1];
    if (dernier && dernier.phase === e.phase) dernier.fin = POSITIONS[i];
    else {
      // Une phase commence à mi-chemin depuis la dernière étape de la précédente.
      const debut = i === 0 ? 0 : (POSITIONS[i - 1] + POSITIONS[i]) / 2;
      if (dernier) dernier.fin = debut;
      res.push({ phase: e.phase, debut, fin: POSITIONS[i] });
    }
  });
  res[res.length - 1].fin = U_MAX;
  return res;
})();
