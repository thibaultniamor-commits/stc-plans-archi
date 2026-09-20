# Cibles STC — V2

Outil web autonome pour relever les **cibles d'affaiblissement acoustique (STC)**
d'un plan d'architecture : on dépose le plan exporté de la CAO — **PDF vectoriel,
SVG ou DXF** — l'outil détecte les locaux et les cloisons qui les séparent, les
classe, et attribue à chaque cloison la cible du couple de catégories. Un scan ou
une image sert de fond à relever à la main.

**→ [Ouvrir l'outil](https://thibaultniamor-commits.github.io/stc-plans-archi/)**

Tout se passe dans le navigateur : aucun serveur, aucun envoi de fichier. La page
fonctionne aussi hors ligne — enregistrez `index.html` et ouvrez-le d'un
double-clic.

## Ce que fait l'outil

- **Analyse d'un plan vectoriel** — PDF, SVG ou DXF : extraction des traits,
  détection des murs, des locaux (numéro, nom, surface), des portes et des cages
  d'escalier ; classement des locaux par mots-clés en six catégories acoustiques.
  Les baies sont refermées par un linteau avant la recherche des pièces, et
  chaque pièce reprend ce que le mobilier lui mangeait : sur trois niveaux d'un
  vrai projet, 97 locaux sur 97 sont retrouvés, sans fusion, à 3 % près en
  surface (voir [CHANGELOG.md](CHANGELOG.md), 2.3.0).
- **Murs au trait ou en aplat plein** — un plan dont les murs sont pochés sans
  contour ressortait vide. Les aplats sombres, longs et minces sont maintenant
  relevés comme des murs, à leur épaisseur réelle.
- **Cloisons obliques** — une cloison en biais était rabattue sur l'horizontale
  ou la verticale, et en ressortait redressée de travers. L'outil retrouve sous
  chaque cloison le trait que la CAO a dessiné, et lui rend sa pente et sa
  longueur vraies ; un mur en double trait n'est plus compté deux fois dans le
  métré.
- **Le même relevé à toutes les échelles** — le moteur raisonne en mètres, pas
  en pixels : la même planche dessinée à 1/50, à 1/100 ou à 1/200 rend le même
  relevé, aux mêmes surfaces. La définition de son image de travail s'adapte à
  l'échelle du plan, dans les limites de la mémoire.
- **Libellés vectorisés lus par reconnaissance de forme** — quand l'export a
  converti les textes en dessin, les lettres sont reconnues à leur silhouette,
  comparée à un alphabet que le navigateur dessine lui-même : rien à installer,
  rien à envoyer. Sur les trois niveaux d'essai, 96 noms de locaux sur 97 sont
  lus, et chacun se reprend dans le panneau de la pièce.
- **Classement par mots entiers, et le doute affiché** — le nom d'un local se
  découpe en mots, et chaque mot-clé est noté par sa précision : c'est le plus
  précis qui gagne, pas le premier de la liste. L'outil garde le mot-clé qui a
  décidé et la qualité de lecture du libellé, et en fait une **confiance**. Quand
  aucun mot-clé ne répond, il le dit au lieu de ranger le local dans « privé » en
  silence — une carte « Catégorie à vérifier » liste les moins sûrs et les ouvre
  d'un clic. La catégorie commande la cible STC : c'est la ligne où une erreur
  coûte le plus cher.
- **Échelle déduite du plan** — le rayon des battants de porte désigne, parmi les
  échelles usuelles, celle à laquelle les portes de ce plan ont une largeur de
  porte ; le cartouche (« 1 : 100 ») sert de recoupement, et la divergence est
  signalée. Le bouton *Détecter* renseigne le champ, et une échelle manifestement
  fausse est signalée à l'issue de l'analyse.
- **Aperçu au survol** — survoler une vignette ouvre la planche en grand à côté
  de la liste : molette pour zoomer sous le curseur, glisser pour déplacer,
  double-clic pour revenir à la page entière. Le rendu se refait à la définition
  du zoom, de quoi lire le cartouche et les libellés avant de lancer le moteur.
- **Diagnostic avant analyse** — chaque page est examinée et reçoit un badge :
  *Vectoriel*, *Texte vectorisé* (libellés convertis en dessin : ils seront lus
  par reconnaissance de forme), *Sans texte* (aucun libellé exploitable : les
  locaux seront à nommer à la main), *Image* (un scan : rien à extraire) ou
  *Sans plan*. On sait donc avant de lancer ce que l'outil saura tenir — et, pour
  les deux derniers cas, il propose le relevé manuel.
- **DXF : les calques font foi** — plutôt que de deviner les murs à l'épaisseur
  du trait, l'outil range les calques en *Mur* / *Porte* / *Ignorer* d'après leur
  nom, et la répartition se corrige d'un clic. Les unités du fichier
  (`$INSUNITS`) donnent l'échelle exacte : ni saisie, ni calibrage.
- **Relevé manuel sur un fond image** — un PNG, un JPG ou une page PDF scannée se
  charge comme fond ; toutes les corrections manuelles de l'éditeur (cloison,
  pièce, espace, porte, calibrage en deux clics) restent disponibles.
- **Cibles STC par cloison** — une matrice éditable donne la cible de chaque
  couple de catégories ; chaque valeur peut être forcée cloison par cloison.
- **Correction à la main** — tracer, déplacer, allonger ou supprimer une
  cloison ; reprendre le contour d'une pièce ; **retirer du relevé une zone qui
  n'en est pas une** (`Suppr`) — elle quitte le plan, le métré, la conformité et
  les exports, sans disparaître de l'analyse, et se rétablit d'un bouton ;
  **corriger le numéro et le nom d'un local**, qui suivent jusque dans les
  cloisons, les métrés et les exports ;
  poser une porte et lui donner son STC ; calibrer l'échelle en deux clics sur
  une cote connue ; auto-connexion (redressement et soudure des extrémités) avec
  tolérance réglable. Annuler / rétablir sur toute la session.
- **Relance sur place** — changer la finesse et relancer le moteur se fait depuis
  le plan, sans repasser par l'accueil : un voile montre l'étape courante, et si
  l'analyse échoue le relevé en cours est rendu intact.
- **Conformité** — le STC composite de chaque cloison portant une porte est
  calculé et comparé à sa cible ; les écarts sont listés et cliquables.
- **Calculateur STCc** — combinaison énergétique de N éléments, part de l'énergie
  transmise par élément, maillon faible nommé avec le gain qu'apporterait sa
  correction, et lecture 2-à-2 sur l'abaque d'Egan.
- **Exports** — JPG, PowerPoint (formes éditables), DXF (cloisons sur des calques
  `STC_xx`), CSV des cloisons, CSV du métré par cible, JSON de validation.
- **Sauvegarde** — un fichier HTML unique qui contient le fond de plan, l'analyse
  et vos corrections, et qui se rouvre d'un double-clic.

## Ce qui change par rapport à la V1

La V2 garde le moteur d'analyse de la V1 et refond l'interface :

- barre d'outils **groupée** — zoom, outils exclusifs porteurs de leur raccourci,
  bascules d'affichage, historique — et réglages fins sortis en menu ;
- **barre d'état** : l'aide du mode courant et les compteurs, sans troncature ;
- panneau latéral en **cartes**, d'ossature constante : l'objet sélectionné, ce
  qui en dépend, puis les actions ; sections repliables en dessous ;
- **conformité** en liste cliquable avec compteur, au lieu d'un bloc de texte ;
- **calculateur** remanié : le résultat domine, chaque élément montre sa part de
  l'énergie transmise, le maillon faible est nommé avec le premier palier qui
  ramène la cloison à sa cible ;
- **raccourcis clavier** (`V` `C` `P` `N` `D` `M`, `Ctrl+S`, `?`), états de
  survol / focus / désactivé explicites, et un accueil en trois étapes.

La V1 reste intacte dans son propre dossier ; ce dépôt ne contient que la V2.

## Construire

`index.html` est un fichier unique de ~2,7 Mo : la source plus pdf.js et
PptxGenJS embarqués en base64. Après toute modification de
`src/outil_stc.src.html` ou de `regles_stc.json` :

```
python build.py
```

| Fichier | Rôle |
| --- | --- |
| `index.html` | l'outil construit — c'est ce qui est publié |
| `src/outil_stc.src.html` | la source (interface + moteur), avec les marques `__PDFJS_B64__`… |
| `regles_stc.json` | catégories de locaux, mots-clés, matrice STC de référence |
| `VERSION` | numéro de version, source unique — injecté au build |
| `CHANGELOG.md` | journal des versions |
| `vendor/` | bibliothèques tierces embarquées au build |
| `build.py` | assemblage |
| `tests/` | bancs d'essai headless |
| `RESTE-A-FAIRE.md` | carnet de reprise : ce qui reste ouvert dans le moteur |

## Tests

`tests/banc.mjs` ouvre `index.html` dans Chrome headless et fait passer chaque
format d'entrée par le vrai chemin de l'outil — chargement, diagnostic, analyse,
relevé manuel — sur des plans d'essai **synthétiques** : un même bâtiment décliné
en DXF (millimètres et mètres), SVG, PDF vectoriel, PDF à murs pochés (à 1/50,
1/100 et 1/200 — le même dessin, pour la déduction d'échelle et l'invariance des
seuils), PDF scanné et PNG ; plus un petit plan coupé par un refend oblique.

```
pip install pymupdf        # une fois
python tests/fixtures.py   # écrit tests/fx/, non versionné
node tests/banc.mjs
```

`tests/stabilite.mjs` garde la trace de ce que le moteur **a répondu**. Le banc
fonctionnel vérifie des seuils — « au moins 12 locaux » — donc un changement qui
en fait passer 18 à 13 le traverse sans bruit. L'étalon `tests/baseline.json`,
lui, est versionné : comptes exacts de locaux, cloisons et portes, échelle
déduite, surface totale, histogramme des catégories et des cibles, et le
classement de chaque local avec le mot-clé qui l'a décidé. Les comptes et les
catégories sont comparés au strict, les surfaces à 3 % près. Les plans d'essai
étant fabriqués, l'étalon est reproductible d'un poste à l'autre — aucun plan
réel n'y entre.

```
node tests/stabilite.mjs                    # échec s'il dérive
node tests/stabilite.mjs --update-baseline  # re-bénir un changement voulu
```

Un écart n'est pas forcément une régression : relisez le diff de l'étalon, puis
commitez-le **avec** le changement qui l'explique.

`tests/verite.mjs` mesure la **justesse** : le plan passe dans le vrai chemin de
l'outil, et le relevé est confronté à une liste de locaux lue sur le plan —
numéro, nom, surface déclarée et un point sûr du local, en points PDF. Le rapport
donne les locaux retrouvés, les fusions, les manques, l'écart de surface, et la
justesse des libellés : numéros exacts, noms reconnus, et la liste de ceux qui
restent à revoir. Les noms se comparent à travers les familles de formes que la
reconnaissance confond (l/i/1, o/0, g/9…), comme le fait la classification.

Si la vérité porte les champs facultatifs `pairs` et `portes`, le banc mesure
aussi les **cloisons** et les **portes**. Les cloisons sont appariées par les
cellules, jamais par les numéros lus — sinon un numéro faux ferait échouer une
cloison juste — et le rapport dit les retrouvées, les manquées, celles en trop
entre deux locaux connus, et l'accord sur la cible STC. Un **score sur 100**
résume l'ensemble (locaux 30, cloisons 20, surfaces 15, noms 15, numéros 10,
portes 10), ramené au poids que la vérité renseigne vraiment.

```
node tests/verite.mjs index.html <plan.pdf> <verite.json> [finesse] [sortie.json]
```

Le fichier de vérité décrit un plan réel : il reste **hors dépôt**, à côté du
plan. Son format tient dans l'en-tête de `tests/verite.mjs`. Le plus court chemin
pour l'écrire : ouvrir le plan dans l'outil, corriger le relevé à l'écran, puis
**Exporter › Étalon de mesure — vérité terrain** — et le relire avant qu'il serve
de référence. Il emporte aussi les zones retirées du relevé : un corpus de faux
positifs désignés à la main.

`tests/nonreg.mjs` compare deux builds sur les mêmes plans, page par page. À
lancer sur de vrais plans avant publication ; ils restent sur le poste, rien
n'est versionné :

```
git show v2.0.0:index.html > avant.html
node tests/nonreg.mjs <dossier> avant.html index.html plan1.pdf plan2.pdf
```

Chrome est cherché à son emplacement habituel sous Windows ; `CHROME_BIN` permet
d'en désigner un autre.

## Versions

Le projet suit [SemVer](https://semver.org/lang/fr/). Le numéro tient dans
`VERSION`, `build.py` l'inscrit dans `index.html`, et il s'affiche dans le pied de
l'accueil et à côté du logo. Publier une version : mettre `VERSION` à jour,
compléter `CHANGELOG.md`, reconstruire, puis étiqueter le commit `vX.Y.Z`. Le
journal complet est dans [CHANGELOG.md](CHANGELOG.md).

## Limites connues

- L'analyse automatique exige un plan **vectoriel** (export CAO). Un scan n'est
  pas analysé : l'outil le signale et bascule en relevé manuel.
- En DXF, les `HATCH`, `DIMENSION` et `MLINE` ne sont pas développés, et les
  bombements (*bulge*) des polylignes sont rendus par leur corde.
- En SVG comme en PDF, les **courbes** rompent la polyligne sans produire de
  segment : un mur dessiné en courbe n'est pas lu.
- Classement des locaux par **mots-clés français**, en mots entiers : un local
  absent du dictionnaire tombe dans « privé » par défaut, mais avec une confiance
  nulle, et l'outil le porte dans sa carte « Catégorie à vérifier ». La
  reclassification reste à la main — ou par une entrée ajoutée à
  `regles_stc.json`.
- Les atriums et escaliers mécaniques ne sont pas détectés comme locaux ; les
  vitrages ne sont pas traités automatiquement.
- Une ouverture de plus de 2 m entre deux espaces n'est pas refermée : les deux
  côtés ne font plus qu'un local. Un local sans étiquette lisible est relevé mais
  reste à nommer — les circulations, gaines et cages en font partie.
- Le PDF annoté n'est pas réécrit par le navigateur — utiliser les exports
  DXF ou PowerPoint.
- Les valeurs des référentiels sont **indicatives** : vérifiez toujours
  l'édition en vigueur du référentiel applicable avant tout usage réglementaire.

## Sources acoustiques

- Abaque du TL composite : M. David Egan, *Architectural Acoustics*, p. 191.
- Référentiels cités : LEED v4 / v4.1 (EQ Acoustic Performance), WELL v2 (S05),
  ANSI/ASA S12.60, CNB / NBC 2020, FGI, ASTM E90 / E413 / E336 / E1332.
- Pour une matrice local-à-local plus fine que les six classes de l'outil :
  A. M. Jaramillo & C. Steel, *Architectural Acoustics*, Routledge, 2015,
  Table B.3, p. 235. Ses valeurs appartiennent à l'ouvrage et ne sont pas
  reproduites ici — l'onglet Bonnes pratiques renvoie à la source.

## Bibliothèques tierces

Embarquées dans `index.html` au moment du build :

- [pdf.js](https://mozilla.github.io/pdf.js/) 3.11.174 — Mozilla Foundation,
  licence Apache-2.0.
- [PptxGenJS](https://gitbrent.github.io/PptxGenJS/) 3.12.0 — Brent Ely,
  licence MIT.

Les lectures SVG et DXF n'ajoutent aucune dépendance : le SVG passe par le moteur
de rendu du navigateur, le DXF par un analyseur écrit pour ce projet.

## Licence

Le code de cet outil est publié sous licence MIT — voir [LICENSE](LICENSE).
Les bibliothèques tierces restent sous leurs licences respectives.
