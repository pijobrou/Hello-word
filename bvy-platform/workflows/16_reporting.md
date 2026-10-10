# Workflow 16 — Automated summaries

**Status:** `STATUS: APPROVED` by the owner on 2026-10-04 (built and tested 2026-10-03, `npm test` 52/52; review package `review/portal-sante/`).
**Owner approval required:** yes — documents sent to clients.

## Objective

Each month (and each quarter and year on demand) the client receives a short summary in plain business language:
where the business stands, what changed, what to watch, what the client must do, what BVY did.

## Content of a summary

1. **En bref** — one paragraph written by staff (pre-filled from the figures).
2. **Les chiffres** — revenue, expenses, profit or loss of the period, compared with the previous period;
   money available and money customers owe at the end of the period when known.
3. **Ce qui a changé** — the important changes only.
4. **À surveiller** — the health indicators « À surveiller » or « Action requise » (workflow 15), each with its
   reason.
5. **Ce que vous avez à faire** — open client tasks.
6. **Ce que BVY a fait pour vous** — counted from the portal for the period: documents filed, questions settled,
   GST/QST returns and tax returns filed, pay runs completed, government requests answered, anomalies resolved.

## Flow

```text
Period ended → draft generated (automatically on the 3rd of the next month for monthly; on demand for quarter
and year) → staff review and edit « En bref » and the figures → Publier → client sees it in « Rapports »,
notified by email without any amount
```

- Figures come from QuickBooks (profit and loss of the exact period) when connected; otherwise staff enter them
  in the draft. Missing figures are shown as « non disponible », never estimated.
- A published summary can be corrected (republished); the previous version is kept in the history.
- Nothing is sent to a client without a staff click on « Publier ».

## Screens

- **Staff — menu « Résumés »**: drafts to review and published summaries; « Préparer les résumés » for a month,
  quarter or year (all accessible clients, or one client from its file).
- **Staff — summary editor**: every section, editable « En bref » and figures, preview as the client sees it.
- **Client — « Rapports »**: the published summaries, newest first, then the shared report files.

## Acceptance criteria

- `npm test` green: period computation (month, quarter on the fiscal year, year), draft content from the portal
  (BVY actions counted for the period only), QuickBooks figures when available, staff figures otherwise, publish
  gate, client sees only published summaries of their own business, email without amounts, roles and isolation.
- Review package with screenshots.
