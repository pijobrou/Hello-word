# Workflow 20 — Forfait gratuit « 2 comptes bancaires » (comptabilité BVY sans QuickBooks)

STATUS: PLAN — À VALIDER PAR LE PROPRIÉTAIRE AVANT TOUTE CONSTRUCTION

## Demande du propriétaire (2026-10-10)

> « J'aimerais laisser un accès gratuit à des clients pour 2 comptes bancaires. »
> Pour qui : tout le monde, depuis le site.
> Contenu : « ils rentrent eux-mêmes les opérations et nous, nous produisons le bilan via leurs données, par
> l'intermédiaire de notre plan comptable. Une fois qu'ils ont trois comptes, on passe à QuickBooks ou on continue
> avec le nôtre et ils paient par mois. Marketing. Il faut planifier tout ensemble avant de le lancer. »
> Durée : gratuit jusqu'à ce qu'ils aient un 3e compte. Au-delà : paiement en ligne.

C'est la partie « Internal Accounting for Non-QBO Clients » prévue dans CLAUDE.md :
relevé / saisie → import → classement → validation → comptabilité → conciliation → états financiers.

## 1. Le parcours du client

1. **Inscription sur le site** (« Commencer gratuitement ») : prénom, nom, courriel, téléphone, nom de
   l'entreprise, province, consentement (Loi 25), case « Je ne suis pas un robot ».
2. **Code reçu par courriel** à entrer : le compte n'existe qu'une fois le courriel prouvé.
3. **Premier démarrage guidé (3 minutes)** : type d'entreprise (travailleur autonome, société, organisme),
   inscrit aux taxes TPS/TVQ ou non, date de fin d'exercice, ses 1 ou 2 comptes bancaires (nom, solde d'ouverture).
4. **Entrer les opérations**, trois façons :
   - saisie simple (date, description, montant, catégorie choisie dans le plan comptable BVY) ;
   - dépôt du relevé PDF (Desjardins et RBC déjà lus par BVY, vérifiés par le calcul — outil du workflow 07 B) ;
   - fichier CSV exporté de la banque.
5. **Classement aidé** : catégorie proposée d'après ses propres opérations passées (« Hydro-Québec → Électricité »),
   taxes calculées automatiquement s'il est inscrit.
6. **Conciliation** : le solde du relevé doit égaler le solde BVY ; les écarts sont montrés (même écran que la v31).
7. **Rapports** : état des résultats et bilan à jour en tout temps, téléchargeables en PDF ; résumé du mois.
8. **3e compte bancaire** → page « Passer au forfait mensuel » avec deux choix :
   - **Rester sur BVY** et payer par mois (paiement Stripe en ligne) ;
   - **Passer à QuickBooks Online** avec BVY (transfert des soldes et de l'historique par l'équipe BVY, puis
     service comptable habituel).

## 2. Le point le plus important : qui « produit le bilan » ?

Le site dit : « BVY n'offre actuellement aucune mission d'audit, d'examen ou de compilation ».
Au Québec, la **mission de compilation** (états financiers préparés par un comptable pour un tiers) relève de la
comptabilité publique, réservée aux CPA titulaires d'un permis. Donc :

- Le bilan du forfait gratuit doit être un **rapport produit par le logiciel à partir des données du client**,
  marqué clairement : « Rapport de gestion interne préparé à partir des données que vous avez saisies.
  Non audité, non examiné ; ce n'est pas une mission de compilation. »
- L'équipe BVY ne le signe pas et ne le présente pas comme des états financiers préparés par BVY.
- Si un client a besoin d'états financiers pour une banque ou un bailleur de fonds → offre payante, dirigée vers
  un CPA autorisé indépendant (comme le dit déjà le site).
- **À faire confirmer** par l'Ordre des CPA du Québec ou votre conseiller juridique avant le lancement.
  Je ne suis pas juriste : c'est un point à valider, pas une certitude.

## 3. Le plan comptable BVY

- Un plan **simplifié** (environ 40 comptes) en langage clair, par type d'entreprise : Revenus, Achats,
  Loyer, Électricité, Télécommunications, Repas (50 %), Véhicule, Assurances, Frais bancaires, Salaires, TPS à
  recevoir / à payer, TVQ à recevoir / à payer, Capital, Emprunts, etc.
- Numéros et libellés compatibles avec QuickBooks pour que le passage à QuickBooks soit un simple transfert.
- Comptabilité en **partie double** sous le capot (chaque opération équilibrée) ; le client ne voit que
  « argent entré / argent sorti / catégorie ».
- Le propriétaire valide la liste des comptes avant la construction.

## 4. Limites du forfait gratuit (à décider)

| Élément | Proposition |
|---|---|
| Comptes bancaires | 2 (un 3e déclenche le passage au forfait mensuel) |
| Opérations | 300 par mois (au-delà, l'entreprise est trop grande pour le gratuit) |
| Utilisateurs | 1 personne |
| Rapports | État des résultats, bilan, résumé mensuel, liste des opérations |
| Aide humaine | Non incluse ; « Votre avis » et une demande de consultation restent possibles |
| Déclarations TPS/TVQ, impôts | Non incluses (montants calculés, déclaration = service payant) |
| Inactivité | Avis après 10 mois sans connexion ; données supprimées à 12 mois sauf réponse (Loi 25) |

## 5. Forfait mensuel (au-delà de 2 comptes)

- Prix à fixer par le propriétaire (exemples de structure : prix par mois selon le nombre de comptes, ou un prix
  fixe + options : TPS/TVQ, paie, revue mensuelle par BVY).
- Paiement en ligne **Stripe** : abonnement mensuel, carte du client ; reçus automatiques ; annulation en tout temps.
  Le propriétaire crée les produits et les prix dans son tableau de bord Stripe ; les clés vont sur le serveur
  seulement (jamais dans le dépôt ni dans une conversation).
- Paiement en retard → avertissement, puis lecture seule (jamais de suppression de données sans préavis).

## 6. Sécurité et Loi 25 (inscription ouverte au public)

- Inscription : case « Je ne suis pas un robot », courriel prouvé par code, téléphone vérifié (filtres v33-v37),
  limite d'inscriptions par adresse IP, un seul forfait gratuit par entreprise.
- Connexion en deux étapes comme le reste du portail ; rôle « client autonome » isolé : il ne voit que son dossier.
- Politique de confidentialité et conditions d'utilisation : section « Forfait gratuit » (ce qui est conservé,
  combien de temps, suppression du compte en un clic, exportation de ses données).
- Évaluation des facteurs relatifs à la vie privée (Loi 25) avant le lancement : données financières de personnes
  qui ne sont pas encore clientes.
- Registre des incidents de confidentialité (obligatoire) : à construire avant le lancement public.

## 7. Marketing (à planifier ensemble)

- **Promesse** : « Votre comptabilité gratuite jusqu'à 2 comptes bancaires. Vous entrez vos opérations, BVY fait
  le reste : bilan, résultats, taxes calculées. »
- **Pour qui** : travailleurs autonomes et petites entreprises du Québec qui font leur comptabilité dans Excel ou
  pas du tout ; créateurs de contenu ; petites boutiques Shopify (pages sectorielles déjà sur le site).
- **Canaux** : page d'accueil du site (bouton « Commencer gratuitement »), page dédiée, fiche Google, publicités
  Meta (vidéos déjà produites), courriels de bienvenue sur 30 jours, parrainage (un mois gratuit au parrain).
- **Mesures** : inscriptions, comptes réellement utilisés après 30 jours, passages au forfait mensuel,
  passages à QuickBooks avec BVY, demandes de consultation venues du gratuit.
- Le plan marketing complet (messages, calendrier, budget) peut être produit avec l'outil Marketing Pro du dépôt.

## 8. Étapes de construction proposées (chacune présentée au propriétaire)

1. **Plan comptable et règles** : liste des comptes, taxes, limites (approbation).
2. **Moteur comptable BVY** : comptes, opérations, partie double, conciliation, rapports (tests).
3. **Saisie et import** : saisie simple, relevé PDF, CSV, classement aidé.
4. **Inscription publique** et premier démarrage guidé, avec les protections anti-robots.
5. **Rapports PDF** avec la mention « rapport de gestion interne ».
6. **Forfait mensuel Stripe** et passage à QuickBooks.
7. **Textes légaux**, évaluation Loi 25, registre des incidents.
8. **Lancement marketing** (page, publicités, courriels).

## 9. Décisions attendues du propriétaire

1. Nom du forfait (ex. « BVY Essentiel », « BVY Départ »).
2. Prix du forfait mensuel et ce qu'il inclut.
3. Limites du gratuit (opérations par mois, nombre d'utilisateurs, durée de conservation).
4. Qui peut s'inscrire : Québec seulement, Canada, ou partout.
5. Confirmation, avec l'Ordre des CPA ou un conseiller, de la façon de présenter le « bilan ».
6. L'équipe BVY regarde-t-elle les dossiers gratuits (et combien de temps), ou le gratuit est-il 100 % libre-service ?
