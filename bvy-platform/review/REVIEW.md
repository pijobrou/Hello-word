# Dossier de revue — site public BVY, version 1

`STATUS: WAITING_FOR_OWNER_APPROVAL`

Date : 26 septembre 2026. Branche : `claude/competence-marketing-pro-hvz21k`.

Répondez par **`STATUS: APPROVED`**, **`STATUS: CHANGES_REQUESTED`** (avec la liste des changements)
ou **`STATUS: REJECTED`**. Rien du portail, de QuickBooks ou de l'IA ne sera construit avant `APPROVED`.

## 1. Aperçu

| Où | Comment |
|---|---|
| Sur votre ordinateur (dès maintenant) | `cd bvy-platform\apps\website` puis `node server.js`, ensuite ouvrir http://localhost:3000 |
| En ligne | https://bvyaccountingtax.ca après `tools\deployment\deploy.cmd` (voir `tools/deployment/DEPLOIEMENT.md`) |

## 2. Captures d'écran

Dossier `screenshots/` : `bureau-*.jpg` (1440 px) et `mobile-*.jpg` (390 px, iPhone), pour
accueil, services, plateforme, fonctionnement, tarifs, contact et connexion.
Contrôle automatique : aucune erreur HTTP, aucun défilement horizontal, aucune erreur JavaScript.

## 3. Pages

| Page | Adresse | Rôle |
|---|---|---|
| Accueil | `/` | Ce qu'est BVY, 6 frustrations → réponses, 6 questions, services, rôle de QuickBooks, domiciliation, portails, appel à l'action |
| Services | `/services/` | 9 services (tenue de livres, paie, TPS/TVQ, impôt des sociétés, travailleurs autonomes, soutien comptable, incorporation, domiciliation, accès plateforme) + détail domiciliation |
| Plateforme BVY | `/plateforme/` | Tableau de bord, À faire, vue financière, documents, alertes, santé financière, communication, suivi du travail, connexion et accès direct QuickBooks, 4 niveaux de détail |
| Fonctionnement | `/fonctionnement/` | Les 8 étapes exigées, qui agit à chaque étape, avec ou sans QuickBooks, FAQ |
| Tarifs | `/tarifs/` | Soumission personnalisée : 3 formules, facteurs de prix, FAQ |
| Contact | `/contact/` | Formulaire de consultation (consentement Loi 25, anti-pourriel) |
| Connexion | `/connexion/` | Entrée du futur portail client + bouton « Ouvrir QuickBooks Online » |
| Espace professionnel | `/portail-comptable/` | Entrée du futur espace de l'équipe (non indexé) |
| Confidentialité | `/confidentialite/` | Politique Loi 25 / LPRPDE |
| Merci, 404 | `/contact/merci/`, `/404.html` | Confirmation sans JavaScript, page introuvable |

`/connexion/` et `/portail-comptable/` répondaient **403** sur l'ancien site : c'est corrigé.

## 4. Design system (base du futur portail)

- **Couleurs** : prune `#1E0820` / `#3A0F3E` / `#5C1F60`, or `#C4A040` / `#D4B860` / `#E8D080` — celles de votre fichier, inchangées. États : Bonne (vert), À surveiller (ambre), Action requise (rouge).
- **Typographie** : Cormorant Garamond (titres), Jost (texte), IBM Plex Mono (numéros) — celles de votre fichier.
- **Composants** : boutons (or, contour, prune), cartes, badges d'état, panneaux de tableau de bord, étapes, FAQ, formulaires, onglets de connexion, pied de page. Tous dans `apps/website/public/assets/css/bvy.css`, sous forme de jetons réutilisables.
- **Icônes** : jeu SVG unique (plus d'émojis), cohérent sur toutes les pages.

## 5. Expérience utilisateur

- Chaque page répond à : qu'est-ce que je regarde, pourquoi c'est important, que dois-je faire, où cliquer.
- Langage simple : « Argent disponible », « Vos clients vous doivent », « Factures à payer », « À faire ».
- Appel à l'action visible sur chaque page ; « Connexion » toujours dans la barre du haut.
- Mobile : menu complet (l'ancien site cachait la navigation sur mobile), boutons pleine largeur.
- Accessibilité : lien « Aller au contenu », focus visible, contrastes relevés, animations coupées si l'appareil le demande, formulaire utilisable au clavier et sans JavaScript.
- Performance : aucune bibliothèque, ~36 Ko de CSS et JavaScript, pages statiques servies par nginx.

## 6. Ce qui a changé par rapport à votre fichier et au site actuel

- Retiré : « Cabinet agréé CPA Québec » et « Dashboard CPA » (le site actuel les avait déjà retirés ; le titre CPA est réservé) ; les 3 témoignages (noms inventés — à remplacer par de vrais témoignages avec accord écrit).
- Courriel : `bvypjb@protonmail.com` (celui du site en ligne) au lieu de `info@bvyaccountingtax.ca`.
- Ajouté : pages Plateforme, Fonctionnement, Tarifs, Connexion, Confidentialité ; formulaire réellement enregistré sur le serveur.

## 7. Limites connues — à confirmer par vous

1. **Chiffres** « 15+ années » et « 200+ clients » : repris du site actuel, à confirmer.
2. **Tarifs** : modèle « sur soumission » avec 3 formules (noms et contenu proposés) ; seul le prix publié « domiciliation dès 295 $/mois » est affiché.
3. **Confidentialité** : durée de conservation de 24 mois, nom de la personne responsable, absence de témoins (cookies) publicitaires — à valider.
4. **Promesses** : « réponse en un jour ouvrable », intégration Payfit, catégorisation assistée par IA — à confirmer.
5. **Tableau de bord** : c'est une maquette avec des données fictives (indiqué sur la page) ; le vrai portail est la phase 3.
6. **Formulaire** : les demandes sont enregistrées dans `/var/www/bvy-website/shared/data/leads.jsonl`. Pour les recevoir par courriel, brancher `LEADS_WEBHOOK_URL` sur un flux n8n (voir `DEPLOIEMENT.md`, étape 9).
7. **Polices Google** : chargées depuis les serveurs de Google (mentionné dans la politique). On peut les héberger localement si vous préférez.
8. **Images** : les photos de services du site actuel n'ont pas pu être récupérées ; le design utilise des icônes. Vous pouvez m'envoyer des photos à intégrer.

## 8. Prochaine étape proposée

Après `STATUS: APPROVED` : workflow `01_design_system.md` — transformer ce site en design system
du portail (jetons, tableaux, modales, états vides/chargement/erreur, graphiques), puis phase 2
(authentification et rôles).
