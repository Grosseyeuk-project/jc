import { describe, expect, it } from 'vitest';
import { anneeAu, indexPlusProche, PHASES, POSITIONS, positionAu, REPERES_ANNEES, U_MAX, uDeEtape } from './chronologie';
import { etapes } from './donnees';
import { traceAu } from './carte/trace';

describe('échelle de la frise', () => {
  it('place les 46 étapes dans l’ordre, de 0 à U_MAX', () => {
    expect(POSITIONS).toHaveLength(46);
    expect(POSITIONS[0]).toBe(0);
    expect(POSITIONS[45]).toBe(U_MAX);
    for (let i = 1; i < 46; i++) expect(POSITIONS[i]).toBeGreaterThan(POSITIONS[i - 1]);
  });

  it('élargit le ministère : 27 à 30 occupe plus de la moitié de la frise', () => {
    expect(uDeEtape('bapteme') / U_MAX).toBeLessThan(0.4);
  });

  it('retrouve l’étape atteinte et l’avancée vers la suivante', () => {
    expect(positionAu(0)).toEqual({ i: 0, f: 0 });
    expect(positionAu(U_MAX)).toEqual({ i: 45, f: 0 });
    const milieu = (POSITIONS[9] + POSITIONS[10]) / 2;
    expect(positionAu(milieu)).toEqual({ i: 9, f: 0.5 });
    expect(indexPlusProche(milieu - 0.1)).toBe(9);
    expect(indexPlusProche(milieu + 0.1)).toBe(10);
  });

  it('fait défiler les années entre deux étapes éloignées', () => {
    const debut = uDeEtape('jesus-12-ans');
    const fin = uDeEtape('bapteme');
    expect(anneeAu(debut)).toBe(12);
    expect(anneeAu((debut + fin) / 2)).toBeGreaterThan(12);
    expect(anneeAu((debut + fin) / 2)).toBeLessThan(27);
    expect(anneeAu(fin)).toBe(27);
  });

  it('a un repère par année distincte et les cinq phases', () => {
    expect(REPERES_ANNEES.map((r) => r.annee)).toEqual([-1, 0, 1, 12, 27, 28, 29, 30]);
    expect(PHASES.map((p) => p.phase)).toEqual(['enfance', 'ministere', 'vers-jerusalem', 'passion', 'resurrection']);
  });
});

describe('tracé', () => {
  it('est vide au départ et complet à la fin', () => {
    expect(traceAu(0).parcouru.features).toHaveLength(0);
    expect(traceAu(U_MAX).parcouru.features).toHaveLength(etapes.length - 1);
  });

  it('ajoute un segment partiel entre deux étapes', () => {
    const u = (POSITIONS[2] + POSITIONS[3]) / 2;
    const { parcouru } = traceAu(u);
    expect(parcouru.features).toHaveLength(3);
  });
});
