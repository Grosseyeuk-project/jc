import type { Actions } from '../actions';
import { citations, etapeParId, etapes, formatAnnee, jalons, LIBELLE_CERTITUDE, lieuParId, textes } from '../donnees';
import type { EtatApp, Section, Store } from '../state';
import type { Etape } from '../types';

const echapper = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const SECTIONS: { titre: string; suivant: string }[] = [
  { titre: 'Contexte historique', suivant: 'Méditation' },
  { titre: 'Méditation', suivant: 'Citations' },
  { titre: 'Citations', suivant: 'Étape suivante' },
];

/** Une citation est un extrait : on signale les coupes en début et en fin de phrase. */
export function extrait(texte: string): string {
  let t = texte;
  if (/^[a-zà-ÿ]/.test(t)) t = `… ${t}`;
  if (/[,;:]$/.test(t)) t = `${t.slice(0, -1)}…`;
  return t;
}

function blocCitations(e: Etape): string {
  return textes[e.id].citations
    .map(
      (ref) => `
      <figure class="citation">
        <blockquote>${echapper(extrait(citations[ref]))}</blockquote>
        <figcaption>${echapper(ref)}</figcaption>
      </figure>`,
    )
    .join('');
}

function enTete(e: Etape): string {
  const lieu = lieuParId.get(e.lieu);
  const certitude = e.certitude_lieu; // dépend de l'événement, pas seulement du lieu
  return `
    <p class="fiche-ordre">Étape ${e.ordre} sur ${etapes.length}</p>
    <h2>${echapper(e.titre)}</h2>
    <p class="fiche-date">${echapper(e.date)}${e.precision === 'hypothese' ? ' <span class="etiquette">hypothèse</span>' : ''}</p>
    ${lieu ? `<p class="fiche-lieu"><strong>${echapper(lieu.nom)}</strong> · ${echapper(lieu.site)}</p>` : ''}
    <p class="fiche-meta"><span class="certitude certitude-${certitude}">${LIBELLE_CERTITUDE[certitude]}</span>
      <span class="fiche-refs">${e.references.map(echapper).join(' · ')}</span></p>`;
}

function annexes(e: Etape): string {
  const lieu = lieuParId.get(e.lieu);
  return [
    lieu && lieu.alternatives.length
      ? `<p class="fiche-alt">Autres sites proposés : ${lieu.alternatives.map(echapper).join(' ; ')}</p>`
      : '',
    e.variante ? `<p class="fiche-variante"><strong>Variante :</strong> ${echapper(e.variante)}</p>` : '',
    e.note ? `<p class="fiche-note"><strong>Note :</strong> ${echapper(e.note)}</p>` : '',
  ].join('');
}

export function creerPanneau(racine: HTMLElement, store: Store, actions: Actions, carte: { recentrer: () => void }) {
  racine.innerHTML = `
    <header class="entete">
      <h1>Sur les traces de Jésus</h1>
      <p class="annee-courante" aria-live="polite"></p>
    </header>
    <div class="bandeau-parcours" hidden>
      <div class="progression" role="progressbar" aria-label="Avancement du parcours" aria-valuemin="1" aria-valuemax="${etapes.length}"><span></span></div>
      <button type="button" class="quitter">Quitter le parcours</button>
    </div>
    <button type="button" class="lancer-parcours">Commencer le parcours guidé</button>
    <section class="fiche" aria-live="polite"></section>
    <div class="navigation" hidden>
      <button type="button" class="nav-precedente"></button>
      <button type="button" class="nav-suivante"></button>
    </div>
    <nav class="jalons" aria-label="Jalons">
      <h2>Jalons</h2>
      <ol></ol>
      <button type="button" class="recentrer">Vue d'ensemble</button>
    </nav>`;

  const $ = <T extends HTMLElement>(sel: string) => racine.querySelector<T>(sel)!;
  const anneeEl = $('.annee-courante');
  const fiche = $('.fiche');
  const liste = $<HTMLOListElement>('.jalons ol');
  const jalonsNav = $('.jalons');
  const navigation = $('.navigation');
  const precedente = $<HTMLButtonElement>('.nav-precedente');
  const suivante = $<HTMLButtonElement>('.nav-suivante');
  const bandeau = $('.bandeau-parcours');
  const progression = $('.progression');
  const lancer = $<HTMLButtonElement>('.lancer-parcours');

  lancer.addEventListener('click', () => actions.commencerParcours(store.get().etapeActive ?? undefined));
  $('.quitter').addEventListener('click', () => actions.quitterParcours());
  $('.recentrer').addEventListener('click', () => {
    actions.pause();
    store.set({ etapeActive: null });
    carte.recentrer();
  });
  precedente.addEventListener('click', () => (store.get().mode === 'parcours' ? actions.reculer() : actions.decaler(-1)));
  suivante.addEventListener('click', () => (store.get().mode === 'parcours' ? actions.avancer() : actions.decaler(1)));

  for (const e of jalons) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.etape = e.id;
    b.innerHTML = `<span class="jalon-annee">${echapper(formatAnnee(e.annee))}</span><span class="jalon-titre">${echapper(e.titre)}</span>`;
    b.addEventListener('click', () => actions.allerA(e.id));
    li.append(b);
    liste.append(li);
  }

  // Au clavier, ← et → suivent le parcours (hors champs de saisie et frise), Échap le quitte.
  document.addEventListener('keydown', (ev) => {
    if (store.get().mode !== 'parcours' || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    if ((ev.target as HTMLElement).closest('input, textarea, select')) return;
    if (ev.key === 'ArrowRight') actions.avancer();
    else if (ev.key === 'ArrowLeft') actions.reculer();
    else if (ev.key === 'Escape') actions.quitterParcours();
    else return;
    ev.preventDefault();
  });

  let dernierId: string | null | undefined;
  const maj = (etat: EtatApp) => {
    const { etapeActive: id, mode, section } = etat;
    const parcours = mode === 'parcours';
    const e = id ? etapeParId.get(id) : undefined;

    bandeau.hidden = !parcours;
    lancer.hidden = parcours;
    jalonsNav.hidden = parcours;
    racine.classList.toggle('en-parcours', parcours);
    lancer.textContent = e ? 'Suivre le parcours depuis cette étape' : 'Commencer le parcours guidé';

    for (const b of liste.querySelectorAll<HTMLButtonElement>('button')) {
      const actif = b.dataset.etape === id;
      b.classList.toggle('actif', actif);
      b.setAttribute('aria-current', actif ? 'step' : 'false');
    }

    // Sur mobile, la fiche est en haut du panneau : on y revient à chaque nouvelle étape.
    if (id !== dernierId) racine.scrollTo({ top: 0, behavior: 'smooth' });
    dernierId = id;

    if (!e) {
      navigation.hidden = true;
      fiche.innerHTML = `<p class="invite">Faites glisser la frise, lancez la lecture ou choisissez un lieu sur la carte. Le parcours guidé raconte les ${etapes.length} étapes une à une.</p>`;
      return;
    }

    navigation.hidden = false;
    const t = textes[e.id];
    if (parcours) {
      progression.setAttribute('aria-valuenow', String(e.ordre));
      progression.setAttribute('aria-valuetext', `Étape ${e.ordre} sur ${etapes.length}`);
      progression.querySelector('span')!.style.width = `${(e.ordre / etapes.length) * 100}%`;
      const corps = [
        `<p class="fiche-histoire">${echapper(t.histoire)}</p>${annexes(e)}`,
        `<p class="fiche-meditation">${echapper(t.meditation)}</p>`,
        blocCitations(e),
      ][section];
      fiche.innerHTML = `
        ${enTete(e)}
        <ol class="onglets" aria-label="Parties de l'étape">
          ${SECTIONS.map(
            (s, k) =>
              `<li><button type="button" data-section="${k}"${k === section ? ' aria-current="step" class="actif"' : ''}>${s.titre}</button></li>`,
          ).join('')}
        </ol>
        <div class="fiche-corps">${corps}</div>`;
      for (const b of fiche.querySelectorAll<HTMLButtonElement>('.onglets button')) {
        b.addEventListener('click', () => store.set({ section: Number(b.dataset.section) as Section }));
      }
      precedente.textContent = section > 0 ? `‹ ${SECTIONS[section - 1].titre}` : '‹ Étape précédente';
      precedente.disabled = section === 0 && e.ordre === 1;
      const fin = section === 2 && e.ordre === etapes.length;
      suivante.textContent = fin ? 'Fin du parcours' : `${SECTIONS[section].suivant} ›`;
      suivante.disabled = fin;
    } else {
      fiche.innerHTML = `
        ${enTete(e)}
        <h3>Contexte historique</h3>
        <p class="fiche-histoire">${echapper(t.histoire)}</p>
        ${annexes(e)}
        <h3>Méditation</h3>
        <p class="fiche-meditation">${echapper(t.meditation)}</p>
        <h3>Citations</h3>
        ${blocCitations(e)}`;
      precedente.textContent = '‹ Précédente';
      suivante.textContent = 'Suivante ›';
      precedente.disabled = e.ordre === 1;
      suivante.disabled = e.ordre === etapes.length;
    }
  };

  const majAnnee = (annee: number) => (anneeEl.textContent = formatAnnee(annee));

  store.subscribe((etat, avant) => {
    if (etat.etapeActive !== avant.etapeActive || etat.mode !== avant.mode || etat.section !== avant.section) maj(etat);
  });
  store.on('annee', majAnnee);
  maj(store.get());
  majAnnee(store.get().annee);
}
