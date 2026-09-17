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
- **Diagnostic avant analyse** — chaque page est examinée et reçoit un badge :
  *Vectoriel*, *Vectoriel sans texte* (tracés lisibles mais libellés vectorisés à
  l'export : les locaux seront à nommer à la main), *Image* (un scan : rien à
  extraire) ou *Sans plan*. On sait donc avant de lancer ce que l'outil saura
  tenir — et, pour les deux derniers cas, il propose le relevé manuel.
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
  cloison ; reprendre le contour d'une pièce ; poser une porte et lui donner son
  STC ; calibrer l'échelle en deux clics sur une cote connue ; auto-connexion
  (redressement et soudure des extrémités) avec tolérance réglable. Annuler /
  rétablir sur toute la session.
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
| `tests/` | banc d'essai headless |

## Tests

`tests/banc.mjs` ouvre `index.html` dans Chrome headless et fait passer chaque
format d'entrée par le vrai chemin de l'outil — chargement, diagnostic, analyse,
relevé manuel — sur des plans d'essai **synthétiques** : un même bâtiment décliné
en DXF (millimètres et mètres), SVG, PDF vectoriel, PDF scanné et PNG.

```
pip install pymupdf        # une fois
python tests/fixtures.py   # écrit tests/fx/, non versionné
node tests/banc.mjs
```

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
- Les murs dessinés en **aplat plein** (poché sans contour au trait) ne sont pas
  lus ; le diagnostic le signale quand la page en compte beaucoup.
- Classement des locaux par **mots-clés français** ; un local non reconnu se
  reclasse à la main.
- Les atriums et escaliers mécaniques ne sont pas détectés comme locaux ; les
  vitrages ne sont pas traités automatiquement.
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
