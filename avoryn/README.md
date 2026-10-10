# AVORYN — site officiel

> **L’ambition de créer. La vision de durer.**
> Technologies, innovation et solutions d’affaires.

Site institutionnel bilingue (français canadien / anglais canadien) d’AVORYN.
Statut : **prêt pour validation — non publié.**

| Document | Contenu |
| --- | --- |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Couleurs, typographie, composants, logo |
| [docs/SECURITY_PRIVACY.md](docs/SECURITY_PRIVACY.md) | Sécurité, formulaires, Loi 25 |
| [docs/TEST_REPORT.md](docs/TEST_REPORT.md) | Rapport des vérifications exécutées |
| [docs/VALIDATION_CHECKLIST.md](docs/VALIDATION_CHECKLIST.md) | Éléments à valider avant publication |

## Pile technique

- **Next.js 16** (App Router, rendu statique), **React 19**, **TypeScript strict**
- **Tailwind CSS 4** (tokens dans `src/app/globals.css`)
- Police **Inter** auto-hébergée (`@fontsource-variable/inter`) : aucune requête vers un tiers
- Formulaire : **action serveur**, validation maison, aucune base de données
- Tests : **Playwright** + **axe-core**

Dépendances d’exécution : `next`, `react`, `react-dom`, `@fontsource-variable/inter`. Rien d’autre.
Aucun service payant n’est requis ; l’envoi de courriels (Resend) ou un webhook est optionnel.

## Démarrage

```bash
npm install
cp .env.example .env.local   # puis compléter au besoin
npm run dev                  # http://localhost:3000 → redirige vers /fr ou /en
```

Prérequis : Node.js ≥ 20.9.

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run typecheck` | Vérification TypeScript |
| `npm run lint` | ESLint (règles Next.js + TypeScript) |
| `npm run test:e2e` | Tests Playwright contre le build de production (`npm run build` d’abord) |
| `npm run check` | Types + lint + build + tests |
| `npm run brand` | Régénère les SVG du logo dans `public/brand/` |

Pour les tests, Playwright doit trouver un Chromium. Si les navigateurs Playwright ne sont pas
installés (`npx playwright install chromium`), indiquer un exécutable :
`PLAYWRIGHT_CHROMIUM_PATH=/chemin/vers/chrome npm run test:e2e`.

## Structure

```
src/
  app/
    [locale]/            pages FR/EN (dossiers en anglais, URL françaises par réécriture)
      page.tsx           accueil
      about/ solutions/ technologies/ sectors/[slug]/ innovations/
      method/ insights/[slug]/ contact/ privacy/ brand/
      layout.tsx         layout racine (lang, en-tête, pied, JSON-LD)
      opengraph-image.tsx
      not-found.tsx  [...rest]/
    actions/contact.ts   action serveur du formulaire
    sitemap.ts robots.ts icon.svg globals.css
  components/            ui.tsx, sections.tsx, ContactForm.tsx, layout/, brand/
  content/               fr.ts (référence), en.ts, insights.ts, projects.ts
  lib/                   i18n.ts, slugs.ts, seo.ts, site.ts, contact.ts
  proxy.ts               redirection vers /fr ou /en selon le navigateur
scripts/generate-brand.mts
tests/                   routes, qualité (liens, a11y, responsive, SEO, sécurité), formulaires
```

### URL

| Page | Français | Anglais |
| --- | --- | --- |
| Accueil | `/fr` | `/en` |
| À propos | `/fr/a-propos` | `/en/about` |
| Solutions | `/fr/solutions` | `/en/solutions` |
| Technologies | `/fr/technologies` | `/en/technologies` |
| Secteurs | `/fr/secteurs/…` | `/en/sectors/…` |
| Innovations | `/fr/innovations` | `/en/innovations` |
| Méthode | `/fr/methode` | `/en/method` |
| Perspectives | `/fr/perspectives` | `/en/insights` |
| Contact | `/fr/contact` | `/en/contact` |
| Confidentialité | `/fr/confidentialite` | `/en/privacy` |
| Identité de marque (non indexée) | `/fr/identite` | `/en/brand` |

## Modifier le contenu

- Tous les textes : `src/content/fr.ts` et `src/content/en.ts`. `en.ts` est typé sur `fr.ts` :
  une clé manquante fait échouer `npm run typecheck`.
- Articles : `src/content/insights.ts`. Ils sont en **brouillon** : invisibles, absents du sitemap
  et en 404 en production. Pour publier : relire, `status: "published"`, renseigner `date`.
- Projets (page Innovations) : `src/content/projects.ts`, vide tant que les états réels ne sont pas confirmés.
- Coordonnées, fondateur, responsable Loi 25 : variables d’environnement (voir `.env.example`).
  Une valeur vide n’est jamais remplacée par une valeur inventée : l’élément est simplement masqué.
- Photo du fondateur : déposer le fichier dans `public/images/` et définir `NEXT_PUBLIC_FOUNDER_PHOTO`.

## Déploiement

Le site est entièrement statique, sauf le formulaire (action serveur) et la redirection de langue (`proxy.ts`).
Il fonctionne chez tout hébergeur Node.js compatible Next.js (Vercel, Netlify, Render, Fly.io,
serveur Node avec `npm run build && npm start`, conteneur Docker).

1. Définir les variables d’environnement (au minimum `NEXT_PUBLIC_SITE_URL`).
2. Configurer l’envoi du formulaire (`RESEND_API_KEY` + `CONTACT_TO_EMAIL` + `CONTACT_FROM_EMAIL`,
   ou `CONTACT_WEBHOOK_URL`). Sans configuration, le formulaire affiche en production un message
   indiquant que l’envoi n’est pas encore activé (aucune demande n’est perdue silencieusement).
3. `npm ci && npm run build && npm start`.
4. Vérifier l’URL de prévisualisation, puis — **seulement au lancement validé** —
   passer `NEXT_PUBLIC_ALLOW_INDEXING=true` et redéployer.

> Le site n’a **pas** été déployé publiquement. Aucun déploiement ne doit être fait sans l’autorisation du fondateur.
