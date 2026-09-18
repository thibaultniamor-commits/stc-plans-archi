# Ce qu'il reste à faire

État au 2026-09-18, après la v2.4.0 (murs pochés, libellés vectorisés, échelle).
Cette liste est un carnet de reprise : chaque entrée dit **ce qu'on observe**,
**ce qu'on en sait déjà**, et **où ça se joue dans le code**. Les numéros de ligne
renvoient à `src/outil_stc.src.html` au moment de la v2.4.0.

## Où on en est

Mesuré sur trois niveaux d'un projet réel, contre les étiquettes du plan
(`tests/verite.mjs`, fichiers de vérité hors dépôt, à côté des plans) :

| Niveau | locaux au plan | retrouvés | fusions | manques | écart médian | noms lus | numéros justes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | 23 | 23 | 0 | 0 | 1,7 % | 23 | 21 |
| 02 | 37 | 37 | 0 | 0 | 2,5 % | 37 | 33 |
| 03 | 37 | 37 | 0 | 0 | 3,3 % | 36 | 34 |

Ce sont les chiffres à retrouver avant de toucher au moteur, et à comparer après.
Une planche 36 × 24 po s'analyse en ~8 à 16 s.

```
node tests/verite.mjs index.html <plan.pdf> <verite.json> [finesse] [sortie.json]
python tests/fixtures.py && node tests/banc.mjs     # 63 vérifications fonctionnelles
```

---

## 1. Ce qui reste des libellés lus par reconnaissance de forme

*Les points 1, 2 et 3 de ce carnet — murs pochés, libellés vectorisés, échelle —
sont faits en v2.4.0. Voici ce qu'ils laissent ouvert.*

**Observé** : 96 noms sur 97 sont lus, mais **88 numéros sur 97** seulement. Les
neuf manquants perdent leur tiret : « 305-1 » ressort « 3051 ». Et une lettre
sur vingt reste fausse — presque toujours le « l » et le « I », qui ont
exactement le même dessin dans une linéale.

**Ce qu'on en sait** : `numeroDe` (:2807) ne sépare le local de son sous-local
que si un tiret a été *reconnu* ; sinon il colle les chiffres, parce que le blanc
n'est pas un séparateur fiable — les chiffres respirent deux fois plus que les
lettres, et « 11 » sortait « 1 1 ». Le tiret fait 1,6 × 0,8 pt : il est au bord
de `GLY_H_MIN` (0,6 pt) et se perd dans les arrondis. Pour le « l » et le « I »,
`reparerBarres` (:2765) tranche sur le contexte (une barre après une minuscule
est un « l ») ; en tête de mot, il n'y a rien à faire.

**Pistes** : mesurer le **pas** entre glyphes plutôt que le vide entre encres —
dans un nombre il est régulier, un tiret y fait un trou d'exactement une chasse ;
et, pour le reste, un **panneau de relecture** listant les libellés dont la
distance moyenne (`L.d`) est la plus mauvaise, pour les reprendre d'affilée
plutôt qu'en cherchant la pièce sur le plan.

**Non traité** : le texte **vectorisé et pivoté**. `lireGlyphes` (:2677) assemble
les lignes sur une ligne de pied horizontale ; un nom de local écrit à la
verticale sur une gaine n'est pas lu. Le texte pivoté qui est *resté du texte*,
lui, est lu depuis la v2.4.0.

## 2. Les aplats qui ne sont ni des murs ni des lettres

**Observé** : `pochesDeMur` (:1116) ne garde que les barreaux — au moins 2,2 fois
plus longs que larges, et pleins à 55 %. Un **poteau** poché carré, une trémie
hachurée, un mur poché coupé en L par l'exportateur passent à travers.

**Ce qu'on en sait** : le filtre est volontairement étroit. Un aplat sombre
compact de 0,4 m, à 1/100, c'est aussi bien un poteau qu'une puce de légende ou
un symbole plein ; les accepter sans autre critère rapporterait du bruit dans les
masques. Les glyphes, eux, sont écartés proprement par `polysDeTexte` (:2670),
qui ne retient comme texte que ce qui est aligné à trois sur une même ligne de
pied.

**Piste** : accepter un aplat compact s'il touche un mur déjà reconnu (poteau
dans un refend) ou s'il se répète en trame régulière (poteaux d'une file).

## 3. L'échelle quand il n'y a pas de portes

**Observé** : `echelleAuto` (:1465) demande au moins cinq battants concordants.
Un plan d'étage technique, une coupe, un plan de toiture n'en ont pas : le
bouton *Détecter* se rabat alors sur le cartouche, et à défaut ne dit rien.

**Ce qu'on en sait** : la lecture du cartouche (`echelleCartouche`, :1502)
cherche « 1 : 100 » dans les mots de la page, sur les plans d'essai elle échoue —
le cartouche porte l'échelle sous une forme qu'aucun `1:n` ne décrit, ou sur deux
lignes. Le recoupement marche sur les fixtures, pas sur le corpus réel.

**Pistes** : lire les **cotes** — une chaîne de cotation donne le rapport entre
la longueur dessinée et le nombre écrit au-dessus, c'est l'échelle exacte et sans
hypothèse ; et, pour le cartouche, chercher le nombre qui suit le mot
« échelle » / « scale » plutôt qu'un motif `1:n`.

## 4. Les ouvertures de plus de 2 m ne sont pas refermées

**Observé** : deux espaces séparés par un passage large ne font qu'un local.

**Ce qu'on en sait** : `linteauxVirtuels` (:1489) apparie les bouts de mur
distants de `GMIN=0,55 m` à `GMAX=2,00 m`. Le plafond a été monté de 1,70 à
2,00 m pour couvrir les portes doubles (1,87 m mesuré sur un gymnase) ; au-delà,
refermer à l'aveugle couperait en deux des espaces que l'architecte compte pour
un.

**Piste** : ne refermer au-delà de 2 m que si l'ouverture porte les marques d'une
baie — tableaux dessinés, seuil, repère de menuiserie — ou laisser l'utilisateur
trancher, le tracé manuel de cloison existant déjà.

## 5. Les cellules anonymes en trop

**Observé** : 18 à 30 cellules sans étiquette par plan, en plus des locaux réels.
Une part est légitime (circulations, cages, gaines), le reste est du creux :
vides de murs, échancrures, cellules de moins de 3 m².

**Ce qu'on en sait** : une cellule sans nom est retenue au-dessus de
`AIRE_ANON = 2 m²` (:1055). Descendre ce seuil de 12 à 2 m² est ce qui a rendu
les deux tiers des locaux — il ne faut pas le remonter sans mesurer.

**Piste nouvelle depuis la v2.4.0** : les étiquettes sont maintenant lues et
rattachées à leur cellule. Une cellule **sans étiquette** alors que toutes ses
voisines en ont une est suspecte — et, à l'inverse, une étiquette prouve le
local, ce dont le filtre de trame tient déjà compte. Le nombre d'étiquettes lues
donne aussi un décompte attendu des locaux, à comparer aux cellules retenues.

**Autres pistes** : trancher par la trame de sol (`filtreTrame` sait déjà le
faire pour les candidats), par la présence d'une porte, ou fusionner une cellule
dont la frontière est presque entièrement partagée avec une seule voisine.

## 6. Les cloisons obliques sont cassées

**Observé** : un mur en biais ressort en marches d'escalier.

**Ce qu'on en sait** : `runsDe` (:1608) projette les pixels d'adjacence sur l'axe
H ou V dominant et reconstruit un segment droit. Tout ce qui n'est ni horizontal
ni vertical se fragmente.

**Piste** : ré-associer les segments vecteurs d'origine aux pixels d'adjacence,
au lieu de reconstruire depuis le raster. C'est aussi ce qui donnerait des
contours de pièce droits plutôt que la frontière molle laissée par la croissance
là où deux pièces se rencontrent dans du mobilier repris.

## 7. Les seuils qui restent en pixels

**Observé** : rien de visible à 1:100, mais tout se décale à 1:50 et à 1:200.

**Ce qu'on en sait** : le code raisonne en mètres (`linteauxVirtuels`,
`tramesRegulieres`, `finsDoublees`, `croissance`, `pochesDeMur`). Restent en
pixels : `RSCALE=2` (:1051), le rayon d'emprise `closing(mask,W,H,30)` (:2052),
l'adjacence `K=14` (:2240), le `GAP=10` de `runsDe` (:2241), et les `L>=6` /
`L>=12` du tracé des masques. Entre 1:50 et 1:200 cela fait un facteur 4.

**Piste** : tout exprimer via `ptPerM`, et rendre `RSCALE` adaptatif (viser
≥ 15 px/m, plafonné par la mémoire : une planche 36 × 24 po fait déjà 6,5 M px).
L'échelle n'étant plus à saisir (v2.4.0), le moteur la connaît désormais avant
d'ouvrir le premier masque.

**Sans objet ici** : les seuils de la reconnaissance de forme (`GLY_H_MIN`,
`GLY_H_MAX`, :2484) sont en points *à dessein* — un texte imprimé fait 2 à 4 mm
sur le papier quelle que soit l'échelle du plan.

## 8. La classification par mots-clés

**Observé** : un local mal orthographié ou absent du dictionnaire tombe dans
`prive` par défaut — et se voit attribuer une cible de 45 au lieu de 50-55.

**Ce qu'on en sait** : `classifier` (:1072) fait un `includes` de mots-clés dans
l'ordre des catégories. Depuis la v2.4.0 il repasse, à défaut, sur une
comparaison **floue** (`flou_`, :1065) qui rabat les familles de formes que la
reconnaissance confond — c'est ce qui sauve « SaIIe » lu pour « Salle ». Cela ne
règle pas l'orthographe : ça règle la lecture.

**Piste** : mots entiers plutôt que sous-chaînes, score plutôt que premier
trouvé, et un champ `confiance` affiché dans l'UI pour que le doute se voie — le
moteur en a maintenant deux à combiner, la qualité de lecture du libellé (`L.d`)
et la netteté du mot-clé trouvé.

## 9. Le harnais de mesure est à moitié fait

**Ce qui existe** : `tests/verite.mjs` (justesse des pièces : appariement par le
point de l'étiquette, fusions, manques, écart de surface ; et, depuis la v2.4.0,
justesse des libellés : numéros exacts, noms reconnus à travers les familles de
formes, ressemblance moyenne, liste des noms à revoir) et `tests/banc.mjs`
(63 vérifications fonctionnelles sur plans synthétiques).

**Ce qui manque** :
- l'appariement des **paires de locaux** et des **portes**, et un score résumé ;
- un étage **stabilité** : sorties de référence commitées pour des plans sans
  vérité, re-bénissables (`--update-baseline`), qui attrapent les effets de bord ;
- un bouton « Exporter la vérité terrain » dans l'outil, qui sérialiserait l'état
  **après** corrections manuelles — c'est le moyen le moins coûteux d'étendre le
  corpus, et il est devenu plus intéressant encore : l'outil lit maintenant les
  numéros et les noms, il n'y a plus qu'à les corriger, pas à les saisir ;
- un corpus d'un **autre émetteur** : les trois plans de référence sortent du
  même exporteur. C'est vrai pour la géométrie, et plus encore pour la
  reconnaissance de forme, réglée sur une seule police (une linéale proche
  d'Arial). Un plan lettré en Romans ou en Century Gothic est le prochain test
  qui apprendra quelque chose.

## 10. Petites dettes

- `lignesUtiles` (:1088) écarte les « pointillés aplatis » par une règle locale
  (4 segments courts consécutifs) que `tramesRegulieres` (:1702) recouvre
  largement, en mieux. À fusionner un jour.
- La reconnaissance de forme coûte une passe de canevas sur tous les glyphes de
  la planche (2 000 environ). Elle est groupée — les vignettes sont dessinées en
  damier et relues d'un seul `getImageData` — mais elle tourne à chaque analyse,
  y compris quand on relance à une autre finesse. Un cache par page la rendrait
  gratuite à la relance.
- La **finesse** n'a presque plus d'effet : le même plan donne les mêmes locaux à
  2, 4 ou 6. Soit on la retire de l'interface, soit on lui redonne un rôle
  explicite (par exemple le seuil `AIRE_ANON`).
- Le temps d'analyse tient surtout à trois passes sur 6,5 M px : la fermeture
  d'emprise (rayon 30), le `labelCC`, et l'adjacence. L'emprise pourrait se
  calculer en demi-résolution.
- Une salle divisible par des cloisons mobiles est comptée pour un local sur le
  plan et pour trois par le moteur : ce n'est pas un défaut du moteur, mais la
  vérité terrain doit le dire, sinon l'écart de surface s'affole.

---

## Pièges déjà payés — à ne pas redécouvrir

- Beaucoup d'exports CAO écrivent **un sous-chemin par segment**
  (`moveTo`/`lineTo`) et dessinent arcs et axes **en tirets géométriques**, sans
  `setDash`. Tout chaînage doit se faire sur la géométrie, jamais sur les
  sous-chemins — c'est ce qui faisait rater 39 portes sur 49.
- `wallpix` contient les murs **et** les traits fins longs : y chercher un bout de
  mur fait passer un vantail de porte pour un mur et bouche la baie. C'est à cela
  que sert le masque `murpix`, murs seuls.
- Un trou d'**un pixel** dans un linteau fait communiquer deux pièces. D'où
  l'accrochage au pixel de mur le plus proche et le débord de 6 cm.
- Les arcs de battement ne sont **pas** des obstacles : les peindre découpe les
  couloirs et rogne les pièces.
- `window.__MOTEUR_DBG` livre les masques intermédiaires (`mask`, `wallpix`,
  `murpix`, `barr`, `hull`, `lab`, `linteaux`, `poches`, `etiq`…). Rendre une
  pièce en image reste le moyen le plus rapide de comprendre pourquoi elle sort
  de travers.
- **Une vignette qui étire la boîte englobante efface la taille du glyphe** : le
  « M » y devient un point, le « H » un « n », le « i » un « l », et le « 0 » un
  « ô » — dont la panse, écrasée par la même normalisation, fait un rond plus
  rond que le zéro. D'où les trois mesures ajoutées à la silhouette (hauteur
  au-dessus du pied, jambage, largeur), prises dans les métriques de la ligne, et
  le surcoût constant imposé aux caractères rares. **Normaliser à la place sur
  la ligne de pied a été essayé et rend moins bien** : la minuscule n'a plus que
  sept pixels de haut, et la forme se perd plus que la taille ne se gagne.
- **La ligne de pied d'un rang se prend à la médiane**, jamais à la moyenne : les
  quelques jambages descendants (p, g, y) la tirent sous le pied, et toutes les
  hauteurs mesurées ensuite avec elle.
- **Le blanc entre chiffres n'est pas un blanc entre mots** : les chiffres ont de
  larges approches, et « 11 m² » sortait « 1 1 m » — donc 1 m². Le seuil de mot
  se prend sur la distribution des trous du bloc lu, pas sur la hauteur seule.
- **L'exposant du « m² » tombe sur sa propre ligne** et se lit « 2 » : il passait
  pour le numéro du local, et « 38 m » pour sa surface. Un exposant est plus
  petit que la ligne qu'il coiffe ; un numéro de local, jamais.
- **Le numéro d'un local est encadré d'un rectangle tracé**, que le moteur voit
  comme un mur : le cadre est une cellule à lui seul, et l'étiquette accrochée à
  son numéro atterrissait dedans. On l'accroche donc à son nom, et on ne retient
  jamais qu'une cellule de taille de pièce.
- **Sur un plan poché, ne pas abaisser le seuil de largeur de trait.** Ce
  repêchage sert à retrouver des cloisons fines sur un plan au trait ; sur un
  plan poché, les murs sont les aplats, et l'abaisser fait des cloisons avec le
  mobilier et les battants.
- **L'axe principal d'un polygone se calcule sur les arêtes pondérées par leur
  longueur**, pas sur ses sommets : un coin répété (les exports ferment souvent
  sur le point de départ) ou une courbe finement découpée fait basculer l'axe, et
  l'épaisseur mesurée avec lui — 0,15 m lue 0,22 m.
