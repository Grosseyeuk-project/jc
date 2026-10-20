// Les gestes de l'utilisateur, traduits en changements d'état cohérents
// (curseur, année et étape active vont toujours ensemble).
import { anneeAu, indexDeEtape, indexPlusProche, POSITIONS, U_MAX, uDeEtape } from './chronologie';
import { etapes } from './donnees';
import { creerStore, type Store } from './state';

// On ouvre sur le voyage complet : tout le tracé est visible.
export const store = creerStore({ annee: anneeAu(U_MAX), curseur: U_MAX, etapeActive: null, lecture: false, mode: 'explorer' });

export function creerActions(s: Store) {
  let anim = 0;

  const actions = {
    /** Sélectionne une étape : le curseur s'y place et la carte s'y rend. */
    allerA(etapeId: string) {
      actions.pause();
      const u = uDeEtape(etapeId);
      s.set({ etapeActive: etapeId, curseur: u, annee: anneeAu(u) });
    },

    /** Déplace le curseur (glisser sur la frise) sans changer l'étape affichée. */
    glisser(u: number) {
      actions.pause();
      s.set({ curseur: u, annee: anneeAu(u) });
    },

    /** Au relâchement, le curseur s'aimante sur l'étape la plus proche. */
    relacher() {
      const i = indexPlusProche(s.get().curseur);
      actions.allerA(etapes[i].id);
    },

    /** Étape précédente (-1) ou suivante (+1). */
    decaler(sens: -1 | 1) {
      const id = s.get().etapeActive;
      const i = id ? indexDeEtape(id) : indexPlusProche(s.get().curseur);
      const j = Math.min(Math.max(i + sens, 0), etapes.length - 1);
      actions.allerA(etapes[j].id);
    },

    /** Lecture automatique : le tracé avance d'une unité de frise par `duree` ms. */
    lire(duree = 900) {
      if (s.get().lecture) return;
      let u = s.get().curseur >= U_MAX - 1e-6 ? 0 : s.get().curseur;
      s.set({ lecture: true, curseur: u, annee: anneeAu(u) });
      let avant = performance.now();
      const pas = (t: number) => {
        if (!s.get().lecture) return;
        u = Math.min(U_MAX, u + (t - avant) / duree);
        avant = t;
        // L'étape active suit la tête du tracé.
        let i = 0;
        while (i < POSITIONS.length - 1 && POSITIONS[i + 1] <= u) i++;
        s.set({ curseur: u, annee: anneeAu(u), etapeActive: etapes[i].id });
        if (u >= U_MAX) s.set({ lecture: false });
        else anim = requestAnimationFrame(pas);
      };
      anim = requestAnimationFrame(pas);
    },

    pause() {
      cancelAnimationFrame(anim);
      if (s.get().lecture) s.set({ lecture: false });
    },
  };
  return actions;
}

export type Actions = ReturnType<typeof creerActions>;
