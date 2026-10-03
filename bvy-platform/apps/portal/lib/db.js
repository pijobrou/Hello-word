'use strict';

/**
 * Base de données du portail : SQLite intégré à Node (node:sqlite), un fichier dans DATA_DIR.
 * Les migrations sont numérotées et appliquées une seule fois, dans l'ordre.
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const MIGRATIONS = [
  // 1 — identité, rôles, sessions, défis, invitations, audit
  `
  CREATE TABLE clients (
    id            INTEGER PRIMARY KEY,
    name          TEXT NOT NULL,
    qbo_realm_id  TEXT,
    status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
    created_at    TEXT NOT NULL
  );
  CREATE TABLE users (
    id              INTEGER PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name            TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('admin','lead','bookkeeper','payroll','tax','client')),
    client_id       INTEGER REFERENCES clients(id),
    password_hash   TEXT,
    totp_secret     TEXT,
    totp_enabled    INTEGER NOT NULL DEFAULT 0,
    totp_last_step  INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','disabled')),
    failed_logins   INTEGER NOT NULL DEFAULT 0,
    locked_until    INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL,
    last_login_at   TEXT,
    CHECK ((role = 'client') = (client_id IS NOT NULL))
  );
  CREATE TABLE client_assignments (
    user_id    INTEGER NOT NULL REFERENCES users(id),
    client_id  INTEGER NOT NULL REFERENCES clients(id),
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, client_id)
  );
  CREATE TABLE sessions (
    id_hash     TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    csrf        TEXT NOT NULL,
    mfa_done    INTEGER NOT NULL DEFAULT 0,
    pending_totp TEXT,
    created_at  INTEGER NOT NULL,
    last_seen   INTEGER NOT NULL,
    ip          TEXT,
    user_agent  TEXT
  );
  CREATE INDEX sessions_user ON sessions(user_id);
  CREATE TABLE challenges (
    id          INTEGER PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    purpose     TEXT NOT NULL CHECK (purpose IN ('login','totp_setup')),
    code_hash   TEXT NOT NULL,
    expires_at  INTEGER NOT NULL,
    attempts    INTEGER NOT NULL DEFAULT 0,
    used_at     INTEGER
  );
  CREATE TABLE tokens (
    hash        TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    purpose     TEXT NOT NULL CHECK (purpose IN ('invite','reset')),
    expires_at  INTEGER NOT NULL,
    used_at     INTEGER,
    created_by  INTEGER REFERENCES users(id)
  );
  CREATE TABLE audit_logs (
    id         INTEGER PRIMARY KEY,
    at         TEXT NOT NULL,
    user_id    INTEGER,
    action     TEXT NOT NULL,
    target     TEXT,
    client_id  INTEGER,
    ip         TEXT,
    details    TEXT
  );
  CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_logs BEGIN SELECT RAISE(ABORT, 'audit_logs est en ajout seulement'); END;
  CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_logs BEGIN SELECT RAISE(ABORT, 'audit_logs est en ajout seulement'); END;
  `,
  // 2 — portail client : tableau de bord, tâches, documents, messages
  `
  ALTER TABLE clients ADD COLUMN qbo_url TEXT;
  CREATE TABLE client_snapshots (
    client_id   INTEGER PRIMARY KEY REFERENCES clients(id),
    data        TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    updated_by  INTEGER REFERENCES users(id)
  );
  CREATE TABLE tasks (
    id           INTEGER PRIMARY KEY,
    client_id    INTEGER NOT NULL REFERENCES clients(id),
    kind         TEXT NOT NULL CHECK (kind IN ('question','document','approval','info')),
    title        TEXT NOT NULL,
    detail       TEXT,
    choices      TEXT,
    due_date     TEXT,
    qbo_url      TEXT,
    status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','done','cancelled')),
    answer       TEXT,
    answered_by  INTEGER REFERENCES users(id),
    answered_at  TEXT,
    created_by   INTEGER REFERENCES users(id),
    created_at   TEXT NOT NULL
  );
  CREATE INDEX tasks_client ON tasks(client_id, status);
  CREATE TABLE documents (
    id           INTEGER PRIMARY KEY,
    client_id    INTEGER NOT NULL REFERENCES clients(id),
    origin       TEXT NOT NULL CHECK (origin IN ('client','bvy')),
    category     TEXT NOT NULL DEFAULT 'document' CHECK (category IN ('document','report')),
    name         TEXT NOT NULL,
    stored       TEXT NOT NULL UNIQUE,
    mime         TEXT NOT NULL,
    size         INTEGER NOT NULL,
    sha256       TEXT NOT NULL,
    note         TEXT,
    task_id      INTEGER REFERENCES tasks(id),
    uploaded_by  INTEGER REFERENCES users(id),
    created_at   TEXT NOT NULL
  );
  CREATE INDEX documents_client ON documents(client_id, category);
  CREATE TABLE messages (
    id          INTEGER PRIMARY KEY,
    client_id   INTEGER NOT NULL REFERENCES clients(id),
    author_id   INTEGER NOT NULL REFERENCES users(id),
    body        TEXT NOT NULL,
    created_at  TEXT NOT NULL
  );
  CREATE INDEX messages_client ON messages(client_id, id);
  CREATE TABLE message_reads (
    user_id      INTEGER NOT NULL REFERENCES users(id),
    client_id    INTEGER NOT NULL REFERENCES clients(id),
    last_read_id INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, client_id)
  );
  `,
  // 3 — QuickBooks Online : connexions, états OAuth, synchronisations, suggestions
  `
  ALTER TABLE client_snapshots ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
  ALTER TABLE tasks ADD COLUMN qbo_item_id INTEGER;
  CREATE TABLE qbo_connections (
    client_id        INTEGER PRIMARY KEY REFERENCES clients(id),
    realm_id         TEXT NOT NULL UNIQUE,
    company_name     TEXT,
    environment      TEXT NOT NULL CHECK (environment IN ('sandbox','production')),
    access_enc       TEXT,
    refresh_enc      TEXT,
    access_expires   INTEGER NOT NULL DEFAULT 0,
    refresh_expires  INTEGER NOT NULL DEFAULT 0,
    status           TEXT NOT NULL CHECK (status IN ('connected','needs_reconnect')),
    connected_by     INTEGER REFERENCES users(id),
    connected_at     TEXT NOT NULL,
    last_sync_at     TEXT,
    last_sync_status TEXT,
    last_error       TEXT
  );
  CREATE TABLE qbo_oauth_states (
    state_hash  TEXT PRIMARY KEY,
    client_id   INTEGER NOT NULL REFERENCES clients(id),
    user_id     INTEGER NOT NULL REFERENCES users(id),
    created_at  INTEGER NOT NULL
  );
  CREATE TABLE sync_jobs (
    id           INTEGER PRIMARY KEY,
    client_id    INTEGER NOT NULL REFERENCES clients(id),
    trigger      TEXT NOT NULL,
    started_at   TEXT NOT NULL,
    finished_at  TEXT,
    status       TEXT NOT NULL CHECK (status IN ('running','ok','failed')),
    error        TEXT,
    stats        TEXT
  );
  CREATE INDEX sync_jobs_client ON sync_jobs(client_id, id);
  CREATE TABLE qbo_items (
    id            INTEGER PRIMARY KEY,
    client_id     INTEGER NOT NULL REFERENCES clients(id),
    kind          TEXT NOT NULL CHECK (kind IN ('uncategorized','overdue_invoice')),
    qbo_type      TEXT NOT NULL,
    qbo_id        TEXT NOT NULL,
    txn_date      TEXT,
    amount_cents  INTEGER,
    counterparty  TEXT,
    detail        TEXT,
    qbo_url       TEXT,
    status        TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','sent','dismissed','resolved')),
    task_id       INTEGER REFERENCES tasks(id),
    first_seen    TEXT NOT NULL,
    last_seen     TEXT NOT NULL,
    UNIQUE (client_id, kind, qbo_type, qbo_id)
  );
  `,
  // 4 — tableau de bord de l'équipe (workflow 05) : profil fiscal, échéances, QuickBooks du cabinet
  `
  ALTER TABLE clients ADD COLUMN is_firm INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE clients ADD COLUMN kind TEXT CHECK (kind IN ('entreprise','autonome','particulier'));
  ALTER TABLE clients ADD COLUMN year_end_month INTEGER NOT NULL DEFAULT 12 CHECK (year_end_month BETWEEN 1 AND 12);
  ALTER TABLE clients ADD COLUMN gst_freq TEXT NOT NULL DEFAULT 'none' CHECK (gst_freq IN ('none','monthly','quarterly','annual'));
  ALTER TABLE clients ADD COLUMN payroll INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE clients ADD COLUMN installments INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE clients ADD COLUMN profile_since TEXT;
  ALTER TABLE clients ADD COLUMN billing_customer_id TEXT;
  CREATE TABLE deadline_marks (
    client_id  INTEGER NOT NULL REFERENCES clients(id),
    key        TEXT NOT NULL,
    status     TEXT NOT NULL CHECK (status IN ('done','na')),
    marked_by  INTEGER REFERENCES users(id),
    marked_at  TEXT NOT NULL,
    PRIMARY KEY (client_id, key)
  );
  CREATE TABLE custom_deadlines (
    id          INTEGER PRIMARY KEY,
    client_id   INTEGER NOT NULL REFERENCES clients(id),
    title       TEXT NOT NULL,
    due_date    TEXT NOT NULL,
    created_by  INTEGER REFERENCES users(id),
    created_at  TEXT NOT NULL
  );
  CREATE TABLE firm_customers (
    customer_id  TEXT PRIMARY KEY,
    name         TEXT NOT NULL
  );
  CREATE TABLE firm_receivables (
    customer_id    TEXT PRIMARY KEY,
    customer_name  TEXT,
    balance_cents  INTEGER NOT NULL,
    overdue_cents  INTEGER NOT NULL,
    invoices       INTEGER NOT NULL,
    oldest_due     TEXT,
    synced_at      TEXT NOT NULL
  );
  `,
  // 5 — état de la tenue de livres par client (vert / orange / rouge au tableau de bord)
  `
  ALTER TABLE clients ADD COLUMN books_status TEXT NOT NULL DEFAULT 'todo' CHECK (books_status IN ('todo','progress','done'));
  ALTER TABLE clients ADD COLUMN books_updated_at TEXT;
  ALTER TABLE clients ADD COLUMN books_updated_by INTEGER REFERENCES users(id);
  `,
  // 6 — paie (workflow 12) : calendrier, employés (noms seulement), paies et leur historique
  `
  CREATE TABLE payroll_schedules (
    client_id      INTEGER PRIMARY KEY REFERENCES clients(id),
    frequency      TEXT NOT NULL CHECK (frequency IN ('weekly','biweekly','semimonthly','monthly')),
    next_pay_date  TEXT NOT NULL,
    lead_days      INTEGER NOT NULL DEFAULT 3 CHECK (lead_days BETWEEN 1 AND 14),
    qbo_url        TEXT,
    active         INTEGER NOT NULL DEFAULT 1,
    updated_by     INTEGER REFERENCES users(id),
    updated_at     TEXT NOT NULL
  );
  CREATE TABLE employees (
    id          INTEGER PRIMARY KEY,
    client_id   INTEGER NOT NULL REFERENCES clients(id),
    name        TEXT NOT NULL,
    pay_type    TEXT NOT NULL DEFAULT 'hourly' CHECK (pay_type IN ('hourly','salary')),
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL
  );
  CREATE TABLE pay_runs (
    id               INTEGER PRIMARY KEY,
    client_id        INTEGER NOT NULL REFERENCES clients(id),
    pay_date         TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','hours_received','validation','preparing','ready','done')),
    hours            TEXT,
    timesheet_doc_id INTEGER REFERENCES documents(id),
    gross_cents      INTEGER,
    net_cents        INTEGER,
    remit_cents      INTEGER,
    employees_paid   INTEGER,
    client_comment   TEXT,
    hours_task_id    INTEGER REFERENCES tasks(id),
    approval_task_id INTEGER REFERENCES tasks(id),
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL,
    UNIQUE (client_id, pay_date)
  );
  CREATE TABLE pay_run_events (
    id          INTEGER PRIMARY KEY,
    run_id      INTEGER NOT NULL REFERENCES pay_runs(id),
    from_status TEXT,
    to_status   TEXT NOT NULL,
    user_id     INTEGER REFERENCES users(id),
    note        TEXT,
    at          TEXT NOT NULL
  );
  ALTER TABLE tasks ADD COLUMN pay_run_id INTEGER REFERENCES pay_runs(id);
  `,
  // 7 — détail de chaque paie : retenues des employés, cotisations de l'employeur, vacances (montants en cents, JSON)
  `
  ALTER TABLE pay_runs ADD COLUMN breakdown TEXT;
  `,
  // 8 — déclarations de TPS/TVQ (workflow 13)
  `
  CREATE TABLE tax_returns (
    id               INTEGER PRIMARY KEY,
    client_id        INTEGER NOT NULL REFERENCES clients(id),
    deadline_key     TEXT NOT NULL,
    period_start     TEXT NOT NULL,
    period_end       TEXT NOT NULL,
    due_date         TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'books' CHECK (status IN ('books','validation','calc','review','approval','filed')),
    checklist        TEXT,
    sales_cents      INTEGER,
    gst_cents        INTEGER,
    itc_cents        INTEGER,
    qst_cents        INTEGER,
    itr_cents        INTEGER,
    prepared_by      INTEGER REFERENCES users(id),
    reviewed_by      INTEGER REFERENCES users(id),
    client_comment   TEXT,
    client_approved  INTEGER NOT NULL DEFAULT 0,
    approval_task_id INTEGER REFERENCES tasks(id),
    confirmation     TEXT,
    filed_at         TEXT,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL,
    UNIQUE (client_id, deadline_key)
  );
  CREATE TABLE tax_return_events (
    id          INTEGER PRIMARY KEY,
    return_id   INTEGER NOT NULL REFERENCES tax_returns(id),
    from_status TEXT,
    to_status   TEXT NOT NULL,
    user_id     INTEGER REFERENCES users(id),
    note        TEXT,
    at          TEXT NOT NULL
  );
  ALTER TABLE tasks ADD COLUMN tax_return_id INTEGER REFERENCES tax_returns(id);
  `,
  // 9 — dossiers d'impôt sur le revenu (workflow 14) : T2/CO-17 des sociétés, T1/TP-1 (et T2125) des particuliers
  `
  CREATE TABLE tax_files (
    id               INTEGER PRIMARY KEY,
    client_id        INTEGER NOT NULL REFERENCES clients(id),
    form             TEXT NOT NULL CHECK (form IN ('t2','t1')),
    deadline_key     TEXT NOT NULL,
    year_label       TEXT NOT NULL,
    period_end       TEXT NOT NULL,
    due_date         TEXT NOT NULL,
    pay_due          TEXT,
    status           TEXT NOT NULL CHECK (status IN ('docs','books','closing','prep','review','approval','filed')),
    docs             TEXT,
    closing          TEXT,
    figures          TEXT,
    prepared_by      INTEGER REFERENCES users(id),
    reviewed_by      INTEGER REFERENCES users(id),
    client_comment   TEXT,
    client_approved  INTEGER NOT NULL DEFAULT 0,
    docs_task_id     INTEGER REFERENCES tasks(id),
    approval_task_id INTEGER REFERENCES tasks(id),
    confirmation_fed TEXT,
    confirmation_qc  TEXT,
    filed_at         TEXT,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL,
    UNIQUE (client_id, deadline_key)
  );
  CREATE TABLE tax_file_events (
    id          INTEGER PRIMARY KEY,
    file_id     INTEGER NOT NULL REFERENCES tax_files(id),
    from_status TEXT,
    to_status   TEXT NOT NULL,
    user_id     INTEGER REFERENCES users(id),
    note        TEXT,
    at          TEXT NOT NULL
  );
  ALTER TABLE tasks ADD COLUMN tax_file_id INTEGER REFERENCES tax_files(id);
  `,
  // 10 — Documents (workflow 09) et communication (workflow 10) : classement, doublons, liens, rappels
  `
  ALTER TABLE documents ADD COLUMN doc_type TEXT;
  ALTER TABLE documents ADD COLUMN period TEXT;
  ALTER TABLE documents ADD COLUMN suggested TEXT;
  ALTER TABLE documents ADD COLUMN suggested_by TEXT;
  ALTER TABLE documents ADD COLUMN duplicate_of INTEGER REFERENCES documents(id);
  ALTER TABLE documents ADD COLUMN link TEXT;
  ALTER TABLE documents ADD COLUMN filed INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE documents ADD COLUMN filed_by INTEGER REFERENCES users(id);
  ALTER TABLE documents ADD COLUMN filed_at TEXT;
  CREATE INDEX documents_inbox ON documents(filed, client_id);
  CREATE INDEX documents_sha ON documents(client_id, sha256);
  UPDATE documents SET filed = 1 WHERE origin = 'bvy';
  UPDATE documents SET filed = 1, doc_type = 'impots' WHERE note LIKE 'Impôts %';
  UPDATE documents SET filed = 1, doc_type = 'paie' WHERE note LIKE 'Feuille de temps%';
  ALTER TABLE tasks ADD COLUMN reminders_sent INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE tasks ADD COLUMN last_reminder_at TEXT;
  ALTER TABLE tasks ADD COLUMN no_reminder INTEGER NOT NULL DEFAULT 0;
  CREATE TABLE task_reminders (
    id         INTEGER PRIMARY KEY,
    task_id    INTEGER NOT NULL REFERENCES tasks(id),
    client_id  INTEGER NOT NULL REFERENCES clients(id),
    manual     INTEGER NOT NULL DEFAULT 0,
    sent_by    INTEGER REFERENCES users(id),
    sent_at    TEXT NOT NULL
  );
  CREATE INDEX task_reminders_client ON task_reminders(client_id, sent_at);
  `,
  // 11 — Anomalies (workflow 06) et validation par le client (workflow 08)
  `
  CREATE TABLE anomalies (
    id            INTEGER PRIMARY KEY,
    client_id     INTEGER NOT NULL REFERENCES clients(id),
    type          TEXT NOT NULL,
    severity      TEXT NOT NULL CHECK (severity IN ('urgent','system','standard')),
    source        TEXT NOT NULL CHECK (source IN ('rule','qbo')),
    ref           TEXT NOT NULL,
    title         TEXT NOT NULL,
    explanation   TEXT NOT NULL,
    action        TEXT NOT NULL,
    amount_cents  INTEGER,
    txn_date      TEXT,
    counterparty  TEXT,
    qbo_url       TEXT,
    data          TEXT,
    status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting_client','answered','resolved','dismissed')),
    owner_id      INTEGER REFERENCES users(id),
    task_id       INTEGER REFERENCES tasks(id),
    resolution    TEXT,
    resolved_by   INTEGER REFERENCES users(id),
    resolved_at   TEXT,
    first_seen    TEXT NOT NULL,
    last_seen     TEXT NOT NULL,
    UNIQUE (client_id, ref)
  );
  CREATE INDEX anomalies_open ON anomalies(status, severity);
  CREATE TABLE anomaly_events (
    id          INTEGER PRIMARY KEY,
    anomaly_id  INTEGER NOT NULL REFERENCES anomalies(id),
    from_status TEXT,
    to_status   TEXT NOT NULL,
    user_id     INTEGER REFERENCES users(id),
    note        TEXT,
    at          TEXT NOT NULL
  );
  CREATE TABLE client_decisions (
    id           INTEGER PRIMARY KEY,
    client_id    INTEGER NOT NULL REFERENCES clients(id),
    counterparty TEXT NOT NULL,
    question     TEXT NOT NULL,
    answer       TEXT NOT NULL,
    task_id      INTEGER REFERENCES tasks(id),
    answered_at  TEXT NOT NULL
  );
  CREATE INDEX client_decisions_party ON client_decisions(client_id, counterparty);
  ALTER TABLE tasks ADD COLUMN anomaly_id INTEGER REFERENCES anomalies(id);
  ALTER TABLE tasks ADD COLUMN counterparty TEXT;
  ALTER TABLE tasks ADD COLUMN question_type TEXT;
  `,
  // 12 — Demandes du gouvernement (workflow 17) : contrôles, demandes de documents, avis
  `
  CREATE TABLE gov_requests (
    id              INTEGER PRIMARY KEY,
    client_id       INTEGER NOT NULL REFERENCES clients(id),
    agency          TEXT NOT NULL CHECK (agency IN ('arc','rq','cnesst','req','autre')),
    kind            TEXT NOT NULL CHECK (kind IN ('verification','documents','cotisation','recouvrement','autre')),
    program         TEXT NOT NULL,
    reference       TEXT,
    letter_date     TEXT NOT NULL,
    due_date        TEXT NOT NULL,
    summary         TEXT NOT NULL,
    amount_cents    INTEGER,
    letter_doc_id   INTEGER REFERENCES documents(id),
    items           TEXT NOT NULL DEFAULT '[]',
    status          TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','gathering','ready','sent','closed')),
    owner_id        INTEGER REFERENCES users(id),
    sent_on         TEXT,
    sent_how        TEXT,
    confirmation    TEXT,
    outcome         TEXT,
    task_id         INTEGER REFERENCES tasks(id),
    created_by      INTEGER REFERENCES users(id),
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  );
  CREATE INDEX gov_requests_open ON gov_requests(status, due_date);
  CREATE TABLE gov_request_events (
    id          INTEGER PRIMARY KEY,
    request_id  INTEGER NOT NULL REFERENCES gov_requests(id),
    from_status TEXT,
    to_status   TEXT NOT NULL,
    user_id     INTEGER REFERENCES users(id),
    note        TEXT,
    at          TEXT NOT NULL
  );
  ALTER TABLE tasks ADD COLUMN gov_request_id INTEGER REFERENCES gov_requests(id);
  `,
  // 13 — Santé financière (workflow 15) et résumés automatiques (workflow 16)
  `
  CREATE TABLE client_health (
    client_id   INTEGER PRIMARY KEY REFERENCES clients(id),
    state       TEXT CHECK (state IN ('good','watch','action')),
    why         TEXT,
    comment     TEXT,
    updated_by  INTEGER REFERENCES users(id),
    updated_at  TEXT NOT NULL
  );
  -- La santé saisie à la main dans le tableau de bord devient l'évaluation de l'équipe
  INSERT INTO client_health (client_id, state, why, updated_by, updated_at)
    SELECT client_id, json_extract(data, '$.health.state'), json_extract(data, '$.health.why'), updated_by, updated_at
    FROM client_snapshots WHERE json_extract(data, '$.health.state') IN ('good','watch','action');
  CREATE TABLE summaries (
    id            INTEGER PRIMARY KEY,
    client_id     INTEGER NOT NULL REFERENCES clients(id),
    period_type   TEXT NOT NULL CHECK (period_type IN ('month','quarter','year')),
    period_start  TEXT NOT NULL,
    period_end    TEXT NOT NULL,
    label         TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
    data          TEXT NOT NULL,
    intro         TEXT,
    figures       TEXT,
    version       INTEGER NOT NULL DEFAULT 0,
    created_by    INTEGER REFERENCES users(id),
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    published_by  INTEGER REFERENCES users(id),
    published_at  TEXT,
    UNIQUE (client_id, period_type, period_start)
  );
  CREATE TABLE summary_versions (
    id            INTEGER PRIMARY KEY,
    summary_id    INTEGER NOT NULL REFERENCES summaries(id),
    version       INTEGER NOT NULL,
    data          TEXT NOT NULL,
    intro         TEXT,
    figures       TEXT,
    published_by  INTEGER REFERENCES users(id),
    published_at  TEXT NOT NULL
  );
  `,
];

function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o750 });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (file !== ':memory:') {
    try { fs.chmodSync(file, 0o600); } catch { /* déjà restreint */ }
  }
  migrate(db);
  return db;
}

function migrate(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
  const row = db.prepare('SELECT version FROM schema_version').get();
  let version = row ? row.version : 0;
  if (!row) db.prepare('INSERT INTO schema_version (version) VALUES (0)').run();
  for (; version < MIGRATIONS.length; version++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[version]);
      db.prepare('UPDATE schema_version SET version = ?').run(version + 1);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

// Exécute fn dans une transaction.
function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

module.exports = { openDb, tx, MIGRATIONS };
