import { describe, expect, it } from 'vitest';
import frontieres from './data/frontieres.json';
import { etapes, formatAnnee, jalons, lieuParId, lieux, villes } from './donnees';
import { creerStore } from './state';

const DANS_LA_REGION = ([lat, lon]: [number, number]) => lat > 29 && lat < 34.5 && lon > 30 && lon < 37;

describe('etapes.json', () => {
  it('contient 46 étapes numérotées de 1 à 46', () => {
    expect(etapes.map((e) => e.ordre)).toEqual(Array.from({ length: 46 }, (_, i) => i + 1));
  });

  it('a des années croissantes dans l’ordre du récit', () => {
    for (let i = 1; i < etapes.length; i++) expect(etapes[i].annee).toBeGreaterThanOrEqual(etapes[i - 1].annee);
  });

  it('place la Nativité en l’an 0, avec une note sur la date', () => {
    const nativite = etapes.find((e) => e.id === 'nativite')!;
    expect(nativite.annee).toBe(0);
    expect(nativite.note).toMatch(/an 0/);
  });

  it('a les 10 jalons prévus', () => {
    expect(jalons.map((e) => e.ordre)).toEqual([3, 9, 12, 19, 27, 30, 33, 38, 40, 46]);
  });

  it('donne des heures aux étapes de la Passion (34 à 39)', () => {
    const passion = etapes.filter((e) => e.ordre >= 34 && e.ordre <= 39);
    expect(passion.every((e) => e.heures)).toBe(true);
  });
});

describe('lieux.json', () => {
  it('couvre tous les lieux des 46 étapes, et rien de plus', () => {
    expect(new Set(lieux.map((l) => l.id))).toEqual(new Set(etapes.map((e) => e.lieu)));
  });

  it('reprend une certitude indiquée dans etapes.json pour ce lieu', () => {
    // Un même lieu peut avoir des certitudes différentes selon l'étape
    // (mont des Oliviers : certain pour l'entrée à Jérusalem, probable pour l'Ascension).
    for (const e of etapes) {
      const certitudes = etapes.filter((j) => j.lieu === e.lieu).map((j) => j.certitude_lieu);
      expect(certitudes, e.lieu).toContain(lieuParId.get(e.lieu)!.certitude);
    }
  });

  it('a des coordonnées [lat, lon] dans la région et une source', () => {
    for (const l of [...lieux, ...villes]) {
      expect(DANS_LA_REGION(l.coord), l.id).toBe(true);
      expect(l.source.length, l.id).toBeGreaterThan(0);
    }
  });

  it('a un identifiant unique par lieu', () => {
    expect(new Set(lieux.map((l) => l.id)).size).toBe(lieux.length);
  });
});

describe('frontieres.json', () => {
  it('trace les cinq régions demandées', () => {
    const noms = (frontieres as GeoJSON.FeatureCollection).features.map((f: GeoJSON.Feature) => f.properties!.nom);
    for (const n of ['Judée', 'Samarie', 'Galilée', 'Pérée', 'Décapole']) expect(noms).toContain(n);
  });
});

describe('formatAnnee', () => {
  it('formate les années avant et après l’an 0', () => {
    expect(formatAnnee(-1)).toBe('1 av. J.-C.');
    expect(formatAnnee(0)).toBe('an 0');
    expect(formatAnnee(30)).toBe('an 30');
  });
});

describe('store', () => {
  it('prévient les abonnés seulement quand une valeur change', () => {
    const s = creerStore({ annee: 0, curseur: 0, etapeActive: null, lecture: false, mode: 'explorer', section: 0 });
    const vus: (string | null)[] = [];
    s.on('etapeActive', (v) => vus.push(v));
    s.set({ annee: 5 });
    s.set({ etapeActive: 'cana' });
    s.set({ etapeActive: 'cana' });
    s.set({ etapeActive: null });
    expect(vus).toEqual(['cana', null]);
  });

  it('permet de se désabonner', () => {
    const s = creerStore({ annee: 0, curseur: 0, etapeActive: null, lecture: false, mode: 'explorer', section: 0 });
    let n = 0;
    const stop = s.subscribe(() => n++);
    s.set({ mode: 'comparer' });
    stop();
    s.set({ mode: 'parcours' });
    expect(n).toBe(1);
  });
});
