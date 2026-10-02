# Workflow 05 — Staff dashboard and work queue (first slice)

**Status:** building (requested by the owner 2026-10-02). `WAITING_FOR_OWNER_APPROVAL` once the review package is ready.
**Owner approval required:** yes (major staff UX).

## Objective

One screen where the owner (and each staff member, for the clients they can access) sees every client, grouped
**separately** by type — **Entreprises**, **Travailleurs autonomes**, **Particuliers** — with, for each client:

1. the **next tax or administrative obligation** and its date (overdue / this week / this month);
2. what the client **owes BVY** and since when (read from the firm's own QuickBooks Online company);
3. what BVY is **waiting for from the client** (open tasks: questions, documents, approvals);
4. the **QuickBooks status** of the client (connected, failed sync, reconnect needed, suggestions to review).

Owner decisions (2026-10-02): unpaid fees come from **the firm's QBO company**; deadlines are **computed
automatically** from a short client profile; the dashboard shows **all four** items.

## Inputs

| Input | Source |
|---|---|
| Client profile: type, fiscal year-end month, GST/QST filing frequency, employees (payroll), instalments | Staff, once per client (client file → **Profil fiscal**) |
| BVY invoices to clients (open balance, overdue) | The firm's QBO company, read-only, hourly with the other syncs |
| Link client ↔ QBO customer of the firm | Automatic by name; staff can choose the customer in the profile |
| Open client tasks, QBO status, suggestions | Workflows 03 and 04 |

## Tools

| Tool | Purpose |
|---|---|
| `apps/portal/lib/deadlines.js` | Deterministic deadline rules (pure function, unit-tested) |
| `apps/portal/lib/workqueue.js` | Profile, deadline completion, custom deadlines, firm receivables, dashboard rows |
| `apps/portal/lib/qbo-sync.js` | Firm connection (admin only) and billing sync: customers + open invoices |

## Deadline rules (to be validated by the firm before production use)

Dates falling on a Saturday or Sunday move to the next Monday (statutory holidays are not shifted yet).

| Applies to | Obligation | Due date |
|---|---|---|
| Particulier | T1 / TP-1 (filing and payment) | 30 April |
| Travailleur autonome | T1 / TP-1 filing | 15 June |
| Travailleur autonome | Balance of tax owing | 30 April |
| Particulier, autonome (if instalments) | Instalments | 15 March, 15 June, 15 September, 15 December |
| Entreprise | T2 / CO-17 | Last day of the 6th month after year-end |
| Entreprise | Balance of tax owing | Last day of the 2nd month after year-end (3rd for an eligible CCPC — check per client) |
| Entreprise | REQ annual update (with the CO-17) | Same date as the CO-17 |
| Autonome, entreprise | GST/QST monthly | Last day of the following month |
| Autonome, entreprise | GST/QST quarterly | Last day of the month after the quarter (quarters follow the fiscal year) |
| Autonome | GST/QST annual | Filing 15 June, payment 30 April |
| Entreprise | GST/QST annual | Last day of the 3rd month after year-end |
| Payroll | Source deductions (regular remitter) | 15th of the following month |
| Payroll | T4 / RL-1 slips and summaries | Last day of February |
| Payroll | CNESST — déclaration des salaires | 15 March |

Each occurrence can be marked **Fait** (or **Ne s'applique pas**); staff can add a custom deadline for anything
the rules do not cover. Overdue = date passed and not marked done (looked back 90 days).

## Access

- Every staff member sees only the clients they can access (workflow 02). Clients never see this screen.
- The firm's QuickBooks connection is **administrator only** and never appears as a client.
- Read-only towards QuickBooks; every profile change, deadline completion and firm connection is audited.

## Acceptance criteria

- `npm test` green: deadline rules, grouping by type, isolation (assigned staff), firm receivables matched to
  clients, firm connection restricted to the administrator, firm never listed as a client.
- Review package with desktop and mobile screenshots.

## Owner feedback 2026-10-02 (second pass)

- Left menu: **Facturation** (administrator and lead accountant) — who owes BVY, balance, overdue part, oldest due
  date, link to the customer in BVY's QuickBooks; balances not linked to a client file listed separately.
- Client groups kept (Entreprises / Travailleurs autonomes / Particuliers). Columns per client:
  **Tenue de livres** (green = à jour, orange = en cours, red = pas encore traité; changed directly in the table),
  **TPS/TVQ**, **Retenues à la source** (incl. T4/RL-1), **T2/CO-17** (filing, balance or REQ, whichever is next;
  T1/TP-1 for self-employed and individuals), **CNESST**, **En attente** (tasks at the client, answers to process,
  unread messages, custom deadlines), **QBO** (connected / disconnected / not linked). Particuliers: T1/TP-1 and
  instalments. Each date is coloured: red overdue, orange ≤ 7 days, plum this month, grey later; « — » = not applicable.
- Administration keeps **Personnes et clients** and adds **QBO du cabinet**, which shows BVY's own obligations
  (fiscal profile of the firm, same rules, mark done / add).
