// Horloge de la Passion : quand une étape de la Passion est active, une réglette
// du jeudi 18 h au vendredi 18 h place les six étapes à leur heure (supposée).
import type { Actions } from '../actions';
import { etapeParId } from '../donnees';
import { DUREE_PASSION, ETAPES_PASSION, formatHeure, heuresDepuisJeudi, NUIT, REPERES_HEURES } from '../passion';
import type { Store } from '../state';

const pct = (t: number) => `${((t / DUREE_PASSION) * 100).toFixed(2)}%`;

export function creerHorloge(racine: HTMLElement, store: Store, actions: Actions) {
  racine.innerHTML = `
    <p class="horloge-titre">Jeudi 6 – vendredi 7 avril 30 <span>heure par heure, heures supposées</span></p>
    <div class="horloge-piste">
      <div class="horloge-nuit" style="left:${pct(NUIT.debut)};width:${pct(NUIT.fin - NUIT.debut)}" title="Nuit"></div>
      <div class="horloge-aiguille"></div>
      <div class="horloge-reperes"></div>
      <div class="horloge-etapes"></div>
    </div>`;

  const reperes = racine.querySelector('.horloge-reperes')!;
  for (const r of REPERES_HEURES) {
    const s = document.createElement('span');
    s.style.left = pct(r.t);
    s.textContent = r.libelle;
    reperes.append(s);
  }

  const boutons = racine.querySelector('.horloge-etapes')!;
  for (const e of ETAPES_PASSION) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.etape = e.id;
    b.style.left = pct(heuresDepuisJeudi(e)!);
    b.title = `${e.titre} : ${formatHeure(e)}`;
    b.setAttribute('aria-label', b.title);
    b.textContent = String(e.ordre);
    b.addEventListener('click', () => actions.allerA(e.id));
    boutons.append(b);
  }

  const aiguille = racine.querySelector<HTMLElement>('.horloge-aiguille')!;
  const maj = (id: string | null) => {
    const e = id ? etapeParId.get(id) : undefined;
    const t = e ? heuresDepuisJeudi(e) : null;
    racine.hidden = t === null;
    if (t === null) return;
    aiguille.style.left = pct(t);
    for (const b of boutons.querySelectorAll<HTMLButtonElement>('button')) b.classList.toggle('actif', b.dataset.etape === id);
  };
  store.on('etapeActive', maj);
  maj(store.get().etapeActive);
}
