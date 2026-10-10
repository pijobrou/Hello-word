# Éléments à valider avant publication

Cocher chaque élément. Rien n’a été inventé : chaque valeur manquante est soit masquée, soit signalée « [À COMPLÉTER] ».

## Identité et marque

- [ ] **Logo** provisoire (symbole + logotype) — approuver, ajuster ou remplacer. Recherche d’antériorité auprès de l’OPIC avant tout dépôt.
- [ ] **Slogan anglais** « Driven to Create. Built to Last. » — adaptation marketing à valider (`src/content/en.ts`, `meta.slogan`).
- [ ] Nom légal de l’entreprise (`NEXT_PUBLIC_LEGAL_NAME`) — affiché dans le pied de page, la politique et les données structurées.
- [ ] Nom de domaine et `NEXT_PUBLIC_SITE_URL`.

## Fondateur

- [ ] Nom complet à afficher (`NEXT_PUBLIC_FOUNDER_NAME`) — actuellement « Le fondateur d’AVORYN ».
- [ ] Photographie professionnelle (`public/images/…` + `NEXT_PUBLIC_FOUNDER_PHOTO`) — actuellement le symbole en remplacement.
- [ ] Relire la biographie (page À propos) : formulation, liste des domaines d’expérience, absence de titre réglementé.

## Contenu

- [ ] Relire l’ensemble des textes FR et EN (`src/content/fr.ts`, `en.ts`).
- [ ] Mention de non-prestation de services réglementés (comptables, fiscaux, juridiques, placement) dans Secteurs — confirmer la formulation.
- [ ] Page Technologies : confirmer quelles capacités sont « offertes en accompagnement » et lesquelles sont « en exploration ».
- [ ] Page Innovations : confirmer les trois axes d’exploration (états « Recherche » / « Concept ») ou les retirer.
- [ ] Projets (BVY Accounting, GovBid, CuddleNest, autres) : décider lesquels présenter, avec leur **état réel** et leur lien juridique exact avec AVORYN (`src/content/projects.ts`). Aucun n’est affiché actuellement.
- [ ] Articles Perspectives : trois brouillons rédigés (sans statistiques ni actualités). Relire, puis publier un à un (`status: "published"`, `date`).
- [ ] Coordonnées publiques facultatives : courriel, téléphone, ville, LinkedIn.

## Juridique et Loi 25

- [ ] Désigner le responsable de la protection des renseignements personnels (`NEXT_PUBLIC_PRIVACY_OFFICER_NAME` / `_EMAIL`).
- [ ] Compléter la politique de confidentialité : hébergeur, fournisseur courriel, durée de conservation, date de mise à jour — puis **validation juridique** et retrait de l’avis « Brouillon » (`privacy.draftNotice`).
- [ ] EFVP si l’hébergeur ou le fournisseur courriel traite des données hors Québec.
- [ ] Politiques de gouvernance et registre des incidents (voir `docs/SECURITY_PRIVACY.md`).
- [ ] Vérifier l’usage du nom « AVORYN » (registre des entreprises du Québec, marques de commerce).

## Technique (au lancement)

- [ ] Choisir l’hébergeur et configurer les variables (`.env.example`).
- [ ] Configurer l’envoi du formulaire (Resend avec domaine vérifié, ou webhook) et faire un envoi réel de bout en bout.
- [ ] Protéger la boîte de réception (MFA, accès restreint).
- [ ] Relancer `npm run check` sur l’environnement cible.
- [ ] Passer `NEXT_PUBLIC_ALLOW_INDEXING=true` **seulement** une fois tout ce qui précède validé, puis soumettre le sitemap (Google Search Console, Bing Webmaster Tools).
- [ ] Autorisation explicite du fondateur pour la mise en ligne.
