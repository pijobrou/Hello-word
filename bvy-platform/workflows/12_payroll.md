# Workflow 12 — Payroll

**Status:** plan approved by the owner on 2026-10-02 (« exécuter 12_payroll.md »); built and tested the same day (`lib/payroll.js`, `lib/views-payroll.js`, `test/payroll.test.js`); review package `review/portal-payroll/`. `WAITING_FOR_OWNER_APPROVAL` of the screens before real clients use it.
**Owner approval required:** yes — new client and staff screens (major UX).

## Objective

Every pay of every client with employees is visible in one place, with a clear state, and nobody has to chase
hours or approvals by email. BVY knows what it is waiting for; the client knows what BVY needs and when.

Owner decisions (2026-10-02):
- Payroll is calculated in **QuickBooks Online Paie (Canada)**. BVY's portal organises the work and links to it;
  it never calculates pay.
- The client sends hours **either** by entering them in the portal **or** by uploading a timesheet (PDF, photo, Excel).
- The client **always approves** the payroll summary before the pay becomes « Prête ».

## Honest limit

Intuit does not offer an API for **QuickBooks Payroll Canada** (its payroll API covers the United States only).
The portal therefore cannot read pay runs, amounts or employees from QBO Paie. Staff enter the summary of each pay
(gross total, net total, deductions/remittance, number of employees) after calculating it in QuickBooks; every pay
has an « Ouvrir la paie dans QuickBooks ↗ » link. Accounting entries created by QBO Paie are still read by the
regular QuickBooks sync (workflow 04).

## Inputs

| Input | Source |
|---|---|
| Pay schedule per client: weekly, biweekly, semi-monthly or monthly; next pay date; hours due N days before | Staff, once (client file → **Paie**) |
| Employees: first and last name, hourly or salaried, active — **never** SIN, address, bank account or salary rate | Staff (the full employee file stays in QBO Paie) |
| Hours per pay | Client in the portal (per employee: regular hours, overtime, vacation/sick, note) or timesheet upload |
| Payroll summary | Staff after calculating in QBO Paie |

## States of a pay (from `CLAUDE.md`)

| State | Meaning | Who acts |
|---|---|---|
| **En attente des données** | Pay created from the schedule; hours requested from the client | Client |
| **Heures reçues** | Client entered hours or uploaded the timesheet | BVY |
| **Validation requise** | BVY posted the summary; client approval requested | Client |
| **En préparation** | Approved; BVY finalises in QBO Paie | BVY |
| **Prête** | Calculated, approved, ready to be paid on the pay date | BVY |
| **Terminée** | Paid; the source-deduction deadline (RS) of that month follows in the dashboard | — |

A pay can go back one step with a reason (e.g. hours corrected). Every change is audited (who, when, from → to).

## Procedure

1. **Set up** (staff, once per client): tick « A des employés » in the fiscal profile (workflow 05), choose the pay
   schedule and next pay date, list the employees (names only).
2. **Automatically**, N days before each pay date (3 by default), the portal creates the pay in « En attente des
   données » and gives the client a **« Heures de paie — paie du AAAA-MM-JJ »** task by email.
3. **Client**: enters hours per employee **or** uploads the timesheet, then submits → « Heures reçues ».
4. **Staff** calculate in QBO Paie, enter the summary (gross, net, deductions/remittance, employees paid) →
   « Validation requise »; the client gets an **approval** task.
5. **Client** approves (« J'approuve ») or refuses with a comment (back to « Heures reçues »).
6. **Staff** finalise → « En préparation » → « Prête » → « Terminée » after payment.
7. The next pay of the schedule is created automatically.

## Screens

- **Staff — menu « Paie »** (roles admin, lead, payroll; bookkeeping and tax do not see payroll): all pays of the
  coming 30 days and late ones, grouped by state, with client, pay date, what is missing, and the QBO Paie link.
- **Staff — client file → tab « Paie »**: schedule, employees, history of pays and their summaries.
- **Dashboard (workflow 05)**: the « RS » column keeps showing source-deduction deadlines; a pay waiting for the
  client appears in « En attente ».
- **Client — À faire**: the hours and approval tasks. **Client — Accueil**: « Paie du AAAA-MM-JJ : en préparation »
  in « BVY travaille sur ».

## Validation rules and edge cases

| Situation | Handling |
|---|---|
| Hours not received 1 day before the pay date | Pay flagged red on the staff Paie screen; reminder email to the client |
| Client refuses the summary | Back to « Heures reçues » with the client's comment; staff notified |
| New or departing employee | Client writes it in the hours note; staff update the list (and QBO Paie) |
| Statutory holiday on the pay date | Staff move the pay date; the change is audited |
| Client without employees | No payroll tab, no pays, no RS column dates |

## Security

- Payroll data is visible only to admin, lead, payroll staff assigned to the client, and the client's own users.
- No SIN, bank details or pay rates are stored in BVY; amounts stored are the pay totals only.
- Every state change, summary entry and approval is in the audit log.

## Acceptance criteria

- `npm test` green: state machine (allowed / refused transitions), schedule → automatic pay creation, client hours
  entry and timesheet upload, approval and refusal, role isolation (bookkeeping/tax have no access), client isolation.
- Review package with desktop and mobile screenshots (staff Paie screen, client hours entry, client approval).

## Build notes (2026-10-02)

- Pays are created by `payrollTick()` (portal start, every hour, and when the schedule is saved or the Paie screen
  opens); idempotent (one pay per client and date); a pay date already past when the schedule is set is not created.
- Monthly schedule: the next date keeps the day of the month, capped at the month end (31 Jan → 28 Feb → 28 Mar).
- Timesheets accepted: PDF, JPG, PNG and Excel (.xlsx, recognised by content, not by name).
- « En retard » on the staff screen: pay date within one day and the pay not yet « Prête ».
- Emails never contain amounts: « BVY a besoin des heures de paie… », « Votre paie du … est prête à approuver ».
