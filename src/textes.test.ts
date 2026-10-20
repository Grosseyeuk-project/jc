import { describe, expect, it } from 'vitest';
// @ts-expect-error script Node sans déclarations de types
import { analyserReference, analyserUsfm } from '../scripts/extraire-citations.mjs';
import { citations, etapes, textes } from './donnees';
import { extrait } from './ui/panneau';

/** La citation « Lc 1:30-31 » tombe-t-elle dans l'une des références de l'étape (« Lc 1:26-38 », « Mt 5-7 »…) ? */
function couverte(ref: string, references: string[]): boolean {
  const c = analyserReference(ref);
  return references.some((r) => {
    const m = r.match(/^(\w+) (\d+)(?:-(\d+))?(?::(\d+)(?:-(?:(\d+):)?(\d+))?)?$/);
    if (!m || m[1] !== c.livre) return false;
    const [, , c1, cFin, va, c2, vb] = m;
    if (va === undefined) return c.chapitre >= +c1 && c.chapitre <= +(cFin ?? c1);
    const debut = [+c1, +va];
    const fin = [+(c2 ?? c1), +(vb ?? va)];
    const avant = (a: number[], b: number[]) => a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]);
    return avant(debut, [c.chapitre, c.de]) && avant([c.chapitre, c.a], fin);
  });
}

describe('textes.json', () => {
  it('couvre les 46 étapes', () => {
    expect(Object.keys(textes).sort()).toEqual(etapes.map((e) => e.id).sort());
  });

  it('a pour chaque étape une histoire, une méditation courte et 1 à 3 citations', () => {
    for (const e of etapes) {
      const t = textes[e.id];
      expect(t.histoire.length, e.id).toBeGreaterThan(100);
      expect(t.meditation.length, e.id).toBeLessThan(200);
      expect(t.citations.length, e.id).toBeGreaterThanOrEqual(1);
      expect(t.citations.length, e.id).toBeLessThanOrEqual(3);
    }
  });

  it('cite des passages tirés des références de l’étape, tous extraits', () => {
    for (const e of etapes) {
      for (const ref of textes[e.id].citations) {
        expect(couverte(ref, e.references), `${e.id} : ${ref}`).toBe(true);
        expect(citations[ref], ref).toBeTruthy();
      }
    }
  });
});

describe('extraction Louis Segond', () => {
  it('nettoie renvois et balises, et recolle les versets sur plusieurs lignes', () => {
    const usfm = [
      '\\c 3',
      '\\s Un titre',
      '\\p',
      '\\v 1 Mais il y eut \\x + \\xo 3:1 \\xt Jn 19:39. \\x*Nicodème,',
      '\\v 2 Jésus dit: \\wj Bonjour.\\wj*',
      '\\q suite du verset 2',
    ].join('\n');
    expect(analyserUsfm(usfm)).toEqual({ '3:1': 'Mais il y eut Nicodème,', '3:2': 'Jésus dit: Bonjour. suite du verset 2' });
  });

  it('signale les coupes d’un extrait', () => {
    expect(extrait('et elle enfanta son fils,')).toBe('… et elle enfanta son fils…');
    expect(extrait('Jésus pleura.')).toBe('Jésus pleura.');
  });
});
