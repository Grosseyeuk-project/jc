import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, LngLatLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre 6 charge son worker à part : Vite le construit et nous donne son adresse.
import urlWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { Actions } from '../actions';
import { indexDeEtape, positionAu, U_MAX } from '../chronologie';
import { formatHeure } from '../passion';
import jerusalem from '../data/jerusalem.json';
import { indicesSelon, raconte } from '../evangiles';
import frontieres from '../data/frontieres.json';
import { etapeParId, etapes, formatAnnee, LIBELLE_CERTITUDE, lieuParId, lieux, villes } from '../donnees';
import type { EtatApp, Store } from '../state';
import type { Lieu } from '../types';
import { creerStyle } from './style';
import { COULEURS_PHASES, TRACE_COMPLETE, traceAu, traceSelon } from './trace';

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

/** Chevron « > » dessiné sur un canevas, pour les flèches de direction (icône SDF, teintable). */
function fleche(): ImageData {
  const t = 32;
  const c = document.createElement('canvas');
  c.width = c.height = t;
  const g = c.getContext('2d')!;
  g.strokeStyle = '#000';
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(11, 8);
  g.lineTo(21, 16);
  g.lineTo(11, 24);
  g.stroke();
  return g.getImageData(0, 0, t, t);
}

/**
 * Pointillés qui avancent : MapLibre n'a pas de décalage de tirets, on fait donc
 * défiler une suite de motifs (technique de l'exemple « ant path » de MapLibre).
 */
const MARCHE: number[][] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
];

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

  // Étiquettes du plan de Jérusalem (visibles en zoom rapproché, voir style.css).
  for (const f of (jerusalem as GeoJSON.FeatureCollection).features) {
    const p = f.properties as { type: string; nom: string; classe?: string };
    if (p.type !== 'etiquette') continue;
    const el = element('div', `etiquette-plan plan-${p.classe}`, p.nom);
    new maplibregl.Marker({ element: el }).setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number]).addTo(carte);
  }

  // Villes repères, sauf celles qui sont aussi des lieux d'étapes (leur marqueur porte le nom).
  const villeParId = new Map(villes.map((v) => [v.id, v]));
  const etiquettesVilles: { el: HTMLElement; coord: [number, number] }[] = [];
  for (const v of villes) {
    if (lieuParId.has(v.id)) continue;
    const gauche = v.etiquette === 'gauche';
    const el = element('div', `ville rang-${v.rang}${gauche ? ' gauche' : ''}`);
    el.dataset.ville = v.id;
    etiquettesVilles.push({ el, coord: versLngLat(v.coord) });
    el.append(element('span', 'ville-point'), element('span', 'ville-nom', v.nom));
    new maplibregl.Marker({ element: el, anchor: gauche ? 'right' : 'left', offset: [gauche ? 4 : -4, 0] })
      .setLngLat(versLngLat(v.coord))
      .addTo(carte);
  }

  // Couches dynamiques : zones, tracé en filigrane, tracé parcouru, tête du tracé.
  let pret = false;
  const majTrace = () => {
    if (!pret) return;
    const { curseur, mode, evangile } = store.get();
    // En mode comparer, on montre tout le récit de l'évangile choisi, en ne reliant que ses étapes.
    const { parcouru, tete } = mode === 'comparer' ? traceSelon(indicesSelon(evangile), U_MAX) : traceAu(curseur);
    (carte.getSource('trace') as GeoJSONSource).setData(parcouru);
    (carte.getSource('tete') as GeoJSONSource).setData(
      tete ? { type: 'Point', coordinates: tete } : { type: 'FeatureCollection', features: [] },
    );
  };
  const majFiligrane = () => {
    if (!pret) return;
    const { mode, evangile } = store.get();
    (carte.getSource('trace-complete') as GeoJSONSource).setData(
      mode === 'comparer' ? traceSelon(indicesSelon(evangile), U_MAX).parcouru : TRACE_COMPLETE,
    );
  };

  let pasMarche = -1;
  const animerMarche = () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const pas = (t: number) => {
      const k = Math.floor(t / 70) % MARCHE.length;
      if (k !== pasMarche && carte.getLayer('trace-marche')) {
        carte.setPaintProperty('trace-marche', 'line-dasharray', MARCHE[k]);
        pasMarche = k;
      }
      requestAnimationFrame(pas);
    };
    requestAnimationFrame(pas);
  };

  carte.on('load', () => {
    // Plan schématique de Jérusalem vers l'an 30 : il apparaît quand on zoome sur la ville.
    const apparition = (max: number) => ['interpolate', ['linear'], ['zoom'], 11.5, 0, 12.8, max] as never;
    carte.addSource('jerusalem', { type: 'geojson', data: jerusalem as GeoJSON.FeatureCollection });
    carte.addLayer({
      id: 'jerusalem-ville',
      type: 'fill',
      source: 'jerusalem',
      filter: ['==', ['get', 'type'], 'ville'],
      paint: { 'fill-color': '#e2cfa5', 'fill-opacity': apparition(0.75) },
    });
    carte.addLayer({
      id: 'jerusalem-batiments',
      type: 'fill',
      source: 'jerusalem',
      filter: ['in', ['get', 'type'], ['literal', ['temple', 'edifice']]],
      paint: { 'fill-color': ['match', ['get', 'type'], 'temple', '#d4b77c', '#c9a46a'], 'fill-opacity': apparition(0.9) },
    });
    carte.addLayer({
      id: 'jerusalem-vallees',
      type: 'line',
      source: 'jerusalem',
      filter: ['==', ['get', 'type'], 'vallee'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#7d978f', 'line-width': 2, 'line-dasharray': [3, 2], 'line-opacity': apparition(0.8) },
    });
    carte.addLayer({
      id: 'jerusalem-murailles',
      type: 'line',
      source: 'jerusalem',
      filter: ['in', ['get', 'type'], ['literal', ['ville', 'temple', 'edifice']]],
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': '#6b4a2b',
        'line-width': ['match', ['get', 'type'], 'ville', 3, 1.5],
        'line-opacity': apparition(0.9),
      },
    });

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
    // Les segments anciens s'estompent : le regard suit les derniers pas.
    const opaciteParAge = ['interpolate', ['linear'], ['get', 'age'], 0, 1, 4, 0.8, 12, 0.55] as never;
    carte.addLayer({
      id: 'trace-halo',
      type: 'line',
      source: 'trace',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#f7eedb',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 3, 12, 6],
        'line-opacity': ['interpolate', ['linear'], ['get', 'age'], 0, 0.85, 6, 0.45] as never,
      },
    });
    carte.addLayer({
      id: 'trace',
      type: 'line',
      source: 'trace',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': couleurParPhase,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.7, 12, 3.2],
        'line-opacity': opaciteParAge,
      },
    });
    // Dernier segment : des pointillés couleur parchemin défilent dessus, comme une marche.
    carte.addLayer({
      id: 'trace-marche',
      type: 'line',
      source: 'trace',
      filter: ['==', ['get', 'courant'], true],
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: {
        'line-color': '#f7eedb',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.4, 12, 3],
        'line-dasharray': MARCHE[0],
      },
    });
    // Flèches de direction le long du tracé (icône dessinée sur un canevas, teintée par phase).
    carte.addImage('fleche', fleche(), { sdf: true });
    carte.addLayer({
      id: 'trace-fleches',
      type: 'symbol',
      source: 'trace',
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 6, 70, 12, 120] as never,
        'icon-image': 'fleche',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 0.45, 12, 0.7] as never,
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: { 'icon-color': couleurParPhase, 'icon-opacity': opaciteParAge },
    });
    animerMarche();
    carte.addSource('tete', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    carte.addLayer({
      id: 'tete',
      type: 'circle',
      source: 'tete',
      paint: { 'circle-radius': 5, 'circle-color': '#f7eedb', 'circle-stroke-color': '#7a1616', 'circle-stroke-width': 2.5 },
    });
    pret = true;
    majFiligrane();
    majTrace();
  });

  // Marqueurs : un par emplacement (Golgotha et le tombeau partagent le Saint-Sépulcre).
  const groupes = new Map<string, Lieu[]>();
  for (const lieu of lieux) {
    const cle = lieu.coord.join(',');
    groupes.set(cle, [...(groupes.get(cle) ?? []), lieu]);
  }

  type Marqueur = {
    el: HTMLElement;
    lieux: Set<string>;
    premiere: number;
    indices: number[];
    coord: [number, number];
    priorite: number;
  };
  const marqueurs: Marqueur[] = [];
  /** Pour chaque marqueur « tête de groupe », les lieux qu'il représente à ce zoom. */
  const groupesAffiches = new Map<HTMLElement, Marqueur[]>();
  const popup = new maplibregl.Popup({ closeButton: false, offset: 14, className: 'popup-lieu', maxWidth: '280px' });
  for (const groupe of groupes.values()) {
    const ids = new Set(groupe.map((l) => l.id));
    const nom = groupe.map((l) => l.nom).join(' · ');
    const etapesIci = etapes.filter((e) => ids.has(e.lieu));
    const jalon = etapesIci.some((e) => e.jalon);
    const debattu = groupe.some((l) => l.certitude === 'debattu');
    const ville = villeParId.get(groupe[0].id);
    const cote = groupe[0].etiquette ? `nom-${groupe[0].etiquette}` : '';
    const classes = ['marqueur', jalon ? 'jalon' : 'simple', debattu ? 'certitude-debattu' : '', ville ? `rang-${ville.rang}` : '', cote];
    const bouton = element('button', classes.filter(Boolean).join(' ')) as HTMLButtonElement;
    bouton.type = 'button';
    bouton.setAttribute('aria-label', `${nom} — ${etapesIci.map((e) => e.titre).join(', ')}`);
    bouton.append(element('span', 'marqueur-disque'));
    if (debattu) {
      const pastille = element('span', 'pastille-debattu', '?');
      pastille.title = LIBELLE_CERTITUDE.debattu;
      bouton.append(pastille);
    }
    bouton.append(element('span', 'marqueur-nom', nom), element('span', 'marqueur-compte'));
    bouton.addEventListener('click', (ev) => {
      ev.stopPropagation();
      // Groupe de lieux proches : on zoome pour les séparer.
      const membres = groupesAffiches.get(bouton);
      if (membres && membres.length > 1) {
        const b = new maplibregl.LngLatBounds();
        for (const m of membres) b.extend(m.coord);
        carte.fitBounds(b, { padding: 110, maxZoom: 14.5, duration: 900 });
        return;
      }
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
    const indices = etapesIci.map((e) => indexDeEtape(e.id));
    // Priorité pour représenter un groupe : jalons, puis grandes villes, puis le reste.
    const priorite = (jalon ? 0 : 2) + (ville?.rang === 1 ? 0 : 1);
    marqueurs.push({ el: bouton, lieux: ids, premiere: Math.min(...indices), indices, coord: versLngLat(groupe[0].coord), priorite });
  }

  // Regroupement : à petit zoom, les lieux à moins de RAYON pixels les uns des autres
  // n'en forment qu'un, avec un compteur. Le lieu actif est toujours visible.
  const RAYON = 26;
  const regrouper = () => {
    const actif = store.get().etapeActive ? etapeParId.get(store.get().etapeActive!)?.lieu : undefined;
    const pos = new Map(marqueurs.map((m) => [m, carte.project(m.coord)]));
    const ordre = [...marqueurs].sort(
      (a, b) =>
        Number(!(actif && b.lieux.has(actif))) - Number(!(actif && a.lieux.has(actif))) ||
        a.priorite - b.priorite ||
        a.premiere - b.premiere,
    );
    const pris = new Set<Marqueur>();
    groupesAffiches.clear();
    for (const tete of ordre) {
      if (pris.has(tete)) continue;
      const p = pos.get(tete)!;
      const membres = ordre.filter((m) => !pris.has(m) && pos.get(m)!.dist(p) < RAYON);
      for (const m of membres) pris.add(m);
      groupesAffiches.set(tete.el, membres);
      for (const m of membres) m.el.classList.toggle('regroupe', m !== tete);
      tete.el.classList.toggle('groupe', membres.length > 1);
      const compte = tete.el.querySelector<HTMLElement>('.marqueur-compte')!;
      compte.textContent = membres.length > 1 ? `+${membres.length - 1}` : '';
      tete.el.title = membres.length > 1 ? `${membres.length} lieux : cliquer pour zoomer` : tete.el.title;
    }
    // Les noms de villes trop proches d'un marqueur visible s'effacent.
    const tetes = [...groupesAffiches.keys()].map((el) => pos.get(marqueurs.find((m) => m.el === el)!)!);
    for (const v of etiquettesVilles) {
      const p = carte.project(v.coord);
      v.el.classList.toggle('masquee', tetes.some((t) => t.dist(p) < 22));
    }
  };
  carte.on('zoomend', regrouper);
  carte.on('resize', regrouper);
  carte.once('load', regrouper);

  // Résurrection : apparitions numérotées en doré. Le tombeau vide et l'Ascension
  // ne sont pas des apparitions ; leurs lieux passent simplement au doré.
  const apparitions = etapes.filter((e) => e.phase === 'resurrection' && e.id !== 'tombeau-vide' && e.id !== 'ascension');
  const pastilles: { el: HTMLElement; i: number }[] = [];
  const parLieu = new Map<string, typeof apparitions>();
  for (const e of apparitions) parLieu.set(e.lieu, [...(parLieu.get(e.lieu) ?? []), e]);
  for (const [lieuId, liste] of parLieu) {
    liste.forEach((e, k) => {
      const n = apparitions.indexOf(e) + 1;
      const el = element('button', 'apparition', String(n)) as HTMLButtonElement;
      el.type = 'button';
      el.title = `Apparition ${n} : ${e.titre}`;
      el.setAttribute('aria-label', el.title);
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        actions.allerA(e.id);
      });
      // Plusieurs apparitions au même lieu (Jérusalem) : pastilles côte à côte.
      const dx = (k - (liste.length - 1) / 2) * 20;
      new maplibregl.Marker({ element: el, anchor: 'center', offset: [dx + 12, -16] })
        .setLngLat(versLngLat(lieuParId.get(lieuId)!.coord))
        .addTo(carte);
      pastilles.push({ el, i: indexDeEtape(e.id) });
    });
  }
  const indicesResurrection = etapes.flatMap((e, i) => (e.phase === 'resurrection' ? [i] : []));

  // --- Abonnements à l'état central ---

  const majCurseur = (u: number) => {
    majTrace();
    // Un lieu est « à venir » tant qu'aucune de ses étapes n'est atteinte.
    // En mode comparer, tout le récit est visible : rien n'est « à venir ».
    const { i } = store.get().mode === 'comparer' ? { i: etapes.length - 1 } : positionAu(u);
    for (const m of marqueurs) {
      const aVenir = m.premiere > i;
      m.el.classList.toggle('a-venir', aVenir);
      m.el.title = aVenir ? `À venir (${formatAnnee(etapes[m.premiere].annee)})` : '';
      m.el.classList.toggle('dore', m.indices.some((k) => k <= i && indicesResurrection.includes(k)));
    }
    for (const p of pastilles) p.el.hidden = p.i > i;
  };

  // Mode comparer : lieux absents de l'évangile estompés, lieux à variante cerclés.
  const majComparer = (etat: EtatApp) => {
    const comparer = etat.mode === 'comparer';
    for (const m of marqueurs) {
      const ici = m.indices.map((k) => etapes[k]);
      m.el.classList.toggle('absent', comparer && !ici.some((e) => raconte(e, etat.evangile)));
      m.el.classList.toggle('variante', comparer && ici.some((e) => e.variante));
    }
    for (const p of pastilles) p.el.classList.toggle('absent', comparer && !raconte(etapes[p.i], etat.evangile));
    majFiligrane();
    majCurseur(etat.curseur);
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
    const zoom = lieu.id === 'egypte' ? 7 : distanceKm(lieu.coord, JERUSALEM) < 3 ? 14.3 : lieu.type === 'zone' ? 9.5 : 10.5;
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
      element('span', 'annotation-date', formatHeure(etape) ? `${etape.date} · ${formatHeure(etape)}` : etape.date),
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
  store.on('etapeActive', regrouper);
  store.subscribe((etat, avant) => {
    if (etat.etapeActive !== avant.etapeActive || etat.mode !== avant.mode) majAnnotation(etat);
    if (etat.mode !== avant.mode || etat.evangile !== avant.evangile) majComparer(etat);
  });
  majCurseur(store.get().curseur);

  return {
    carte,
    recentrer: () => carte.flyTo({ ...VUE_INITIALE, speed: 1.2 }),
  };
}
