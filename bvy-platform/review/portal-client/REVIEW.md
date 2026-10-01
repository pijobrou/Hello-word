# Dossier de revue — portail client BVY, phase 3

`STATUS: WAITING_FOR_OWNER_APPROVAL`

Date : 1er octobre 2026. Procédure : `workflows/03_client_portal.md`. Code : `apps/portal/`.
**Construit et testé sur ordinateur, pas encore en ligne.** Toutes les captures utilisent une entreprise fictive
(« Atelier Boréal inc. »).

Répondez par **`STATUS: APPROVED`**, **`STATUS: CHANGES_REQUESTED`** (avec vos changements) ou **`STATUS: REJECTED`**.

## 1. Ce que voit le client

| Capture | Écran | Il répond à… |
|---|---|---|
| `01-tableau-de-bord` | Argent disponible, ce que les clients doivent, factures à payer (chacun avec une phrase d’explication), santé financière **avec le pourquoi**, ce qui a changé, ses 3 prochaines tâches, ce que BVY fait (barres de progression). La date des chiffres est toujours affichée. | Où en est mon entreprise ? Y a-t-il un problème ? Qu’est-ce qui a changé ? Que fait BVY ? |
| `02-a-faire` | Les tâches de BVY : question (« Paiement Costco de 842,37 $ : dépense d’entreprise ? » Oui / Non / Autre), document à envoyer (directement depuis la tâche), approbation (J’approuve / Je n’approuve pas), information. | Que dois-je faire ? |
| `03-documents` | Envoyer un PDF ou une photo (20 Mo maximum) et retrouver ce que BVY a partagé. | Où sont mes documents ? |
| `04-messages` | Un seul fil avec BVY, au lieu des courriels dispersés. | Comment parler à mon comptable ? |
| `05-rapports` | Les rapports partagés par BVY. | Où est mon résumé du mois ? |
| `06-menu-plus-mobile` | Sur téléphone : barre d’onglets en bas, menu « Plus » (Rapports, Mon compte, QuickBooks ↗, Se déconnecter). | — |
| Partout | **« QuickBooks ↗ »** dans la navigation, en haut de l’écran et sur chaque chiffre et tâche liés. | Où voir le détail ? |

## 2. Ce que fait l’équipe BVY

| Capture | Écran |
|---|---|
| `07-equipe-clients` | La liste de ses clients : tâches ouvertes, messages non lus, date du tableau de bord (« À préparer » s’il n’y en a pas). |
| `08-equipe-tableau` | Mettre à jour le tableau de bord du client (montants, explications, santé + pourquoi, ce qui a changé, travail en cours) et le lien QuickBooks. |
| `09-equipe-taches` | Créer une tâche (le client est prévenu par courriel), voir les réponses, marquer terminé. |

Onglets Documents et Messages du dossier : partager un document ou un rapport, répondre au client.

## 3. Règles respectées (vérifiées par 22 tests automatiques)

- Un client ne voit **jamais** les chiffres, tâches, documents ou messages d’un autre client ; un membre du
  personnel seulement ses clients assignés (essais réels de contournement dans les tests : refus 403, inscrits au journal).
- Santé financière : impossible de publier un état sans explication.
- Fichiers : type vérifié d’après le contenu (un faux « .pdf » est refusé), conservés au Canada sur le serveur,
  jamais affichés dans le navigateur (toujours téléchargés), chaque téléchargement inscrit au journal.
- Courriels d’avis **sans aucun détail financier** : « Vous avez une nouvelle tâche dans votre portail BVY ».
- Liens QuickBooks acceptés seulement vers `https://…intuit.com`.
- Aucune donnée inventée : tant que QuickBooks n’est pas branché (phase 4), les chiffres sont saisis par BVY et
  leur date est toujours visible.

## 4. Limites connues

- Les chiffres sont saisis à la main par BVY jusqu’à la connexion QuickBooks (phase 4).
- « Mes finances », « Factures » et « Taxes » du menu prévu ne sont pas encore là : ils dépendent des données
  QuickBooks. Je n’ai pas voulu afficher des pages vides.
- Pas encore en ligne (DNS `portail`, certificat, service et sauvegarde à installer).

## 5. Prochaine étape proposée

1. Votre approbation de ces écrans, puis la mise en ligne sur `portail.bvyaccountingtax.ca`.
2. Phase 4 — connexion QuickBooks Online (les chiffres et les liens se mettent à jour tout seuls).

`STATUS: WAITING_FOR_OWNER_APPROVAL`
