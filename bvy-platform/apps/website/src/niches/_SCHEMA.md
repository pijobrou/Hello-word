# Format d'une page de niche (un fichier JSON par niche)

Le fichier `src/niches/<slug>.json` produit la page `/<slug>/` au moment de `node build.js`.
Pour mettre à jour « Ce qui change dans votre secteur » : modifier `changes.items` et `changes.updated`,
puis `node build.js`. Aucune modification réglementaire n'est publiée sans validation humaine.

```jsonc
{
  "slug": "comptabilite-entreprise-ia-saas-quebec",   // = URL /<slug>/ et nom des images
  "order": 1,                                          // ordre des cartes sur l'accueil
  "title": "Comptabilité pour entreprises IA et SaaS | BVY",   // balise <title>
  "description": "…",                                  // méta-description (≤ 160 caractères)
  "breadcrumb": "Entreprises IA et SaaS",              // nom court (fil d'Ariane, schéma)
  "card": {                                            // carte de l'accueil (≤ 45 mots au total)
    "title": "Entreprises IA et SaaS",
    "text": "Une phrase courte, orientée mouvement (pas d'inquiétude).",
    "button": "Comptabilité pour IA et SaaS"
  },
  "image":  { "alt": "…" },    // image principale : /assets/img/secteurs/<slug>.webp (4:3)
  "image2": { "alt": "…" },    // image secondaire : /assets/img/secteurs/<slug>-2.webp (3:2)
  "eyebrow": "Entreprises IA, technologiques et SaaS",
  "h1": "…",                   // seul H1 de la page, contient le mot-clé principal
  "quote": "…",                // phrase philosophique du secteur
  "intro": ["paragraphe", "paragraphe"],
  "reality":  { "h2": "…", "paragraphs": ["…"] },
  "stages":   { "h2": "…", "intro": "…",
                "items": [ { "name": "Lancement", "text": "…", "needs": ["besoin comptable", "…"] } ] },  // 3 étapes
  "flow":     { "h2": "…", "intro": "…",
                "steps": [ { "label": "Vente", "detail": "…" } ],   // 4 à 6 étapes du parcours de l'argent
                "result": "…" },                                     // la clarté obtenue au bout
  "expertise":{ "h2": "…", "intro": "…", "items": ["…"] },
  "services": { "h2": "…", "items": [ { "name": "…", "text": "…", "link": "/services/#tenue-de-livres" } ] },
  "offer": null,               // ou { "name", "price", "text", "includes": [], "limits": "…", "button" } (Shopify seulement)
  "changes":  { "updated": "2026-09-30",
                "items": [ { "kind": "Technologies|Modèles de revenus|Obligations fiscales et administratives",
                             "title": "…", "text": "…", "link": null, "source": "https://… (source officielle)" } ] },
  "faq": [ { "q": "…", "a": "…" } ],   // 4 à 5 questions
  "cta": { "title": "…", "text": "…", "button": "…", "service": "tenue-de-livres" },
  "keywords": ["…"]            // pour mémoire (non affiché)
}
```
