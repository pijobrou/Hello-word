# Workflow 00 — Build the BVY public website

**Status:** `APPROVED` by the owner on 2026-10-01. Next: workflow 01 (design system).
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

## Revision 2 — sector pages (2026-09-30, owner request)

- Editorial line: « Votre entreprise avance. Vos chiffres doivent avancer avec elle. » Clients are presented as
  entrepreneurs in motion, never as worried people.
- Six sector pages generated from `apps/website/src/niches/<slug>.json` (format: `src/niches/_SCHEMA.md`) by
  `src/niche-template.js`: hero image, sector quote, reality, 3 growth stages with their accounting needs,
  money-flow diagram, expertise, services, « Ce qui change dans votre secteur » (3 cards + last-update date),
  FAQ, CTA. JSON-LD: Service, BreadcrumbList, FAQPage. Hub page `/secteurs/`; six cards on the home page.
- All six are published; the owner will pick the main niche after analysing traffic and enquiries.
- « Ce qui change » is edited only in the JSON files and published only after human validation
  (change `changes.updated`, run `node build.js`, redeploy).
- Offers: Mise au clair Shopify 850 $ (fixed, one-time), Clarté mensuelle « sur soumission » (three options
  presented after the 30-minute consultation), Domiciliation 294,99 $. No turnaround time is published.
- New pages: `/a-propos/` (founder biography to be supplied by the owner), `/rendez-vous/`.
- Footer on every page: no audit, review or compilation engagements; certification work is referred to an
  independent licensed CPA. BVY Accounting & Tax Services Inc. is incorporated (owner, 2026-09-30).

## Revision 3 — protection du formulaire de consultation (2026-10-08, demande du propriétaire)

> « il faut sécuriser notre site contre les fraudeurs et autres ; vérifier si le courriel et le téléphone sont bons
> avant d'envoyer la demande lorsqu'un client fait une demande de consultation »

STATUS: WAITING_FOR_OWNER_APPROVAL

Outil : `apps/website/verify.js` (tests : `apps/website/test/verify.test.js`). Aucun service externe, aucune clé.

**Courriel** (formulaire et Jessica) :
- syntaxe stricte ;
- fautes de frappe connues (gmial.com, hotmial.com, videotron.com…) : « Vouliez-vous écrire marie@gmail.com ? »,
  corrigé d'un clic ;
- adresses jetables refusées (yopmail, mailinator, 10minutemail… ~50 domaines) ;
- le domaine doit recevoir du courrier (enregistrement MX vérifié dans le DNS, 3 s au plus). Si le DNS du serveur
  est en panne (même gmail.com ne répond pas), la demande passe, marquée « domaine non vérifié ».

**Téléphone** — maintenant obligatoire :
- 10 chiffres nord-américains (ou international avec « + ») ; poste accepté ;
- refusés : indicatif ou central qui commence par 0 ou 1, N11 (911, 411…), 555-01xx (numéros fictifs), 900/976,
  chiffres tous identiques, 1234567890 ;
- enregistré au format (418) 555-1234, avec « Canada » ou « États-Unis ».

**Fraudeurs et robots** (la demande est ignorée en silence ; le robot croit qu'elle est partie ; gardée dans
`data/spam.jsonl` pour vérification) :
- formulaire rempli en moins de 3 secondes ;
- lien dans un nom, plus de 2 liens dans le message, mots de pourriel connus, texte surtout en cyrillique ou chinois ;
- champ piège invisible (existait déjà) ;
- demande postée depuis un autre site : refusée (403) ;
- même courriel dans les 24 dernières heures : enregistré, mais sans nouvel avis ni accusé de réception ;
- limite par adresse IP : 5 demandes par 10 minutes (existait déjà).

L'avis envoyé à BVY indique « domaine vérifié : reçoit du courriel » et « numéro valide — Canada ».

**Limites** : on vérifie que l'adresse peut recevoir du courriel et que le numéro peut exister, pas qu'ils
appartiennent à la personne. Pour le prouver : code envoyé par courriel avant d'accepter la demande (possible sans
frais), ou code par texto (service payant, p. ex. Twilio). Un test « je ne suis pas un robot » (Cloudflare
Turnstile, gratuit, clé ajoutée sur le serveur) est aussi possible. À décider par le propriétaire.

## Deployment log

- 2026-10-01 — Owner deployed revision 2 to the OVH VPS with `deploy.cmd --nginx`. The old nginx file
  `/etc/nginx/sites-enabled/bvy` (apex + api., portail., dashboard. subdomains) was removed by the owner;
  backup at `/home/ubuntu/nginx-ancien/bvy.conf`. Verified live: https://bvyaccountingtax.ca/secteurs/ (200),
  `/api/health` → `{"ok":true}`. The subdomains are no longer served (owner's decision).
- 2026-10-01 — v3 deployed. Contact-form email notification active: sent through Gmail SMTP from the owner's
  Gmail account (app password stored only in `/var/www/bvy-website/shared/.env` on the server) to
  bvypjb@protonmail.com. Owner confirmed receipt of a test request.
- 2026-10-01 — v4 (owner request « jessica et le courriel »), built and tested, not yet deployed:
  - Client acknowledgement email: after each form request the site sends the client a fixed message signed
    « L’équipe BVY » with the `/rendez-vous/` link (`mailer.js` → `confirmationMessage`). Replies go to the first
    `MAIL_TO` address. The form text is never copied into it; capped at 100 per day; `CONFIRMATION_EMAIL=0`
    turns it off. The owner should disable the mailbox auto-reply.
  - Jessica, AI assistant (`chat.js`, `public/assets/js/jessica.js`): `POST /api/chat` calls the Claude API
    (`claude-opus-5-5`, low effort, server-side refusal fallback) with a system prompt limited to the site's
    published facts; no personalised tax advice; hands off to `/rendez-vous/`. Discloses that it is an AI and that
    messages are processed by Anthropic outside Canada. Nothing is stored server-side. Limits: 20 messages per
    visitor per 10 min, 150 per day site-wide. Hidden unless `ANTHROPIC_API_KEY` is set in the server `.env`.
  - Privacy policy: new section 10 (Jessica) and the email providers (Gmail, ProtonMail) in section 6.
  - Deployment: `remote-install.sh` now runs `npm ci --omit=dev` for the Anthropic SDK; failure leaves the site up
    with Jessica disabled. Guide: `DEPLOIEMENT.md` §9.3–9.4. Review screenshots: `review/jessica/`.
- 2026-10-01 — v5 (owner request: block AI and scrapers), built and tested, not yet deployed. `apps/website/bots.js`
  holds one list used by `robots.txt` (AI crawlers: `Disallow: /`; search engines allowed), by `server.js`
  (403 on `/api/`) and by the nginx templates (403 site-wide, empty User-Agent refused, rate limits 10 req/s per
  IP with bursts, 429 above). Pages carry `noai, noimageai` and `tdm-reservation: 1`; `/.well-known/tdmrep.json`
  reserves text-and-data-mining rights. Tested against a real nginx (browser 200, Googlebot 200, GPTBot 403,
  robots.txt readable). Requires deploying with `--nginx`. Trade-off accepted by the owner's request: the site
  will not be read by AI search assistants (ChatGPT search, Perplexity, Claude). Guide: `DEPLOIEMENT.md` §9.5.
- 2026-10-01 — v5 deployed by the owner (`deploy.cmd --nginx`). `ANTHROPIC_API_KEY` added by the owner to
  `/var/www/bvy-website/shared/.env` (never in the repo or chat); `/api/chat` → `{"ok":true,"enabled":true}`.
  Jessica is live; first real conversation still to be checked by the owner.
- 2026-10-01 — v6 (owner request: Jessica books appointments in Google Calendar). Chosen approach: Google Calendar
  appointment schedule (booking page managed by Google). `BOOKING_URL` in the server `.env` (Google Calendar
  links only) is given by Jessica, shown at the bottom of her window and used in the client acknowledgement email.
  Jessica cannot see availability or book on someone's behalf. Privacy policy updated. Tests 37/37.
- 2026-10-01 — v7 (owner request: Jessica takes name, email, phone, books by availability and records it in Google
  Drive). `google.js` (service-account JWT, freeBusy, events.insert, Sheets append; no dependency) and `booking.js`
  (Québec time zone slots Mon–Fri 8–17, 18 h lead, 14 days; tools `voir_disponibilites` / `reserver_rendez_vous`).
  Jessica must obtain consent and an explicit « oui » on a recap before booking; the server re-checks the slot,
  validates contact data, caps 2/IP, 1/email per day, 15/day site-wide. Event in the owner's calendar, row in a
  Google Sheet, local copy `data/rendez-vous.jsonl` (Canada), confirmation email to the client and notice to BVY.
  The meeting is a phone call (service accounts cannot invite attendees on a personal Google account). Privacy
  policy updated (Google outside Canada). Setup: `DEPLOIEMENT.md` §9.4 ter. Tests 43/43 with fake Google/Claude.
  Not tested against the real Google and Claude APIs yet.
