# Workflow 06 — Anomalies

**Status:** `STATUS: WAITING_FOR_OWNER_APPROVAL` — built and tested 2026-10-03 (`npm test` 48/48; review package `review/portal-anomalies/`).
**Owner approval required:** yes — new staff screen « Anomalies » and client questions created from it.

## Objective

Problems are found by the portal, not discovered too late by a person: every anomaly has a severity, a plain
explanation, an owner, a recommended action, a status, a resolution and a history.

## What is detected (deterministic rules — no AI at this stage)

| Group | Anomaly | Rule | Source |
|---|---|---|---|
| Standard | Duplicate transaction | Two payments (expense, cheque, bill) to the same payee for the same amount, within 3 days | QuickBooks sync |
| Standard | Unusual transaction | Payment at least 3 × the usual amount paid to that payee (median of ≥ 3 earlier payments) and ≥ 500 $; or a first payment ≥ 5 000 $ to a new payee | QuickBooks sync |
| Standard | Uncertain category | Line posted to an « uncategorized » account (workflow 04) | QuickBooks sync |
| Standard | Missing document | A document requested from the client still missing after 14 days | Tasks |
| System | QuickBooks disconnected | Connection no longer authorised | QuickBooks |
| System | Synchronisation failed | Last sync ended in error (the error is shown) | QuickBooks |
| System | Data out of date | Connected but not synchronised for 48 hours | QuickBooks |
| System | Missing data | No fiscal profile: deadlines cannot be computed | Client file |
| Urgent | Dangerous cash position | Bank balance below zero, or below the bills to pay | Dashboard figures |
| Urgent | Tax deadline approaching / passed | An obligation not done, due within 7 days or late | Deadlines (workflow 05) |
| Urgent | Major overdue invoice | Customer invoice overdue ≥ 90 days or ≥ 5 000 $ | QuickBooks sync |
| Urgent | Payroll risk | Pay date within 2 days and pay run not ready | Payroll (workflow 12) |

Rules run every hour and after every QuickBooks sync. An anomaly that is no longer detected is closed
automatically with the resolution « Plus détecté » (for example, fixed in QuickBooks). An ignored anomaly is
not raised again.

## States and actions

`Ouverte → En cours (owner) → En attente du client → Réponse reçue → Résolue | Ignorée`

- **Prendre en charge**: the staff member becomes the owner.
- **Demander au client** (workflow 08): a plain-language question is created in the client's « À faire ».
- **Résoudre**: a resolution note is required. **Ignorer**: a reason is required.
- **Rouvrir**: back to open. Every change is recorded in the anomaly's history and audited.

## Screens

- **Staff — menu « Anomalies »** (all staff, only the clients they can access): grouped by Urgent, System,
  Standard; filter by status; owner, client, explanation, recommended action, QuickBooks link.
- **Staff — client file → tab « Anomalies »**.
- **Staff dashboard**: tile « Anomalies urgentes ».

## Honest limits

- Detection reads what QuickBooks returns for the period already synchronised (since 1 January of last year);
  it does not read attachments.
- « Dangerous cash position » compares the dashboard figures; it does not forecast cash flow.

## Acceptance criteria

- `npm test` green: each rule (positive and negative case), automatic closing, ignored not raised again, states
  and required notes, history, roles and isolation.
- Review package with screenshots.
