import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, LngLatLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre 6 charge son worker à part : Vite le construit et nous donne son adresse.
import urlWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { Actions } from '../actions';
import { indexDeEtape, positionAu } from '../chronologie';
import frontieres from '../data/frontieres.json';
import { etapeParId, etapes, formatAnnee, LIBELLE_CERTITUDE, lieuParId, lieux, villes } from '../donnees';
import type { EtatApp, Store } from '../state';
import type { Lieu } from '../types';
import { creerStyle } from './style';
import { COULEURS_PHASES, TRACE_COMPLETE, traceAu } from './trace';

maplibregl.setWorkerUrl(urlWorker);

const VUE_INITIALE = { center: [35.45, 32.15] as LngLatLike, zoom: 7.3 };
// Jusqu'au Vieux-Caire à l'ouest, pour la fuite en Égypte.
const LIMITES: [[number, number], [number, number]] = [[29.8, 28.8], [38.2, 34.4]];
// Lieux à moins de 3 km du Temple : on zoome davantage pour les distinguer.
const JERUSALEM: [number, number] = [31.7781, 35.2358];

/** [lat, lon] (format des données) → [lon, lat] (format MapLibre). */
const versLngLat = ([lat, lon]: [number, number]): [number, number] => [lon, lat];

const distanceKm = ([a, b]: [number, number], [c, d]: [number, number]) =>
  Math.hypot((a - c) * 110.6, (b - d) * 111.3 * Math.cos((a * Math.PI) / 180));

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

const couleurParPhase = ['match', ['get', 'phase'], ...Object.entries(COULEURS_PHASES).flat(), '#8b5e3c'] as never;

export function creerCarte(conteneur: HTMLElement, store: Store, actions: Actions) {
  const carte = new maplibregl.Map({
    container: conteneur,
    style: creerStyle(new URL(import.meta.env.BASE_URL, location.href).href),
    ...VUE_INITIALE,
    minZoom: 5.5,
    maxZoom: 15,
    maxBounds: LIMITES,
    attributionControl: { compact: true },
    dragRotate: false,
    pitchWithRotate: false,
  });
  carte.touchZoomRotate.disableRotation();
  carte.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  carte.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'top-left');

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

  // Villes repères, sauf celles qui sont aussi des lieux d'étapes (leur marqueur porte le nom).
  const villeParId = new Map(villes.map((v) => [v.id, v]));
  for (const v of villes) {
    if (lieuParId.has(v.id)) continue;
    const gauche = v.etiquette === 'gauche';
    const el = element('div', `ville rang-${v.rang}${gauche ? ' gauche' : ''}`);
    el.dataset.ville = v.id;
    el.append(element('span', 'ville-point'), element('span', 'ville-nom', v.nom));
    new maplibregl.Marker({ element: el, anchor: gauche ? 'right' : 'left', offset: [gauche ? 4 : -4, 0] })
      .setLngLat(versLngLat(v.coord))
      .addTo(carte);
  }

  // Couches dynamiques : zones, tracé en filigrane, tracé parcouru, tête du tracé.
  let pret = false;
  const majTrace = (u: number) => {
    if (!pret) return;
    const { parcouru, tete } = traceAu(u);
    (carte.getSource('trace') as GeoJSONSource).setData(parcouru);
    (carte.getSource('tete') as GeoJSONSource).setData({ type: 'Point', coordinates: tete });
  };

  carte.on('load', () => {
    const zones = lieux.filter((l) => l.type === 'zone');
    carte.addSource('zones', { type: 'geojson', data: { type: 'FeatureCollection', features: zones.map((z) => cercle(z)) } });
    carte.addLayer({ id: 'zones-aplat', type: 'fill', source: 'zones', paint: { 'fill-color': '#8a2f1d', 'fill-opacity': 0.07 } });
    carte.addLayer({
      id: 'zones-trait',
      type: 'line',
      source: 'zones',
      paint: { 'line-color': '#8a2f1d', 'line-width': 1, 'line-dasharray': [2, 2], 'line-opacity': 0.6 },
    });

    carte.addSource('trace-complete', { type: 'geojson', data: TRACE_COMPLETE });
    carte.addLayer({
      id: 'trace-filigrane',
      type: 'line',
      source: 'trace-complete',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#6b5640', 'line-width': 1.2, 'line-opacity': 0.3, 'line-dasharray': [1, 2] },
    });

    carte.addSource('trace', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    carte.addLayer({
      id: 'trace-halo',
      type: 'line',
      source: 'trace',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#f7eedb', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 4, 12, 7], 'line-opacity': 0.8 },
    });
    carte.addLayer({
      id: 'trace',
      type: 'line',
      source: 'trace',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': couleurParPhase, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2, 12, 4] },
    });
    carte.addSource('tete', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    carte.addLayer({
      id: 'tete',
      type: 'circle',
      source: 'tete',
      paint: { 'circle-radius': 5, 'circle-color': '#f7eedb', 'circle-stroke-color': '#7a1616', 'circle-stroke-width': 2.5 },
    });
    pret = true;
    majTrace(store.get().curseur);
  });

  // Marqueurs : un par emplacement (Golgotha et le tombeau partagent le Saint-Sépulcre).
  const groupes = new Map<string, Lieu[]>();
  for (const lieu of lieux) {
    const cle = lieu.coord.join(',');
    groupes.set(cle, [...(groupes.get(cle) ?? []), lieu]);
  }

  const marqueurs: { el: HTMLElement; lieux: Set<string>; premiere: number }[] = [];
  const popup = new maplibregl.Popup({ closeButton: false, offset: 14, className: 'popup-lieu', maxWidth: '280px' });
  for (const groupe of groupes.values()) {
    const ids = new Set(groupe.map((l) => l.id));
    const nom = groupe.map((l) => l.nom).join(' · ');
    const etapesIci = etapes.filter((e) => ids.has(e.lieu));
    const jalon = etapesIci.some((e) => e.jalon);
    const debattu = groupe.some((l) => l.certitude === 'debattu');
    const ville = villeParId.get(groupe[0].id);
    const classes = ['marqueur', jalon ? 'jalon' : 'simple', debattu ? 'certitude-debattu' : '', ville ? `rang-${ville.rang}` : ''];
    const bouton = element('button', classes.filter(Boolean).join(' ')) as HTMLButtonElement;
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
        actions.allerA(etapesIci[0].id);
        return;
      }
      // Plusieurs étapes au même endroit (Jérusalem, Capharnaüm…) : on laisse choisir.
      const liste = element('div', 'choix-etapes');
      liste.append(element('div', 'choix-titre', nom));
      for (const e of etapesIci) {
        const b = element('button', 'choix-etape') as HTMLButtonElement;
        b.type = 'button';
        b.append(element('span', 'choix-ordre', String(e.ordre)), document.createTextNode(e.titre));
        b.addEventListener('click', () => {
          popup.remove();
          actions.allerA(e.id);
        });
        liste.append(b);
      }
      popup.setLngLat(versLngLat(groupe[0].coord)).setDOMContent(liste).addTo(carte);
    });
    new maplibregl.Marker({ element: bouton, anchor: 'center' }).setLngLat(versLngLat(groupe[0].coord)).addTo(carte);
    marqueurs.push({ el: bouton, lieux: ids, premiere: Math.min(...etapesIci.map((e) => indexDeEtape(e.id))) });
  }

  // --- Abonnements à l'état central ---

  const majCurseur = (u: number) => {
    majTrace(u);
    // Un lieu est « à venir » tant qu'aucune de ses étapes n'est atteinte.
    const { i } = positionAu(u);
    for (const m of marqueurs) {
      const aVenir = m.premiere > i;
      m.el.classList.toggle('a-venir', aVenir);
      m.el.title = aVenir ? `À venir (${formatAnnee(etapes[m.premiere].annee)})` : '';
    }
  };

  const majEtape = (id: string | null, etat: EtatApp) => {
    const lieuActif = id ? etapeParId.get(id)?.lieu : undefined;
    for (const { el, lieux: ids } of marqueurs) el.classList.toggle('actif', !!lieuActif && ids.has(lieuActif));
    const etape = id ? etapeParId.get(id) : undefined;
    const lieu = etape ? lieuParId.get(etape.lieu) : undefined;
    if (!lieu) return;
    const centre = versLngLat(lieu.coord);
    if (etat.lecture) {
      // En lecture, la caméra glisse d'un lieu à l'autre sans plonger.
      carte.easeTo({ center: centre, zoom: lieu.id === 'egypte' ? 6 : 7.6, duration: 1400, essential: true });
      return;
    }
    const zoom = lieu.id === 'egypte' ? 7 : distanceKm(lieu.coord, JERUSALEM) < 3 ? 12.5 : lieu.type === 'zone' ? 9.5 : 10.5;
    carte.flyTo({ center: centre, zoom, speed: 0.9, curve: 1.5, essential: true });
  };

  // Parcours guidé : un cartouche annote l'étape sur la carte.
  const cartouche = element('div', 'annotation');
  cartouche.setAttribute('aria-hidden', 'true');
  const annotation = new maplibregl.Marker({ element: cartouche, anchor: 'bottom', offset: [0, -16] });
  const majAnnotation = (etat: EtatApp) => {
    const etape = etat.etapeActive ? etapeParId.get(etat.etapeActive) : undefined;
    const lieu = etape ? lieuParId.get(etape.lieu) : undefined;
    if (etat.mode !== 'parcours' || !etape || !lieu) {
      annotation.remove();
      return;
    }
    cartouche.innerHTML = '';
    cartouche.append(
      element('span', 'annotation-numero', String(etape.ordre)),
      element('span', 'annotation-titre', etape.titre),
      element('span', 'annotation-date', etape.date),
    );
    cartouche.style.setProperty('--couleur', COULEURS_PHASES[etape.phase]);
    // Relance l'animation d'apparition.
    cartouche.classList.remove('apparait');
    void cartouche.offsetWidth;
    cartouche.classList.add('apparait');
    annotation.setLngLat(versLngLat(lieu.coord)).addTo(carte);
  };

  store.on('curseur', majCurseur);
  store.on('etapeActive', majEtape);
  store.subscribe((etat, avant) => {
    if (etat.etapeActive !== avant.etapeActive || etat.mode !== avant.mode) majAnnotation(etat);
  });
  majCurseur(store.get().curseur);

  return {
    carte,
    recentrer: () => carte.flyTo({ ...VUE_INITIALE, speed: 1.2 }),
  };
}
