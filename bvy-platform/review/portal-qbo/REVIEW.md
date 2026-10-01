# Dossier de revue — phase 4 : connexion QuickBooks Online

`STATUS: WAITING_FOR_OWNER_APPROVAL` (avant de connecter de vrais clients en production)

Date : 1er octobre 2026. Procédure : `workflows/04_quickbooks_connection.md`. Code : `apps/portal/lib/qbo.js`,
`apps/portal/lib/qbo-sync.js`. Captures avec des données fictives.

## Ce qui est construit

- **Connexion par client** (onglet QuickBooks du dossier) avec l’autorisation officielle d’Intuit (OAuth 2.0).
  Lecture seule : BVY ne modifie jamais QuickBooks.
- **Synchronisation toutes les heures** (et sur demande) : argent en banque, factures impayées et en retard,
  factures à payer, revenus et dépenses des deux derniers mois complets. Le tableau de bord du client se remplit
  seul ; la santé financière et « BVY travaille sur » restent écrits par l’équipe.
- **Suggestions** tirées de QuickBooks : dépenses non catégorisées (90 derniers jours) et factures en retard de
  plus de 30 jours. Un clic les envoie au client en mots simples, avec le lien vers la transaction ; rien n’est
  envoyé sans ce clic. Quand c’est corrigé dans QuickBooks, la tâche se ferme seule.
- **État visible** : « QuickBooks connecté · dernière synchronisation… » pour le client ; badges et nombre de
  suggestions pour l’équipe ; « Reconnexion nécessaire » si l’autorisation expire (derniers chiffres conservés).

## Captures

| Fichier | Écran |
|---|---|
| `01-equipe-clients-*` | Liste des clients avec l’état QuickBooks et les suggestions |
| `02-onglet-quickbooks-*` | Connexion, synchronisation et suggestions d’un client |
| `03-client-tableau-synchronise-*` | Le tableau de bord du client rempli par QuickBooks |

## Sécurité (30 tests automatiques, faux serveur Intuit)

Jetons chiffrés (AES-256-GCM) avec une clé qui n’existe que sur le serveur ; jetons de renouvellement remplacés à
chaque usage ; « state » OAuth à usage unique, lié à la personne et valable 10 minutes ; une entreprise QuickBooks
ne peut être reliée qu’à un seul client ; seul le personnel qui a accès au client peut connecter, synchroniser ou
déconnecter ; déconnexion = révocation chez Intuit ; tout est inscrit au journal d’audit.

## Limites connues

- **Pas encore testé avec le vrai Intuit** (mon environnement n’y a pas accès) : le premier essai se fait sur la
  société « bac à sable » d’Intuit, avec votre application (guide `DEPLOIEMENT.md` §9 ter).
- Les liens vers une transaction ouvrent QuickBooks ; si vous gérez plusieurs sociétés, QuickBooks peut d’abord
  vous demander laquelle ouvrir.
- Pour les clés de production, Intuit exige une page « Conditions d’utilisation » sur le site (à créer).
- Détection limitée pour l’instant à deux types d’éléments ; d’autres (documents manquants, doublons,
  rapprochements) viendront avec les anomalies (workflow 06).

`STATUS: WAITING_FOR_OWNER_APPROVAL`
