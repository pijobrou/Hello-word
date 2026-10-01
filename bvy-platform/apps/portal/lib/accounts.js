'use strict';

/**
 * Comptes, invitations, connexion en deux étapes, sessions et journal d'audit.
 * Toute la logique de sécurité est ici (testée dans test/accounts.test.js) ; server.js ne fait que l'afficher.
 */

const { tx } = require('./db.js');
const C = require('./crypto.js');
const { ROLES, canInviteRole } = require('./rbac.js');

const MIN = 60_000;
const HOUR = 60 * MIN;
const POLICY = Object.freeze({
  inviteTtl: 72 * HOUR,
  resetTtl: 30 * MIN,
  codeTtl: 10 * MIN,
  codeAttempts: 5,
  maxFailedLogins: 10,
  lockMs: 15 * MIN,
  sessionIdle: 60 * MIN,
  sessionMax: 12 * HOUR,
  preMfaMax: 15 * MIN, // une session qui n'a pas terminé la 2e étape expire vite
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const iso = (ms) => new Date(ms).toISOString();
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max);

class AccountError extends Error {}

function createAccounts(db, { now = () => Date.now() } = {}) {
  /* ------------------------------------------------------------- audit */
  function audit({ userId = null, action, target = null, clientId = null, ip = null, details = null }) {
    db.prepare('INSERT INTO audit_logs (at, user_id, action, target, client_id, ip, details) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(iso(now()), userId, action, target, clientId, ip, details ? JSON.stringify(details) : null);
  }

  const userById = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  const userByEmail = (email) => db.prepare('SELECT * FROM users WHERE email = ?').get(clean(email, 160));

  /* ----------------------------------------------------------- clients */
  function createClient(actor, name, ip) {
    const n = clean(name, 160);
    if (n.length < 2) throw new AccountError('Indiquez le nom de l’entreprise.');
    const { lastInsertRowid } = db.prepare('INSERT INTO clients (name, created_at) VALUES (?, ?)').run(n, iso(now()));
    const id = Number(lastInsertRowid);
    audit({ userId: actor && actor.id, action: 'client.create', target: `client:${id}`, clientId: id, ip, details: { name: n } });
    return db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  }

  /* ------------------------------------------------------- invitations */
  function issueToken(userId, purpose, ttl, createdBy) {
    const token = C.randomToken();
    db.prepare('UPDATE tokens SET used_at = ? WHERE user_id = ? AND purpose = ? AND used_at IS NULL').run(now(), userId, purpose);
    db.prepare('INSERT INTO tokens (hash, user_id, purpose, expires_at, created_by) VALUES (?, ?, ?, ?, ?)')
      .run(C.sha256(token), userId, purpose, now() + ttl, createdBy || null);
    return token;
  }

  // actor = null seulement pour le premier administrateur (cli.js create-admin).
  function invite(actor, { email, name, role, clientId }, ip) {
    const e = clean(email, 160).toLowerCase();
    const n = clean(name, 120);
    if (!ROLES[role]) throw new AccountError('Rôle inconnu.');
    if (actor && !canInviteRole(actor, role)) throw new AccountError('Vous ne pouvez pas inviter ce rôle.');
    if (!EMAIL_RE.test(e)) throw new AccountError('Adresse courriel invalide.');
    if (n.length < 2) throw new AccountError('Indiquez le nom de la personne.');
    const cid = role === 'client' ? Number(clientId) : null;
    if (role === 'client' && !db.prepare("SELECT 1 FROM clients WHERE id = ? AND status = 'active'").get(cid)) {
      throw new AccountError('Choisissez l’entreprise de ce client.');
    }
    return tx(db, () => {
      let user = userByEmail(e);
      if (user && user.status !== 'invited') throw new AccountError('Cette personne a déjà un compte.');
      if (user) {
        db.prepare('UPDATE users SET name = ?, role = ?, client_id = ? WHERE id = ?').run(n, role, cid, user.id);
      } else {
        const r = db.prepare('INSERT INTO users (email, name, role, client_id, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(e, n, role, cid, iso(now()));
        user = { id: Number(r.lastInsertRowid) };
      }
      const token = issueToken(user.id, 'invite', POLICY.inviteTtl, actor && actor.id);
      audit({ userId: actor ? actor.id : null, action: 'user.invite', target: `user:${user.id}`, clientId: cid, ip, details: { email: e, role } });
      return { user: userById(user.id), token };
    });
  }

  function tokenUser(token, purpose) {
    const row = db.prepare('SELECT * FROM tokens WHERE hash = ? AND purpose = ?').get(C.sha256(token || ''), purpose);
    if (!row || row.used_at || row.expires_at < now()) return null;
    const user = userById(row.user_id);
    if (!user || user.status === 'disabled') return null;
    return { row, user };
  }

  function acceptInvite(token, password, ip) {
    const t = tokenUser(token, 'invite');
    if (!t || t.user.status !== 'invited') throw new AccountError('Ce lien d’invitation n’est plus valide. Demandez-en un nouveau à BVY.');
    const problem = C.passwordProblem(password, t.user.email);
    if (problem) throw new AccountError(problem);
    tx(db, () => {
      db.prepare('UPDATE tokens SET used_at = ? WHERE hash = ?').run(now(), t.row.hash);
      db.prepare("UPDATE users SET password_hash = ?, status = 'active' WHERE id = ?").run(C.hashPassword(password), t.user.id);
      audit({ userId: t.user.id, action: 'user.activate', target: `user:${t.user.id}`, clientId: t.user.client_id, ip });
    });
    return userById(t.user.id);
  }

  /* -------------------------------------------------------- connexion */
  // 1re étape. Renvoie l'utilisateur si le mot de passe est bon ; sinon une erreur toujours identique.
  function checkPassword(email, password, ip) {
    const user = userByEmail(email);
    const generic = new AccountError('Courriel ou mot de passe incorrect.');
    if (!user || user.status !== 'active') {
      C.verifyPassword(password, null);
      audit({ action: 'login.fail', target: clean(email, 160).toLowerCase(), ip, details: { reason: user ? user.status : 'unknown' } });
      throw generic;
    }
    if (user.locked_until > now()) {
      audit({ userId: user.id, action: 'login.locked', target: `user:${user.id}`, ip });
      throw new AccountError('Trop d’essais. Réessayez dans 15 minutes ou réinitialisez votre mot de passe.');
    }
    if (!C.verifyPassword(password, user.password_hash)) {
      const failed = user.failed_logins + 1;
      const lock = failed >= POLICY.maxFailedLogins ? now() + POLICY.lockMs : 0;
      db.prepare('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?').run(lock ? 0 : failed, lock, user.id);
      audit({ userId: user.id, action: lock ? 'login.lock' : 'login.fail', target: `user:${user.id}`, ip });
      throw generic;
    }
    db.prepare('UPDATE users SET failed_logins = 0 WHERE id = ?').run(user.id);
    return userById(user.id);
  }

  // Code par courriel (2e étape). Renvoie le code à envoyer ; seul son hash est conservé.
  function startEmailCode(user, purpose = 'login') {
    const code = C.randomCode();
    db.prepare('UPDATE challenges SET used_at = ? WHERE user_id = ? AND purpose = ? AND used_at IS NULL').run(now(), user.id, purpose);
    db.prepare('INSERT INTO challenges (user_id, purpose, code_hash, expires_at) VALUES (?, ?, ?, ?)')
      .run(user.id, purpose, C.sha256(`${user.id}:${code}`), now() + POLICY.codeTtl);
    return code;
  }

  function verifyEmailCode(user, code, ip, purpose = 'login') {
    const ch = db.prepare(`SELECT * FROM challenges WHERE user_id = ? AND purpose = ? AND used_at IS NULL
      ORDER BY id DESC LIMIT 1`).get(user.id, purpose);
    if (!ch || ch.expires_at < now() || ch.attempts >= POLICY.codeAttempts) {
      audit({ userId: user.id, action: 'mfa.email.expired', target: `user:${user.id}`, ip });
      throw new AccountError('Ce code a expiré. Demandez-en un nouveau.');
    }
    const ok = C.safeEqual(ch.code_hash, C.sha256(`${user.id}:${String(code || '').replace(/\s/g, '')}`));
    if (!ok) {
      db.prepare('UPDATE challenges SET attempts = attempts + 1 WHERE id = ?').run(ch.id);
      audit({ userId: user.id, action: 'mfa.email.fail', target: `user:${user.id}`, ip });
      throw new AccountError('Code incorrect.');
    }
    db.prepare('UPDATE challenges SET used_at = ? WHERE id = ?').run(now(), ch.id);
    audit({ userId: user.id, action: 'mfa.email.ok', target: `user:${user.id}`, ip });
    return true;
  }

  function verifyAppCode(user, code, ip, secret = user.totp_secret) {
    const step = secret ? C.verifyTotp(secret, code, now()) : null;
    if (step === null || step <= user.totp_last_step) {
      audit({ userId: user.id, action: 'mfa.app.fail', target: `user:${user.id}`, ip });
      throw new AccountError('Code incorrect. Vérifiez l’heure de votre téléphone et réessayez.');
    }
    db.prepare('UPDATE users SET totp_last_step = ? WHERE id = ?').run(step, user.id);
    audit({ userId: user.id, action: 'mfa.app.ok', target: `user:${user.id}`, ip });
    return true;
  }

  // Application d'authentification : nouveau secret proposé, activé seulement après un code valide.
  function enableApp(user, secret, code, ip) {
    verifyAppCode({ ...user, totp_last_step: 0 }, code, ip, secret);
    db.prepare('UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE id = ?').run(secret, user.id);
    audit({ userId: user.id, action: 'mfa.app.enable', target: `user:${user.id}`, ip });
  }

  function disableApp(actor, user, ip) {
    db.prepare('UPDATE users SET totp_secret = NULL, totp_enabled = 0, totp_last_step = 0 WHERE id = ?').run(user.id);
    audit({ userId: actor.id, action: actor.id === user.id ? 'mfa.app.disable' : 'mfa.app.reset', target: `user:${user.id}`, ip });
  }

  /* --------------------------------------------------------- sessions */
  function createSession(user, { mfaDone, ip, userAgent }) {
    const token = C.randomToken();
    db.prepare(`INSERT INTO sessions (id_hash, user_id, csrf, mfa_done, created_at, last_seen, ip, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(C.sha256(token), user.id, C.randomToken(), mfaDone ? 1 : 0, now(), now(),
      clean(ip, 64), clean(userAgent, 200));
    if (mfaDone) markLogin(user, ip);
    return token;
  }

  function markLogin(user, ip) {
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(iso(now()), user.id);
    audit({ userId: user.id, action: 'login.ok', target: `user:${user.id}`, clientId: user.client_id, ip });
  }

  // Session valide (et utilisateur actif) ou null. Met à jour la dernière activité.
  function getSession(token) {
    if (!token) return null;
    const hash = C.sha256(token);
    const s = db.prepare('SELECT * FROM sessions WHERE id_hash = ?').get(hash);
    if (!s) return null;
    const t = now();
    const max = s.mfa_done ? POLICY.sessionMax : POLICY.preMfaMax;
    if (t - s.last_seen > POLICY.sessionIdle || t - s.created_at > max) {
      db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(hash);
      return null;
    }
    const user = userById(s.user_id);
    if (!user || user.status !== 'active') {
      db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(hash);
      return null;
    }
    db.prepare('UPDATE sessions SET last_seen = ? WHERE id_hash = ?').run(t, hash);
    return { ...s, user };
  }

  // Après la 2e étape : nouvelle session (le jeton change, contre la fixation de session).
  function completeMfa(session, { ip, userAgent }) {
    db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(session.id_hash);
    return createSession(session.user, { mfaDone: true, ip, userAgent });
  }

  function destroySession(token) {
    if (token) db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(C.sha256(token));
  }

  const listSessions = (user) => db.prepare('SELECT * FROM sessions WHERE user_id = ? AND mfa_done = 1 ORDER BY last_seen DESC').all(user.id);

  function revokeSession(user, idHash, ip) {
    const r = db.prepare('DELETE FROM sessions WHERE id_hash = ? AND user_id = ?').run(idHash, user.id);
    if (r.changes) audit({ userId: user.id, action: 'session.revoke', target: `user:${user.id}`, ip });
  }

  /* ----------------------------------------------------- mot de passe */
  function changePassword(user, current, next, ip, keepSessionHash) {
    if (!C.verifyPassword(current, user.password_hash)) throw new AccountError('Mot de passe actuel incorrect.');
    const problem = C.passwordProblem(next, user.email);
    if (problem) throw new AccountError(problem);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(C.hashPassword(next), user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND id_hash != ?').run(user.id, keepSessionHash || '');
    audit({ userId: user.id, action: 'password.change', target: `user:${user.id}`, ip });
  }

  // Renvoie un jeton seulement si le compte est actif (la page affiche toujours le même message).
  function requestReset(email, ip) {
    const user = userByEmail(email);
    if (!user || user.status !== 'active') {
      audit({ action: 'password.reset.unknown', target: clean(email, 160).toLowerCase(), ip });
      return null;
    }
    audit({ userId: user.id, action: 'password.reset.request', target: `user:${user.id}`, ip });
    return { user, token: issueToken(user.id, 'reset', POLICY.resetTtl, null) };
  }

  // Après réinitialisation, la personne doit encore passer la 2e étape pour entrer.
  function resetPassword(token, password, ip) {
    const t = tokenUser(token, 'reset');
    if (!t || t.user.status !== 'active') throw new AccountError('Ce lien n’est plus valide. Recommencez la demande.');
    const problem = C.passwordProblem(password, t.user.email);
    if (problem) throw new AccountError(problem);
    tx(db, () => {
      db.prepare('UPDATE tokens SET used_at = ? WHERE hash = ?').run(now(), t.row.hash);
      db.prepare('UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = 0 WHERE id = ?').run(C.hashPassword(password), t.user.id);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(t.user.id);
      audit({ userId: t.user.id, action: 'password.reset', target: `user:${t.user.id}`, ip });
    });
    return userById(t.user.id);
  }

  /* --------------------------------------------------- administration */
  function setStatus(actor, userId, status, ip) {
    const user = userById(userId);
    if (!user) throw new AccountError('Utilisateur introuvable.');
    if (status === 'disabled' && user.role === 'admin') {
      const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active'").get().n;
      if (admins <= 1) throw new AccountError('Impossible de désactiver le dernier administrateur.');
    }
    if (status === 'active' && !user.password_hash) throw new AccountError('Cette personne n’a pas encore accepté son invitation.');
    tx(db, () => {
      db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, user.id);
      if (status === 'disabled') db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
      audit({ userId: actor.id, action: status === 'disabled' ? 'user.disable' : 'user.enable', target: `user:${user.id}`, clientId: user.client_id, ip });
    });
  }

  function setAssignment(actor, userId, clientId, assigned, ip) {
    const user = userById(userId);
    if (!user || !['bookkeeper', 'payroll', 'tax'].includes(user.role)) throw new AccountError('Seul le personnel assigné (tenue de livres, paie, fiscalité) a des assignations.');
    if (!db.prepare('SELECT 1 FROM clients WHERE id = ?').get(Number(clientId))) throw new AccountError('Client introuvable.');
    if (assigned) {
      db.prepare('INSERT OR IGNORE INTO client_assignments (user_id, client_id, created_at) VALUES (?, ?, ?)').run(user.id, Number(clientId), iso(now()));
    } else {
      db.prepare('DELETE FROM client_assignments WHERE user_id = ? AND client_id = ?').run(user.id, Number(clientId));
    }
    audit({ userId: actor.id, action: assigned ? 'assignment.add' : 'assignment.remove', target: `user:${user.id}`, clientId: Number(clientId), ip });
  }

  function unlock(userId) {
    db.prepare('UPDATE users SET failed_logins = 0, locked_until = 0 WHERE id = ?').run(userId);
    audit({ action: 'user.unlock', target: `user:${userId}` });
  }

  return {
    POLICY, audit, userById, userByEmail, createClient, invite, acceptInvite, tokenUser,
    checkPassword, startEmailCode, verifyEmailCode, verifyAppCode, enableApp, disableApp,
    createSession, getSession, completeMfa, destroySession, listSessions, revokeSession, markLogin,
    changePassword, requestReset, resetPassword, setStatus, setAssignment, unlock,
  };
}

module.exports = { createAccounts, AccountError, POLICY };
