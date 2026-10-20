// Ambiance « carte ancienne » : papier vieilli, mer gravée, rose des vents,
// cartouche de titre et noms des eaux en lettres anciennes.
import * as maplibregl from 'maplibre-gl';

/** Hachures horizontales fines, comme la mer des cartes gravées. */
function hachures(): ImageData {
  const l = 8;
  const h = 5;
  const c = document.createElement('canvas');
  c.width = l;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(62, 92, 86, 0.55)';
  g.fillRect(0, 2, l, 1);
  return g.getImageData(0, 0, l, h);
}

const ROSE = `
<svg viewBox="-50 -50 100 100" aria-hidden="true">
  <g fill="none" stroke="currentColor" stroke-width="0.8">
    <circle r="30"/><circle r="27"/>
    ${Array.from({ length: 32 }, (_, k) => {
      const a = (k * Math.PI) / 16;
      const r1 = k % 4 === 0 ? 22 : 25;
      return `<line x1="${(Math.sin(a) * r1).toFixed(2)}" y1="${(-Math.cos(a) * r1).toFixed(2)}" x2="${(Math.sin(a) * 27).toFixed(2)}" y2="${(-Math.cos(a) * 27).toFixed(2)}"/>`;
    }).join('')}
  </g>
  <g stroke="currentColor" stroke-width="0.6" stroke-linejoin="round">
    ${[45, 135, 225, 315]
      .map(
        (d) =>
          `<g transform="rotate(${d})"><path d="M0,-24 L4,-4 L0,0 Z" fill="var(--rose-clair)"/><path d="M0,-24 L-4,-4 L0,0 Z" fill="currentColor"/></g>`,
      )
      .join('')}
    ${[0, 90, 180, 270]
      .map(
        (d) =>
          `<g transform="rotate(${d})"><path d="M0,-38 L6,-6 L0,0 Z" fill="var(--rose-clair)"/><path d="M0,-38 L-6,-6 L0,0 Z" fill="${d === 0 ? 'var(--rose-nord)' : 'currentColor'}"/></g>`,
      )
      .join('')}
    <circle r="3" fill="var(--rose-clair)"/>
  </g>
  <text y="-41" text-anchor="middle" class="rose-lettre">N</text>
</svg>`;

/** Noms des eaux, à placer sur la carte : [lon, lat], rotation, zooms où ils sont lisibles. */
const EAUX: { nom: string; sous?: string; lngLat: [number, number]; angle: number; classe: string }[] = [
  { nom: 'Mer Méditerranée', sous: 'Mare Nostrum', lngLat: [34.15, 32.55], angle: -8, classe: 'eau-mer' },
  { nom: 'Mer Morte', lngLat: [35.475, 31.5], angle: -82, classe: 'eau-lac' },
  { nom: 'Jourdain', lngLat: [35.585, 32.18], angle: -84, classe: 'eau-fleuve' },
];

/** À appeler juste après la création de la carte, avant d'ajouter les marqueurs. */
export function habillerCarte(carte: maplibregl.Map, conteneur: HTMLElement) {
  // Papier : grain, taches, vignettage et double filet. Inséré juste au-dessus du
  // fond de carte, sous les marqueurs (ajoutés ensuite dans le même conteneur).
  const papier = document.createElement('div');
  papier.className = 'papier';
  const toile = carte.getCanvas();
  toile.parentElement!.insertBefore(papier, toile.nextSibling);

  const rose = document.createElement('div');
  rose.className = 'rose-des-vents';
  rose.innerHTML = ROSE;
  conteneur.append(rose);

  const cartouche = document.createElement('div');
  cartouche.className = 'cartouche-titre';
  cartouche.innerHTML = `
    <span class="cartouche-latin">Terra Sancta</span>
    <span class="cartouche-titre-principal">La Palestine au temps de Jésus</span>
    <span class="cartouche-date">vers l’an 30</span>`;
  conteneur.append(cartouche);

  for (const e of EAUX) {
    const el = document.createElement('div');
    el.className = `nom-eau ${e.classe}`;
    el.style.setProperty('--angle', `${e.angle}deg`);
    el.innerHTML = `<div><span>${e.nom}</span>${e.sous ? `<small>${e.sous}</small>` : ''}</div>`;
    new maplibregl.Marker({ element: el }).setLngLat(e.lngLat).addTo(carte);
  }

  carte.on('load', () => {
    carte.addImage('hachures', hachures());
    carte.addLayer(
      { id: 'mer-hachures', type: 'fill', source: 'mer', paint: { 'fill-pattern': 'hachures', 'fill-opacity': 0.45 } },
      'mer-cote',
    );
    carte.addLayer(
      { id: 'lacs-hachures', type: 'fill', source: 'lacs', paint: { 'fill-pattern': 'hachures', 'fill-opacity': 0.4 } },
      'lacs-rive',
    );
    // Lignes d'eau parallèles au rivage, de plus en plus pâles vers le large.
    [6, 12, 19].forEach((d, k) => {
      carte.addLayer(
        {
          id: `mer-onde-${k}`,
          type: 'line',
          source: 'mer',
          minzoom: 6,
          paint: { 'line-color': '#5e7a72', 'line-width': 0.8, 'line-offset': d, 'line-opacity': 0.5 - k * 0.14 },
        },
        'mer-cote',
      );
    });
  });
}
