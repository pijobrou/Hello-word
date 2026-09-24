# 01 — Audit SEO · bvyaccountingtax.ca · 2026-09-24 · v2

> **v2 (même jour)** — le client confirme : **aucun CPA**, **cabinet virtuel**, adresse Google
> **1001, route Saint-Martin, Sainte-Marie G6E 0R8**. Les constats 1 et 7 sont réécrits en conséquence.

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
| Confiance / E-E-A-T | 🔴 2/10 | Titre CPA affiché sans CPA dans l'équipe, pas d'équipe nommée, pas d'avis, affirmations non prouvées |
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
   → **Décidé (v2) :** 1001, route Saint-Martin, Sainte-Marie G6E 0R8. D'après les annonces
   publiques, c'est un immeuble locatif résidentiel (« Sentiers 59 »). Pour un cabinet virtuel qui ne
   reçoit pas de clients, les règles de Google Business Profile demandent une **zone de service
   avec adresse masquée** : une adresse résidentielle affichée comme lieu d'accueil expose la fiche
   à une suspension. Sur le site : « Sainte-Marie (Québec) — services 100 % en ligne », sans numéro
   de logement. Il reste à choisir **un** numéro de téléphone, puis à corriger chaque fiche de
   l'Ontario (liste au PLAN § 5).
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
7. **Titre CPA — à retirer cette semaine (v2 : aucun CPA dans l'équipe).** Le titre est réservé
   aux membres de l'Ordre des CPA ; l'afficher sans l'être est une infraction au Code des
   professions, et c'est aussi ce qui ferait refuser ou signaler des annonces. Mentions trouvées
   sur la page d'accueil le 2026-09-24 :
   - bandeau : « CPA Québec — Agrément officiel » ;
   - texte d'accroche : « Cabinet agréé CPA Québec » ;
   - meta description : « Cabinet comptable professionnel agréé CPA au Québec » ;
   - section contact : « 30 minutes avec un CPA » et « Conforme Loi 25 (Québec) · PIPEDA · CPA Québec » ;
   - carte portail : « Dashboard CPA ».
   Remplacer par des preuves vraies : années d'expérience de la personne qui fait les dossiers,
   formation (DEC/AEC/BAC en comptabilité, si c'est le cas), logiciels maîtrisés, prix.
8. **États financiers.** Le site promet des bilans « conformes aux NCECF ». Sans CPA, BVY peut
   préparer des états financiers pour la direction et pour les déclarations fiscales, mais **pas**
   d'audit ni de mission d'examen (activités réservées). Si le client a besoin d'états financiers
   signés par un CPA (souvent exigé par une banque), il faut un cabinet CPA partenaire. Le cas de la
   mission de compilation est à confirmer auprès de l'Ordre des CPA avant de la proposer.

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
| Meta description | Cabinet comptable professionnel agréé CPA au Québec… (180 car., tronquée, **mention CPA à retirer**) | **Impôts des particuliers et des entreprises, tenue de livres et états financiers en Nouvelle-Beauce, 100 % en ligne. Consultation gratuite de 30 min.** (≈150 car.) |
| H1 | Votre partenaire comptable et fiscal au Canada | **Comptable à Sainte-Marie : impôts, tenue de livres et états financiers** |
| H2 | 4 H2 génériques | Un H2 par service avec le mot-clé (« Déclaration d'impôt des particuliers », « Tenue de livres pour PME »…) |

### P2 — Contenu et confiance

- Page **À propos** : nom, photo, formation et expérience réelles de la personne qui traite les
  dossiers (sans titre réservé) ; histoire du cabinet (Ontario → Québec, dit clairement) ;
  « cabinet virtuel : tout se fait en ligne, par téléphone ou en visio » ; mention du cabinet CPA
  partenaire si un partenariat est signé.
- **Tarifs** : fourchettes « à partir de » (le 295 $/mois de la domiciliation prouve que BVY
  assume l'affichage de prix — les concurrents locaux ne le font presque pas).
- **FAQ** par service (documents à fournir, dates limites, délais) — c'est ce qui est repris par
  les AI Overviews et ChatGPT.
- **Avis Google** : aucun visible. Objectif ≥ 20 avis réels avant la saison d'impôt (sollicités
  auprès de clients existants, jamais achetés, jamais rédigés par le cabinet).
- Preuves : badge QuickBooks ProAdvisor (si réel), code de représentant ARC / Revenu Québec,
  aucun logo d'ordre professionnel.

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
