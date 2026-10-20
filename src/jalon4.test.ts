import { describe, expect, it } from 'vitest';
import jerusalem from './data/jerusalem.json';
import { etapeParId, etapes, lieuParId } from './donnees';
import { etapesAVariante, indicesSelon, raconte, referencesSelon } from './evangiles';
import { ETAPES_PASSION, formatHeure, heuresDepuisJeudi } from './passion';

describe('mode comparer', () => {
  it('compte 19 étapes à variante, comme le champ `variante` de etapes.json', () => {
    expect(etapesAVariante.map((e) => e.ordre)).toEqual([5, 6, 7, 10, 11, 13, 17, 18, 19, 21, 30, 32, 34, 36, 37, 40, 42, 45, 46]);
  });

  it('sait quel évangile raconte quelle étape', () => {
    const cana = etapeParId.get('cana')!;
    expect(raconte(cana, 'Jn')).toBe(true);
    expect(raconte(cana, 'Mt')).toBe(false);
    expect(referencesSelon(etapeParId.get('bapteme')!, 'Mc')).toEqual(['Mc 1:9-11']);
    // L'Ascension est racontée par Luc (Lc 24:50-53) et par les Actes, pas par Matthieu.
    expect(raconte(etapeParId.get('ascension')!, 'Lc')).toBe(true);
    expect(raconte(etapeParId.get('ascension')!, 'Mt')).toBe(false);
  });

  it('donne à chaque évangile une suite d’étapes non vide et ordonnée', () => {
    for (const g of ['Mt', 'Mc', 'Lc', 'Jn'] as const) {
      const ind = indicesSelon(g);
      expect(ind.length).toBeGreaterThan(10);
      expect([...ind].sort((a, b) => a - b)).toEqual(ind);
    }
  });
});

describe('Passion heure par heure', () => {
  it('place les six étapes de la Passion entre jeudi 18 h et vendredi 18 h', () => {
    expect(ETAPES_PASSION.map((e) => e.ordre)).toEqual([34, 35, 36, 37, 38, 39]);
    expect(ETAPES_PASSION.map((e) => heuresDepuisJeudi(e))).toEqual([0, 4, 6, 12, 15, 23]);
  });

  it('formate l’heure en français', () => {
    expect(formatHeure(etapeParId.get('dernier-repas')!)).toBe('jeudi, vers 18 h');
    expect(formatHeure(etapeParId.get('grand-pretre')!)).toBe('vendredi, vers minuit');
    expect(formatHeure(etapeParId.get('cana')!)).toBeNull();
  });
});

describe('plan de Jérusalem', () => {
  /** Point dans un polygone (lancer de rayon), coordonnées [lon, lat]. */
  const dedans = ([x, y]: number[], anneau: number[][]) => {
    let c = false;
    for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
      const [xi, yi] = anneau[i];
      const [xj, yj] = anneau[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const ville = (jerusalem as GeoJSON.FeatureCollection).features.find((f) => f.properties!.type === 'ville')!;
  const anneau = (ville.geometry as GeoJSON.Polygon).coordinates[0];
  const lonLat = (id: string) => [lieuParId.get(id)!.coord[1], lieuParId.get(id)!.coord[0]];

  it('laisse le Golgotha et Gethsémani hors les murs', () => {
    expect(dedans(lonLat('golgotha'), anneau)).toBe(false);
    expect(dedans(lonLat('gethsemani'), anneau)).toBe(false);
  });

  it('enferme le Temple, le Cénacle, le palais de Caïphe, le prétoire et Siloé', () => {
    for (const id of ['jerusalem', 'cenacle', 'palais-caiphe', 'pretoire', 'siloe']) expect(dedans(lonLat(id), anneau), id).toBe(true);
  });

  it('a des apparitions numérotées de 1 à 5', () => {
    const apparitions = etapes.filter((e) => e.phase === 'resurrection' && e.id !== 'tombeau-vide' && e.id !== 'ascension');
    expect(apparitions).toHaveLength(5);
  });
});
