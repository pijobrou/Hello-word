# Workflow 02 — Authentication and roles (BVY portal)

**Status:** in progress (phase 2). Design system approved 2026-10-01 (`workflows/01_design_system.md`).
**Owner approval required:** before the portal is opened to real clients (production launch, `CLAUDE.md`).

## Objective

Give every person exactly the access their role needs to the BVY portal, with a login that is simple for
clients and strong for staff, and an audit trail of every important action.

## Owner decisions (2026-10-01)

| Topic | Decision |
|---|---|
| Client login | Password **and** a second factor: a 6-digit code by email (default) or an authenticator app if the client turns it on |
| Staff login | Password **and** a second factor: authenticator app (recommended) or code by email |
| Address | `https://portail.bvyaccountingtax.ca` ; `https://bvyaccountingtax.ca/portail/` and `/connexion/` lead there |

## Roles

| Role (code) | Who | Sees | Can |
|---|---|---|---|
| `admin` — Administrateur BVY | Owner | Every client, every user, the audit log | Invite and deactivate users, create clients, assign staff, everything below |
| `lead` — Comptable principal | Lead accountant | Every client | Assign staff to clients, see the audit log of clients |
| `bookkeeper` — Tenue de livres | Bookkeeper | Only the clients assigned to them | Bookkeeping work (phase 5+) |
| `payroll` — Paie | Payroll staff | Only assigned clients, payroll areas | Payroll work (phase 7) |
| `tax` — Fiscalité | Tax staff | Only assigned clients, tax areas | Tax work (phase 7) |
| `client` — Client | A person at a client business | Only their own business | See their portal, answer questions, send documents (phase 3) |

Permissions are code, not data: `apps/portal/lib/rbac.js` is the single map from role to permissions, and
`canAccessClient(user, clientId)` is the only gate to a client's data. Every route checks a permission.

## Tools

| Tool | Purpose |
|---|---|
| `apps/portal/server.js` | Portal web server (Node ≥ 22.13, built-in `node:sqlite`, no framework) |
| `apps/portal/lib/` | `db.js` (schema, migrations), `auth.js` (passwords, codes, TOTP, sessions), `rbac.js`, `audit.js`, `mailer.js` |
| `apps/portal/cli.js` | Server-side administration: `create-admin`, `list-users`, `unlock` |
| `apps/portal/test/` | `npm test` |

## Procedure — first administrator (once, on the server)

1. `node cli.js create-admin <email> "<Prénom Nom>"` prints a one-time invitation link (valid 72 h).
2. The owner opens it, chooses a password, sets up the authenticator app (or email code), and is logged in.
3. From **Administration**, the owner creates clients and invites staff and client users.

## Procedure — invitation (every new user)

1. An admin (or lead, for client users) enters email, name, role and — for a client user — the client business.
2. The portal emails a single-use link valid 72 hours. Nobody chooses a password for someone else.
3. The person sets a password (12+ characters, not a common password, not their email), then the second factor.

## Procedure — login

1. Email + password. Wrong answers always show the same message (no hint that an email exists).
2. Second factor: app code if enabled, otherwise a 6-digit email code valid 10 minutes, 5 tries.
3. Session cookie `__Host-bvy_session` (HttpOnly, Secure, SameSite=Lax), stored server-side as a hash;
   expires after 60 minutes idle or 12 hours in all. Users can see and end their sessions.

## Validation rules

- Passwords: hashed with scrypt (N=2¹⁵, r=8, p=1, 16-byte salt); never logged, never emailed.
- 10 failed logins on an account → locked 15 minutes; per-IP limits on every authentication form.
- Email codes, invitation and reset tokens are stored only as SHA-256 hashes and are single use.
- Every POST carries a per-session CSRF token and must come from the portal's own origin.
- Password reset never bypasses the second factor.
- A deactivated user loses all sessions immediately.
- Audit log (append-only table `audit_logs`): logins (success / failure), second-factor events, invitations,
  role and assignment changes, deactivations, password changes, session revocations.

## Expected outputs

Login, second factor, invitation acceptance, password reset, account page (password, authenticator app,
sessions), administration (users, clients, assignments, audit log), role-based home page.

## Errors and edge cases

| Situation | Handling |
|---|---|
| Email cannot be sent (SMTP down) | The user is told to try again; error logged; no account is unlocked by default |
| Lost phone (authenticator app) | Staff: an admin resets their second factor (audited). Clients: email code still works |
| Invitation expired | Admin sends a new one; the old token stays invalid |
| Last active administrator deactivated | Refused |
| Database file missing | Created and migrated at start-up |

## Acceptance criteria

- `npm test` green, including RBAC isolation tests (a client never sees another client; staff see only
  assigned clients).
- Screens use only the approved design system (`packages/design-system`).
- Review package with screenshots presented to the owner before production use by real clients.
