# Workflow 04 — QuickBooks Online connection

**Status:** built and tested 2026-10-01 (fake Intuit API), `WAITING_FOR_OWNER_APPROVAL` before production clients — requested by the owner 2026-10-01: « les tâches et autres à faire proviennent
surtout des données de leur compte QBO »).
**Owner approval required:** before connecting real client companies in production (production launch).

## Objective

Connect each client's QuickBooks Online company to BVY so that the dashboard figures come from QBO, BVY detects
what needs attention, and the work is organised from QBO data — while QBO stays the accounting source of truth.

## Principles (`CLAUDE.md` → QuickBooks Online Functional Rule)

- **Read only.** BVY never writes to QBO. Accounting work is done in QBO; BVY reads, explains and links back.
- Every detected item keeps a direct **« Voir dans QuickBooks ↗ »** link.
- **Staff review before the client sees anything.** QBO detections become *suggestions* in the client file;
  a staff member sends them to the client as a plain-language task in one click, or dismisses them.
- When the item is fixed in QBO, the next synchronisation closes the suggestion and its client task.

## Inputs

| Input | Source |
|---|---|
| Intuit app (Client ID / Client Secret, redirect URI) | developer.intuit.com — owner creates it (development keys for the sandbox, production keys after Intuit's questionnaire) |
| `QBO_TOKEN_KEY` | 32 random bytes (`openssl rand -base64 32`), server `.env` only |
| Authorisation | A person with admin access to the client's QBO company (BVY via QuickBooks Online Accountant, or the client) |

## Tools

| Tool | Purpose |
|---|---|
| `apps/portal/lib/qbo.js` | OAuth 2.0 (authorize, token exchange, refresh, revoke), AES-256-GCM token encryption, API calls (minor version 75) |
| `apps/portal/lib/qbo-sync.js` | Synchronisation: bank balances, open invoices, open bills, profit and loss by month, uncategorised expenses, overdue invoices → snapshot + suggestions |
| `cli.js sync-all` + `bvy-portail-sync.timer` | Hourly synchronisation of every connected client |

## Procedure

1. Staff opens a client file → **QuickBooks** → **Connecter QuickBooks** → Intuit sign-in and consent
   (scope `com.intuit.quickbooks.accounting`) → back to the client file. The OAuth `state` is single-use, tied
   to the staff member and the client, and expires after 10 minutes.
2. A first synchronisation runs immediately; then every hour, and on **Synchroniser maintenant**.
3. Staff reviews **Suggestions QuickBooks**: *Envoyer au client* (creates the task with the QBO link) or *Ignorer*.
4. **Déconnecter** revokes the tokens at Intuit and deletes them from BVY.

## What a synchronisation computes

| Dashboard block | QBO source |
|---|---|
| Argent disponible | Sum of active Bank accounts' current balance |
| Vos clients vous doivent | Open invoices (balance > 0); overdue > 30 days counted separately |
| Factures à payer | Open bills; those due within 30 days counted |
| Ce qui a changé | Profit and loss: income and expenses of the current month vs the previous month |
| Santé financière, BVY travaille sur | Stay set by staff (no automatic score: every state needs a human explanation) |

| Suggestion | Detection | Client wording |
|---|---|---|
| `uncategorized` | Lines posted to an uncategorised / « Ask My Accountant » account in purchases, bills, deposits and journal entries since 1 January of the previous year (all pages). Deposits become « D’où vient cet argent ? » | « Nous avons trouvé un paiement de 842,37 $ à Costco le 18 septembre. Était-ce une dépense d’entreprise ? » |
| `overdue_invoice` | Invoice unpaid more than 30 days after its due date | « La facture n° 1042 à Client X (2 150,00 $) est en retard de 45 jours. » (information) |

## Validation rules and security

- Tokens encrypted at rest (AES-256-GCM, key only in the server `.env`); never logged, never shown.
- Refresh tokens rotate: the newest one is always stored. `invalid_grant` → status « Reconnexion nécessaire »,
  the client keeps its last figures with their date.
- Only staff who can access the client (workflow 02) can connect, sync, see suggestions or disconnect.
- Every connection, synchronisation, suggestion sent/dismissed and disconnection is in the audit log.
- Intuit API usage stays far below the free Builder tier of the Intuit App Partner Program
  (500,000 CorePlus read credits per month; about 10 calls per client per hour here).

## Errors and edge cases

| Situation | Handling |
|---|---|
| Intuit unavailable / timeout | Job recorded as failed with the error; previous figures kept and dated; retried next hour |
| Refresh token expired or revoked | Status « Reconnexion nécessaire »; staff sees a Reconnect button |
| Company connected to two BVY clients | Refused (one QBO company = one BVY client) |
| Transaction fixed in QBO | Suggestion resolved; open client task closed automatically with « Corrigé dans QuickBooks » |
| Client not using QBO | Nothing changes: figures entered by staff (workflow 03) |

## Acceptance criteria

- `npm test` green with a fake Intuit API (OAuth, refresh rotation, sync, suggestions, auto-close, isolation).
- First real test on an Intuit **sandbox** company before connecting any real client.

## Production log

- 2026-10-01 — v11: the « Connecter QuickBooks » form was silently blocked by the portal's CSP (`form-action 'self'`
  refused the redirect to Intuit). Fixed (`form-action` allows `https://appcenter.intuit.com` and `*.intuit.com`),
  reproduced and verified in Chromium, regression test added.
- 2026-10-01 — v12: Intuit gateway errors (lowercase `fault.error`, e.g. 403 `ApplicationAuthorizationFailed` 003100)
  were shown as « erreur ». Now parsed and explained in French, with the `intuit_tid` reference.
- 2026-10-02 — Root cause of the 403: Production keys with `QBO_ENV=sandbox`. Owner set `QBO_ENV=production`,
  reconnected, and the first client is connected to its real QuickBooks Online company (read-only). The QBOA consent
  screen lists the firm first; client companies are reached with « Rechercher pour un client ».
- 2026-10-02 — Owner found uncategorised operations dated February 2026 that were not suggested: the scan only
  covered purchases of the last 90 days. Now: since 1 January of the previous year, paginated, and also bills,
  deposits and journal entries (regression test with February operations). Limit, stated to the owner: bank-feed
  transactions still « À examiner » (not yet accepted in QBO) are not exposed by the Intuit API and cannot be read.
