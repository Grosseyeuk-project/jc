# Sur les traces de Jésus

Webapp en français : suivre Jésus sur une carte au style parchemin, de la Nativité à l'Ascension.
Le cadrage du projet est dans [CLAUDE.md](CLAUDE.md).

## Lancer

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # vérifie les données et l'état central
npm run build    # site statique dans dist/
```

## Structure

- `src/data/` : étapes, lieux, villes, frontières antiques (JSON).
- `src/state.ts` : état central (année, étape active, mode) ; la carte et le panneau s'y abonnent.
- `src/carte/` : carte MapLibre et son style parchemin.
- `src/ui/` : panneau latéral (fiche de l'étape, liste des jalons).
- `scripts/preparer-geo.mjs` : télécharge et découpe les données géographiques (`npm run geo`).

## Données et licences

- Côtes, lacs, fleuves : [Natural Earth](https://www.naturalearthdata.com/) (domaine public).
- Relief : tuiles Terrarium de Mapzen, hébergées par AWS Open Data (SRTM, NASA, et autres sources libres).
- Coordonnées des lieux : sources citées dans le champ `source` de chaque entrée.
- Citations : Louis Segond 1910 (domaine public), dépôt [BibleCorps/FRA-B-LSG1910-PD-UBS](https://github.com/BibleCorps/FRA-B-LSG1910-PD-UBS), extraites par `npm run citations`.
- Frontières antiques : tracé approximatif fait à la main, en cours de relecture.
