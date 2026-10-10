# Dossier de revue — design system du portail BVY, version 1.0

`STATUS: APPROVED` (propriétaire, 1er octobre 2026)

Date : 1er octobre 2026. Phase 1 du plan (`CLAUDE.md`). Procédure : `workflows/01_design_system.md`.

Répondez par **`STATUS: APPROVED`**, **`STATUS: CHANGES_REQUESTED`** (avec vos changements) ou
**`STATUS: REJECTED`**. Rien d'autre (connexion, rôles, portail réel, QuickBooks) ne sera construit avant
`APPROVED`.

## 1. Ce qui a été construit

Le « langage visuel » du futur portail client, tiré directement du site approuvé : même prune, même or, mêmes
polices (Cormorant Garamond, Jost, IBM Plex Mono), mêmes coins arrondis. Le portail est plus clair et un peu
plus dense que le site, mais reste calme et très lisible.

| Élément | Où |
|---|---|
| Galerie à ouvrir dans un navigateur (double-clic) : toutes les couleurs, tous les composants et un tableau de bord complet | `packages/design-system/gallery.html` |
| Les couleurs, tailles et espacements (une seule source) | `packages/design-system/tokens.json` → `tokens.css` |
| Les composants (navigation, cartes, alertes, formulaires, tableaux, fenêtres, états…) | `packages/design-system/components.css` |
| Mode d'emploi | `packages/design-system/README.md` |

Le tableau de bord d'exemple (entreprise fictive « Atelier Boréal », marqué « Exemple — données fictives »)
répond en 30 secondes à : combien j'ai, combien on me doit, combien je dois, la santé de l'entreprise et
pourquoi, ce que je dois faire, ce que BVY fait pour moi, ce qui a changé — avec « Voir dans QuickBooks ↗ »
partout où c'est utile, et la question type « Nous avons trouvé un paiement Costco de 842,37 $. Était-ce une
dépense d'entreprise ? » (Oui / Non, personnel / Autre).

**Lisibilité vérifiée par un programme** : 46 combinaisons de texte et de fond respectent la norme
d'accessibilité WCAG AA (0 échec ; la plus faible : « À surveiller » à 5,43:1 pour un minimum de 4,5:1).
L'or sur fond blanc est interdit comme couleur de texte (2,49:1) : un or plus foncé du site (#7A5F12) le
remplace pour les liens « Voir dans QuickBooks ↗ ».

## 2. Captures d'écran

| Fichier | Contenu |
|---|---|
| `tableau-de-bord-bureau-1440.png` | Le tableau de bord sur ordinateur |
| `ecran-telephone-mobile-390.png` | Le premier écran sur téléphone (barre d'onglets en bas) |
| `navigation-plus-mobile-390.png` | Le menu « Plus » ouvert sur téléphone, avec QuickBooks ↗ |
| `tableau-de-bord-mobile-390.png` | Le tableau de bord complet sur téléphone |
| `galerie-bureau-1440.jpg`, `galerie-mobile-390.jpg` | Toute la galerie (couleurs, typographie, composants) |

Contrôle automatique : aucune erreur, aucun défilement horizontal à 390 px, polices chargées, navigation au
clavier qui commence par « Aller au contenu ».

## 3. Décisions à valider (5)

1. **Bouton principal prune dans le portail.** Sur le site, le bouton or est partout. Dans le portail, on
   propose : boutons principaux en prune, et **un seul bouton or par écran** pour l'action la plus importante.
   Raison : beaucoup de boutons or dans un écran de travail fatiguent l'œil et perdent leur force.
2. **Boutons en casse normale** (« Envoyer ma réponse ») au lieu des MAJUSCULES espacées du site. Raison :
   plus lisible quand il y a plusieurs boutons à l'écran. Les petits surtitres restent en majuscules, comme
   sur le site.
3. **Fond lavande très pâle (#F8F4FF, déjà sur le site) avec des cartes blanches**, et navigation prune à
   gauche. Alternative : fond blanc pur, plus neutre mais moins « BVY ».
4. **Deux ajustements d'accessibilité** : un gris-prune (#8C7A99) pour le contour des champs de formulaire,
   et un contour de sélection (focus clavier) prune sur fond clair au lieu de l'or du site. Raison : l'or et
   les bordures du site sont trop pâles sur fond blanc pour être vus par tous (norme 3:1). L'or reste utilisé
   sur fond prune.
5. **Navigation sur téléphone** : barre d'onglets en bas (Accueil, À faire, Finances, Messages, Plus) ; Factures,
   Documents, Taxes, Rapports et QuickBooks ↗ dans « Plus », et « Ouvrir QuickBooks ↗ » toujours en haut de
   l'écran. Alternative : un menu « hamburger » comme sur le site.

## 4. Limites connues

- C'est une galerie statique : aucune donnée réelle, aucune connexion, aucun lien vers votre QuickBooks
  (les liens ouvrent la page d'accueil de QuickBooks Online).
- Les polices viennent de Google Fonts, comme sur le site. On pourra les héberger nous-mêmes au moment du
  portail réel si vous le souhaitez.
- Le portail du personnel (file de travail) utilisera ces mêmes jetons ; ses écrans seront présentés à leur
  phase.

## 5. Prochaine étape proposée

Après `STATUS: APPROVED` : workflow 02 — connexion et rôles (administrateur BVY, comptable principal, tenue de
livres, paie, fiscalité, client), puis le portail client (phase 3) construit avec ce design system.

`STATUS: APPROVED` (propriétaire, 1er octobre 2026)


## Décision du propriétaire — 1er octobre 2026

`STATUS: APPROVED`. Les cinq décisions sont retenues telles que proposées : boutons principaux prune avec un seul bouton or par écran ; boutons en casse normale ; fond lavande très pâle (#F8F4FF), cartes blanches et navigation prune ; contour des champs #8C7A99 et focus prune sur fond clair ; barre d’onglets en bas sur téléphone, QuickBooks ↗ toujours en haut.
