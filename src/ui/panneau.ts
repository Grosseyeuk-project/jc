import { etapeParId, formatAnnee, jalons, LIBELLE_CERTITUDE, lieuParId } from '../donnees';
import type { Store } from '../state';

const echapper = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function creerPanneau(racine: HTMLElement, store: Store, actions: { recentrer: () => void }) {
  racine.innerHTML = `
    <header class="entete">
      <h1>Sur les traces de Jésus</h1>
      <p class="annee-courante" aria-live="polite"></p>
    </header>
    <section class="fiche" aria-live="polite"></section>
    <nav class="jalons" aria-label="Jalons">
      <h2>Jalons</h2>
      <ol></ol>
      <button type="button" class="recentrer">Vue d'ensemble</button>
    </nav>`;

  const anneeEl = racine.querySelector<HTMLElement>('.annee-courante')!;
  const fiche = racine.querySelector<HTMLElement>('.fiche')!;
  const liste = racine.querySelector<HTMLOListElement>('.jalons ol')!;

  racine.querySelector('.recentrer')!.addEventListener('click', () => {
    store.set({ etapeActive: null });
    actions.recentrer();
  });

  for (const e of jalons) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.etape = e.id;
    b.innerHTML = `<span class="jalon-annee">${echapper(formatAnnee(e.annee))}</span><span class="jalon-titre">${echapper(e.titre)}</span>`;
    b.addEventListener('click', () => store.set({ etapeActive: e.id, annee: e.annee }));
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
      fiche.innerHTML = `<p class="invite">Choisissez un jalon dans la liste ou sur la carte.</p>`;
      return;
    }
    const lieu = lieuParId.get(e.lieu);
    // La certitude dépend de l'événement, pas seulement du lieu (voir l'Ascension).
    const certitude = e.certitude_lieu;
    fiche.innerHTML = `
      <p class="fiche-ordre">Étape ${e.ordre} sur 46</p>
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
