# Workflow 14 — Income tax (T2/CO-17, T1/TP-1, T2125)

**Status:** `STATUS: APPROVED` by the owner on 2026-10-03 (built and tested 2026-10-03; `npm test` 43/43; review package `review/portal-incometax/`).
**Owner approval required:** yes — new staff and client screens.

## Objective

Every income-tax file follows a visible path, the client knows exactly which documents BVY still needs, and a
return is never prepared on books that are not up to date.

## Two kinds of files

| Client | File | Created | Path |
|---|---|---|---|
| Entreprise (société) | **T2 and CO-17** for a fiscal year | When the fiscal year has ended | Bookkeeping up to date → year-end closing → preparation → review → client approval → filed |
| Travailleur autonome | **T1 and TP-1 with T2125** for a calendar year | 1 January of the following year | Documents → bookkeeping up to date → preparation → review → client approval → filed |
| Particulier | **T1 and TP-1** for a calendar year | 1 January of the following year | Documents → preparation → review → client approval → filed |

Files for years that ended before the client's profile was set up are not created (as in workflow 05).

## Documents (individuals and self-employed)

Each file carries a checklist of documents requested from the client, pre-filled by client type and editable by
staff:

- Particulier: T4 / RL-1, T4A / RL-1 (autres revenus), T5 / RL-3 (placements), T4RSP / T4RIF, REER receipts,
  child-care receipts (RL-24), medical expenses, donations, tuition (T2202 / RL-8), rent or property tax (Solidarity
  credit), Notice of assessment of the previous year.
- Travailleur autonome — in addition: business income and expenses (from QuickBooks when connected), vehicle use
  (kilometres for business and in total), home-office area and costs, GST/QST registration numbers.

The client sees the list in the portal (« Documents pour vos impôts »), uploads each document or answers « Je ne
l'ai pas / ne s'applique pas », then clicks « J'ai tout envoyé ». Staff can also mark an item received.

## Year-end closing (companies)

Checklist confirmed by staff: bank and credit-card reconciliations at year end; depreciation (CCA) and year-end
adjustments booked; payroll and GST/QST reconciled with the returns of the year; financial statements produced.

## Preparation figures (copied from the tax software; the portal computes the balance)

| File | Figures | Computed |
|---|---|---|
| T2/CO-17 | Net income per books, taxable income, federal tax payable, Québec tax payable, instalments paid | Balance = federal + Québec − instalments (payable or refund), due date of the balance (workflow 05) |
| T1/TP-1 | Total income, federal tax payable, Québec tax payable, tax already paid (source deductions and instalments) | Balance = federal + Québec − already paid; due 30 April |

## States, rules, screens

- A file never leaves « Tenue de livres à compléter » while the client's bookkeeping is not « À jour » (companies
  and self-employed).
- Review warns when the preparer reviews their own file; client approves or refuses with a comment; filing records
  the confirmation numbers (federal and Québec) and marks the dashboard deadlines done (T2/CO-17 and REQ update, or
  T1/TP-1).
- Staff: menu « Impôts » (admin, lead, tax), client-file tab « Impôts », file sheet. Client: documents page and
  approval page, tasks in « À faire ». Every change is audited; a file can go back one step with a reason.

## Acceptance criteria

- `npm test` green: creation by client type, document checklist (client upload, « ne s'applique pas », « J'ai
  tout envoyé »), bookkeeping gate, closing checklist, balance computation, client approval and refusal, filing
  marks the deadlines done, roles and isolation.
- Review package with screenshots.
