// Frise chronologique : glisser le curseur fait avancer le tracé ; les jalons
// sont cliquables ; la lecture déroule tout le voyage.
import type { Actions } from '../actions';
import { indexPlusProche, PHASES, POSITIONS, REPERES_ANNEES, U_MAX } from '../chronologie';
import { COULEURS_PHASES } from '../carte/trace';
import { etapes, formatAnnee } from '../donnees';
import { raconte } from '../evangiles';
import type { EtatApp, Store } from '../state';
import type { Phase } from '../types';

const NOMS_PHASES: Record<Phase, string> = {
  enfance: 'Enfance',
  ministere: 'Ministère',
  'vers-jerusalem': 'Vers Jérusalem',
  passion: 'Passion',
  resurrection: 'Résurrection',
};

const pct = (u: number) => `${((u / U_MAX) * 100).toFixed(3)}%`;

export function creerFrise(racine: HTMLElement, store: Store, actions: Actions) {
  racine.innerHTML = `
    <button type="button" class="frise-lecture" aria-label="Lancer la lecture"></button>
    <div class="frise-piste">
      <div class="frise-phases"></div>
      <div class="frise-rail"><div class="frise-parcouru"></div></div>
      <div class="frise-etapes"></div>
      <input type="range" class="frise-curseur" id="frise-curseur" min="0" max="${U_MAX}" step="0.01" aria-label="Avancer dans le temps" />
      <div class="frise-jalons"></div>
      <div class="frise-annees"></div>
    </div>`;

  const bouton = racine.querySelector<HTMLButtonElement>('.frise-lecture')!;
  const curseur = racine.querySelector<HTMLInputElement>('.frise-curseur')!;
  const parcouru = racine.querySelector<HTMLElement>('.frise-parcouru')!;

  // Bandes de phases.
  const phases = racine.querySelector('.frise-phases')!;
  for (const p of PHASES) {
    const b = document.createElement('div');
    b.className = `frise-phase phase-${p.phase}`;
    b.style.left = pct(p.debut);
    b.style.width = pct(p.fin - p.debut);
    b.style.setProperty('--couleur', COULEURS_PHASES[p.phase]);
    b.innerHTML = `<span>${NOMS_PHASES[p.phase]}</span>`;
    phases.append(b);
  }

  // Une graduation par étape ; les jalons sont des boutons au-dessus du curseur.
  const graduations = racine.querySelector('.frise-etapes')!;
  const jalons = racine.querySelector('.frise-jalons')!;
  const marques: HTMLElement[] = [];
  etapes.forEach((e, i) => {
    const m = document.createElement('span');
    m.className = 'frise-etape';
    m.style.left = pct(POSITIONS[i]);
    m.style.setProperty('--couleur', COULEURS_PHASES[e.phase]);
    m.title = `${e.ordre}. ${e.titre}`;
    graduations.append(m);
    marques.push(m);
    if (e.jalon) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'frise-jalon';
      b.style.left = pct(POSITIONS[i]);
      b.style.setProperty('--couleur', COULEURS_PHASES[e.phase]);
      b.dataset.etape = e.id;
      b.title = `${e.titre} (${e.date})`;
      b.setAttribute('aria-label', `${e.titre}, ${e.date}`);
      b.addEventListener('click', () => actions.allerA(e.id));
      jalons.append(b);
    }
  });

  // Repères d'années. Les plus serrés sont masqués sur petit écran.
  const annees = racine.querySelector('.frise-annees')!;
  REPERES_ANNEES.forEach((r, k) => {
    const s = document.createElement('span');
    const suivant = REPERES_ANNEES[k + 1];
    s.className = `frise-annee${suivant && suivant.u - r.u < 4 ? ' serre' : ''}`;
    s.style.left = pct(r.u);
    s.textContent = r.annee < 0 ? `${-r.annee} av.` : String(r.annee);
    s.title = formatAnnee(r.annee);
    annees.append(s);
  });

  // Gestes.
  curseur.addEventListener('input', () => actions.glisser(Number(curseur.value)));
  curseur.addEventListener('change', () => actions.relacher());
  curseur.addEventListener('keydown', (ev) => {
    const touches: Record<string, () => void> = {
      ArrowLeft: () => actions.decaler(-1),
      ArrowDown: () => actions.decaler(-1),
      ArrowRight: () => actions.decaler(1),
      ArrowUp: () => actions.decaler(1),
      Home: () => actions.allerA(etapes[0].id),
      End: () => actions.allerA(etapes[etapes.length - 1].id),
    };
    const f = touches[ev.key];
    if (f) {
      ev.preventDefault();
      f();
    }
  });
  bouton.addEventListener('click', () => (store.get().lecture ? actions.pause() : actions.lire()));

  // Abonnements.
  const majCurseur = (u: number) => {
    curseur.value = String(u);
    parcouru.style.width = pct(u);
    const i = indexPlusProche(u);
    const e = etapes[i];
    curseur.setAttribute('aria-valuetext', `Étape ${e.ordre} sur ${etapes.length} : ${e.titre}, ${formatAnnee(e.annee)}`);
    marques.forEach((m, k) => m.classList.toggle('atteinte', POSITIONS[k] <= u + 1e-6));
  };
  const majLecture = (lecture: boolean) => {
    bouton.classList.toggle('en-lecture', lecture);
    bouton.setAttribute('aria-label', lecture ? 'Mettre en pause' : 'Lancer la lecture');
    bouton.title = lecture ? 'Pause' : 'Lecture du voyage';
  };
  const majEtape = (id: string | null) => {
    for (const b of jalons.querySelectorAll<HTMLButtonElement>('button')) b.classList.toggle('actif', b.dataset.etape === id);
  };

  // Mode comparer : étapes absentes de l'évangile estompées, variantes signalées.
  const majComparer = (etat: EtatApp) => {
    const comparer = etat.mode === 'comparer';
    racine.classList.toggle('en-comparaison', comparer);
    marques.forEach((m, k) => {
      m.classList.toggle('absent', comparer && !raconte(etapes[k], etat.evangile));
      m.classList.toggle('variante', comparer && !!etapes[k].variante);
    });
    for (const b of jalons.querySelectorAll<HTMLButtonElement>('button')) {
      const e = etapes.find((x) => x.id === b.dataset.etape)!;
      b.classList.toggle('absent', comparer && !raconte(e, etat.evangile));
    }
  };
  store.subscribe((etat, avant) => {
    if (etat.mode !== avant.mode || etat.evangile !== avant.evangile) majComparer(etat);
  });
  majComparer(store.get());

  store.on('curseur', majCurseur);
  store.on('lecture', majLecture);
  store.on('etapeActive', majEtape);
  majCurseur(store.get().curseur);
  majLecture(store.get().lecture);
  majEtape(store.get().etapeActive);
}
