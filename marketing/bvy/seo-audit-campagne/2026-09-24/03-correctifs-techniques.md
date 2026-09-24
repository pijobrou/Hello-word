# 03 — Correctifs techniques (pour le développeur du site)

Le site est en **Next.js (App Router)** — détecté via `/_next/static/chunks/app/page-*.js`.
Les extraits ci-dessous sont à adapter ; les valeurs entre `⟨ ⟩` sont à remplacer par les vraies
données **avant** mise en ligne (ne pas publier de gabarit).

## 1. `app/robots.ts`

```ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/connexion/', '/portail-comptable/'] }],
    sitemap: 'https://www.bvyaccountingtax.ca/sitemap.xml',
  }
}
```

## 2. `app/sitemap.ts`

```ts
import type { MetadataRoute } from 'next'

const base = 'https://www.bvyaccountingtax.ca'
const pages = [
  '', '/impot-particuliers-sainte-marie', '/tenue-de-livres', '/etats-financiers',
  '/impot-entreprises', '/tps-tvq', '/paie', '/incorporation', '/domiciliation-canada',
  '/tarifs', '/a-propos', '/faq', '/contact', '/politique-de-confidentialite',
  '/en/company-domiciliation-canada',
]

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((p) => ({ url: `${base}${p}`, lastModified: new Date() }))
}
```

## 3. Métadonnées de l'accueil (`app/page.tsx` ou `app/layout.tsx`)

```ts
export const metadata = {
  metadataBase: new URL('https://www.bvyaccountingtax.ca'),
  title: 'Comptable à Sainte-Marie (Beauce) · Impôts, tenue de livres | BVY',
  description:
    'Impôts des particuliers et des entreprises, tenue de livres et états financiers à Sainte-Marie et en Nouvelle-Beauce. Consultation gratuite de 30 min.',
  alternates: { canonical: '/', languages: { 'fr-CA': '/', 'en-CA': '/en' } },
  openGraph: {
    type: 'website', locale: 'fr_CA', siteName: 'BVY Accounting & Tax Services',
    images: [{ url: '/og-bvy.jpg', width: 1200, height: 630, alt: 'BVY — comptable à Sainte-Marie' }],
  },
}
```

Pages `/connexion/` et `/portail-comptable/` : `export const metadata = { robots: { index: false } }`.
Même chose sur `portail.bvyaccountingtax.ca`.

## 4. Redirection unique `www`

Choisir `https://www.bvyaccountingtax.ca` (c'est la version déjà indexée) et rediriger en 301
`bvyaccountingtax.ca → www.bvyaccountingtax.ca` dans nginx :

```nginx
server { listen 443 ssl; server_name bvyaccountingtax.ca; return 301 https://www.bvyaccountingtax.ca$request_uri; }
```

## 5. JSON-LD `AccountingService` (dans le `<body>` du layout)

```tsx
const org = {
  '@context': 'https://schema.org',
  '@type': 'AccountingService',
  name: 'BVY Accounting & Tax Services Inc.',
  alternateName: 'BVY Services de comptabilité et d\'impôt Inc.',
  url: 'https://www.bvyaccountingtax.ca',
  logo: 'https://www.bvyaccountingtax.ca/logo.png',
  email: 'info@bvyaccountingtax.ca',
  telephone: '⟨+1-418-XXX-XXXX⟩',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '⟨adresse civique⟩', addressLocality: 'Sainte-Marie',
    addressRegion: 'QC', postalCode: '⟨G6E …⟩', addressCountry: 'CA',
  },
  areaServed: ['Sainte-Marie', 'Nouvelle-Beauce', 'Chaudière-Appalaches', 'Québec'],
  openingHours: 'Mo-Fr 08:00-17:00',
  priceRange: '$$',
  sameAs: ['https://www.facebook.com/bvyacctax/', '⟨URL fiche Google⟩', '⟨LinkedIn⟩'],
  knowsLanguage: ['fr', 'en'],
}
// <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }} />
```

Sur chaque page de service : un bloc `FAQPage` qui reprend **mot pour mot** les questions/réponses
visibles de la page (Google ignore un schéma qui ne correspond pas au texte affiché).

## 6. Mesure (obligatoire avant toute publicité payante)

1. Google Tag Manager + GA4, avec bannière de consentement (Loi 25 : témoins non essentiels
   désactivés par défaut).
2. Événements de conversion : `generate_lead` (envoi du formulaire, avec le service choisi),
   `click_tel`, `click_email`, `click_portail`.
3. Google Search Console (propriété de domaine) + envoi du sitemap.
4. Balise Google Ads et pixel Meta **seulement** après consentement.

## 7. Formulaire

- Ajouter les options : **« Impôt des particuliers (T1/TP-1) »**, **« Travailleur autonome »**,
  **« Impôt de société (T2/CO-17) »**, **« Mise à jour de livres en retard »**.
- Case de consentement non cochée pour l'infolettre (LCAP), séparée de la demande de consultation.
- Lien vers la politique de confidentialité sous le bouton.
