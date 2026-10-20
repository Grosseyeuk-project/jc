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
- Parcours guidé : caméra qui suit l'étape, précédent/suivant, contexte historique puis citations (la méditation a été retirée à la demande de Vincent).
- Mode comparer : sélecteur d'évangile (Mt, Mc, Lc, Jn) ; on surligne toutes les étapes dont le champ `variante` est rempli dans `etapes.json` (19 étapes : 5, 6, 7, 10, 11, 13, 17, 18, 19, 21, 30, 32, 34, 36, 37, 40, 42, 45, 46). Le champ fait foi, pas une liste figée.
- Technique : Vite + TypeScript, MapLibre GL 6 (choix confirmé), JSON statique, aucun serveur. Étiquettes en HTML (pas de serveur de glyphes).

## Données

- `src/data/etapes.json` : les 46 étapes de référence. Ordre harmonisé, références, certitude du lieu, variantes, `note` (remarques de datation).
- `src/data/lieux.json` : fait pour les lieux des jalons ; à compléter pour les 46 étapes. Un lieu par identifiant utilisé dans `etapes.json`, avec `type` (point, zone ou trajet), `coord` [lat, lon] et `certitude` (certain, probable, debattu). Vérifier chaque coordonnée sur une source fiable avant de l'inscrire ; ne rien inventer pour les lieux débattus (donner le site traditionnel et le marquer `debattu`). Chaque lieu a un champ `source`. La certitude affichée dans la fiche est celle de l'étape (`certitude_lieu`), car un même lieu peut varier (mont des Oliviers : certain pour l'entrée à Jérusalem, probable pour l'Ascension).
- `src/data/villes.json` : villes repères (sources citées), `rang` 1 à 3 pour la densité selon le zoom.
- `src/data/frontieres.json` : régions vers l'an 30, tracées à la main (GeoJSON, [lon, lat]).
- `public/geo/` et `public/relief/` : Natural Earth 1:10m et tuiles d'altitude Terrarium, produits par `npm run geo`.
- `src/data/textes.json` : par étape, `histoire` (factuelle) et `citations` (références, 1 à 3, prises dans les références de l'étape). Typographie française (espaces fines insécables).
- `src/data/citations-lsg.json` : texte Louis Segond 1910 des citations, généré par `npm run citations` (ne pas éditer à la main). Source : dépôt GitHub BibleCorps/FRA-B-LSG1910-PD-UBS (domaine public), figé sur le commit 0a17bed. Les coupes d'extrait sont signalées par « … » à l'affichage.

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

## Troisième jalon : parcours guidé et annotations (fait)

- Mode `parcours` : pour chaque étape, contexte historique, puis citations (champ `section` de l'état), puis étape suivante. Le tracé s'allonge et la caméra suit pendant le passage d'une étape à l'autre.
- Barre de progression, « Quitter le parcours », clavier ← → et Échap. On peut démarrer depuis l'étape affichée.
- Cartouche sur la carte (numéro, titre, date) pendant le parcours.
- En mode explorer, la fiche affiche aussi les deux parties.

## Quatrième jalon : comparer, Passion, Résurrection (fait)

- Onglets de mode : Explorer, Parcours guidé, Comparer.
- Comparer (`src/evangiles.ts`) : choix de Mt, Mc, Lc ou Jn ; le tracé ne relie que les étapes de cet évangile ; les lieux et graduations absents s'estompent ; les étapes à variante sont cerclées sur la carte et marquées d'un losange sur la frise ; la fiche montre un tableau « Selon les évangiles » et l'encart « Ce qui diffère » ; liste des 19 récits qui diffèrent.
- Passion (`src/passion.ts`, `src/ui/horloge.ts`) : réglette du jeudi 18 h au vendredi 18 h (nuit ombrée, heures supposées) dès qu'une étape 34-39 est active ; heure dans la fiche et le cartouche.
- Plan de Jérusalem vers l'an 30 (`src/data/jerusalem.json`) : murailles (Golgotha hors les murs), esplanade du Temple, Antonia, palais d'Hérode, vallées ; il apparaît à partir du zoom 12. Côté des noms réglé par lieu (champ `etiquette` de `lieux.json`) pour éviter les chevauchements.
- Résurrection : lieux dorés une fois atteints, apparitions numérotées de 1 à 5 (pastilles dorées cliquables).
- Les marqueurs MapLibre portent une `opacity` en ligne : pour estomper, utiliser `filter: opacity()`.

Suite : on continue d'améliorer la version actuelle avant d'ouvrir la phase 2.

## Phase 2 (reportée)

Décision de Vincent, à appliquer le moment venu : Pierre et Paul d'après les Actes des Apôtres (Pierre : Pentecôte, Samarie, Joppé, Césarée ; Paul : conversion, trois voyages missionnaires, voyage vers Rome), citations Louis Segond. Dans la même page, avec un sélecteur de récit « Jésus / Les apôtres » ; la carte s'élargit à la Méditerranée orientale pour les apôtres.

## Points encore ouverts

- Tracé des frontières antiques et plan schématique de Jérusalem à faire relire par Vincent.
- Textes d'histoire des 46 étapes, et choix des citations, à faire relire par Vincent (premier jet dans `textes.json`).
- Mer Morte : contour actuel (Natural Earth), coupé en deux bassins ; dans l'Antiquité elle était plus grande et d'un seul tenant. À redessiner si besoin.
- Relief limité au zoom 9 : flou en zoom rapproché ; à Jérusalem, le plan schématique prend le relais.
