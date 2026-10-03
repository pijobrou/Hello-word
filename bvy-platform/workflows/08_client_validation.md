# Workflow 08 — Client validation

**Status:** `STATUS: WAITING_FOR_OWNER_APPROVAL` — built and tested 2026-10-03 (`npm test` 50/50; review package `review/portal-anomalies/`).
**Owner approval required:** yes — questions shown to clients.

## Objective

When information is ambiguous, BVY asks the client one simple business question — never an account code — and
never asks the same question twice.

## Questions by situation

| Situation | Question to the client | Choices |
|---|---|---|
| Uncategorized payment | « Nous avons trouvé un paiement de 842,37 $ à Costco le 2026-02-14. Était-ce une dépense d'entreprise ? » | Oui, dépense d'entreprise · Non, personnel · Autre |
| Uncategorized deposit | « … un dépôt de 1 200,00 $ … D'où vient cet argent ? » | Une vente ou un revenu d'entreprise · Un apport personnel ou un prêt · Autre |
| Duplicate | « Nous voyons deux paiements de 310,00 $ à Hydro-Québec, le 2026-09-02 et le 2026-09-03. Avez-vous payé deux fois ? » | Oui, deux achats différents · Non, c'est le même paiement en double · Je ne sais pas |
| Unusual | « Un paiement de 4 980,00 $ à Bureau en Gros le 2026-09-12 est plus élevé que d'habitude. De quoi s'agit-il ? » | Achat d'équipement · Dépense exceptionnelle de l'entreprise · Dépense personnelle · Autre |
| Missing document | Existing document request (workflow 09); reminders by workflow 10 | Upload |

« Autre » always requires a short explanation. Staff can edit the question before it is sent.

## The answer goes back to the work

- The anomaly moves to « Réponse reçue »; the answer appears on the anomaly and in Réception.
- Staff apply the answer in QuickBooks (« Ouvrir dans QuickBooks ↗ »); the next sync closes the anomaly.

## Client memory (no repeated questions)

Every answer about a payee is remembered: « Dernière réponse du client pour Costco : Oui, dépense d'entreprise
(2026-10-19) ». Staff see it on the next anomaly or suggestion for that payee and can resolve without asking
again (« Résoudre avec la réponse précédente »). These answers will also feed AI classification (workflow 07).

## Acceptance criteria

- `npm test` green: question wording and choices by type, no account code, « Autre » needs a comment, the
  answer updates the anomaly, the memory is shown and used, roles and isolation.
