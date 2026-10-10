# Rapport des vérifications

**Date d’exécution :** 10 octobre 2026
**Environnement :** Linux, Node.js 22.22, Next.js 16.4.0, Chromium (Playwright 1.64), build de production (`next start`).
**Commande :** `npm run typecheck && npm run lint && npm run build && npm run test:e2e`

## Résultat global

| Vérification | Résultat |
| --- | --- |
| Vérification des types (`tsc --noEmit`, mode strict + `noUncheckedIndexedAccess`) | ✅ 0 erreur |
| Lint (ESLint, règles Next.js core-web-vitals + TypeScript) | ✅ 0 erreur, 0 avertissement |
| Build de production | ✅ 41 pages statiques générées |
| Tests Playwright | ✅ **107 réussis, 0 échec** (2,0 min) |
| `npm audit --omit=dev` (dépendances d’exécution) | ✅ 0 vulnérabilité |

## Détail des 107 tests

### Routes — `tests/routes.spec.ts` (41)

- **34 pages** (17 FR + 17 EN, dont les 12 fiches secteur) : statut 200, un seul `<h1>` visible,
  `lang="fr-CA"` / `"en-CA"`, titre, méta-description, URL canonique, liens `hreflang` fr-CA / en-CA / x-default,
  **aucune erreur ni avertissement dans la console** et aucune exception JavaScript.
- `/` → `/fr` (navigateur francophone) et → `/en` (navigateur anglophone) ; `/contact` → `/fr/contact`.
- `/fr/about` → 308 vers `/fr/a-propos` (URL canonique unique).
- Sélecteur de langue sur une fiche secteur : `/fr/secteurs/immobilier` ⇄ `/en/sectors/real-estate`.
- 404 localisée en français et en anglais.
- Les articles en brouillon renvoient 404 en production.

### Qualité — `tests/quality.spec.ts` (48)

- **Liens** : tous les liens internes des 34 pages répondent < 400 ; toutes les ancres `#…` ciblent un élément existant.
- **Accessibilité** : analyse axe-core (WCAG 2.0/2.1/2.2 A et AA) sur les **34 pages** → 0 violation, contrastes compris ;
  plus le formulaire en état d’erreur → 0 violation.
- **Tailles d’écran** : 360, 768, 1024 et 1440 px → aucun débordement horizontal sur les 34 pages.
- **Menu mobile** : `aria-expanded`, ouverture, fermeture par Échap avec retour du focus, fermeture après navigation.
- **Lien d’évitement** « Aller au contenu principal » : premier élément focusable, visible au focus.
- **SEO** : `robots.txt` bloquant avant le lancement ; `sitemap.xml` bilingue avec `hreflang`, sans brouillon ni page d’identité ;
  JSON-LD `Organization` valide (nom, slogan officiel) ; image Open Graph PNG générée.
- **Sécurité** : CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` présents, `X-Powered-By` absent ;
  aucune requête vers un domaine tiers.

### Formulaires — `tests/forms.spec.ts` (18)

- Validation (logique pure) : demande valide acceptée ; 7 erreurs détectées simultanément ; longueur maximale ; secteur par défaut.
- Anti-robot : pot de miel, envoi trop rapide, horodatage invalide, message rempli de liens, envoi humain accepté, envoi sans JavaScript accepté.
- Navigateur : résumé d’erreurs focalisé et champs liés par `aria-describedby` ; valeurs conservées après erreur ;
  **envoi valide → confirmation de réception focalisée** ; rejet d’un envoi trop rapide ; rejet du pot de miel ;
  type présélectionné par l’URL (`?type=partnership`) ; fiche secteur avec secteur imposé et envoi réussi ; messages en anglais.

Les tests de formulaire s’exécutent avec `CONTACT_DELIVERY=log` : aucun courriel n’est envoyé et aucune donnée personnelle n’est journalisée.

## Vérifications complémentaires (manuelles, exécutées)

- Mode révision `NEXT_PUBLIC_SHOW_DRAFTS=true` : les 3 articles brouillons s’affichent (200) avec `robots: noindex`.
- Revue visuelle (captures 1440 px et 375 px) : accueil, À propos, Solutions, Méthode, Contact, Technologies, Innovations, Identité.
  Deux défauts corrigés pendant la revue : symbole du hero non affiché (conflit animation/translation) et libellés rognés dans le schéma du cycle.
- Contrastes de la palette calculés (voir `docs/DESIGN_SYSTEM.md`).

## Problèmes trouvés et corrigés par les tests

1. Présélection du type de demande depuis l’URL non appliquée après hydratation → groupe radio remonté avec une clé.
2. Couleur de texte secondaire figée au niveau `:root` (gris sur fond bleu nuit) → token `@theme inline`.

## Non couvert / limites

- Envoi réel de courriel (Resend) ou webhook : nécessite des identifiants ; à tester après configuration.
- Navigateurs Firefox et Safari : non testés (seul Chromium est disponible dans l’environnement d’exécution).
- Lecteurs d’écran réels (NVDA, VoiceOver) : non testés ; axe-core couvre les règles automatisables seulement.
- Performances mesurées (Lighthouse) : non exécuté ; le site est statique, sans script tiers ni police externe.
- Limitation de débit : logique simple non couverte par un test automatisé dédié.
- `npm audit` complet : 1 alerte « high » (`braces`) dans l’outillage ESLint de développement, non déployé ; la correction proposée par npm rétrograderait `eslint-config-next` vers la v14 (non appliquée).
