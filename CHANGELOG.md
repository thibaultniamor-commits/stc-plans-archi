# Journal des versions

Les versions suivent [SemVer](https://semver.org/lang/fr/) : `MAJEUR.MINEUR.CORRECTIF`.
Le numéro vit dans le fichier `VERSION` ; `build.py` l'inscrit dans `index.html`,
où il s'affiche dans le pied de l'accueil et à côté du logo dans l'éditeur.

## 2.1.0 — 2026-09-17

### Ajouté

- **Diagnostic de la source, avant l'analyse.** Chaque page reçoit un badge sur
  sa vignette — *Vectoriel*, *Sans texte*, *Image*, *Sans plan* — et la page
  choisie affiche en clair ce que l'outil saura en tirer. Le cas *Sans texte*
  (tracés lisibles, libellés vectorisés à l'export) était jusqu'ici indiscernable
  d'un bug : l'analyse réussissait sans nommer aucun local.
- **Import SVG.** Même traitement que le PDF vectoriel : traits, largeurs,
  couleurs et libellés. Les dimensions physiques du fichier (`width`/`height` en
  mm, pt, in…) donnent l'échelle.
- **Import DXF.** Développement des blocs (`INSERT`, imbriqués, en grille),
  `LINE`, `LWPOLYLINE`, `POLYLINE`, `ARC`, `CIRCLE`, `ELLIPSE`, `SOLID`, `TEXT`,
  `MTEXT` et `ATTRIB`. Deux gains que le PDF ne donne pas :
  - les **calques** remplacent l'heuristique d'épaisseur de trait — l'outil les
    répartit en *Mur* / *Porte* / *Ignorer*, et la répartition se corrige d'un
    clic dans une carte dédiée ;
  - les **unités du fichier** (`$INSUNITS`, ou l'ordre de grandeur de l'étendue)
    donnent l'échelle exacte : plus rien à saisir ni à calibrer.
- **Relevé manuel sur un fond image.** PNG, JPG, WebP — et toute page PDF
  reconnue comme un scan — se chargent comme fond de plan. Les outils de tracé de
  l'éditeur (cloison, pièce, espace, porte, calibrage) restent tous disponibles.
  Un scan n'est plus une impasse.
- **Numéro de version** affiché dans l'outil et embarqué dans les sauvegardes.

### Corrigé

- **Tracés PDF perdus quand l'épaisseur est posée après le chemin.** Le moteur
  n'acceptait un tracé que si l'opérateur de peinture suivait immédiatement sa
  construction. Les flux qui écrivent `chemin … épaisseur couleur trait` — c'est
  le cas de plusieurs exporteurs — voyaient **tous** leurs traits ignorés, et le
  plan ressortait vide. Le chemin est désormais mis de côté et matérialisé sur
  l'opérateur de peinture, avec l'état graphique qui s'y applique.

### Modifié

- L'accueil accepte `.pdf`, `.svg`, `.dxf`, `.png`, `.jpg`, `.jpeg`, `.webp`.
- « Relancer l'analyse » n'apparaît que si la source est encore là et analysable.
- Les noms de fichiers exportés perdent l'extension d'origine quelle qu'elle soit,
  et non plus seulement `.pdf`.

## 2.0.0 — 2026-09-09

Première version publiée du dépôt : refonte complète de l'interface de la V1,
moteur d'analyse inchangé. Voir le README, section « Ce qui change par rapport à
la V1 ».
