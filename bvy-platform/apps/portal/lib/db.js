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
