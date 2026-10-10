# Workflow 01 — Design system of the BVY client portal

**Status:** `WAITING_FOR_OWNER_APPROVAL` (submitted 2026-10-01). Previous: workflow 00 `APPROVED` 2026-10-01.
**Owner approval required:** yes — "main design system" (`CLAUDE.md`, Human Approval Rules). Workflow 02
(authentication and roles) and the portal build do not start before `STATUS: APPROVED`.

## Objective

Turn the approved public website into the design system of the client portal (and, later, the staff portal):
one source of design tokens, a set of portal components, and a reference screen of the client dashboard —
without inventing a new identity. The portal must feel premium, calm and highly readable; it must let a client
with little accounting knowledge understand their situation in about 30 seconds.

Scope is Phase 1 only: no authentication, no backend, no QuickBooks connection, no real portal pages.

## Inputs

| Input | Source | Stone / Opinion |
|---|---|---|
| Approved website stylesheet | `apps/website/public/assets/css/bvy.css` | Stone (every colour, font, radius) |
| Site layout and portal preview | `apps/website/src/layout.html`, `src/pages/plateforme.html` (dashboard mock), `src/pages/connexion.html` | Stone (seed of the dashboard, « Bonne / À surveiller / Action requise ») |
| Product brief | `CLAUDE.md` — Workflow 01, Workflow 03, Client Dashboard, Progressive Disclosure, Plain-Language Accounting, QBO Functional Rule, Workflow 08 example, Core UX Principle | Stone |
| Logo | `apps/website/public/assets/img/bvy-logo-*.png` (copied to `packages/design-system/assets/`) | Stone |
| Portal density, sentence-case buttons, plum focus ring, added input border neutral | this workflow | Opinion — listed as owner decisions in `review/design-system/REVIEW.md` |

## Tools

| Tool | Purpose |
|---|---|
| `packages/design-system/tokens.json` | Single source of truth (primitives, semantic roles, type, space, radius, shadow, motion, layout, z-index, contrast pairs) |
| `packages/design-system/scripts/build-tokens.mjs` | Generates `tokens.css` (`--bvy-*` custom properties). `--check` fails if `tokens.css` is stale |
| `packages/design-system/scripts/contrast.mjs` | WCAG 2.2 contrast of every declared text/background pair; exits 1 below 4.5:1 (text) or 3:1 (large text, UI). `--md` prints a Markdown table |
| `packages/design-system/scripts/screenshots.mjs` | Playwright: gallery at 1440 px and 390 px, dashboard frame, phone first screen, open "Plus" sheet. Flags console/network errors, horizontal scroll, elements wider than the viewport, missing fonts, first Tab not on the skip link |
| `packages/design-system/gallery.html` | Static showcase of every token and component + a full client dashboard (fictional data) |

No dependency to install. Playwright is used only for screenshots (resolved from the current directory, e.g. a
scratch directory with `node_modules` linked to the global install; set `CHROMIUM_PATH` and, behind the sandbox
proxy, `IGNORE_HTTPS_ERRORS=1` for Google Fonts).

## Procedure

1. Read `CLAUDE.md` (sections above) and `bvy.css`. Never add a brand colour; neutrals may be added only for
   readability/accessibility and must be marked "AJOUT accessibilité" in `tokens.json`.
2. Edit `packages/design-system/tokens.json`. Components use **semantic roles** (`--bvy-text`, `--bvy-surface`,
   `--bvy-primary`…), never primitives or hard-coded colours.
3. `cd packages/design-system && node scripts/build-tokens.mjs`
4. `node scripts/contrast.mjs` → must print `0 échec(s)`. Add a pair to `$contrast.pairs` for every new
   text/background combination.
5. Edit `components.css` and `gallery.html` (every component must appear in the gallery, in French).
6. Screenshots: `node scripts/screenshots.mjs` → `review/design-system/`. Open every image; fix layout bugs until
   it reads as premium, calm and readable and the script reports no problem.
7. Update `review/design-system/REVIEW.md` and **stop** with `STATUS: APPROVED` (propriétaire, 1er octobre 2026).

## Design system definition

### 1. Colour tokens

Primitives come from `bvy.css` (names in parentheses).

| Group | Tokens |
|---|---|
| Plum | `plum-900` #1E0820 (`--plum`), `plum-800` #3A0F3E (`--plum2`), `plum-700` #5C1F60 (`--plum3`), `plum-600` #7A3080 (`--plum4`), `plum-logo` #4A2146 |
| Gold | `gold-500` #C4A040 (`--gold`), `gold-400` #D4B860 (`--gold2`), `gold-300` #E8D080 (`--gold3`), `gold-50` #FBF5E0 (`--gold4`), `gold-line` #EAD9A0, `gold-deep` #9A7A22 (site eyebrow), `gold-ink` #7A5F12 (site `.who.qb`) |
| Neutrals | `white`, `cream` #FDFBFF, `cream-2` #F8F4FF, `line` #EDE5F4, `line-2` #DDD0EC, `ink` #1A0A1E, `ink-2` #4A3555, `ink-3` #6B5A7A, `on-dark` .92 / `on-dark-2` .74 / `on-dark-3` .60 white; **added:** `line-strong` #8C7A99 (input borders, 3.92:1) |
| Status | Good #1B6B45 / #E8F5EE · Watch #8A5A00 / #FFF4DC · Action required #A12C2C / #FCEAEA (site `--good/--watch/--act`) |

Semantic roles: `bg-app` (cream-2), `surface` (white), `surface-muted` (cream), `surface-qbo` (gold-50), `text`,
`text-muted`, `text-subtle`, `text-heading`, `text-link`, `text-gold`, `primary` (plum-900), `accent` (gold-500),
`focus` (plum-600), `focus-on-dark` (gold-500), `nav-*`, `good/watch/act/info` (+ `-bg`), `chart-1..3`,
`border`, `border-input`, `overlay`.

Rules: plum frames (navigation), light content is read, gold highlights. **Gold is never text on a light
background** (2.49:1) — use `text-gold`. One gold button per screen. Colour never carries meaning alone.

### 2. Typography

Cormorant Garamond (display: page titles, key amounts, client question), Jost (all UI and text), IBM Plex Mono
(references). Same Google Fonts URL as the site. Scale: display 40 · h1 32 · h2 24 · h3 18 (Jost 600) · amount
34 (Cormorant 600, `tabular-nums lining-nums`) · body 16 · UI 15 · small 14 · meta 13 · label 12 (uppercase).
Nothing below 12 px; no weight 300 below 17 px. Amounts: `48 215,60 $` (no-break spaces, comma, `$` after).

### 3. Spacing, radius, elevation, motion

4 px grid: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Cards 24 px padding (20 px mobile), 24 px between cards,
content max 1200 px, sidebar 252 px, top bar 64 px, tab bar 64 px, touch target ≥ 44 px. Radius 4 (buttons,
inputs — as the site) / 8 (cards) / 14 (modals) / pill (badges). Shadows sm (cards), md (toasts), lg (modals).
Motion 150 / 250 ms; everything disabled under `prefers-reduced-motion`.

### 4. Buttons

`btn-gold` accent (one per screen), `btn-plum` primary, `btn-outline` secondary, `btn-ghost` tertiary,
`btn-qbo` (Open QuickBooks ↗), `btn-danger` (always behind a confirmation). Sizes sm 36 / default 44 / lg 52.
States: hover, `:focus-visible`, `disabled`, `aria-busy="true"` (spinner). Labels say what happens. In the
portal, buttons are sentence case (site keeps uppercase). Links: `link` (level 3 "Voir le détail") and
`qbo-link` (level 4 "Voir dans QuickBooks ↗", new tab, announced to screen readers).

### 5. Cards

`card` (+ `card-head`, `card-foot`), `card-accent` (gold top rule: new/important), `card-qbo`, `card-dark`
(brand moments only). KPI cards follow progressive disclosure: **1** amount → **2** one-sentence explanation →
**3** "Voir le détail" → **4** "Voir dans QuickBooks ↗". Dashboard KPIs: « Argent disponible », « Vos clients
vous doivent », « Factures à payer ». Each card answers the four Core UX questions.

### 6. Alerts and notifications

`alert-good / -watch / -act / -info`: icon + short title + one sentence + optional action. `role="alert"` only
for Action required; otherwise `role="status"`. Toasts (`.toasts` region, `aria-live="polite"`): confirm an
action, 6 s, close button, above the mobile tab bar; never the only place an information exists.

### 7. Forms

Visible label above every field, optional marked "(facultatif)", hint below, error below with icon and a fix
instruction, `aria-invalid` + `aria-describedby`. Input border `border-input` (≥ 3:1). Components: text, select,
textarea, search with icon, checkbox, dropzone (accepts phone photos), segmented control (`aria-pressed`),
choice tiles (radio) for client questions.

### 8. Tables

Level 3 detail only. Caption, `scope="col"`, amounts right-aligned in tabular figures, status as badge, one
`qbo-link` per row, footer total. Wrapper is a focusable region with horizontal scroll as a fallback; under
640 px `table-stack` turns each row into a card using `data-label`.

### 9. Badges

Health states — always word + icon + colour: « Bonne » (check), « À surveiller » (eye), « Action requise »
(warning). Never a score out of 100; each health badge is followed by the reason. Others: info, neutral, gold
(QuickBooks), `count` pill. Sync dot: connected / syncing (pulse) / late / disconnected.

### 10. Navigation

Desktop app shell: plum sidebar with « Accueil, À faire, Mes finances, Factures, Documents, Taxes, Rapports,
Messages » then, separated and gold-framed, « QuickBooks ↗ » (hidden for non-QBO clients). Active item:
`aria-current="page"`, pale-gold text, gold left rule. White top bar: QuickBooks connection status + last sync
time + « Ouvrir QuickBooks ↗ » on every screen. Breadcrumbs for level 3 pages.

### 11. Modals

Native `<dialog>` with `showModal()` (focus trap, Esc, focus return). Only for confirmations and short
decisions; title is a question, primary button repeats the verb. Bottom sheet under 960 px.

### 12. Empty states

Icon + reassuring title + one sentence + the next action (« Rien à faire pour l'instant — Tout est à jour »).

### 13. Loading states

Skeletons with the shape of the content (`skeleton`, `sk-line`, `sk-amount`), `aria-busy`, spinner + text for
syncing (« Synchronisation avec QuickBooks… »), busy buttons. Never a blank screen.

### 14. Errors

Say what failed, what is still reliable, how to fix (« QuickBooks n'est plus connecté — Les montants affichés
datent du 28 septembre » + « Reconnecter QuickBooks »). Generic errors offer Retry + contact and a short
reference code; never a raw technical message alone.

### 15. Charts

Conclusion sentence first, chart second, numbers in a « Voir les chiffres » table. Bars (vertical for time,
horizontal for breakdowns), no pies, no 3D, no truncated axis, max 3 series: `chart-1` plum (revenue),
`chart-2` deep gold (expenses), `chart-3` light plum — all ≥ 3:1 on white. HTML/CSS bars so text keeps its real
size. Changes: arrow + sign + word. Work progress: bar + text ("85 %", « Attend la tenue de livres »), with
`role="progressbar"`.

### 16. Domain components (client dashboard)

Financial health card (state + why + « Comment BVY arrive à cet état » disclosure); « À faire » items (icon,
title, why, due date, primary action, « Voir dans QuickBooks ↗ »); « BVY travaille sur » progress list
(bookkeeping, bank reconciliation, GST/QST waiting for bookkeeping, payroll up to date); « Ce qui a changé »
(revenue, expenses, overdue invoices, taxes — each with one explanatory sentence); client-validation question
card (« Nous avons trouvé un paiement Costco de 842,37 $. Était-ce une dépense d'entreprise ? » — « Oui,
dépense d'entreprise » / « Non, personnel » / « Autre » with a free-text field; confirmation state after
sending; no account codes).

### 17. Mobile patterns

Under 960 px the sidebar becomes a bottom tab bar (Accueil, À faire, Finances, Messages, Plus); « Plus » opens a
sheet with Factures, Documents, Taxes, Rapports, QuickBooks ↗. « Ouvrir QuickBooks ↗ » stays in the top bar; sync
status moves to the top of the content. Under 640 px: one column, stacked tables, full-width choices, actions
below the to-do text. Safe-area insets respected. No horizontal scroll at 390 px.

### 18. Accessibility rules

WCAG 2.2 AA. Skip link; one `h1` per screen; headings in order; visible focus (plum ring on light, gold ring
on plum); full keyboard use (Tab, Enter, Space, Esc), tab order = visual order; status never by colour alone;
external links announced « (nouvel onglet) »; decorative icons `aria-hidden`; charts have `role="img"` + text
alternative + data table; live regions for toasts and sync; `prefers-reduced-motion`; text ≥ 12 px; 200 % zoom
without loss; `lang="fr-CA"`; touch targets ≥ 44 px.

### Contrast results (`node scripts/contrast.mjs --md`, 2026-10-01)

46 allowed pairs, 0 failures; 4 forbidden combinations documented (they must stay below the threshold).
Lowest margin: « À surveiller » text on its background, 5.43:1.

| Texte / élément | Fond | Couleurs | Ratio | Seuil | Résultat | Usage |
|---|---|---|---|---|---|---|
| `text` | `surface` | #1A0A1E / #FFFFFF | 18.99:1 | 4.5:1 (text) | OK | Texte courant sur carte |
| `text` | `bg-app` | #1A0A1E / #F8F4FF | 17.52:1 | 4.5:1 (text) | OK | Texte courant sur fond du portail |
| `text-muted` | `surface` | #4A3555 / #FFFFFF | 10.87:1 | 4.5:1 (text) | OK | Explications sur carte |
| `text-muted` | `bg-app` | #4A3555 / #F8F4FF | 10.03:1 | 4.5:1 (text) | OK | Explications sur fond |
| `text-subtle` | `surface` | #6B5A7A / #FFFFFF | 6.23:1 | 4.5:1 (text) | OK | Métadonnées sur carte |
| `text-subtle` | `bg-app` | #6B5A7A / #F8F4FF | 5.75:1 | 4.5:1 (text) | OK | Métadonnées sur fond |
| `text-subtle` | `surface-muted` | #6B5A7A / #FDFBFF | 6.06:1 | 4.5:1 (text) | OK | En-têtes de tableau |
| `text-heading` | `surface` | #1E0820 / #FFFFFF | 18.91:1 | 4.5:1 (text) | OK | Titres sur carte |
| `text-heading` | `bg-app` | #1E0820 / #F8F4FF | 17.44:1 | 4.5:1 (text) | OK | Titres de page |
| `text-link` | `surface` | #5C1F60 / #FFFFFF | 11.54:1 | 4.5:1 (text) | OK | Liens sur carte |
| `text-link` | `bg-app` | #5C1F60 / #F8F4FF | 10.65:1 | 4.5:1 (text) | OK | Liens sur fond |
| `text-gold` | `surface` | #7A5F12 / #FFFFFF | 6.05:1 | 4.5:1 (text) | OK | Lien « Voir dans QuickBooks ↗ » |
| `text-gold` | `surface-qbo` | #7A5F12 / #FBF5E0 | 5.54:1 | 4.5:1 (text) | OK | Texte dans une zone QuickBooks |
| `text` | `surface-qbo` | #1A0A1E / #FBF5E0 | 17.39:1 | 4.5:1 (text) | OK | Texte courant dans une zone QuickBooks |
| `text-on-primary` | `primary` | #FFFFFF / #1E0820 | 18.91:1 | 4.5:1 (text) | OK | Bouton principal |
| `text-on-primary` | `primary-hover` | #FFFFFF / #5C1F60 | 11.54:1 | 4.5:1 (text) | OK | Bouton principal survolé |
| `text-on-accent` | `accent` | #1E0820 / #C4A040 | 7.61:1 | 4.5:1 (text) | OK | Bouton or |
| `text-on-accent` | `accent-hover` | #1E0820 / #D4B860 | 9.74:1 | 4.5:1 (text) | OK | Bouton or survolé |
| `nav-text` | `nav-bg` | #C5BFC5 / #1E0820 | 10.44:1 | 4.5:1 (text) | OK | Navigation |
| `nav-text` | `nav-bg-hover` | #CCC1CD / #3A0F3E | 9.13:1 | 4.5:1 (text) | OK | Navigation survolée |
| `nav-text-strong` | `nav-bg` | #EDEBED / #1E0820 | 15.97:1 | 4.5:1 (text) | OK | Nom de l'entreprise |
| `nav-text-subtle` | `nav-bg` | #A59CA6 / #1E0820 | 7.13:1 | 4.5:1 (text) | OK | Libellés de groupe |
| `nav-text-active` | `nav-active-bg` sur `nav-bg` | #E8D080 / #351D24 | 10.14:1 | 4.5:1 (text) | OK | Élément de navigation actif |
| `nav-qbo` | `nav-bg` | #D4B860 / #1E0820 | 9.74:1 | 4.5:1 (text) | OK | QuickBooks ↗ dans la navigation |
| `nav-text-strong` | `nav-bg-hover` | #EFECF0 / #3A0F3E | 13.59:1 | 4.5:1 (text) | OK | Texte de toast |
| `good` | `good-bg` | #1B6B45 / #E8F5EE | 5.79:1 | 4.5:1 (text) | OK | Badge / alerte « Bonne » |
| `watch` | `watch-bg` | #8A5A00 / #FFF4DC | 5.43:1 | 4.5:1 (text) | OK | Badge / alerte « À surveiller » |
| `act` | `act-bg` | #A12C2C / #FCEAEA | 6.21:1 | 4.5:1 (text) | OK | Badge / alerte « Action requise » |
| `info` | `info-bg` | #5C1F60 / #F8F4FF | 10.65:1 | 4.5:1 (text) | OK | Badge / alerte d'information |
| `text` | `good-bg` | #1A0A1E / #E8F5EE | 16.93:1 | 4.5:1 (text) | OK | Texte courant d'une alerte « Bonne » |
| `text` | `watch-bg` | #1A0A1E / #FFF4DC | 17.38:1 | 4.5:1 (text) | OK | Texte courant d'une alerte « À surveiller » |
| `text` | `act-bg` | #1A0A1E / #FCEAEA | 16.36:1 | 4.5:1 (text) | OK | Texte courant d'une alerte « Action requise » |
| `good` | `surface` | #1B6B45 / #FFFFFF | 6.49:1 | 4.5:1 (text) | OK | Variation positive sur carte |
| `watch` | `surface` | #8A5A00 / #FFFFFF | 5.93:1 | 4.5:1 (text) | OK | Variation à surveiller sur carte |
| `act` | `surface` | #A12C2C / #FFFFFF | 7.21:1 | 4.5:1 (text) | OK | Message d'erreur de champ |
| `border-input` | `surface` | #8C7A99 / #FFFFFF | 3.92:1 | 3:1 (ui) | OK | Contour des champs et cases |
| `border-input` | `surface-muted` | #8C7A99 / #FDFBFF | 3.81:1 | 3:1 (ui) | OK | Contour des champs sur zone secondaire |
| `focus` | `surface` | #7A3080 / #FFFFFF | 8.20:1 | 3:1 (ui) | OK | Anneau de focus sur carte |
| `focus` | `bg-app` | #7A3080 / #F8F4FF | 7.56:1 | 3:1 (ui) | OK | Anneau de focus sur fond |
| `focus-on-dark` | `nav-bg` | #C4A040 / #1E0820 | 7.61:1 | 3:1 (ui) | OK | Anneau de focus dans la navigation |
| `accent` | `nav-bg` | #C4A040 / #1E0820 | 7.61:1 | 3:1 (ui) | OK | Filet or / indicateur actif sur prune |
| `chart-1` | `surface` | #5C1F60 / #FFFFFF | 11.54:1 | 3:1 (ui) | OK | Graphique série 1 |
| `chart-2` | `surface` | #9A7A22 / #FFFFFF | 4.05:1 | 3:1 (ui) | OK | Graphique série 2 |
| `chart-3` | `surface` | #7A3080 / #FFFFFF | 8.20:1 | 3:1 (ui) | OK | Graphique série 3 |
| `chart-1` | `progress-track` | #5C1F60 / #EDE5F4 | 9.40:1 | 3:1 (ui) | OK | Barre de progression sur son rail |
| `act` | `surface` | #A12C2C / #FFFFFF | 7.21:1 | 3:1 (ui) | OK | Contour d'un champ en erreur |
| `accent` | `surface` | #C4A040 / #FFFFFF | 2.49:1 | 4.5:1 (text) | Interdit (attendu) | INTERDIT : texte or #C4A040 sur blanc — utiliser text-gold |
| `accent-hover` | `bg-app` | #D4B860 / #F8F4FF | 1.79:1 | 4.5:1 (text) | Interdit (attendu) | INTERDIT : texte or clair sur fond du portail |
| `border-2` | `surface` | #DDD0EC / #FFFFFF | 1.47:1 | 3:1 (ui) | Interdit (attendu) | INTERDIT comme contour de champ (décoratif seulement) — utiliser border-input |
| `accent` | `surface` | #C4A040 / #FFFFFF | 2.49:1 | 3:1 (ui) | Interdit (attendu) | INTERDIT comme anneau de focus sur fond clair — utiliser focus |

## Validation rules

- Only tokens from `tokens.json`; no hex colour in `components.css` (the only literals allowed are translucent
  `rgba()` overlays/shadows derived from brand or white/black, and the URL-encoded select chevron).
- `build-tokens.mjs --check` and `contrast.mjs` both exit 0.
- Every component in `components.css` is shown in `gallery.html`.
- Client-facing text in plain French (Québec): « Argent disponible », « Vos clients vous doivent », « Factures à
  payer »; no ledger/journal/chart-of-accounts jargon at levels 1–2.
- Every QuickBooks link: « ↗ », new tab, `rel="noopener"`, screen-reader hint.
- Example data is fictional and labelled « Exemple — données fictives ».
- `screenshots.mjs` reports no problem at 1440 px and 390 px.

## Expected outputs

`packages/design-system/`: `tokens.json`, `tokens.css`, `components.css`, `gallery.html`, `gallery.js`,
`README.md`, `package.json`, `assets/`, `scripts/{tokens-lib,build-tokens,contrast,screenshots}.mjs`.
`review/design-system/`: `REVIEW.md`, `galerie-bureau-1440.jpg`, `galerie-mobile-390.jpg`,
`tableau-de-bord-bureau-1440.png`, `tableau-de-bord-mobile-390.png`, `ecran-telephone-mobile-390.png`,
`navigation-plus-mobile-390.png`.

## Errors and edge cases

| Situation | Handling |
|---|---|
| A new colour pair fails contrast | Do not lower the threshold. Use a darker role (`text-gold`, `chart-2`, `border-input`) or change the background |
| Owner asks for a new brand colour | Major brand change → owner approval; add to `tokens.json`, rebuild, re-check, re-screenshot |
| Google Fonts unavailable | Fallbacks Georgia / system-ui / ui-monospace keep the layout; screenshots script reports the missing font |
| Client without QuickBooks | Hide « QuickBooks ↗ » nav item, top-bar button and `qbo-link`s; the rest of the experience is identical |
| QuickBooks disconnected or sync late | Red / amber sync dot in the top bar + error state with the date of the data shown and « Reconnecter QuickBooks » |
| Long names, large amounts | Brand name truncates with ellipsis; amounts never wrap (`white-space:nowrap`); KPI grid goes 3 → 2 → 1 columns |
| JavaScript disabled | Layout, navigation links and disclosures (`<details>`) work; only the « Plus » sheet, modal demo and toasts need JS |
| `:has()` unsupported (old browsers) | Choice tiles lose the selected highlight; native radio still shows the choice |

## Acceptance criteria

- Every item listed under "Workflow 01: Design System" in `CLAUDE.md` is defined above and shown in the gallery.
- No new visual identity: plum and gold from the site, same three fonts, same radii.
- Dashboard example answers the CLAUDE.md client questions (cash, owed to me, I owe, what changed, is anything
  wrong, what to do, what BVY is doing, where to see more) and the four Core UX questions.
- QuickBooks ↗ visible in the sidebar, the top bar and every to-do / KPI where relevant.
- Contrast script and token build pass; screenshots clean at 1440 px and 390 px; keyboard usable.

## Approval gate

Return `STATUS: APPROVED` (propriétaire, 1er octobre 2026) with `review/design-system/REVIEW.md`. Continue to workflow 02 only on
`STATUS: APPROVED`. On `STATUS: CHANGES_REQUESTED`: collect changes → edit `tokens.json` / components → rebuild →
contrast → screenshots → new review → wait again. On `STATUS: REJECTED`: stop.

STATUS: APPROVED


## Décision du propriétaire — 1er octobre 2026

`STATUS: APPROVED`. Les cinq décisions sont retenues telles que proposées : boutons principaux prune avec un seul bouton or par écran ; boutons en casse normale ; fond lavande très pâle (#F8F4FF), cartes blanches et navigation prune ; contour des champs #8C7A99 et focus prune sur fond clair ; barre d’onglets en bas sur téléphone, QuickBooks ↗ toujours en haut.
