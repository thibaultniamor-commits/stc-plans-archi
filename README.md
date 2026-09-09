# Cibles STC — V2

Outil web autonome pour relever les **cibles d'affaiblissement acoustique (STC)**
d'un plan d'architecture : on dépose le PDF vectoriel exporté de la CAO, l'outil
détecte les locaux et les cloisons qui les séparent, les classe, et attribue à
chaque cloison la cible du couple de catégories.

**→ [Ouvrir l'outil](https://thibaultniamor-commits.github.io/stc-plans-archi/)**

Tout se passe dans le navigateur : aucun serveur, aucun envoi de fichier. La page
fonctionne aussi hors ligne — enregistrez `index.html` et ouvrez-le d'un
double-clic.

## Ce que fait l'outil

- **Analyse d'un plan PDF** — extraction vectorielle des traits, détection des
  murs, des locaux (numéro, nom, surface), des portes et des cages d'escalier ;
  classement des locaux par mots-clés en six catégories acoustiques.
- **Cibles STC par cloison** — une matrice éditable donne la cible de chaque
  couple de catégories ; chaque valeur peut être forcée cloison par cloison.
- **Correction à la main** — tracer, déplacer, allonger ou supprimer une
  cloison ; reprendre le contour d'une pièce ; poser une porte et lui donner son
  STC ; calibrer l'échelle en deux clics sur une cote connue ; auto-connexion
  (redressement et soudure des extrémités) avec tolérance réglable. Annuler /
  rétablir sur toute la session.
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
| `vendor/` | bibliothèques tierces embarquées au build |
| `build.py` | assemblage |

## Limites connues

- Le PDF doit être **vectoriel** (export CAO). Un scan ne donne rien.
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

## Licence

Le code de cet outil est publié sous licence MIT — voir [LICENSE](LICENSE).
Les bibliothèques tierces restent sous leurs licences respectives.
