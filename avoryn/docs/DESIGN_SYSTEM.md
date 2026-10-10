# Design system AVORYN

Référence vivante : page `/fr/identite` (non indexée). Source des tokens : `src/app/globals.css`.

## Couleurs

| Rôle | Token CSS | Classe Tailwind | Valeur |
| --- | --- | --- | --- |
| Bleu nuit (principale) | `--avoryn-night` | `bg-night` / `text-night` | `#101C2D` |
| Or champagne (principale) | `--avoryn-champagne` | `champagne` | `#C8A96D` |
| Blanc (principale) | `--avoryn-white` | `white` | `#FFFFFF` |
| Fond clair | `--avoryn-mist` | `mist` | `#F7F8FA` |
| Texte principal | `--avoryn-ink` | `ink` | `#172235` |
| Texte secondaire | `--avoryn-slate` | `slate` | `#64748B` |
| Bordures | `--avoryn-line` | `line` | `#E2E8F0` |
| Bleu secondaire | `--avoryn-navy` | `navy` | `#24344B` |
| Texte secondaire **contextuel** | `--text-muted` | `text-muted` | selon la surface |

Seule exception fonctionnelle : le rouge d’erreur des formulaires (`#9B1C1C`, 8,15:1 sur blanc),
indispensable pour signaler les erreurs ; il n’est jamais utilisé comme couleur de marque.

Répartition visée : ~60 % fonds clairs (blanc, `mist`), ~30 % bleu nuit (hero, bandeaux, pied de page), ~10 % or (filets, index, boutons principaux sur fond sombre).

### Contrastes mesurés (WCAG 2.2)

| Combinaison | Ratio | Usage autorisé |
| --- | --- | --- |
| Or sur bleu nuit | 7,63:1 | Tout texte |
| Or sur `#24344B` | 5,61:1 | Tout texte |
| Bleu nuit sur or (boutons) | 7,63:1 | Tout texte |
| Blanc sur bleu nuit | 17,13:1 | Tout texte |
| Blanc 72 % sur bleu nuit | 8,9:1 | Texte secondaire sur fond sombre |
| `#172235` sur blanc | 15,95:1 | Texte courant |
| `#64748B` sur blanc | 4,76:1 | Texte secondaire **sur blanc uniquement** |
| `#64748B` sur `#F7F8FA` | 4,48:1 | ✗ insuffisant → `#24344B` (11,85:1) |
| Or sur blanc | 2,25:1 | ✗ décoratif seulement (filets, puces) |

Les surfaces gèrent ces règles automatiquement : `.surface-white`, `.surface-mist`,
`.surface-night`, `.surface-navy` redéfinissent `--text-muted` et la couleur de l’anneau de focus.
Utiliser `text-muted` plutôt qu’une couleur fixe pour le texte secondaire.

## Typographie

- **Inter Variable**, auto-hébergée.
- `text-display` : clamp(2.5rem → 4.5rem), interlignage 1.04, approche -0.03em (titres H1).
- `text-headline` : clamp(1.875rem → 3rem) (titres de section).
- Sur-titres : 12 px, capitales, approche 0.2em, précédés d’un filet or (`Eyebrow`).
- Index éditoriaux `01`, `02`… en chasse fixe (`Index`).

## Composants (`src/components`)

| Composant | Rôle |
| --- | --- |
| `Container`, `Section` (`tone`) | Largeur max 80rem, gouttière 16 px mobile ; surface et rythme vertical |
| `Eyebrow`, `SectionHeading` | Sur-titre + titre + introduction |
| `ButtonLink` (`gold`, `night`, `outlineLight`, `outlineDark`), `TextLink` | Actions (cible ≥ 44 px) |
| `Card`, `Badge`, `Index`, `DashList` | Éléments de contenu |
| `PageHero`, `CtaBand`, `MethodTimeline`, `FounderPortrait` | Sections composées |
| `ContactForm` | Formulaire accessible (résumé d’erreurs, focus, aria) |
| `Logo`, `BrandSymbol`, `Wordmark` | Logo en SVG inline (`currentColor`) |
| `Header` / `SiteNav`, `Footer` | Navigation, menu mobile, sélecteur FR/EN |

## Mouvement

Une seule animation d’entrée (`animate-rise`, 0,8 s) sur les héros, et des transitions de survol.
Tout est neutralisé avec `prefers-reduced-motion: reduce`.

## Logo (proposition provisoire)

- **Symbole** : octogone élargi (la vision) ; deux traits convergents (la création) ; axe vertical (la progression) ; posé au-dessus de la base (la stabilité).
- **Logotype** : capitales géométriques au trait, terminaisons horizontales ; le **O** reprend l’octogone.
- Source unique : `src/components/brand/geometry.ts` → `npm run brand` régénère `public/brand/*.svg` et `src/app/icon.svg`.

| Fichier | Version |
| --- | --- |
| `avoryn-horizontal-gold-on-night.svg` | Horizontale, or sur bleu nuit |
| `avoryn-horizontal-night-on-white.svg` | Horizontale, bleu nuit sur blanc |
| `avoryn-horizontal-gold-night.svg` | Horizontale, symbole or + texte bleu nuit (fond transparent) |
| `avoryn-horizontal-mono-black.svg` / `-mono-white.svg` | Monochromes |
| `avoryn-vertical-gold-on-night.svg` / `-night-on-white.svg` / `-mono-black.svg` | Verticales |
| `avoryn-symbol-gold.svg` / `-night.svg` / `-mono-black.svg` | Symbole seul |
| `avoryn-favicon.svg` (= `src/app/icon.svg`) | Favicon |

Le symbole s’inspire de la forme fournie dans la charte (octogone et « Y »). Une recherche
d’antériorité (marques déposées, OPIC/CIPO) est nécessaire avant tout dépôt ou usage officiel.
