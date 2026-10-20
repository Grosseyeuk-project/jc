import type { Actions } from '../actions';
import { citations, etapeParId, etapes, formatAnnee, jalons, LIBELLE_CERTITUDE, lieuParId, textes } from '../donnees';
import { etapesAVariante, EVANGILES, indicesSelon, NOMS_EVANGILES, referencesSelon } from '../evangiles';
import { formatHeure } from '../passion';
import type { EtatApp, Mode, Section, Store } from '../state';
import type { Etape } from '../types';

const echapper = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const SECTIONS: { titre: string; suivant: string }[] = [
  { titre: 'Contexte historique', suivant: 'Citations' },
  { titre: 'Citations', suivant: 'Étape suivante' },
];

const MODES: { mode: Mode; libelle: string }[] = [
  { mode: 'explorer', libelle: 'Explorer' },
  { mode: 'parcours', libelle: 'Parcours guidé' },
  { mode: 'comparer', libelle: 'Comparer' },
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
  const heure = formatHeure(e);
  return `
    <p class="fiche-ordre">Étape ${e.ordre} sur ${etapes.length}</p>
    <h2>${echapper(e.titre)}</h2>
    <p class="fiche-date">${echapper(e.date)}${heure ? ` · ${echapper(heure)}` : ''}${e.precision === 'hypothese' ? ' <span class="etiquette">hypothèse</span>' : ''}</p>
    ${lieu ? `<p class="fiche-lieu"><strong>${echapper(lieu.nom)}</strong> · ${echapper(lieu.site)}</p>` : ''}
    <p class="fiche-meta"><span class="certitude certitude-${certitude}">${LIBELLE_CERTITUDE[certitude]}</span>
      <span class="fiche-refs">${e.references.map(echapper).join(' · ')}</span></p>`;
}

function annexes(e: Etape, avecVariante = true): string {
  const lieu = lieuParId.get(e.lieu);
  return [
    lieu && lieu.alternatives.length
      ? `<p class="fiche-alt">Autres sites proposés : ${lieu.alternatives.map(echapper).join(' ; ')}</p>`
      : '',
    avecVariante && e.variante ? `<p class="fiche-variante"><strong>Variante :</strong> ${echapper(e.variante)}</p>` : '',
    e.note ? `<p class="fiche-note"><strong>Note :</strong> ${echapper(e.note)}</p>` : '',
  ].join('');
}

/** Tableau « qui raconte quoi » pour une étape. */
function selonLesEvangiles(e: Etape, choisi: string): string {
  const lignes = EVANGILES.map((g) => {
    const refs = referencesSelon(e, g);
    return `<tr class="${g === choisi ? 'choisi' : ''}${refs.length ? '' : ' muet'}">
      <th scope="row">${NOMS_EVANGILES[g]}</th>
      <td>${refs.length ? refs.map(echapper).join(' · ') : '<span aria-label="ne raconte pas cet épisode">—</span>'}</td>
    </tr>`;
  }).join('');
  const autres = e.references.filter((r) => !EVANGILES.some((g) => r.startsWith(`${g} `)));
  return `
    <h3>Selon les évangiles</h3>
    <table class="selon">${lignes}</table>
    ${autres.length ? `<p class="fiche-alt">Aussi : ${autres.map(echapper).join(' · ')}</p>` : ''}
    ${e.variante ? `<p class="encart-variante"><strong>Ce qui diffère :</strong> ${echapper(e.variante)}</p>` : ''}`;
}

export function creerPanneau(racine: HTMLElement, store: Store, actions: Actions, carte: { recentrer: () => void }) {
  racine.innerHTML = `
    <header class="entete">
      <h1>Sur les traces de Jésus</h1>
      <p class="annee-courante" aria-live="polite"></p>
    </header>
    <div class="modes" role="group" aria-label="Mode">
      ${MODES.map((m) => `<button type="button" data-mode="${m.mode}">${m.libelle}</button>`).join('')}
    </div>
    <div class="bandeau-parcours" hidden>
      <div class="progression" role="progressbar" aria-label="Avancement du parcours" aria-valuemin="1" aria-valuemax="${etapes.length}"><span></span></div>
      <button type="button" class="quitter">Quitter le parcours</button>
    </div>
    <section class="comparer" hidden aria-label="Comparer les évangiles">
      <div class="evangiles" role="radiogroup" aria-label="Évangile">
        ${EVANGILES.map((g) => `<button type="button" role="radio" data-evangile="${g}" title="${NOMS_EVANGILES[g]}">${g}</button>`).join('')}
      </div>
      <p class="comparer-resume"></p>
    </section>
    <button type="button" class="lancer-parcours" hidden>Suivre le parcours depuis cette étape</button>
    <section class="fiche" aria-live="polite"></section>
    <div class="navigation" hidden>
      <button type="button" class="nav-precedente"></button>
      <button type="button" class="nav-suivante"></button>
    </div>
    <nav class="jalons" aria-label="Jalons">
      <h2>Jalons</h2>
      <ol></ol>
      <button type="button" class="recentrer">Vue d'ensemble</button>
    </nav>
    <nav class="variantes" aria-label="Étapes à variantes" hidden>
      <h2>Récits qui diffèrent <span>(${etapesAVariante.length})</span></h2>
      <ol></ol>
    </nav>`;

  const $ = <T extends HTMLElement>(sel: string) => racine.querySelector<T>(sel)!;
  const anneeEl = $('.annee-courante');
  const fiche = $('.fiche');
  const liste = $<HTMLOListElement>('.jalons ol');
  const jalonsNav = $('.jalons');
  const variantesNav = $('.variantes');
  const navigation = $('.navigation');
  const precedente = $<HTMLButtonElement>('.nav-precedente');
  const suivante = $<HTMLButtonElement>('.nav-suivante');
  const bandeau = $('.bandeau-parcours');
  const progression = $('.progression');
  const lancer = $<HTMLButtonElement>('.lancer-parcours');
  const comparer = $('.comparer');
  const resume = $('.comparer-resume');

  for (const b of racine.querySelectorAll<HTMLButtonElement>('.modes button')) {
    b.addEventListener('click', () => actions.choisirMode(b.dataset.mode as Mode));
  }
  for (const b of racine.querySelectorAll<HTMLButtonElement>('.evangiles button')) {
    b.addEventListener('click', () => actions.choisirEvangile(b.dataset.evangile as (typeof EVANGILES)[number]));
  }
  lancer.addEventListener('click', () => actions.commencerParcours(store.get().etapeActive ?? undefined));
  $('.quitter').addEventListener('click', () => actions.quitterParcours());
  $('.recentrer').addEventListener('click', () => {
    actions.pause();
    store.set({ etapeActive: null });
    carte.recentrer();
  });
  precedente.addEventListener('click', () => (store.get().mode === 'parcours' ? actions.reculer() : actions.decaler(-1)));
  suivante.addEventListener('click', () => (store.get().mode === 'parcours' ? actions.avancer() : actions.decaler(1)));

  const boutonEtape = (e: Etape, gauche: string) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.etape = e.id;
    b.innerHTML = `<span class="jalon-annee">${echapper(gauche)}</span><span class="jalon-titre">${echapper(e.titre)}</span>`;
    b.addEventListener('click', () => actions.allerA(e.id));
    li.append(b);
    return li;
  };
  for (const e of jalons) liste.append(boutonEtape(e, formatAnnee(e.annee)));
  for (const e of etapesAVariante) $('.variantes ol').append(boutonEtape(e, `${e.ordre}.`));

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
    const { etapeActive: id, mode, section, evangile } = etat;
    const e = id ? etapeParId.get(id) : undefined;

    for (const b of racine.querySelectorAll<HTMLButtonElement>('.modes button')) {
      const actif = b.dataset.mode === mode;
      b.classList.toggle('actif', actif);
      b.setAttribute('aria-pressed', String(actif));
    }
    for (const b of racine.querySelectorAll<HTMLButtonElement>('.evangiles button')) {
      const actif = b.dataset.evangile === evangile;
      b.classList.toggle('actif', actif);
      b.setAttribute('aria-checked', String(actif));
    }
    bandeau.hidden = mode !== 'parcours';
    comparer.hidden = mode !== 'comparer';
    jalonsNav.hidden = mode !== 'explorer';
    variantesNav.hidden = mode !== 'comparer';
    lancer.hidden = mode !== 'explorer' || !e;
    racine.dataset.mode = mode;

    if (mode === 'comparer') {
      const n = indicesSelon(evangile).length;
      const nv = etapesAVariante.filter((v) => referencesSelon(v, evangile).length).length;
      resume.textContent = `${NOMS_EVANGILES[evangile]} raconte ${n} des ${etapes.length} étapes, dont ${nv} dont le récit diffère d'un évangile à l'autre. Sur la carte, le tracé ne relie que ses étapes.`;
    }

    for (const b of racine.querySelectorAll<HTMLButtonElement>('.jalons ol button, .variantes ol button')) {
      const actif = b.dataset.etape === id;
      b.classList.toggle('actif', actif);
      b.setAttribute('aria-current', actif ? 'step' : 'false');
    }

    // Sur mobile, la fiche est en haut du panneau : on y revient à chaque nouvelle étape.
    if (id !== dernierId) racine.scrollTo({ top: 0, behavior: 'smooth' });
    dernierId = id;

    if (!e) {
      navigation.hidden = true;
      fiche.innerHTML =
        mode === 'comparer'
          ? `<p class="invite">Choisissez un évangile, puis une étape sur la carte, sur la frise ou dans la liste ci-dessous.</p>`
          : `<p class="invite">Faites glisser la frise, lancez la lecture ou choisissez un lieu sur la carte. Le parcours guidé raconte les ${etapes.length} étapes une à une.</p>`;
      return;
    }

    navigation.hidden = false;
    const t = textes[e.id];
    if (mode === 'parcours') {
      progression.setAttribute('aria-valuenow', String(e.ordre));
      progression.setAttribute('aria-valuetext', `Étape ${e.ordre} sur ${etapes.length}`);
      progression.querySelector('span')!.style.width = `${(e.ordre / etapes.length) * 100}%`;
      const corps = [
        `<p class="fiche-histoire">${echapper(t.histoire)}</p>${annexes(e)}`,
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
      const fin = section === SECTIONS.length - 1 && e.ordre === etapes.length;
      suivante.textContent = fin ? 'Fin du parcours' : `${SECTIONS[section].suivant} ›`;
      suivante.disabled = fin;
      return;
    }

    if (mode === 'comparer') {
      fiche.innerHTML = `
        ${enTete(e)}
        ${selonLesEvangiles(e, evangile)}
        <h3>Contexte historique</h3>
        <p class="fiche-histoire">${echapper(t.histoire)}</p>
        ${annexes(e, false)}`;
    } else {
      fiche.innerHTML = `
        ${enTete(e)}
        <h3>Contexte historique</h3>
        <p class="fiche-histoire">${echapper(t.histoire)}</p>
        ${annexes(e)}
        <h3>Citations</h3>
        ${blocCitations(e)}`;
    }
    precedente.textContent = '‹ Précédente';
    suivante.textContent = 'Suivante ›';
    precedente.disabled = e.ordre === 1;
    suivante.disabled = e.ordre === etapes.length;
  };

  const majAnnee = (annee: number) => (anneeEl.textContent = formatAnnee(annee));

  store.subscribe((etat, avant) => {
    if (
      etat.etapeActive !== avant.etapeActive ||
      etat.mode !== avant.mode ||
      etat.section !== avant.section ||
      etat.evangile !== avant.evangile
    )
      maj(etat);
  });
  store.on('annee', majAnnee);
  maj(store.get());
  majAnnee(store.get().annee);
}
