# Workflow 03 — Client portal MVP

**Status:** `WAITING_FOR_OWNER_APPROVAL` (built and tested 2026-10-01; review package `review/portal-client/`). Prerequisites: design system approved, workflow 02 built.
**Owner approval required:** before real clients use it (major client UX + production launch, `CLAUDE.md`).

## Objective

A client with little accounting knowledge understands in about 30 seconds where the business stands, what
needs their attention and what BVY is doing — and can act (answer, upload, write) without training.

## Scope (MVP, `CLAUDE.md` → "Client Portal MVP")

| Area | Client sees / does | BVY staff (assigned or management) do |
|---|---|---|
| Accueil (tableau de bord) | Argent disponible, sommes à recevoir, factures à payer, santé financière **avec explication**, ce qui a changé, ce que BVY fait, prochaines tâches | Update the snapshot (date, amounts, state + why, changes, work progress) |
| À faire | Answer a business question (« Était-ce une dépense d’entreprise ? »), send a missing document, approve, read an information | Create tasks; see answers; close tasks |
| Documents | Send documents (PDF, JPG, PNG, 20 MB max); see what BVY shared | Share documents; download what the client sent |
| Messages | One conversation with BVY | Reply |
| Rapports | Reports and returns shared by BVY | Share a document as a report |
| QuickBooks ↗ | « Ouvrir QuickBooks » when the client uses QBO | Save the client’s QBO company link |

Until the QuickBooks integration (workflow 04), the dashboard figures are entered by BVY staff and always show
their date (« Chiffres au 30 septembre 2026, mis à jour par BVY »). Nothing is invented or computed by the portal.

## Data (migration 2, `apps/portal/lib/db.js`)

`clients.qbo_url`, `client_snapshots` (one JSON snapshot per client, with author and date), `tasks`,
`documents` (files on disk under `DATA_DIR/documents/<client>/`, random names, mode 0600, SHA-256 kept),
`messages`, `message_reads`.

## Rules

- Every read and write goes through `canAccessClient()` (workflow 02); a client never reaches another client.
- Plain language (`CLAUDE.md` → "Plain-Language Accounting"): no account codes, no jargon on the client side.
- Every state shown has an explanation (financial health: Bonne / À surveiller / Action requise + why).
- Uploads: type checked by content (PDF/JPEG/PNG signatures), size ≤ 20 MB, never served inline, downloaded
  only by people with access. Each upload, download and task answer is in the audit log.
- Email notifications carry no financial detail: « Vous avez une nouvelle tâche dans votre portail BVY ».
- QuickBooks links open in a new tab and are only `https://*.intuit.com` addresses.

## Errors and edge cases

| Situation | Handling |
|---|---|
| No snapshot yet | Dashboard says so plainly and points to À faire / Messages |
| File too large or wrong type | Clear message, nothing stored |
| Client with several users | All see the same business; each answer records who answered |
| Email cannot be sent | The item is still created; the portal is the source of truth |

## Acceptance criteria

- `npm test` green, including isolation tests for every new route (task, document, message, snapshot).
- Screens answer the four questions of `CLAUDE.md` (« What am I looking at? … What should I click next? »).
- Review package with desktop and mobile screenshots presented to the owner.
