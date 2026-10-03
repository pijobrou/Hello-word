# Workflow 10 — Communication

**Status:** `STATUS: WAITING_FOR_OWNER_APPROVAL` — built and tested 2026-10-03 (`npm test` 46/46; review package `review/portal-inbox/`).
**Owner approval required:** yes — automatic reminders sent to clients.

## Objective

The client never has to search email, texts and calls to know what BVY needs, and BVY never has to remember to
chase a client: requests live in the portal, reminders go out by themselves, and the whole history of a client is
on one screen.

## Automatic reminders

| Rule | Value |
|---|---|
| Concerned | Open client tasks that need an action: question, document, approval (including payroll hours, tax documents and approvals created by workflows 12 to 14) |
| Schedule | 3 days after the request, then 7 days, then 14 days — 3 reminders at most |
| Sending window | Monday to Friday, 9:00 to 17:00 (Montréal time) |
| Grouping | One email per client per round, whatever the number of tasks |
| Content | « Rappel : N élément(s) vous attend(ent) dans votre portail BVY » and the portal link — never an amount, a name or a task title (the email can be read by someone else) |
| Stop | The task is answered or closed, or staff choose « Ne plus relancer » on that task |
| Manual | « Relancer maintenant » on an open task (at most once per 24 hours per task) |
| Escalation | 7 days after the 3rd reminder without an answer, the task appears in Réception under « Sans réponse : appelez le client » |

Every reminder is recorded (task, date, automatic or manual, who) and audited.

## Centralised history

Staff — client file → tab « Historique »: one timeline of messages, documents (sent and received), tasks
(created, answered) and reminders, newest first.

## Inbox (shared with workflow 09)

Menu « Réception »: what came in from clients and needs a person — documents to file, replies to close, unread
messages, tasks without answer after 3 reminders.

## Acceptance criteria

- `npm test` green: no reminder before 3 days, outside the window or on a weekend; reminders at 3, 7 and 14 days;
  no 4th; grouped per client; no amount or title in the email; « Ne plus relancer » and an answer stop them;
  manual reminder limited to once per 24 hours; escalation in Réception; history; roles and isolation.
- Review package with screenshots.
