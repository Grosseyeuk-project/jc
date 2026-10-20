# Sur les traces de Jésus — brief de démarrage

Webapp en français : suivre Jésus sur une carte, de la Nativité à l'Ascension, avec un curseur d'années, un tracé animé et des annotations. Ton adulte, sobre, mais ludique (animations fluides, parcours guidé). Usage personnel d'abord. Phase 2 plus tard : les apôtres, sur le même moteur.

Spécification complète : le doc « Sur les traces de Jésus — Cadrage » (claude.ai). Ce fichier en est le résumé exécutable.

## Décisions déjà prises

- Sources : Évangiles, plus les Actes pour l'Ascension. Textes en Louis Segond 1910 (domaine public).
- Lieux incertains affichés avec la mention « localisation débattue » (champ `certitude_lieu`).
- Chronologie : Nativité placée en l'an 0 par convention (champ `note` de l'étape : il n'y a pas d'an 0 dans le calendrier, et les historiens situent la naissance vers 6-4 av. J.-C.). Ministère de 27 à 30, crucifixion le vendredi 7 avril 30 (an 33 en note).
- Carte : PAS d'OpenStreetMap. Fond maison vectoriel, thème parchemin, données libres (Natural Earth, relief libre). Frontières antiques (Judée, Samarie, Galilée, Pérée, Décapole) tracées à la main en GeoJSON.
- Curseur : frise de 1 av. J.-C. à 30 à échelle élargie sur le ministère, avec jalons cliquables (`jalon: true`). Le tracé s'anime avec le curseur et les étapes sont cliquables.
- Passion (étapes 34 à 39) : zoom heure par heure sur un plan de Jérusalem (champ `heures`).
- Résurrection et Ascension : marqueur doré, apparitions numérotées.
- Parcours guidé : caméra qui suit l'étape, précédent/suivant, contexte historique puis méditation puis citations.
- Mode comparer : sélecteur d'évangile (Mt, Mc, Lc, Jn) ; on surligne toutes les étapes dont le champ `variante` est rempli dans `etapes.json` (19 étapes : 5, 6, 7, 10, 11, 12, 13, 17, 18, 19, 21, 30, 32, 34, 36, 37, 40, 42, 45, 46). Le champ fait foi, pas une liste figée.
- Technique : Vite + TypeScript, MapLibre GL 6 (choix confirmé), JSON statique, aucun serveur. Étiquettes en HTML (pas de serveur de glyphes).

## Données

- `src/data/etapes.json` : les 46 étapes de référence. Ordre harmonisé, références, certitude du lieu, variantes, `note` (remarques de datation).
- `src/data/lieux.json` : fait pour les lieux des jalons ; à compléter pour les 46 étapes. Un lieu par identifiant utilisé dans `etapes.json`, avec `type` (point, zone ou trajet), `coord` [lat, lon] et `certitude` (certain, probable, debattu). Vérifier chaque coordonnée sur une source fiable avant de l'inscrire ; ne rien inventer pour les lieux débattus (donner le site traditionnel et le marquer `debattu`). Chaque lieu a un champ `source`. La certitude affichée dans la fiche est celle de l'étape (`certitude_lieu`), car un même lieu peut varier (mont des Oliviers : certain pour l'entrée à Jérusalem, probable pour l'Ascension).
- `src/data/villes.json` : villes repères (sources citées), `rang` 1 à 3 pour la densité selon le zoom.
- `src/data/frontieres.json` : régions vers l'an 30, tracées à la main (GeoJSON, [lon, lat]).
- `public/geo/` et `public/relief/` : Natural Earth 1:10m et tuiles d'altitude Terrarium, produits par `npm run geo`.
- `src/data/textes.json` : à créer. Par étape : `histoire`, `meditation`, `citations` (Louis Segond 1910). Rédaction en français, factuelle côté histoire, courte côté méditation.

## Premier jalon : socle carte (fait)

1. Projet Vite + TypeScript, carte MapLibre avec fond parchemin (côtes, Méditerranée, lac de Tibériade, mer Morte, Jourdain, relief ombré).
2. Couche de frontières antiques en GeoJSON et villes principales.
3. `lieux.json` pour les lieux des étapes jalons (3, 9, 12, 19, 27, 30, 33, 38, 40, 46), marqueurs et pastille « débattu ».
4. Un état central minimal (année courante, étape active, mode) auquel la carte s'abonne.

Commandes : `npm run dev`, `npm test`, `npm run build`, `npm run geo` (re-télécharge les données géographiques).

## Deuxième jalon : curseur et tracé animé (fait)

- `src/chronologie.ts` : échelle de la frise (1 unité par étape + 0,3 par année écoulée : l'enfance tient dans un petit tiers, le ministère occupe le reste).
- `src/actions.ts` : gestes (aller à une étape, glisser, relâcher avec aimantation, précédente/suivante, lecture/pause). Curseur, année et étape active changent toujours ensemble.
- `src/carte/trace.ts` : arcs doux d'une étape à la suivante (bombés à droite du sens de marche, pour distinguer les allers-retours), colorés par phase, résurrection en doré. Le voyage complet reste en filigrane.
- `src/ui/frise.ts` : frise sous la carte (phases, graduation par étape, jalons cliquables, repères d'années, bouton lecture). Clavier : flèches = étape précédente/suivante, Début/Fin.
- `lieux.json` couvre les 30 lieux des 46 étapes. Les lieux qui sont aussi des villes repères portent le nom de la ville.

Jalons suivants : 3) parcours guidé et annotations ; 4) mode comparer et zoom Passion (plan de Jérusalem : les lieux s'y chevauchent encore) ; 5) phase 2.

## Points encore ouverts

- Source du texte Louis Segond 1910 à retenir pour les citations.
- Tracé des frontières antiques à faire relire par Vincent.
- Textes d'histoire et de méditation pour les 46 étapes à faire relire par Vincent.
- Mer Morte : contour actuel (Natural Earth), coupé en deux bassins ; dans l'Antiquité elle était plus grande et d'un seul tenant. À redessiner si besoin.
- Relief limité au zoom 9 : flou sur Jérusalem en zoom rapproché. Le plan de Jérusalem (jalon 4) prendra le relais.
