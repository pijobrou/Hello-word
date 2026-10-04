# Workflow 17 — Government requests (audits, document requests, notices)

**Status:** `STATUS: APPROVED` by the owner on 2026-10-03 (requested by the owner the same day; built and tested, `npm test` 50/50; review package `review/portal-gouvernement/`).
**Owner approval required:** yes — new staff screens and a line on the client home.

## Objective

Every letter from a government agency is recorded the day it arrives, has a response deadline that nobody can
miss, a list of what must be gathered, and a visible path until the file is closed. The client knows BVY is
handling it.

## Agencies and kinds

| Agencies | Kinds of request |
|---|---|
| ARC (Agence du revenu du Canada) · Revenu Québec · CNESST · Registraire des entreprises (REQ) · Autre (municipalité, RRQ, Service Canada…) | **Vérification / contrôle** (audit) · **Demande de renseignements ou de documents** · **Avis de cotisation ou de nouvelle cotisation** · **Avis de solde dû / recouvrement** · **Autre** |

Program concerned: TPS/TVQ, impôt de la société, impôt du particulier, retenues à la source et paie, CNESST,
autre.

## Deadlines

- The response deadline written in the letter is required (date limite de réponse).
- Notice of assessment or reassessment: the objection deadline is computed — **90 days after the date of the
  notice** (ARC and Revenu Québec) — and used as the deadline when no earlier date is written in the letter.
  Honest limit: for individuals, ARC also allows one year after the filing deadline when that is later; staff
  can change the date.
- An open request whose deadline is within 7 days, or passed, is an **urgent anomaly** (workflow 06).

## Path

`Reçue → Documents à réunir → Prête à envoyer → Envoyée (en attente de la réponse) → Fermée`

- **Reçue**: agency, kind, program, reference number, date of the letter, deadline, summary; the letter itself is
  attached (a document classified « Lettre du gouvernement » in Réception can be turned into a request in one
  click).
- **Documents à réunir**: checklist of what the agency asks for; each item is « à obtenir », « reçu » or « ne
  s'applique pas ». Staff can ask the client for the missing items in one task (workflow 09 upload; reminders by
  workflow 10).
- **Prête à envoyer**: all items received or not applicable.
- **Envoyée**: date and how (Mon dossier, Mon dossier pour les entreprises, courrier, télécopieur, agent) and
  confirmation number.
- **Fermée**: the outcome is required (« Aucun changement », « Nouvelle cotisation de 1 250,00 $ », « Objection
  déposée », …).
- A request can go back one step with a reason. Every change is recorded and audited.

## Screens

- **Staff — menu « Gouvernement »**: open requests sorted by deadline, agency, kind, client, status; closed
  requests on demand.
- **Staff — client file → tab « Gouvernement »** and the request sheet (details, letter, checklist, history).
- **Client — home « BVY travaille sur »**: « Lettre de Revenu Québec (vérification TPS/TVQ) — réponse due le
  2026-11-02 », with the step. Document requests appear in « À faire ». No amount or letter content is sent
  by email.

## Acceptance criteria

- `npm test` green: creation (required fields, deadline, 90-day objection date), from a classified document,
  checklist and client request, path and required notes, urgent anomaly near the deadline, client home line,
  roles and isolation.
- Review package with screenshots.
