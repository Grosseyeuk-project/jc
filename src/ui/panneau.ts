import { etapeParId, etapes, formatAnnee, jalons, LIBELLE_CERTITUDE, lieuParId } from '../donnees';
import type { Actions } from '../actions';
import type { Store } from '../state';

const echapper = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function creerPanneau(racine: HTMLElement, store: Store, actions: Actions, carte: { recentrer: () => void }) {
  racine.innerHTML = `
    <header class="entete">
      <h1>Sur les traces de Jésus</h1>
      <p class="annee-courante" aria-live="polite"></p>
    </header>
    <section class="fiche" aria-live="polite"></section>
    <div class="navigation" hidden>
      <button type="button" class="nav-precedente">‹ Précédente</button>
      <button type="button" class="nav-suivante">Suivante ›</button>
    </div>
    <nav class="jalons" aria-label="Jalons">
      <h2>Jalons</h2>
      <ol></ol>
      <button type="button" class="recentrer">Vue d'ensemble</button>
    </nav>`;

  const anneeEl = racine.querySelector<HTMLElement>('.annee-courante')!;
  const fiche = racine.querySelector<HTMLElement>('.fiche')!;
  const liste = racine.querySelector<HTMLOListElement>('.jalons ol')!;
  const navigation = racine.querySelector<HTMLElement>('.navigation')!;
  const precedente = racine.querySelector<HTMLButtonElement>('.nav-precedente')!;
  const suivante = racine.querySelector<HTMLButtonElement>('.nav-suivante')!;
  precedente.addEventListener('click', () => actions.decaler(-1));
  suivante.addEventListener('click', () => actions.decaler(1));

  racine.querySelector('.recentrer')!.addEventListener('click', () => {
    actions.pause();
    store.set({ etapeActive: null });
    carte.recentrer();
  });

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

  const majFiche = (id: string | null) => {
    for (const b of liste.querySelectorAll<HTMLButtonElement>('button')) {
      const actif = b.dataset.etape === id;
      b.classList.toggle('actif', actif);
      b.setAttribute('aria-current', actif ? 'step' : 'false');
    }
    const e = id ? etapeParId.get(id) : undefined;
    // Sur mobile, la fiche est en haut du panneau : on y revient.
    racine.scrollTo({ top: 0, behavior: 'smooth' });
    if (!e) {
      navigation.hidden = true;
      fiche.innerHTML = `<p class="invite">Faites glisser la frise, lancez la lecture ▶ ou choisissez un lieu sur la carte.</p>`;
      return;
    }
    navigation.hidden = false;
    precedente.disabled = e.ordre === 1;
    suivante.disabled = e.ordre === etapes.length;
    const lieu = lieuParId.get(e.lieu);
    // La certitude dépend de l'événement, pas seulement du lieu (voir l'Ascension).
    const certitude = e.certitude_lieu;
    fiche.innerHTML = `
      <p class="fiche-ordre">Étape ${e.ordre} sur ${etapes.length}</p>
      <h2>${echapper(e.titre)}</h2>
      <p class="fiche-date">${echapper(e.date)}${e.precision === 'hypothese' ? ' <span class="etiquette">hypothèse</span>' : ''}</p>
      ${
        lieu
          ? `<p class="fiche-lieu"><strong>${echapper(lieu.nom)}</strong> · ${echapper(lieu.site)}</p>`
          : ''
      }
      <p><span class="certitude certitude-${certitude}">${LIBELLE_CERTITUDE[certitude]}</span></p>
      ${
        lieu && lieu.alternatives.length
          ? `<p class="fiche-alt">Autres sites proposés : ${lieu.alternatives.map(echapper).join(' ; ')}</p>`
          : ''
      }
      <p class="fiche-refs">${e.references.map(echapper).join(' · ')}</p>
      ${e.variante ? `<p class="fiche-variante"><strong>Variante :</strong> ${echapper(e.variante)}</p>` : ''}
      ${e.note ? `<p class="fiche-note"><strong>Note :</strong> ${echapper(e.note)}</p>` : ''}`;
  };

  const majAnnee = (annee: number) => (anneeEl.textContent = formatAnnee(annee));

  store.on('etapeActive', majFiche);
  store.on('annee', majAnnee);
  majFiche(store.get().etapeActive);
  majAnnee(store.get().annee);
}
