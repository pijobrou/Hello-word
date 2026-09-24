# 01 — Audit SEO · bvyaccountingtax.ca · 2026-09-24

**Méthode.** Page d'accueil récupérée en direct via Firecrawl (HTML brut, statut 200), puis
`/robots.txt`, `/sitemap.xml`, `/connexion/`, et recherches `site:` et marque dans l'index web
Firecrawl. **Limites :** pas d'accès à Google Search Console, à Google Business Profile ni à un
outil de volumes de mots-clés ; aucune mesure de vitesse (Core Web Vitals) — tout ce qui en dépend
est marqué « à mesurer ». Aucun chiffre ci-dessous n'est une estimation présentée comme une mesure.

## Score global (grille qualitative)

| Axe | Note | En une phrase |
|---|---|---|
| Technique / indexation | 🔴 3/10 | Pas de robots.txt, pas de sitemap, pas de canonique, pas de données structurées |
| Contenu / mots-clés | 🔴 2/10 | Une seule page ; aucune page pour « impôt particulier », « tenue de livres Sainte-Marie », etc. |
| SEO local | 🔴 1/10 | Pas d'adresse complète ni de téléphone ; annuaires anciens pointent vers Scarborough (Ontario) |
| Confiance / E-E-A-T | 🟠 3/10 | Aucun nom de CPA, pas d'équipe, pas d'avis, affirmations non prouvées |
| Conversion | 🟠 5/10 | Formulaire + consultation gratuite, mais pas de téléphone, pas d'option « impôt des particuliers » |
| Mesure | 🔴 0/10 | Aucun outil d'analyse ni de suivi des conversions |
| Visibilité IA (ChatGPT, AI Overviews, Perplexity) | 🔴 1/10 | Rien de citable : pas de FAQ, pas de schéma, pas d'entité cohérente |

## Constats détaillés (priorité P0 = cette semaine)

### P0 — Bloquants

1. **Adresse et téléphone incohérents (NAP).** Le site dit « Sainte-Marie, Chaudière-Appalaches »
   sans adresse civique ni téléphone. Les annuaires et Facebook disent **275/345 Manse Rd,
   Scarborough ON**, tél. **647-778-7627** et **438-831-1554** (PagesJaunes, Cylex, Infobel,
   Scribble Maps, Facebook — lus 2026-09-24). Pour Google, l'entreprise est en Ontario : c'est le
   frein n° 1 du référencement local à Sainte-Marie.
   → Choisir **une** adresse et **un** numéro, les afficher sur le site, puis corriger chaque fiche
   (liste au PLAN § 6.1).
2. **Aucun téléphone cliquable.** En comptabilité locale, l'appel est la conversion principale.
3. **Aucune page par service.** Tout tient dans une page d'accueil : impossible de se classer à la
   fois sur « impôt particulier Sainte-Marie », « tenue de livres Beauce » et « domiciliation
   entreprise Québec ».
4. **Les particuliers sont absents de l'offre.** Le T1 n'est cité qu'une fois dans une liste ; le
   formulaire n'offre **aucune option « Impôt des particuliers / travailleur autonome »**. C'est
   pourtant l'une des deux cibles demandées.
5. **Aucune mesure.** Ni GA4, ni Google Tag Manager, ni pixel Meta : aucune campagne ne pourra
   être pilotée au coût par demande.
6. **Loi 25.** Le site collecte nom, courriel, téléphone et pays, affiche « 100 % Conforme Loi 25 »,
   mais ne montre ni politique de confidentialité ni responsable de la protection des
   renseignements personnels. Risque légal **et** de crédibilité.
7. **Titre CPA.** « Cabinet agréé CPA Québec » et « avec un CPA » : à rendre vérifiable (nom et
   numéro de membre du CPA, lien vers le Tableau de l'Ordre). Si ce n'est pas le cas, retirer la
   mention immédiatement — l'usage du titre est réservé.

### P1 — Technique

| Élément | Constat | Correctif |
|---|---|---|
| `robots.txt` | 404 | Créer (voir 03-correctifs-techniques.md) |
| `sitemap.xml` | 404 | Générer via `app/sitemap.ts` |
| Balise canonique | Absente ; l'index contient `www.` alors que le site répond aussi sans `www` | Choisir une version, redirection 301, canonique |
| Données structurées | Aucune (ni `AccountingService`, ni `FAQPage`) | JSON-LD `AccountingService` + `FAQPage` |
| Open Graph / partage | Aucune balise `og:` | Titre, description, image 1200×630 avec logo |
| Langue | `fr` seulement, pas de version anglaise ni `hreflang` alors que le nom est anglais et la cible inclut des investisseurs étrangers | Version EN des pages domiciliation + `hreflang` fr-CA/en-CA |
| Portail | `portail.bvyaccountingtax.ca` et `/connexion/` indexés | `noindex` sur les pages de connexion |
| Rendu | Next.js, contenu présent dans le HTML serveur ✅ | — |
| Images | `alt` présents ✅, chargement différé ✅ | Nommer les fichiers avec le service + ville |
| Vitesse | Non mesurée | Lancer PageSpeed Insights (mobile) |

### P1 — Balises de la page d'accueil

| | Actuel | Proposé |
|---|---|---|
| `<title>` (68 car.) | BVY Accounting & Tax Services Inc. — Cabinet Comptable Professionnel | **Comptable à Sainte-Marie (Beauce) · Impôts, tenue de livres \| BVY** |
| Meta description | Cabinet comptable professionnel agréé CPA au Québec… (180 car., tronquée) | **Impôts des particuliers et des entreprises, tenue de livres et états financiers à Sainte-Marie et en Nouvelle-Beauce. Consultation gratuite de 30 min.** (≈150 car.) |
| H1 | Votre partenaire comptable et fiscal au Canada | **Comptable à Sainte-Marie : impôts, tenue de livres et états financiers** |
| H2 | 4 H2 génériques | Un H2 par service avec le mot-clé (« Déclaration d'impôt des particuliers », « Tenue de livres pour PME »…) |

### P2 — Contenu et confiance

- Page **À propos** : nom, photo, titre professionnel et numéro de membre du ou des CPA ;
  histoire du cabinet (Ontario → Québec, s'il y a lieu, dit clairement).
- **Tarifs** : fourchettes « à partir de » (le 295 $/mois de la domiciliation prouve que BVY
  assume l'affichage de prix — les concurrents locaux ne le font presque pas).
- **FAQ** par service (documents à fournir, dates limites, délais) — c'est ce qui est repris par
  les AI Overviews et ChatGPT.
- **Avis Google** : aucun visible. Objectif ≥ 20 avis réels avant la saison d'impôt (sollicités
  auprès de clients existants, jamais achetés, jamais rédigés par le cabinet).
- Preuves : badge QuickBooks ProAdvisor (si réel), logos d'ordre professionnel (si autorisé).

## Mots-clés cibles (volumes à mesurer dans Google Keyword Planner avant de fixer les budgets)

| Groupe | Requêtes | Page cible |
|---|---|---|
| Impôt particuliers | comptable impôt Sainte-Marie · déclaration d'impôt Beauce · faire ses impôts Sainte-Marie · impôt travailleur autonome Beauce | `/impot-particuliers-sainte-marie` |
| Tenue de livres | tenue de livres Sainte-Marie · tenue de livres Beauce · comptable PME Nouvelle-Beauce · QuickBooks comptable Beauce | `/tenue-de-livres` |
| États financiers / bilan | états financiers entreprise Beauce · mission de compilation · bilan fin d'année PME | `/etats-financiers` |
| Impôt entreprises | déclaration T2 CO-17 · impôt société par actions Beauce · comptable entreprise incorporée | `/impot-entreprises` |
| Taxes | déclaration TPS TVQ · rapport de taxes trimestriel | `/tps-tvq` |
| International | domiciliation entreprise Québec · ouvrir une entreprise au Canada depuis la France · company registration Quebec non-resident | `/domiciliation-canada` + `/en/…` |
| Marque | BVY comptable · BVY Accounting | accueil |

## Visibilité IA (six surfaces)

Google AI Overviews, ChatGPT, Perplexity, Gemini, Copilot, Claude : BVY n'a aujourd'hui aucune
chance d'être cité, faute de contenu de réponse et d'une entité claire (nom + adresse + services
cohérents partout). Les mêmes correctifs (NAP unique, FAQ, schéma `AccountingService`, pages
par service, avis) servent le SEO classique **et** les réponses IA. Test à refaire après
correctifs : demander « quel comptable à Sainte-Marie de Beauce pour mes impôts ? » sur chaque
surface et noter qui est cité.
