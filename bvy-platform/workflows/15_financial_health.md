# Workflow 15 — Financial health

**Status:** `STATUS: WAITING_FOR_OWNER_APPROVAL` — point 3 (owner: « on commence par 1, 2, 3, 4 »); built and tested 2026-10-03 (`npm test` 52/52; review package `review/portal-sante/`).
**Owner approval required:** yes — major client UX (the health shown on the client home).

## Objective

The client understands in a few seconds whether the business is fine, and why — never a score without an
explanation.

## States

**Bonne** · **À surveiller** · **Action requise** — for each indicator and overall (overall = the worst
indicator). Every state carries one sentence that says why, with the number behind it.

## Indicators (deterministic rules)

| Indicator | Bonne | À surveiller | Action requise | Source |
|---|---|---|---|---|
| Argent disponible | Covers at least 1 month of expenses and the bills to pay | Covers the bills but less than 1 month of expenses | Below zero, or below the bills to pay | Bank balances and bills (QuickBooks or BVY figures); expenses of the last month |
| Rentabilité | Profit last month | Loss last month only | Loss two months in a row | Profit and loss of the last two complete months (QuickBooks) |
| Clients qui vous doivent | Less than 20 % overdue more than 30 days | 20 % to 49 % overdue | 50 % or more overdue | Unpaid customer invoices (QuickBooks) |
| Dépenses | Up less than 25 % on the previous month | Up 25 % or more | — | Profit and loss (QuickBooks) |
| Taxes et échéances | Nothing late, nothing within 7 days | An obligation within 7 days, or a government request open | An obligation late | Deadlines (workflow 05) and government requests (workflow 17) |
| Paie | Pay runs on time | — | A pay run at risk or a source-deduction remittance late | Payroll (workflow 12) |

An indicator without data is not shown (« pas assez de données » for staff), never guessed.

## Human control

- The health is computed every time it is shown, from the latest figures (QuickBooks sync every hour), deadlines, government requests and payroll.
- Staff can add a comment for the client and, when the rules miss the context, set the overall state
  themselves — the explanation is then required and shown as « Évaluée par BVY ».
- Staff see the computed indicators in the client file (tab « Santé »).

## Acceptance criteria

- `npm test` green: each indicator (thresholds on both sides), overall = worst, missing data omitted, staff
  override with required explanation, client home shows state, reasons and BVY comment.
- Review package with screenshots.
