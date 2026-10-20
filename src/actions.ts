// Les gestes de l'utilisateur, traduits en changements d'état cohérents
// (curseur, année et étape active vont toujours ensemble).
import { anneeAu, indexDeEtape, indexPlusProche, POSITIONS, U_MAX, uDeEtape } from './chronologie';
import { etapes } from './donnees';
import type { Evangile } from './evangiles';
import { creerStore, type Mode, type Section, type Store } from './state';

// On ouvre sur le voyage complet : tout le tracé est visible.
export const store = creerStore({
  annee: anneeAu(U_MAX),
  curseur: U_MAX,
  etapeActive: null,
  lecture: false,
  mode: 'explorer',
  section: 0,
  evangile: 'Lc',
});

const reduitMouvement = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function creerActions(s: Store) {
  let anim = 0;
  const stopAnim = () => cancelAnimationFrame(anim);

  /** Fait glisser le curseur jusqu'à `cible` ; le tracé s'allonge pendant ce temps. */
  const animerVers = (cible: number, duree: number) => {
    stopAnim();
    const depart = s.get().curseur;
    if (reduitMouvement() || duree <= 0 || Math.abs(cible - depart) < 1e-6) {
      s.set({ curseur: cible, annee: anneeAu(cible) });
      return;
    }
    const t0 = performance.now();
    const pas = (t: number) => {
      const k = Math.min(1, (t - t0) / duree);
      const lisse = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const u = depart + (cible - depart) * lisse;
      s.set({ curseur: u, annee: anneeAu(u) });
      if (k < 1) anim = requestAnimationFrame(pas);
    };
    anim = requestAnimationFrame(pas);
  };

  const actions = {
    /** Sélectionne une étape : le curseur s'y place et la carte s'y rend. */
    allerA(etapeId: string, section: Section = 0) {
      actions.pause();
      const u = uDeEtape(etapeId);
      s.set({ etapeActive: etapeId, curseur: u, annee: anneeAu(u), section });
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
      if (j === i && id) return;
      if (sens === 1 && id) {
        // Vers l'avant, le tracé avance jusqu'à l'étape suivante pendant que la caméra s'y rend.
        actions.pause();
        s.set({ etapeActive: etapes[j].id, section: 0 });
        animerVers(POSITIONS[j], 1600);
      } else {
        actions.allerA(etapes[j].id);
      }
    },

    /** Lecture automatique : le tracé avance d'une unité de frise par `duree` ms. */
    lire(duree = 900) {
      if (s.get().lecture) return;
      stopAnim();
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
        s.set({ curseur: u, annee: anneeAu(u), etapeActive: etapes[i].id, section: 0 });
        if (u >= U_MAX) s.set({ lecture: false });
        else anim = requestAnimationFrame(pas);
      };
      anim = requestAnimationFrame(pas);
    },

    pause() {
      stopAnim();
      if (s.get().lecture) s.set({ lecture: false });
    },

    // --- Parcours guidé : contexte historique, puis citations, puis étape suivante. ---

    /** Démarre le parcours à l'étape donnée (par défaut l'Annonciation). */
    commencerParcours(etapeId: string = etapes[0].id) {
      s.set({ mode: 'parcours' });
      actions.allerA(etapeId);
    },

    quitterParcours() {
      actions.pause();
      s.set({ mode: 'explorer', section: 0 });
    },

    /** Change de mode depuis les onglets du panneau. */
    choisirMode(mode: Mode) {
      if (mode === s.get().mode) return;
      if (mode === 'parcours') return actions.commencerParcours(s.get().etapeActive ?? undefined);
      actions.pause();
      s.set({ mode, section: 0 });
    },

    choisirEvangile(evangile: Evangile) {
      s.set({ evangile });
    },

    avancer() {
      const { section, etapeActive } = s.get();
      if (!etapeActive) return actions.commencerParcours();
      if (section < 1) s.set({ section: (section + 1) as Section });
      else actions.decaler(1);
    },

    reculer() {
      const { section, etapeActive } = s.get();
      if (!etapeActive) return;
      if (section > 0) s.set({ section: (section - 1) as Section });
      else if (indexDeEtape(etapeActive) > 0) actions.allerA(etapes[indexDeEtape(etapeActive) - 1].id, 1);
    },
  };
  return actions;
}

export type Actions = ReturnType<typeof creerActions>;
