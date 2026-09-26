# Workflow 00 — Build the BVY public website

**Status:** `WAITING_FOR_OWNER_APPROVAL` (v1 delivered 2026-09-26)
**Owner approval required:** yes, before any work on workflow 01 and later.

## Objective

Publish a complete first version of the public BVY website, in the existing plum/purple and gold
identity, that explains what BVY does, the problems it solves, the role of QuickBooks Online, and
gives visitors a clear way to book a consultation or reach the future client portal.

## Inputs

| Input | Source | Stone / Opinion |
|---|---|---|
| Owner's site file `BVY_Website.html` | owner upload, kept at `apps/website/src/_original-owner-file.html` | Stone (identity, services, domiciliation offer, 295 $/mois) |
| Live site content | scrape of https://bvyaccountingtax.ca on 2026-09-26 | Stone (contact email, platform text, 6-step process) |
| Logo | owner upload → `apps/website/public/assets/img/bvy-logo.png` | Stone |
| Product brief | `CLAUDE.md` | Stone |
| "10 ans d'expérience" (no client count) | owner, 2026-09-26 | Stone |
| No CPA on staff — never mention CPA | owner, 2026-09-26 | Stone |

## Tools

| Tool | Purpose |
|---|---|
| `apps/website/build.js` | Assemble `src/pages/*.html` into `src/layout.html` → `public/`, plus `sitemap.xml`, `robots.txt` |
| `apps/website/server.js` | Zero-dependency Node server: static files + `POST /api/contact` + `GET /api/health` |
| `apps/website/test/` | `npm test` — static serving, security headers, contact validation, honeypot, rate limit, webhook |
| `tools/website/screenshots.mjs` | Desktop + mobile review screenshots, flags HTTP errors, console errors, horizontal scroll |
| `tools/website/logo-variants.mjs` | Regenerate favicon / 96 px / 192 px logo from the master PNG |
| `tools/deployment/` | OVH deployment kit (`deploy.cmd`, `deploy.sh`, `remote-install.sh`, nginx, systemd) — see `DEPLOIEMENT.md` |

## Procedure

1. Edit content in `apps/website/src/pages/` (never in `public/*.html`, which is generated).
2. `cd apps/website && node build.js`
3. `npm test`
4. `node server.js` → check http://localhost:3000
5. `node ../../tools/website/screenshots.mjs` → review `review/screenshots/`, fix every reported problem.
6. Deploy the preview (owner runs `tools\deployment\deploy.cmd`).
7. Present the review package (`review/REVIEW.md`) and **stop**.

## Validation rules

- Only brand tokens from `public/assets/css/bvy.css` (`--plum*`, `--gold*`, neutrals for readability).
- Text on dark backgrounds ≥ `rgba(255,255,255,.6)`; body text on white uses `--text2`/`--text3` (WCAG AA).
- No invented facts: no professional-designation claims, no testimonials, no prices other than those the
  owner approved, no delivery times.
- Every page: one `h1`, skip link, visible focus, keyboard-usable menu, no horizontal scroll at 390 px.
- No inline `<script>` (CSP `script-src 'self'`), except JSON-LD data blocks.
- Contact form: consent checkbox required (Loi 25), honeypot, server-side validation, leads stored in
  Canada (`/var/www/bvy-website/shared/data/leads.jsonl`).

## Expected outputs

Pages: `/`, `/services/`, `/plateforme/`, `/fonctionnement/`, `/tarifs/`, `/contact/`, `/contact/merci/`,
`/connexion/`, `/portail-comptable/`, `/confidentialite/`, `/404.html`.

## Errors and edge cases

| Situation | Handling |
|---|---|
| Node service down | nginx still serves every page; only the form fails, and the page then shows the email address |
| JavaScript disabled | the form posts normally and redirects to `/contact/merci/` |
| Spam | honeypot (silently accepted, not stored) + 5 submissions / 10 min / IP |
| Webhook (n8n) down | lead is still written to disk; error logged |
| Deployment breaks the site | `remote-install.sh` rolls back automatically if the health check fails; `--rollback` by hand |

## Acceptance criteria

All items of "Website Acceptance Criteria" in `CLAUDE.md`, plus: `npm test` green and
`screenshots.mjs` reporting no problems.

## Approval gate

Return `STATUS: WAITING_FOR_OWNER_APPROVAL`. Continue to workflow 01 only on `STATUS: APPROVED`.
On `STATUS: CHANGES_REQUESTED`: collect changes → update → redeploy → new review package → wait again.
On `STATUS: REJECTED`: stop.
