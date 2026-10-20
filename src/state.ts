// État central de l'application. La carte, le panneau et (plus tard) la frise
// s'y abonnent ; aucun composant ne se parle directement.

export type Mode = 'explorer' | 'parcours' | 'comparer';

export interface EtatApp {
  /** Année affichée (négative = av. J.-C., 0 = Nativité par convention). */
  annee: number;
  /** Identifiant de l'étape sélectionnée, ou null. */
  etapeActive: string | null;
  mode: Mode;
}

type Ecouteur = (etat: EtatApp, avant: EtatApp) => void;

export interface Store {
  get(): EtatApp;
  set(modif: Partial<EtatApp>): void;
  /** Appelle `ecouteur` à chaque changement ; renvoie la fonction de désabonnement. */
  subscribe(ecouteur: Ecouteur): () => void;
  /** Appelle `ecouteur` seulement quand `cle` change. */
  on<K extends keyof EtatApp>(cle: K, ecouteur: (valeur: EtatApp[K], etat: EtatApp) => void): () => void;
}

export function creerStore(initial: EtatApp): Store {
  let etat = { ...initial };
  const ecouteurs = new Set<Ecouteur>();

  return {
    get: () => etat,
    set(modif) {
      const suivant = { ...etat, ...modif };
      const change = (Object.keys(modif) as (keyof EtatApp)[]).some((k) => suivant[k] !== etat[k]);
      if (!change) return;
      const avant = etat;
      etat = suivant;
      for (const e of [...ecouteurs]) e(etat, avant);
    },
    subscribe(ecouteur) {
      ecouteurs.add(ecouteur);
      return () => ecouteurs.delete(ecouteur);
    },
    on(cle, ecouteur) {
      return this.subscribe((e, avant) => {
        if (e[cle] !== avant[cle]) ecouteur(e[cle], e);
      });
    },
  };
}

export const ANNEE_DEBUT = -1;
export const ANNEE_FIN = 30;

export const store = creerStore({ annee: ANNEE_DEBUT, etapeActive: null, mode: 'explorer' });
