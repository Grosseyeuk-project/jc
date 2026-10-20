import * as maplibregl from 'maplibre-gl';
import type { LngLatLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre 6 charge son worker à part : Vite le construit et nous donne son adresse.
import urlWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import frontieres from '../data/frontieres.json';
import { etapeParId, formatAnnee, jalons, jalonsDuLieu, LIBELLE_CERTITUDE, lieuParId, villes } from '../donnees';
import type { Store } from '../state';
import type { Lieu } from '../types';
import { creerStyle } from './style';

const VUE_INITIALE = { center: [35.45, 32.15] as LngLatLike, zoom: 7.3 };
const LIMITES: [[number, number], [number, number]] = [[33.0, 29.6], [37.8, 34.0]];

/** [lat, lon] (format des données) → [lon, lat] (format MapLibre). */
const versLngLat = ([lat, lon]: [number, number]): [number, number] => [lon, lat];

function cercle(lieu: Lieu, pas = 48): GeoJSON.Feature {
  const [lat, lon] = lieu.coord;
  const r = lieu.rayon_km ?? 1;
  const dLat = r / 110.574;
  const dLon = r / (111.32 * Math.cos((lat * Math.PI) / 180));
  const anneau: [number, number][] = [];
  for (let i = 0; i <= pas; i++) {
    const a = (i / pas) * 2 * Math.PI;
    anneau.push([lon + dLon * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: 'Feature', properties: { id: lieu.id }, geometry: { type: 'Polygon', coordinates: [anneau] } };
}

function element(tag: string, classe: string, texte?: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = classe;
  if (texte) el.textContent = texte;
  return el;
}

maplibregl.setWorkerUrl(urlWorker);

export function creerCarte(conteneur: HTMLElement, store: Store) {
  const carte = new maplibregl.Map({
    container: conteneur,
    style: creerStyle(new URL(import.meta.env.BASE_URL, location.href).href),
    ...VUE_INITIALE,
    minZoom: 6,
    maxZoom: 15,
    maxBounds: LIMITES,
    attributionControl: { compact: true },
    dragRotate: false,
    pitchWithRotate: false,
  });
  carte.touchZoomRotate.disableRotation();
  carte.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  carte.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

  // Le niveau de zoom pilote, en CSS, quelles étiquettes sont visibles.
  const majZoom = () => (conteneur.dataset.zoom = String(Math.floor(carte.getZoom())));
  carte.on('zoom', majZoom);
  majZoom();

  // Régions antiques : étiquettes en lettres espacées.
  for (const f of (frontieres as GeoJSON.FeatureCollection).features) {
    const p = f.properties as { nom: string; statut: string; etiquette: [number, number] };
    const el = element('div', 'etiquette-region', p.nom);
    el.title = p.statut;
    new maplibregl.Marker({ element: el }).setLngLat(p.etiquette).addTo(carte);
  }

  // Villes principales.
  for (const v of villes) {
    const gauche = v.etiquette === 'gauche';
    const el = element('div', `ville rang-${v.rang}${gauche ? ' gauche' : ''}`);
    el.dataset.ville = v.id;
    el.append(element('span', 'ville-point'), element('span', 'ville-nom', v.nom));
    new maplibregl.Marker({ element: el, anchor: gauche ? 'right' : 'left', offset: [gauche ? 4 : -4, 0] }).setLngLat(versLngLat(v.coord)).addTo(carte);
  }

  // Zones (lieux de type « zone ») : un disque en pointillés.
  const zones = [...new Set(jalons.map((e) => e.lieu))].map((id) => lieuParId.get(id)).filter((l) => l?.type === 'zone') as Lieu[];
  carte.on('load', () => {
    carte.addSource('zones', { type: 'geojson', data: { type: 'FeatureCollection', features: zones.map((z) => cercle(z)) } });
    carte.addLayer({ id: 'zones-aplat', type: 'fill', source: 'zones', paint: { 'fill-color': '#8a2f1d', 'fill-opacity': 0.1 } });
    carte.addLayer({
      id: 'zones-trait',
      type: 'line',
      source: 'zones',
      paint: { 'line-color': '#8a2f1d', 'line-width': 1.2, 'line-dasharray': [2, 2] },
    });
  });

  // Marqueurs des lieux jalons. Les lieux aux mêmes coordonnées (Golgotha et le
  // tombeau, tous deux dans le Saint-Sépulcre) partagent un seul marqueur.
  const groupes = new Map<string, Lieu[]>();
  for (const lieuId of new Set(jalons.map((e) => e.lieu))) {
    const lieu = lieuParId.get(lieuId);
    if (!lieu) continue;
    const cle = lieu.coord.join(',');
    groupes.set(cle, [...(groupes.get(cle) ?? []), lieu]);
  }

  const marqueurs: { el: HTMLElement; lieux: Set<string> }[] = [];
  const popup = new maplibregl.Popup({ closeButton: false, offset: 16, className: 'popup-lieu' });
  for (const groupe of groupes.values()) {
    const nom = groupe.map((l) => l.nom).join(' · ');
    const etapesIci = jalons.filter((e) => groupe.some((l) => l.id === e.lieu));
    const debattu = groupe.some((l) => l.certitude === 'debattu');
    const bouton = element('button', `marqueur certitude-${debattu ? 'debattu' : groupe[0].certitude}`) as HTMLButtonElement;
    bouton.type = 'button';
    bouton.setAttribute('aria-label', `${nom} — ${etapesIci.map((e) => e.titre).join(', ')}`);
    bouton.append(element('span', 'marqueur-disque'));
    if (debattu) {
      const pastille = element('span', 'pastille-debattu', '?');
      pastille.title = LIBELLE_CERTITUDE.debattu;
      bouton.append(pastille);
    }
    bouton.append(element('span', 'marqueur-nom', nom));
    bouton.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (etapesIci.length === 1) {
        choisir(etapesIci[0].id);
        return;
      }
      // Plusieurs jalons au même endroit (ex. mont des Oliviers) : on laisse choisir.
      const liste = element('div', 'choix-etapes');
      liste.append(element('div', 'choix-titre', nom));
      for (const e of etapesIci) {
        const b = element('button', 'choix-etape') as HTMLButtonElement;
        b.type = 'button';
        b.append(element('span', 'choix-ordre', String(e.ordre)), document.createTextNode(e.titre));
        b.addEventListener('click', () => {
          popup.remove();
          choisir(e.id);
        });
        liste.append(b);
      }
      popup.setLngLat(versLngLat(groupe[0].coord)).setDOMContent(liste).addTo(carte);
    });
    new maplibregl.Marker({ element: bouton, anchor: 'center' }).setLngLat(versLngLat(groupe[0].coord)).addTo(carte);
    marqueurs.push({ el: bouton, lieux: new Set(groupe.map((l) => l.id)) });
  }

  function choisir(etapeId: string) {
    const e = etapeParId.get(etapeId);
    if (e) store.set({ etapeActive: e.id, annee: e.annee });
  }

  // --- Abonnements à l'état central ---

  store.on('etapeActive', (id) => {
    const lieuActif = id ? etapeParId.get(id)?.lieu : undefined;
    for (const { el, lieux } of marqueurs) el.classList.toggle('actif', !!lieuActif && lieux.has(lieuActif));
    const etape = id ? etapeParId.get(id) : undefined;
    const lieu = etape ? lieuParId.get(etape.lieu) : undefined;
    if (!lieu) return;
    // Les lieux de la Passion sont à quelques centaines de mètres : on zoome davantage.
    const zoom = etape!.phase === 'passion' || etape!.phase === 'resurrection' ? 12.5 : 10;
    carte.flyTo({ center: versLngLat(lieu.coord), zoom, speed: 0.9, curve: 1.5, essential: true });
  });

  // Les lieux dont aucun jalon n'est encore atteint à l'année courante sont estompés.
  const majAnnee = (annee: number) => {
    for (const { el, lieux } of marqueurs) {
      const premier = Math.min(...[...lieux].flatMap((id) => jalonsDuLieu(id).map((e) => e.annee)));
      el.classList.toggle('a-venir', premier > annee);
      el.title = premier > annee ? `À venir (${formatAnnee(premier)})` : '';
    }
  };
  store.on('annee', majAnnee);
  majAnnee(store.get().annee);

  return {
    carte,
    recentrer: () => carte.flyTo({ ...VUE_INITIALE, speed: 1.2 }),
  };
}
