# Workflow 09 — Documents

**Status:** `STATUS: WAITING_FOR_OWNER_APPROVAL` — built and tested 2026-10-03 (`npm test` 46/46; review package `review/portal-inbox/`).
**Owner approval required:** yes — new staff screen « Réception » and changes to the client documents page.

## Objective

Every document a client sends is identified, filed with the right period and linked to the work it belongs to
(income tax, payroll, GST/QST), so nobody searches for a document and nothing sits unread in a folder.

## Flow

```text
Client sends a document (Documents page, a task, payroll hours, tax checklist)
  ↓
Identification: type suggested from the client's answer « De quoi s'agit-il ? », the file name and where it was sent
  ↓
Duplicate check (same file already received for this client)
  ↓
Staff « Réception »: confirm type and period, link it to a tax file / pay run / GST-QST return  →  Classé
  ↓
Searchable in the client file (name, type, period)
```

Documents sent from a context that already says what they are (a tax checklist item, payroll hours) are filed
automatically with their link; they do not wait in Réception.

## Document types (plain language)

Facture d'achat ou de fournisseur · Facture de vente · Relevé bancaire · Relevé de carte de crédit · Reçu de
dépense · Document d'impôt (feuillet, avis de cotisation) · Paie · TPS/TVQ · Lettre du gouvernement (ARC, Revenu
Québec, CNESST) · Contrat, bail ou entente · Autre.

## Rules

- The suggestion is never presented as certain: staff see « Suggestion : … (d'après le nom du fichier) » or
  « (selon le client) » and confirm with one click.
- Period: `AAAA-MM` or `AAAA`, pre-filled when the file name contains a date.
- A link can only point to a file of the same client (tax file, pay run, GST/QST return).
- Duplicate = same content (SHA-256) already received for the same client; staff see « Déjà reçu le … » and can
  file it as a duplicate. Files are never deleted from the portal (retention).
- Every classification is audited.

## Honest limit

No OCR or content extraction in this phase: identification uses the client's answer, the file name and the
context. Reading the content of a document (amounts, dates, vendor) comes with the AI phase (workflow 07), on
documents the portal already stores.

## Screens

- **Staff — menu « Réception »** (every staff role, only the clients they can access): documents to file, client
  replies to close, unread messages, clients without answer after 3 reminders (workflow 10).
- **Staff — client file → Documents**: search by name, type and period; type, period and link columns; filing form
  for documents not yet filed.
- **Client — Documents**: « De quoi s'agit-il ? » when sending (optional, « Je ne sais pas » allowed); the type
  is shown in the list and the list can be filtered by type.

## Acceptance criteria

- `npm test` green: suggestion from the name and from the client's answer, period from the name, duplicate
  detection, automatic filing from a tax checklist, Réception limited to accessible clients, filing with a link
  (a link to another client's file is refused), search, roles and isolation.
- Review package with screenshots.
