# Journal des versions

Les versions suivent [SemVer](https://semver.org/lang/fr/) : `MAJEUR.MINEUR.CORRECTIF`.
Le numéro vit dans le fichier `VERSION` ; `build.py` l'inscrit dans `index.html`,
où il s'affiche dans le pied de l'accueil et à côté du logo dans l'éditeur.

## 2.5.0 — 2026-09-18

Deux gestes qui manquaient à l'accueil et au plan : **voir la planche avant de
lancer le moteur**, et **retirer du relevé une zone qui n'en est pas une**. Le
moteur n'a pas bougé : mêmes locaux, mêmes surfaces, mêmes cloisons.

### Ajouté

- **Aperçu au survol d'une vignette.** Une vignette de 92 px ne dit pas quel
  niveau on tient, ni ce que porte le cartouche : on lançait l'analyse pour le
  savoir, une minute pour rien quand ce n'était pas la bonne page. Survoler une
  vignette ouvre maintenant la planche en grand, à côté de la liste et jamais
  dessus, avec son badge de diagnostic. La molette zoome sous le curseur, le
  glisser déplace, le double-clic et *Ajuster* reviennent à la page entière,
  Échap ferme. **Le rendu suit le zoom** : la page s'affiche tout de suite à la
  définition de la fenêtre, puis se refait plus finement dès qu'on grossit —
  plafonné à 16 Mpx, une planche 36 × 24 po rendue sans limite coûterait 65 Mo.
  Les quatre sources y passent : PDF, SVG, DXF et image.
- **Suppr retire une zone du relevé.** L'aide clavier promettait « supprimer
  l'objet sélectionné » ; une cloison, une porte et un espace tracé à la main
  obéissaient, une pièce détectée non. Or le moteur sort toujours des cellules
  qui ne sont pas des locaux — un vide de mur, une échancrure, le cadre d'un
  numéro — et rien ne permettait de les enlever. La pièce sélectionnée s'efface
  donc à la touche `Suppr`, ou par le bouton du panneau. Elle disparaît du plan,
  ses cloisons quittent le métré, la conformité, la légende et les exports (JPG,
  PowerPoint, DXF, CSV), et le compte des pièces en tient compte.
- **Ce qui a été retiré se voit et se rétablit.** Une zone détectée est *mise de
  côté*, pas effacée : l'analyse la connaît toujours. Le panneau au repos dit
  combien de zones sont hors du relevé et les ramène d'un bouton ; `Ctrl+Z` fait
  de même, et le retrait s'enregistre avec le reste du relevé (`suppr`), donc
  survit à une sauvegarde rouverte. Un espace tracé à la main, lui, s'efface
  vraiment : rien d'autre ne le porte.

### Modifié

- Le banc fonctionnel passe de **63 à 77 vérifications** : l'ouverture de
  l'aperçu, son rendu, le zoom à la molette et sa reprise de définition, le
  retour à la planche entière, la fermeture ; puis le retrait d'une zone, la
  sortie de ses cloisons du métré, sa trace dans l'état enregistré, le fait que
  le moteur la connaisse encore, et son retour par `Ctrl+Z`.

## 2.4.0 — 2026-09-18

Les trois premiers points du carnet de reprise : les murs pochés, les libellés
vectorisés, l'échelle. La géométrie ne bouge pas — mêmes locaux, mêmes surfaces,
mêmes cloisons — mais les locaux ont désormais un nom, et l'échelle se lit sur le
plan au lieu de se saisir.

| Niveau | locaux | retrouvés | fusions | manques | écart médian | noms lus | numéros justes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | 23 | 23 | 0 | 0 | 1,7 % | 0 → **23** | 0 → **21** |
| 02 | 37 | 37 | 0 | 0 | 2,5 % | 0 → **37** | 0 → **33** |
| 03 | 37 | 37 | 0 | 0 | 3,3 % | 0 → **36** | 0 → **34** |

### Ajouté

- **Les murs dessinés en aplat plein sont lus.** Un plan dont les murs sont
  pochés sans contour au trait ressortait vide : `balayerPDF` comptait l'aplat
  puis jetait le chemin, et un mur tracé en rectangle ne donnait aucun segment,
  même au trait. Les contours fermés des aplats sont maintenant retenus, les
  rectangles développés en leurs quatre côtés, et les aplats sombres, longs et
  minces — ni un L, ni une étoile, ni un jambage de lettre — peints dans les
  masques à leur épaisseur réelle. Sur un plan poché, le seuil de largeur de
  trait n'est plus abaissé : les pochés *sont* les murs, et l'abaisser ferait
  passer le mobilier pour des cloisons.
- **Les libellés vectorisés sont lus par reconnaissance de forme.** C'était le
  cas des trois plans d'essai : `getTextContent` ne rendait que le cartouche et
  les 97 locaux sortaient « Espace non identifié », donc sans catégorie
  acoustique ni cible STC. Les lettres, restées là en aplats de la taille d'un
  caractère, sont reconnues à leur silhouette, comparée à un alphabet que le
  navigateur dessine lui-même — pas d'OCR à embarquer, rien qui sorte du poste.
  La silhouette seule ne suffit pas : trois mesures prises dans les métriques de
  la ligne (hauteur au-dessus du pied, jambage, largeur) séparent le « M » du
  point, le « H » du « n », le « g » du « 9 ». **96 noms de locaux sur 97** sont
  lus, à 97 % de ressemblance moyenne.
- **Les étiquettes se lisent en bloc.** Un numéro, le nom dessous, la surface
  encore dessous : c'est la disposition de tous les plans d'architecte. La lire
  ainsi vaut mieux que de ramasser tous les mots tombés dans la cellule — les
  cotes, les repères de menuiserie et les légendes n'entrent plus dans le nom du
  local. L'étiquette s'accroche à son nom et non à son numéro, celui-ci étant
  encadré d'un rectangle tracé que le moteur voit comme un mur.
- **L'échelle se déduit du plan.** Le rayon des battants de porte désigne, parmi
  les échelles usuelles, celle à laquelle les portes de ce plan ont une largeur
  de porte — les échelles s'échelonnent d'un quart en un quart, les portes ne
  varient que de quinze pour cent, la désignation est donc franche. Le cartouche
  (« 1 : 100 ») sert de recoupement, et la divergence est dite. Un bouton
  *Détecter* renseigne le champ à l'accueil ; à l'issue de l'analyse, une échelle
  manifestement fausse est signalée, sans calcul supplémentaire puisque les
  battants sont déjà relevés.
- **Le numéro et le nom d'un local détecté se corrigent.** Ils ne l'étaient que
  pour les espaces tracés à la main. Un nom lu par reconnaissance de forme garde
  parfois une lettre de travers, et il commande la catégorie et la cible STC : il
  se reprend dans le panneau de la pièce, suit jusque dans les cloisons, les
  métrés et les exports, s'annule et s'enregistre avec le reste.
- **Le texte pivoté n'est plus jeté.** `motsPDF` écartait tout ce dont la matrice
  n'était pas droite — le nom d'un local posé sur une gaine verticale, une
  légende de coupe. Chaque mot est maintenant posé le long de sa propre direction
  d'écriture. Même chose pour le SVG.
- **Le SVG livre aussi ses aplats**, donc ses murs pochés et ses libellés
  vectorisés, par le même chemin que le PDF.
- **Un badge *Texte vectorisé*** à l'accueil, distinct de *Sans texte* : le
  premier annonce des libellés lus par reconnaissance de forme, le second des
  locaux à nommer à la main.

### Corrigé

- **La classification tolère les confusions de forme.** « Salle » lu « SaIIe » ne
  trouvait plus le mot-clé « salle » : le local tombait dans `prive`, cible 45 au
  lieu de 50-55. Les noms se comparent maintenant aussi à travers les familles de
  formes que rien ne sépare (l/i/1, o/0, s/5, g/9…).

### Modifié

- **Le banc de vérité terrain mesure les libellés** : numéros exacts, noms
  reconnus, ressemblance moyenne, et la liste de ceux qui restent à revoir avec
  ce que le plan dit et ce qui a été lu.
- **Deux plans d'essai de plus** — le même bâtiment aux murs pochés, à 1/100 et à
  1/50 — et le banc fonctionnel passe de 41 à 63 vérifications : murs en aplat et
  leur épaisseur, déduction d'échelle et recoupement du cartouche, lecture des
  étiquettes (« 11 m² » que les blancs entre chiffres coupaient en « 1 1 m », le
  tiret d'un sous-local, une cote isolée qui n'est pas un numéro), correction
  d'un libellé et son annulation.

## 2.3.0 — 2026-09-18

Refonte de la détection des espaces. Mesurée sur trois niveaux d'un vrai projet,
contre les étiquettes relevées sur le plan (numéro, nom, surface déclarée) :

| Niveau | locaux au plan | retrouvés | fusionnés | manqués | écart de surface (médian) | portes |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | 23 | 9 → **23** | 6 → **0** | 8 → **0** | 7,1 % → **1,7 %** | 18 → 52 |
| 02 | 37 | 10 → **37** | 3 → **0** | 24 → **0** | 8,1 % → **2,4 %** | 7 → 51 |
| 03 | 37 | 13 → **37** | 2 → **0** | 22 → **0** | 8,0 % → **3,3 %** | 10 → 49 |

### Corrigé

- **Deux locaux sur trois étaient jetés faute d'étiquette lisible.** Une cellule
  sans nom n'était gardée que si elle dépassait 12 m² — ce qui supprimait tous
  les bureaux, sanitaires, rangements et locaux techniques de n'importe quel plan
  dont les libellés sont vectorisés à l'export. Le seuil descend à 2 m² ; en
  dessous, on a affaire à un meuble ou à un cartouche, pas à un local.
- **Les arcs de battement ne sont plus des obstacles.** Peints dans le masque
  comme des cloisons, ils balayaient la pièce et le couloir, découpaient les
  circulations en tronçons et rognaient les surfaces. La baie qu'ils signalent
  est désormais refermée par un trait posé au droit du mur.
- **Les portes n'étaient presque jamais vues** — 10 sur 49 sur le plan d'essai.
  Les arcs étaient chaînés sur les sous-chemins du PDF ; or beaucoup d'exports
  CAO écrivent chaque segment en « moveTo/lineTo » et dessinent les battants en
  tirets, si bien qu'un quart de cercle arrive en onze sous-chemins séparés. Le
  chaînage suit maintenant la géométrie.
- **Les surfaces sortaient 25 % trop petites sur les petits locaux.** Une pièce
  n'était que son vide : le mobilier, les appareils sanitaires, les battants et
  jusqu'au cartouche de son étiquette y creusaient des trous. Les pièces
  repoussent maintenant sur tout ce qui n'est pas mur ou baie fermée, et
  reprennent la moitié intérieure du trait de mur, qui est centré sur la face.
- **Un trou d'un pixel faisait communiquer deux pièces.** Les traits qui
  referment une baie sont accrochés au pixel de mur le plus proche et débordent
  de quelques centimètres de part et d'autre.

### Ajouté

- **Linteaux virtuels.** Deux bouts de mur restés face à face, alignés et
  distants de 0,55 à 2,00 m, valent une ouverture : elle est refermée avant la
  recherche des pièces. Sans cela il fallait demander à la fermeture
  morphologique de combler 0,90 m, ce qui soudait les couloirs du même coup.
  Couvre aussi les baies sans battant dessiné et les portes coulissantes.
- **Les régularités du dessin sont reconnues et écartées** : quatre traits
  parallèles régulièrement espacés de moins d'une porte (revêtement, hachure de
  poché, volée de marches) et les tirets réguliers alignés d'un trait d'axe de
  trame. Un gymnase dont le plancher est dessiné en lames de 5 cm et le terrain
  de badminton qui s'y superpose ressortaient en une trentaine de cellules.
- **Une cloison fine doit être doublée.** Une cloison a une épaisseur : deux
  traits parallèles à 5–40 cm. Un trait fin isolé est un marquage au sol ou
  l'arête d'un meuble — il ne sépare plus deux locaux.
- **Banc de vérité terrain** (`tests/verite.mjs`) : le plan passe dans le vrai
  chemin de l'outil, et le relevé est confronté à une liste de locaux lue sur le
  plan. Rapport par local, comptage des fusions, des manques et de l'écart de
  surface. Les fichiers de vérité restent hors dépôt, avec les plans.

### Modifié

- **Le rattrapage des circulations est retiré.** Il rendait les couloirs que les
  arcs de battement détruisaient ; ceux-ci n'étant plus peints, il ne rattrapait
  plus rien et coûtait un quart du temps d'analyse. L'analyse d'une planche
  36 × 24 po passe de ~15 s à ~11 s.
- **La finesse ne décide plus du résultat.** Elle arbitrait entre pièces soudées
  et pièces éclatées ; les baies étant refermées explicitement, le même plan
  donne les mêmes 37 locaux à finesse 2, 4 ou 6.

## 2.2.0 — 2026-09-17

### Modifié

- **Relancer l'analyse ne repasse plus par l'accueil.** Le moteur tourne sur
  place, derrière un voile qui montre l'étape courante et une jauge « étape n / 10 ».
  Le plan reste à l'écran. Si l'analyse échoue, le voile le dit et le relevé en
  cours est rendu intact — seul le bouton *Fermer* le referme.

## 2.1.1 — 2026-09-17

### Corrigé

- **Les menus de la barre d'outils ne s'ouvraient pas.** « Auto-connexion » et
  « Page / PDF » basculaient bien, mais s'affichaient *à l'intérieur* de la barre,
  haute de 42 px et coupée à `overflow:hidden` : ils étaient intégralement rognés,
  donc invisibles et non cliquables. Comme le bouton « Relancer l'analyse » vit
  dans le menu « Page / PDF », il était lui aussi inatteignable — impossible de
  relancer le moteur une fois dans l'éditeur. Menus et popovers sont désormais en
  position fixe et posés sous leur bouton, en restant dans la fenêtre. *Le défaut
  existait déjà en 2.0.0.*
- **Barre d'outils tronquée entre 1421 et 1536 px de fenêtre.** Le rang de
  dégarnissage tombait à 1420 px alors que la barre garnie réclame 1177 px, soit
  une fenêtre d'au moins ~1537 px avec le volet latéral : « Page / PDF » était
  coupé en « Page / PD ». Seuils mesurés et replacés (1540 px pour les libellés
  d'outils, 1680 px pour les raccourcis clavier).
- **Le masquage des libellés d'outils ne masquait rien.** La règle visait
  `span:not(.dot)` alors que les libellés sont des nœuds texte : les boutons
  rétrécissaient à 28 px et le texte débordait par-dessus ses voisins.

### Ajouté

- Le banc d'essai vérifie maintenant que les menus sont *atteignables au clic*
  (`elementFromPoint`), que « Relancer l'analyse » aboutit depuis l'éditeur, et
  que le dernier groupe de la barre tient dans la barre. 39 vérifications.

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
