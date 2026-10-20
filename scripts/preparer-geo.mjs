// Télécharge et découpe les données géographiques libres utilisées par la carte.
// - Natural Earth 1:10m (domaine public) : mer, lacs, fleuves.
// - Tuiles d'altitude « Terrarium » (Mapzen / AWS Open Data, SRTM et autres sources libres)
//   pour le relief ombré.
// Les fichiers produits sont versionnés dans public/ : l'application reste 100 % statique.
// Usage : npm run geo
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname } from 'node:path';
import bboxClip from '@turf/bbox-clip';

// Emprise des données : du delta du Nil à Damas.
const BBOX = [30.5, 28.5, 38.5, 35.5]; // [ouest, sud, est, nord]
// Emprise du relief (plus serrée : la Palestine antique et ses abords).
const BBOX_RELIEF = [30.8, 29.4, 37.2, 34.2]; // jusqu'au Vieux-Caire (fuite en Égypte)
const ZOOM_RELIEF = [5, 9];

const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const TERRARIUM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';

const couches = [
  { src: 'ne_10m_ocean.geojson', dest: 'mer.geojson' },
  { src: 'ne_10m_lakes.geojson', dest: 'lacs.geojson', garder: ['name', 'name_fr'] },
  {
    src: 'ne_10m_rivers_lake_centerlines.geojson',
    dest: 'fleuves.geojson',
    garder: ['name', 'name_fr', 'scalerank'],
    // Pas d'ouvrages modernes (canal de Suez, canal d'Ismaïlia) ni de tronçons sans nom.
    filtre: (p) => p.name && !/canal/i.test(p.name),
  },
];

const arrondir = (c) => (typeof c[0] === 'number' ? [+c[0].toFixed(4), +c[1].toFixed(4)] : c.map(arrondir));

function intersecte(f, [o, s, e, n]) {
  let mo = Infinity, ms = Infinity, me = -Infinity, mn = -Infinity;
  const parcourir = (c) => {
    if (typeof c[0] === 'number') {
      mo = Math.min(mo, c[0]); me = Math.max(me, c[0]);
      ms = Math.min(ms, c[1]); mn = Math.max(mn, c[1]);
    } else c.forEach(parcourir);
  };
  parcourir(f.geometry.coordinates);
  return !(me < o || mo > e || mn < s || ms > n);
}

async function vecteurs() {
  for (const { src, dest, garder, filtre } of couches) {
    process.stdout.write(`${src}… `);
    const r = await fetch(NE + src);
    if (!r.ok) throw new Error(`${src} : HTTP ${r.status}`);
    const fc = await r.json();
    const features = [];
    for (const f of fc.features) {
      if (!f.geometry || !intersecte(f, BBOX)) continue;
      if (filtre && !filtre(f.properties)) continue;
      const parts = f.geometry.type.startsWith('Multi') ? f.geometry.coordinates : [f.geometry.coordinates];
      const simple = f.geometry.type.replace('Multi', '');
      for (const coords of parts) {
        const clip = bboxClip({ type: 'Feature', properties: {}, geometry: { type: simple, coordinates: coords } }, BBOX);
        const g = clip.geometry;
        if (!g || g.coordinates.length === 0) continue;
        const props = {};
        for (const k of garder ?? []) if (f.properties[k] != null) props[k] = f.properties[k];
        features.push({ type: 'Feature', properties: props, geometry: { type: g.type, coordinates: arrondir(g.coordinates) } });
      }
    }
    await writeFile(`public/geo/${dest}`, JSON.stringify({ type: 'FeatureCollection', features }));
    console.log(`${features.length} entités`);
  }
}

const lon2x = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const lat2y = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

async function relief() {
  const [o, s, e, n] = BBOX_RELIEF;
  let total = 0;
  for (let z = ZOOM_RELIEF[0]; z <= ZOOM_RELIEF[1]; z++) {
    for (let x = lon2x(o, z); x <= lon2x(e, z); x++) {
      for (let y = lat2y(n, z); y <= lat2y(s, z); y++) {
        const dest = `public/relief/${z}/${x}/${y}.png`;
        try { await access(dest); total++; continue; } catch {}
        const r = await fetch(`${TERRARIUM}/${z}/${x}/${y}.png`);
        if (!r.ok) throw new Error(`tuile ${z}/${x}/${y} : HTTP ${r.status}`);
        await mkdir(dirname(dest), { recursive: true });
        await writeFile(dest, Buffer.from(await r.arrayBuffer()));
        total++;
      }
    }
  }
  console.log(`relief : ${total} tuiles (zooms ${ZOOM_RELIEF.join('-')})`);
}

await mkdir('public/geo', { recursive: true });
await vecteurs();
await relief();
