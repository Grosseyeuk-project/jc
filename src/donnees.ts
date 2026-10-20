import etapesBrutes from './data/etapes.json';
import lieuxBruts from './data/lieux.json';
import villesBrutes from './data/villes.json';
import textesBruts from './data/textes.json';
import citationsLsg from './data/citations-lsg.json';
import type { Etape, Lieu, TexteEtape, Ville } from './types';

export const etapes = etapesBrutes as Etape[];
export const lieux = lieuxBruts as Lieu[];
export const villes = villesBrutes as Ville[];
export const textes = textesBruts as Record<string, TexteEtape>;
/** Texte Louis Segond 1910 de chaque citation, extrait par scripts/extraire-citations.mjs. */
export const citations = citationsLsg as Record<string, string>;

export const jalons = etapes.filter((e) => e.jalon);
export const lieuParId = new Map(lieux.map((l) => [l.id, l]));
export const etapeParId = new Map(etapes.map((e) => [e.id, e]));

/** Étapes jalons rattachées à un lieu, dans l'ordre du récit. */
export const jalonsDuLieu = (lieuId: string) => jalons.filter((e) => e.lieu === lieuId);

export function formatAnnee(annee: number): string {
  if (annee < 0) return `${-annee} av. J.-C.`;
  return `an ${annee}`;
}

export const LIBELLE_CERTITUDE: Record<Lieu['certitude'], string> = {
  certain: 'localisation certaine',
  probable: 'localisation probable',
  debattu: 'localisation débattue',
};
