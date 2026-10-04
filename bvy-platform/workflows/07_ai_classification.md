# Workflow 07 — AI classification (and assisted reconciliation, part B)

**Status:** part A `STATUS: WAITING_FOR_OWNER_APPROVAL` — built and tested 2026-10-04 (`npm test` 54/54; review package `review/portal-classement/`). Part B (assisted reconciliation) waits for the owner's answers. Point 3 `STATUS: APPROVED` on 2026-10-04.
**Owner approval required:** yes — AI suggestions shown to staff; client data sent to the AI provider.

## Owner decisions that frame this workflow

- QuickBooks Online already categorises most transactions with its own AI and bank rules: **BVY only works on
  what QBO did not take into account** (lines left in an « uncategorized » account). Owner, 2026-10-03.
- BVY stays read-only in QBO for now: an accepted suggestion becomes a « À faire dans QuickBooks » line with a
  direct link; the next sync closes it once done. Writing into QBO is a later step that needs its own approval.
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

## Part B — assisted reconciliation (to be designed with the owner)

Compare a statement (bank or credit card, CSV/OFX first, PDF next) with the QBO account for a month and show
**only the exceptions** (owner, 2026-10-03), with the action and « Ouvrir dans QuickBooks ↗ ». Needs from the
owner: how the reconciliation of « la résidence » is done today, which files are received, how gaps are noted.

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
