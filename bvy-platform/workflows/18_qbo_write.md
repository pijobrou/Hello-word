# Workflow 18 — Écrire dans QuickBooks sur un clic

STATUS: WAITING_FOR_OWNER_APPROVAL

## Décision du propriétaire (2026-10-05)

> « il faut que ma plateforme soit très facile et utile pour le travail ; si je travaille sur ma plateforme je ne
> refais pas le travail dans QBO, je clique et c'est fait. Ou je me rends sur QBO et j'effectue le travail
> rapidement. Pour les rapprochements bancaires je veux aller vite. »

QuickBooks reste le livre officiel (CLAUDE.md). Ce workflow est celui qui « permet explicitement » des écritures
dans QBO, selon la règle : **jamais automatique, toujours sur le clic d'un membre autorisé de l'équipe**.

## Ce que BVY écrit dans QuickBooks

| Où | Bouton | Ce qui est fait dans QBO |
|---|---|---|
| Classement (onglet du client) | « Classer dans QuickBooks (N) » | Les lignes au compte « non catégorisé » de chaque opération du groupe passent au compte choisi (et au code de taxe choisi). |
| Conciliation — « Au relevé, pas dans QuickBooks » | « Créer dans QuickBooks » | Une dépense (sortie) ou un dépôt (entrée) au compte bancaire du relevé, à la date et au montant du relevé, avec la catégorie et la taxe choisies. |
| Conciliation — en lot | « Créer dans QuickBooks les N opérations dont la catégorie est proposée » | Même chose pour chaque ligne manquante dont la catégorie est connue par l'historique du dossier ; les autres restent à choisir une par une. |
| Conciliation — « Montant différent » | « Corriger dans QuickBooks : montant » | Le montant de l'opération QBO devient celui du relevé (opération à une ligne, sans taxe seulement). |
| Réception — relevé bancaire PDF | « Relevé bancaire : concilier maintenant » | Rien n'est écrit : la conciliation démarre avec le compte bancaire retenu pour ce client (le dernier utilisé, ou le seul). |

Les propositions viennent de l'historique QuickBooks du dossier : compte habituel du bénéficiaire et code de taxe
habituel. La personne peut toujours changer la catégorie ou la taxe avant de cliquer.

## Sécurité

1. **Rôles** : administrateur, comptable principal, teneur de livres, impôts. La paie et le client ne voient aucun
   bouton et toute tentative est refusée.
2. **Interrupteur** : Administration → Suggestions → « Écriture dans QuickBooks » (activé par défaut). Désactivé,
   aucun bouton n'apparaît et toute écriture est refusée.
3. **Vérification après coup** : QBO renvoie l'opération enregistrée ; si son total n'est pas exactement celui voulu
   (taxes recalculées autrement, par exemple), BVY défait aussitôt (suppression de l'opération créée, ou remise
   des comptes d'avant) et affiche « rien n'a été créé / changé — faites-le dans QuickBooks ».
4. **Journal et annulation** : chaque écriture est enregistrée (avant / après, qui, quand) dans « Fait dans
   QuickBooks par BVY », avec un bouton « Annuler » qui supprime l'opération créée ou remet l'état d'avant. Elle est
   aussi au journal d'audit (`qbo.write.*`).
5. **Isolation** : un membre de l'équipe n'écrit que dans les dossiers qui lui sont assignés.

## Ce qui reste dans QuickBooks (limites honnêtes)

- **Cocher dans l'écran de rapprochement de QBO** : l'API d'Intuit ne le permet pas. BVY indique la façon rapide :
  « cochez tout, puis décochez seulement les opérations En circulation ».
- Supprimer un doublon (« Dans QuickBooks, pas au relevé ») : « Ouvrir dans QuickBooks ↗ ». Une suppression est
  trop sensible pour un clic depuis BVY.
- Corriger le montant d'une opération à plusieurs lignes ou avec taxes.
- Les opérations encore « À examiner » dans le flux bancaire de QBO ne sont pas lisibles par l'API.
- Cartes de crédit : pas encore.
- Les taxes à la création utilisent « taxes incluses » ; la vérification du total protège contre un écart.
  À confirmer sur un vrai dossier avec le propriétaire avant un usage large.

## Outils

- `apps/portal/lib/qbo-write.js` — `recategorize`, `createFromStatement`, `fixAmount`, `undo`, `recent`.
- `apps/portal/lib/qbo.js` — `post()` ; `qbo-sync.js` — `withToken`, codes de taxe, historique avec taxes.
- Migration 16 : `qbo_tax_codes`, `qbo_payee_accounts.tax_code`, `qbo_writes`.
- Tests : `apps/portal/test/qbo-write.test.js` (QuickBooks fictif en mémoire ; relevé fictif).

## Critères d'acceptation

- [x] Un clic crée / classe / corrige dans QBO, avec vérification du total et annulation possible.
- [x] Aucun bouton pour les rôles non autorisés ; interrupteur administrateur.
- [x] Chaque écriture au journal.
- [ ] Essai sur un vrai dossier QBO (bac à sable Intuit ou dossier test) avec le propriétaire.
