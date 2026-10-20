export type Certitude = 'certain' | 'probable' | 'debattu';
export type Phase = 'enfance' | 'ministere' | 'vers-jerusalem' | 'passion' | 'resurrection';

export interface Etape {
  id: string;
  ordre: number;
  titre: string;
  annee: number;
  date: string;
  precision: 'environ' | 'hypothese';
  lieu: string;
  phase: Phase;
  jalon: boolean;
  references: string[];
  certitude_lieu: Certitude;
  variante: string | null;
  note: string | null;
  heures?: { jour: string; debut: string };
}

export interface Lieu {
  id: string;
  nom: string;
  type: 'point' | 'zone' | 'trajet';
  /** [latitude, longitude] */
  coord: [number, number];
  rayon_km?: number;
  /** Côté du nom autour du marqueur, quand des lieux voisins se gênent (défaut : dessous). */
  etiquette?: 'haut' | 'bas' | 'gauche' | 'droite';
  certitude: Certitude;
  site: string;
  alternatives: string[];
  source: string;
}

export interface Ville {
  id: string;
  nom: string;
  /** [latitude, longitude] */
  coord: [number, number];
  /** 1 = toujours visible, 3 = seulement en zoom rapproché */
  rang: 1 | 2 | 3;
  /** Côté de l'étiquette quand elle gênerait un marqueur (défaut : droite). */
  etiquette?: 'gauche';
  source: string;
}

export interface TexteEtape {
  /** Contexte historique, factuel. */
  histoire: string;
  /** Références des citations (Louis Segond 1910), ex. « Lc 1:30-31 ». */
  citations: string[];
}
