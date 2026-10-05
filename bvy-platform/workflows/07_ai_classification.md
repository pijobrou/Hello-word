# Workflow 07 — AI classification (and assisted reconciliation, part B)

**Status:** part A `STATUS: APPROVED` by the owner on 2026-10-04. Part B `STATUS: WAITING_FOR_OWNER_APPROVAL` — built and tested 2026-10-05 (`npm test` 57/57; review package `review/portal-conciliation/`).
**Owner approval required:** yes — AI suggestions shown to staff; client data sent to the AI provider.

## Owner decisions that frame this workflow

- QuickBooks Online already categorises most transactions with its own AI and bank rules: **BVY only works on
  what QBO did not take into account** (lines left in an « uncategorized » account). Owner, 2026-10-03.
- BVY stays read-only in QBO for now: an accepted suggestion becomes a « À faire dans QuickBooks » line with a
  direct link; the next sync closes it once done. Writing into QBO is a later step that needs its own approval.
- **No AI wording in the pages** (owner, 2026-10-04): no « IA », « Claude », « intelligence artificielle », model name
  or tokens on any client or staff page. Staff see « suggestion automatique » and « d'après l'historique du dossier »;
  the settings page is « Administration → Suggestions ». The privacy policy still has to mention the external
  service (Loi 25) before it is turned on.
- Reference: `docs/cahier-anomalies-qbo.md` (points 3, 11, 12, 14, 15), applied progressively.

## Part A — category suggestions

Order of the engines (deterministic first, AI last — cahier, point 16):

1. **History of the file** — how the same payee was categorised in QuickBooks before (all payments read since
   1 January of last year). Suggestion when one account holds at least 80 % of at least 3 earlier payments.
   Confidence = that share (minus 5 points with fewer than 5 payments). Explanation: « 14 paiements à Amazon sur
   15 classés en Fournitures ».
2. **AI** (only when enabled by the administrator and the API key is installed on the server) — for the remaining
   lines: payee, description, amount, date and the client's chart of accounts are sent; the answer must be one
   account of that chart, a confidence and one sentence of reasoning. Nothing else of the client is sent (no
   name, no address, no other transaction).
3. **Client's previous answer** (workflow 08) is shown next to the suggestion.

Thresholds (configurable in Administration, defaults from `CLAUDE.md`):

| Confidence | Meaning |
|---|---|
| 95–100 % | Strong suggestion. « Automatic » is **not** used: BVY does not write into QBO. |
| 75–94 % | Suggestion. |
| below 75 % | Validation required: choose the account or ask the client. |

Grouping: lines of the same payee are grouped — « Amazon — 23 transactions — 1 284,32 $ — Fournitures — 91 % —
[Accepter pour les 23] [Choisir une autre catégorie] [Demander au client] ».

Every decision is recorded (who, when, suggested account, chosen account, source history/AI, confidence) — the
feedback that makes the next suggestions better (the history engine learns from QBO itself after correction).

## Part B — assisted reconciliation (owner's answers, 2026-10-05)

Owner's process today: reconciliation **in QuickBooks** (Reconcile), statements received **as PDF**, the
accountant **ticks the operations that match the statement**. Owner chose: read the PDF on BVY's server (A), with
the external service as a fallback (B).

1. Staff choose the QuickBooks bank account and a statement PDF (already received, or uploaded on the spot).
2. **Reading on BVY's server** (`lib/statement.js`, pdf.js): lines rebuilt from the text positions — date,
   description, amount (withdrawal/debit or deposit/credit column), balance when printed. Formats: Desjardins
   (Frais / Retrait / Dépôt / Solde, several accounts per statement, negative balances « 377.35- ») and RBC
   (Cheques & Debits / Deposits & Credits / Balance, period summary). Checked by arithmetic: opening + deposits −
   withdrawals = closing, every printed balance, and the bank's summary totals and counts when present.
   Tested on two real statements of the owner (kept outside the repository): 107 lines with 107 balances, and
   80 lines matching the summary exactly.
3. **Fallback**: only if the local reading does not balance and the administrator has enabled automatic
   suggestions, the PDF is read by the external service; its answer goes through the same arithmetic checks.
   An unverified reading is shown with a warning, never as certain.
4. **QuickBooks** (read only): every transaction of that account for the period ± 15 days — expenses and
   cheques, deposits, transfers, bill payments, customer payments, sales receipts, refunds, journal entries.
5. **Matching**: same amount and date within 3 days, then 10 days; cheques by number (60 days); grouped
   deposits (one statement line = 2 to 4 QuickBooks entries, or the reverse); same payee with a different amount.
6. **Only the exceptions are shown** (owner): « Au relevé, pas dans QuickBooks », « Montant différent »,
   « Dans QuickBooks, pas au relevé » (duplicate or wrong date), « En circulation » (normal). What matches is
   counted and listed folded, to be ticked in QuickBooks. Each exception: « Ouvrir / Saisir dans QuickBooks ↗ »
   and « Réglé ». The reconciliation can be closed only when every gap except « en circulation » is settled.

Limits: other bank layouts are added one by one from real samples; credit-card accounts come later (sign
conventions differ); BVY does not tick anything in QuickBooks itself.

## Privacy (Loi 25)

AI calls use the Anthropic API; data leaves the portal for the duration of the call. The administrator turns the
AI on only after the privacy policy and client consent mention it. Every call is logged (date, client, number of
lines, model, tokens) — never the content.

## Acceptance criteria

- `npm test` green: history rule (threshold, share, small samples), AI answer validated against the chart (an
  account outside the chart is rejected), AI disabled → history only, grouping by payee, accept / choose /
  reject recorded, « À faire dans QuickBooks » closed by the next sync, thresholds configurable, roles and
  isolation, no client name in the AI request.
- Review package with screenshots.
