# Workflow 13 — GST/QST (TPS/TVQ)

**Status:** `STATUS: APPROVED` by the owner on 2026-10-03 (built and tested 2026-10-02; review package `review/portal-salestax/`).
**Owner approval required:** yes — new staff and client screens.

## Objective

Every GST/QST return of every registered client follows the same visible path, and **a return is never shown as
ready while the bookkeeping is not up to date** (`CLAUDE.md`).

```text
Bookkeeping complete → Accounting validation → GST/QST calculation → Review → Client approval → Filed
```

## Inputs

| Input | Source |
|---|---|
| Filing frequency (monthly, quarterly, annual), fiscal year-end | Client fiscal profile (workflow 05) |
| Bookkeeping state of the client (à jour / en cours / pas encore traité) | Dashboard (workflow 05) |
| Return figures: taxable sales, GST collected, ITCs, QST collected, ITRs | Staff, from the QuickBooks Online GST/QST report (« Taxes ») |
| Filing confirmation number, filing date | Staff, after filing (Mon dossier / ARC, Mon dossier pour les entreprises / Revenu Québec, or QBO) |

Honest limit: QuickBooks Online does not expose its Canadian GST/QST return through the public API. Staff copy
the five lines from the QBO tax report; the portal does the arithmetic, the controls and the follow-up. Every
return has an « Ouvrir les taxes dans QuickBooks ↗ » link.

## States

| State | Meaning | Blocking rule |
|---|---|---|
| **Tenue de livres à compléter** | Period closed; return created | Moves on only when the client's bookkeeping is **À jour** |
| **Validation comptable** | Bookkeeping done; accounts reviewed (bank reconciled, uncategorised cleared) | Staff confirm the checklist |
| **Calcul** | Figures entered from QBO | Five amounts required; net GST and net QST computed |
| **Révision** | A second look at the figures | Staff mark « Révisé » (the reviewer is recorded; a warning shows when the preparer reviews their own work) |
| **Approbation du client** | Client approves the amounts to pay (or the refund) | Client « J'approuve » / « Je n'approuve pas » with a comment |
| **Produite** | Filed; confirmation number recorded | The GST/QST deadline of that period is marked done in the dashboard |

Every change is audited; a return can go back one step with a reason.

## Creation

Returns are created automatically for each period that has **ended**, from the client's deadlines (workflow 05):
monthly, quarterly (aligned on the fiscal year) or annual. Periods that ended before the client's profile was set
up are not created. One return per client and period.

## Computation

- Net GST = GST collected − ITCs ; Net QST = QST collected − ITRs.
- Positive = to pay (CRA for GST, Revenu Québec for QST); negative = refund.
- Controls shown to staff (not blocking): GST collected far from 5 % of taxable sales, QST far from 9.975 %
  (more than 10 % away from the expected rate) — a sign of exempt or zero-rated sales, or of an entry error.

## Screens

- **Staff — menu « TPS/TVQ »** (admin, lead, bookkeeping, tax; not payroll): returns by state, period, due date,
  amount, blocking reason.
- **Staff — client file → tab « TPS/TVQ »**: history of returns.
- **Return sheet (staff)**: checklist, figures form, computed amounts, controls, review, filing.
- **Client — task « Approuver votre déclaration de TPS/TVQ »** and a page showing the amounts in plain language.

## Acceptance criteria

- `npm test` green: period computation, automatic creation, the bookkeeping gate (no progress while bookkeeping is
  not « À jour »), arithmetic, client approval and refusal, filing marks the deadline done, roles and isolation.
- Review package with screenshots.
