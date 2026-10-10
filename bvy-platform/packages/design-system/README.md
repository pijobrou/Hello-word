# Design system du portail BVY

Version 1.0 — `STATUS: WAITING_FOR_OWNER_APPROVAL`. Procédure complète : `workflows/01_design_system.md`.

Les couleurs, polices et formes du **site public approuvé** (prune / or), adaptées au portail client :
contenu clair et lisible, navigation prune, or réservé à ce qui compte. Aucune dépendance à installer.

| Fichier | Rôle |
|---|---|
| `tokens.json` | **Seule source de vérité** : couleurs, typographie, espacements, rayons, ombres, mouvements, mise en page, paires de contraste |
| `tokens.css` | Variables CSS `--bvy-*` **générées** depuis `tokens.json` (ne pas modifier à la main) |
| `components.css` | Composants du portail : coquille (barre latérale, barre du haut, barre d'onglets mobile), boutons, badges, cartes KPI, santé financière, À faire, « BVY travaille sur », « Ce qui a changé », question de validation, alertes, toasts, formulaires, tableaux, modale, états vide / chargement / erreur, graphiques |
| `gallery.html` + `gallery.js` | Galerie : chaque jeton, chaque composant et un tableau de bord complet (données fictives) |
| `scripts/` | `build-tokens.mjs`, `contrast.mjs`, `screenshots.mjs` |
| `assets/` | Logo BVY (copie du site) |

## Voir la galerie

Ouvrir `gallery.html` dans un navigateur (double-clic). Internet sert seulement aux polices Google.

## Utiliser dans une page

```html
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="components.css">
```

Toujours passer par les jetons (`var(--bvy-text)`, `var(--bvy-space-4)`…), jamais une couleur écrite en dur.
Copier le balisage d'un composant depuis `gallery.html`.

## Modifier un jeton

1. Modifier `tokens.json`.
2. `node scripts/build-tokens.mjs` — régénère `tokens.css`.
3. `node scripts/contrast.mjs` — doit afficher « 0 échec » (WCAG AA : 4,5:1 texte, 3:1 grand texte et éléments d'interface).
4. Captures : `node scripts/screenshots.mjs` (Playwright requis) → `review/design-system/`.

`npm run check` enchaîne la vérification de `tokens.css` et le contraste (utile en intégration continue).

Une modification de couleur de marque demande l'approbation du propriétaire (`CLAUDE.md`, « Human Approval Rules »).
