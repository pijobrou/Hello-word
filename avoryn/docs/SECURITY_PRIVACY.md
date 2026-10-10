# Sécurité et protection des renseignements personnels

> Ce document décrit les mesures techniques en place. Il ne constitue pas un avis juridique :
> la conformité à la Loi 25 et aux lois fédérales doit être validée par un conseiller qualifié.

## 1. Données traitées par le site

| Donnée | Origine | Traitement | Conservation par le site |
| --- | --- | --- | --- |
| Type, nom, courriel, organisation (facultative), secteur (facultatif), message | Formulaire | Validée côté serveur puis transmise (courriel Resend ou webhook) | **Aucune** (pas de base de données) |
| Adresse IP | Requête | Compteur anti-abus en mémoire, 10 minutes | Effacée à l’expiration de la fenêtre |
| Témoins (cookies), analytique | — | **Aucun** | — |

En mode `log` (développement, tests), seules des métadonnées non personnelles sont journalisées
(type de demande, secteur, langue, longueur du message).

## 2. Minimisation et consentement

- Seuls le nom, le courriel et le message sont obligatoires.
- Le consentement est une case à cocher explicite, non précochée, reliée à la politique.
- Le formulaire invite à ne transmettre aucun renseignement sensible.
- Aucune ressource tierce (police, script, analytique) n’est chargée : aucune donnée de navigation n’est communiquée à un tiers. Un test automatisé le vérifie.

## 3. Protection du formulaire

| Mesure | Implémentation |
| --- | --- |
| Validation serveur | `src/lib/contact.ts` — types autorisés, longueurs maximales, format du courriel, liste fermée de secteurs |
| Nettoyage | Retrait des caractères de contrôle ; courriel envoyé en **texte brut** (pas d’injection HTML) ; objet tronqué |
| Pot de miel | Champ `website` invisible ; rempli → rejet |
| Délai minimal | Horodatage posé côté client ; envoi en moins de 2,5 s ou horodatage invalide → rejet |
| Filtre de liens | Plus de 3 URL dans le message → rejet |
| Limitation du débit | 5 envois / IP / 10 min (`CONTACT_RATE_LIMIT`) |
| Délais réseau | Appels sortants limités à 10 s |
| Secrets | Clés uniquement côté serveur (aucune variable `NEXT_PUBLIC_` sensible) |

**Limite connue** : le compteur de débit est propre à chaque instance du serveur. Sur une plateforme
serverless à forte charge, compléter par la protection de l’hébergeur (WAF, limitation au niveau du CDN)
ou par un CAPTCHA respectueux de la vie privée (p. ex. Cloudflare Turnstile) — non ajouté pour éviter
un service tiers non nécessaire à ce stade.

## 4. En-têtes HTTP

`Content-Security-Policy` (`default-src 'self'`, `frame-ancestors 'none'`, `form-action 'self'`,
`object-src 'none'`, `upgrade-insecure-requests`), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictive,
suppression de `X-Powered-By`. Définis dans `next.config.ts`.

`script-src` inclut `'unsafe-inline'`, requis par les scripts d’hydratation de Next.js en rendu
statique. Une CSP à nonce est possible mais imposerait un rendu dynamique de chaque page ; le site
n’affichant aucun contenu fourni par les visiteurs, le risque résiduel est faible.

## 5. Gestion des accès

- Les demandes arrivent dans la boîte courriel (ou l’outil) désignée par `CONTACT_TO_EMAIL` / le webhook : limiter l’accès aux personnes qui traitent les demandes et activer l’authentification multifacteur.
- Clés d’API : stockées chez l’hébergeur, renouvelées en cas de départ ou de doute.
- Dépendances : `npm audit` à chaque mise à jour. État au moment de la livraison : 0 vulnérabilité dans les dépendances d’exécution ; une alerte « high » concerne `braces` via l’outillage ESLint (développement uniquement, non déployé).

## 6. Obligations Loi 25 — à mettre en place par l’entreprise

- [ ] Désigner le **responsable de la protection des renseignements personnels** (par défaut, la personne ayant la plus haute autorité) et publier son titre et ses coordonnées.
- [ ] Adopter et publier des **politiques et pratiques de gouvernance** (conservation, destruction, rôles, traitement des plaintes).
- [ ] Tenir un **registre des incidents de confidentialité** ; aviser la Commission d’accès à l’information et les personnes concernées en cas de risque de préjudice sérieux.
- [ ] Réaliser une **évaluation des facteurs relatifs à la vie privée (EFVP)** avant de communiquer des renseignements hors Québec (hébergeur, fournisseur courriel).
- [ ] Fixer la **durée de conservation** des demandes reçues et la procédure de destruction.
- [ ] Compléter et faire valider la politique de confidentialité (`/fr/confidentialite`).

## 7. Procédure d’incident (résumé)

1. Contenir : révoquer les clés exposées, désactiver le formulaire (`CONTACT_DELIVERY=disabled`).
2. Évaluer : renseignements touchés, personnes concernées, risque de préjudice sérieux.
3. Aviser : Commission d’accès à l’information et personnes concernées si le risque est sérieux.
4. Consigner l’incident au registre et corriger la cause.
