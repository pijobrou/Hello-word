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

## 0. Objectif : un outil de marketing (précision du propriétaire, 2026-10-10)

> « La gratuité, c'est comme un marketing pour m'attirer la clientèle. Une fois le bilan fait, on leur propose la
> T2/CO-17. »

Le forfait gratuit n'est pas un produit en soi : c'est la **porte d'entrée**. Il attire les petites entreprises,
les habitue à BVY pendant l'année, et prépare les données de leur fin d'exercice. La vente visée :

| Client | Ce que BVY propose à la fin de l'exercice |
|---|---|
| Société par actions (incorporée) | **T2** (fédéral) et **CO-17** (Québec), avec les états financiers IGRF tirés de ses données BVY |
| Travailleur autonome | T1 avec **T2125** (fédéral) et **TP-80** (Québec) |
| Inscrit aux taxes | Déclarations de TPS/TVQ (déjà calculées dans BVY) |
| 3 comptes bancaires ou plus | Forfait mensuel BVY, ou passage à QuickBooks avec BVY |

Conséquences sur le plan :
- **Le moment clé est la fin de l'exercice** : 60 jours avant, le portail affiche « Votre année se termine le … :
  BVY peut produire votre T2 et votre CO-17 à partir de vos données » avec le prix et un bouton « Je veux que BVY
  s'en occupe » (demande envoyée à l'équipe, devis, paiement).
- **La qualité des données compte plus que le volume** : une T2 se prépare vite si les opérations sont classées et
  conciliées. Le portail montre au client un indicateur « Prêt pour la fin d'année » (comptes conciliés, opérations
  non classées, pièces manquantes).
- **Le « bilan » du gratuit sert à préparer la déclaration** : ce sont les renseignements IGRF (annexes 100 et 125
  de la T2) produits dans le cadre du service fiscal payant, et non des états financiers « compilés » remis à des
  tiers. La mention « rapport de gestion interne » reste sur le rapport téléchargé par le client (section 2).

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

**Base retenue par le propriétaire (2026-10-10)** : les lignes du formulaire fédéral **T2125, État des résultats
des activités d'une entreprise ou d'une profession libérale** (parties 3, 4 et 7). Chaque compte BVY porte le
numéro de ligne T2125 : le rapport annuel donne directement les montants à inscrire dans la déclaration.
Comptabilité en partie double sous le capot ; le client ne voit que des noms clairs.

### 3.1 Revenus (partie 3C)

| Compte BVY | Nom affiché au client | Ligne T2125 | Notes |
|---|---|---|---|
| 4000 | Ventes et honoraires | 8000 (via 3A) | Montant **avant** TPS/TVQ si inscrit aux taxes |
| 4100 | Commissions | 8000 (via 3A) | |
| 4900 | Autres revenus | 8230 | Subventions, intérêts d'entreprise, etc. |

TPS et TVQ perçues → comptes de taxes à payer (3.5), jamais dans les revenus.

### 3.2 Coût des marchandises vendues (partie 3D) — pour ceux qui vendent des produits (Shopify, boutique)

| Compte | Nom affiché | Ligne T2125 |
|---|---|---|
| 5000 | Achats de marchandises | 8320 |
| 5100 | Main-d'œuvre directe | 8340 |
| 5200 | Sous-traitance | 8360 |
| 5300 | Autres coûts (emballage, frais de plateforme liés aux ventes) | 8450 |
| — | Stock au début / à la fin de l'année | 8300 / 8500 (saisi une fois par an) |

### 3.3 Dépenses (partie 4)

| Compte | Nom affiché au client | Ligne T2125 | Règle automatique |
|---|---|---|---|
| 6010 | Publicité | 8521 | |
| 6020 | Repas et frais de représentation | 8523 | **50 % seulement** reporté à la ligne 8523 |
| 6030 | Créances irrécouvrables | 8590 | Seulement si le revenu avait été inscrit |
| 6040 | Assurances (entreprise) | 8690 | Pas l'assurance auto ni maison (voir 3.4) |
| 6050 | Intérêts et frais bancaires | 8710 | |
| 6060 | Taxes d'affaires, droits d'adhésion et licences | 8760 | |
| 6070 | Frais de bureau | 8810 | Logiciels, abonnements, petits équipements |
| 6080 | Papeterie et fournitures de bureau | 8811 | |
| 6090 | Honoraires professionnels (comptables, juridiques) | 8860 | |
| 6100 | Frais de gestion et d'administration | 8871 | |
| 6110 | Loyer | 8910 | Local d'affaires (pas la maison : voir 3.4) |
| 6120 | Réparations et entretien | 8960 | |
| 6130 | Salaires et avantages (y compris cotisations de l'employeur) | 9060 | |
| 6140 | Impôts fonciers (local d'affaires) | 9180 | |
| 6150 | Frais de déplacement | 9200 | Hébergement, transport ; repas → 6020 |
| 6160 | Services publics (local d'affaires) | 9220 | Électricité, chauffage, eau, Internet, téléphone |
| 6170 | Carburant et huile (sauf véhicules à moteur) | 9224 | Machinerie, génératrice |
| 6180 | Livraison, transport et messagerie | 9275 | Postes Canada, Purolator, frais d'expédition |
| 6900 | Autres dépenses (préciser) | 9270 | Le client doit écrire une précision |

### 3.4 Dépenses avec une part personnelle

**Véhicule à moteur (tableau A → ligne 9281)** — le client indique une fois par an les kilomètres d'affaires et
les kilomètres totaux ; BVY applique le pourcentage d'affaires.

| Compte | Nom affiché | Vers |
|---|---|---|
| 7010 | Véhicule : essence et huile | 9281 × % affaires |
| 7020 | Véhicule : entretien et réparations | 9281 × % affaires |
| 7030 | Véhicule : assurance | 9281 × % affaires |
| 7040 | Véhicule : permis et immatriculation | 9281 × % affaires |
| 7050 | Véhicule : intérêts sur le prêt | 9281 × % affaires (plafond ARC) |
| 7060 | Véhicule : frais de location (bail) | 9281 × % affaires (plafond ARC) |
| 7070 | Véhicule : autres frais (stationnement d'affaires, lave-auto) | 9281 |

**Utilisation de la résidence aux fins de l'entreprise (partie 7 → ligne 9945)** — le client indique une fois par
an la superficie du bureau et la superficie totale de la maison ; BVY calcule la part d'affaires, et la déduction
ne peut pas créer ou augmenter une perte (report à l'année suivante, ligne 7O).

| Compte | Nom affiché | Ligne partie 7 |
|---|---|---|
| 7510 | Maison : chauffage | 7A |
| 7520 | Maison : électricité | 7B |
| 7530 | Maison : assurance | 7C |
| 7540 | Maison : entretien | 7D |
| 7550 | Maison : intérêts hypothécaires | 7E |
| 7560 | Maison : impôts fonciers (taxes municipales et scolaires) | 7F |
| 7590 | Maison : autres (préciser) — loyer si locataire, Internet | 7G |

**Déduction pour amortissement (DPA, ligne 9936)** : jamais saisie comme dépense. Le client inscrit l'achat d'un
bien durable (ordinateur, équipement, véhicule) dans « Biens de l'entreprise » (1500) ; la DPA est calculée à la
fin de l'année (catégorie, taux, règle de la demi-année) et **revue par BVY** avant d'être utilisée.

### 3.5 Bilan (actif, passif, avoir du propriétaire)

| Compte | Nom affiché | Notes |
|---|---|---|
| 1010 | Compte bancaire 1 | Forfait gratuit : 2 comptes au maximum |
| 1020 | Compte bancaire 2 | |
| 1050 | Petite caisse (argent comptant) | Ne compte pas comme compte bancaire |
| 1200 | Clients — argent à recevoir | Factures envoyées non payées |
| 1300 | TPS à recevoir (CTI) | Si inscrit |
| 1310 | TVQ à recevoir (RTI) | Si inscrit |
| 1400 | Stock de marchandises | Fin d'année |
| 1500 | Biens de l'entreprise (équipement, ordinateur, véhicule) | Base de la DPA |
| 2100 | Fournisseurs — factures à payer | |
| 2200 | TPS à payer | Si inscrit |
| 2210 | TVQ à payer | Si inscrit |
| 2300 | Carte de crédit d'entreprise | Compte bancaire au sens du forfait ? **À décider** |
| 2500 | Emprunts | |
| 3100 | Apports du propriétaire | Argent personnel mis dans l'entreprise |
| 3200 | Retraits du propriétaire | Argent de l'entreprise pris pour soi (pas une dépense) |
| 3900 | Avoir du propriétaire (début d'exercice) | |

### 3.6 Sociétés par actions (clients T2 / CO-17) — la cible principale

Bonne nouvelle : les numéros de lignes du T2125 **sont les codes de l'IGRF** (Index général des renseignements
financiers) utilisés par la T2 pour l'état des résultats (annexe 125) : 8000, 8320, 8521, 8523, 8590, 8690, 8710,
8760, 8810, 8811, 8860, 8871, 8910, 8960, 9060, 9180, 9200, 9220, 9224, 9275, 9281, 9270. Revenu Québec accepte
les mêmes renseignements IGRF avec la CO-17. **Le même plan BVY sert donc aux deux.** Différences pour une société :

| Sujet | Travailleur autonome (T2125) | Société par actions (T2 / CO-17) |
|---|---|---|
| Amortissement | DPA ligne 9936 | Amortissement comptable (IGRF 9936) et DPA à l'annexe 8 |
| Bureau à la maison | Partie 7 (ligne 9945) | Pas de partie 7 : la société paie un loyer ou rembourse l'actionnaire |
| Véhicule | % d'affaires (tableau A) | Avantage imposable ou allocation : à revoir par BVY |
| Argent pris par le propriétaire | Retraits (3200), sans impôt | **Prêt à l'actionnaire, salaire ou dividende** : à classer avec BVY (règles fiscales strictes) |
| Avoir | Apports, retraits, avoir du propriétaire | Capital-actions, bénéfices non répartis, dividendes |

Comptes de bilan propres aux sociétés (codes IGRF du bilan, annexe 100) :

| Compte | Nom affiché | IGRF |
|---|---|---|
| 2780 | Avances de l'actionnaire (argent que vous avez prêté à la société) | 2780 |
| 1310 | Avances à l'actionnaire (argent pris dans la société) — **alerte BVY** | 1301 (à confirmer) |
| 3500 | Capital-actions | 3500 |
| 3600 | Bénéfices non répartis | 3600 |
| 3700 | Dividendes déclarés | 3700 |

Les codes IGRF du bilan pour les autres comptes (encaisse 1001, clients 1060, stocks 1120, fournisseurs 2620,
taxes à payer 2680, emprunts 2700 / 3140, etc.) seront vérifiés un par un dans le guide de l'IGRF (RC4088)
avant la construction.

**Alerte automatique** : quand un client incorporé classe une sortie d'argent « pour moi » (épicerie, dépense
personnelle), BVY ne la met pas en dépense ; il la place dans « Avances à l'actionnaire » et avertit le client
qu'il faudra la régulariser avec BVY avant la fin de l'année (règle du prêt à l'actionnaire). C'est aussi une
occasion naturelle de proposer le service.

### 3.7 Limites de cette base

- **Québec** : le travailleur autonome québécois remplit aussi le **TP-80** de Revenu Québec, dont les lignes
  diffèrent ; colonne de correspondance TP-80 à ajouter (à valider par le propriétaire).
- Les règles (50 % des repas, plafonds des véhicules, DPA, prêt à l'actionnaire) sont celles de l'ARC et de
  Revenu Québec à la date de construction ; à revoir chaque année.

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
- **Entonnoir** : inscription gratuite → données de l'année classées et conciliées → indicateur « Prêt pour la
  fin d'année » → offre T2/CO-17 (ou T1/TP-80) 60 jours avant la fin de l'exercice → client de BVY.
- **Mesures** : déclarations T2/CO-17 et T1 vendues aux inscrits gratuits (mesure principale), inscriptions, comptes réellement utilisés après 30 jours, passages au forfait mensuel,
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

## 9. Décisions du propriétaire (2026-10-10)

| Sujet | Décision |
|---|---|
| But | Outil de marketing : le gratuit mène à la T2/CO-17 (et T1/TP-80, TPS/TVQ) |
| Nom | **BVY Libre** |
| Qui peut s'inscrire | **Tout le Canada** |
| Carte de crédit d'entreprise | **Compte comme un compte bancaire** : 2 au total (ex. 1 compte + 1 carte) ; le 3e = forfait payant |
| Dépassement des limites (opérations, utilisateurs) | Facturé par le **forfait supplémentaire** ou ajouté au **prix de la T2** |
| Suivi par l'équipe BVY pendant l'année | **Non**, 100 % libre-service — **sauf si le client paie** : revue en cours d'année, T2, CO-17, TPS/TVQ |
| Plan comptable | Lignes T2125 = codes IGRF (sections 3.1 à 3.6) |

Conséquences de « tout le Canada » :
- Hors Québec : pas de CO-17 ; T2 seulement, sauf l'**Alberta** (déclaration provinciale AT1 séparée) — à offrir
  ou non. Travailleurs autonomes hors Québec : T1/T2125 sans TP-80.
- Taxes : **TVH** (Ontario, provinces de l'Atlantique) et **TVP** (Colombie-Britannique, Saskatchewan, Manitoba)
  en plus de TPS/TVQ : comptes de taxes à ajouter selon la province choisie à l'inscription.
- Vie privée : Loi 25 pour les clients du Québec, **LPRPDE** (fédérale) pour les autres provinces ; même niveau de
  protection pour tous.

## 10. Décisions encore attendues

1. Prix de la **T2 + CO-17** (société au Québec) et de la **T2 seule** (hors Québec).
2. Prix de la **T1 + T2125 + TP-80** (travailleur autonome).
3. Prix des **déclarations TPS/TVQ** (par période) et de la **revue en cours d'année** (si offerte).
4. Prix du **forfait mensuel** (3 comptes ou plus) et du dépassement (opérations, utilisateurs).
5. Limites du gratuit : proposé **300 opérations par mois** et **1 utilisateur**.
6. Offrir l'**AT1 (Alberta)** ou non.
7. Confirmation (Ordre des CPA ou conseiller) de la présentation du rapport (section 2).
