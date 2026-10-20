// Passion heure par heure : du jeudi 18 h au vendredi 18 h (étapes 34 à 39, champ `heures`).
// Les heures sont des hypothèses : les Évangiles n'en donnent que quelques-unes.
import { etapes } from './donnees';
import type { Etape } from './types';

/** Durée couverte par l'horloge, en heures. */
export const DUREE_PASSION = 24;

/** Heures écoulées depuis jeudi 18 h. */
export function heuresDepuisJeudi(e: Etape): number | null {
  if (!e.heures) return null;
  const [h, m] = e.heures.debut.split(':').map(Number);
  const heure = h + m / 60;
  return e.heures.jour === 'jeudi' ? heure - 18 : heure + 6;
}

/** « jeudi, vers 18 h » */
export function formatHeure(e: Etape): string | null {
  if (!e.heures) return null;
  const [h, m] = e.heures.debut.split(':').map(Number);
  const heure = h === 0 && m === 0 ? 'minuit' : `${h} h${m ? String(m).padStart(2, '0') : ''}`;
  return `${e.heures.jour}, vers ${heure}`;
}

export const ETAPES_PASSION = etapes.filter((e) => e.heures);

/** Repères de l'horloge, toutes les trois heures. */
export const REPERES_HEURES = Array.from({ length: 9 }, (_, k) => {
  const t = k * 3;
  const h = (18 + t) % 24;
  return { t, libelle: h === 0 ? 'minuit' : `${h} h`, jour: t < 6 ? 'jeudi' : 'vendredi' };
});

/** La nuit, approximativement de 18 h à 6 h (début avril à Jérusalem). */
export const NUIT = { debut: 0, fin: 12 };
