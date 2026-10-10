'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { openDb } = require('../lib/db.js');
const { createAccounts, POLICY } = require('../lib/accounts.js');
const { can, canAccessClient, visibleClients } = require('../lib/rbac.js');
const C = require('../lib/crypto.js');

function setup() {
  let t = Date.UTC(2026, 9, 1, 12, 0);
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  const db = openDb(':memory:');
  const acc = createAccounts(db, { now: clock.now });
  const { user: admin, token } = acc.invite(null, { email: 'Owner@BVY.ca', name: 'Pierre Owner', role: 'admin' });
  acc.acceptInvite(token, 'une phrase assez longue');
  return { db, acc, clock, admin: acc.userById(admin.id) };
}
const PW = 'une phrase assez longue';

test('mots de passe : scrypt, règles, temps constant pour un compte inconnu', () => {
  const h = C.hashPassword('Été à Québec 2026 !');
  assert.match(h, /^scrypt\$32768\$8\$1\$/);
  assert.ok(C.verifyPassword('Été à Québec 2026 !', h));
  assert.ok(!C.verifyPassword('autre chose 2026', h));
  assert.ok(!C.verifyPassword('x', null));
  assert.match(C.passwordProblem('court', 'a@b.ca'), /12 caractères/);
  assert.match(C.passwordProblem('motdepasse123', 'a@b.ca'), /courant/);
  assert.match(C.passwordProblem('marie.tremblay2026', 'marie.tremblay@ex.ca'), /courriel/);
  assert.strictEqual(C.passwordProblem('trois chevaux bleus', 'a@b.ca'), null);
});

test('TOTP conforme RFC 6238 (vecteur SHA-1) et refus de la réutilisation', () => {
  const secret = C.base32Encode(Buffer.from('12345678901234567890'));
  assert.strictEqual(C.totpAt(secret, Math.floor(59 / 30)), '287082');
  assert.strictEqual(C.totpAt(secret, Math.floor(1111111109 / 30)), '081804');
  const { acc, admin, clock } = setup();
  const s = C.newTotpSecret();
  acc.enableApp(admin, s, C.totpAt(s, Math.floor(clock.now() / 30000)));
  const u = acc.userById(admin.id);
  assert.strictEqual(u.totp_enabled, 1);
  clock.advance(30_000);
  const code = C.totpAt(s, Math.floor(clock.now() / 30000));
  assert.ok(acc.verifyAppCode(acc.userById(admin.id), code));
  assert.throws(() => acc.verifyAppCode(acc.userById(admin.id), code), /Code incorrect/); // rejeu
  assert.match(C.totpUri(s, 'a@b.ca'), /^otpauth:\/\/totp\/BVY%3Aa%40b\.ca\?secret=/);
});

test('invitation : lien unique, expirant, mot de passe choisi par la personne', () => {
  const { acc, admin, clock } = setup();
  const client = acc.createClient(admin, 'Atelier Boréal inc.');
  const { user, token } = acc.invite(admin, { email: 'marie@boreal.ca', name: 'Marie', role: 'client', clientId: client.id });
  assert.strictEqual(user.status, 'invited');
  assert.strictEqual(user.password_hash, null);
  assert.throws(() => acc.acceptInvite(token, 'court'), /12 caractères/);
  acc.acceptInvite(token, PW);
  assert.throws(() => acc.acceptInvite(token, PW), /plus valide/);
  const again = acc.invite(admin, { email: 'luc@boreal.ca', name: 'Luc', role: 'client', clientId: client.id });
  clock.advance(POLICY.inviteTtl + 1);
  assert.throws(() => acc.acceptInvite(again.token, PW), /plus valide/);
  assert.throws(() => acc.invite(admin, { email: 'marie@boreal.ca', name: 'Marie', role: 'client', clientId: client.id }), /déjà un compte/);
  assert.throws(() => acc.invite(admin, { email: 'x@y.ca', name: 'Xavier', role: 'client' }), /entreprise/);
});

test('connexion : message identique, verrouillage après 10 échecs, code courriel à usage unique', () => {
  const { acc, admin, clock } = setup();
  assert.throws(() => acc.checkPassword('inconnu@x.ca', PW), /Courriel ou mot de passe incorrect/);
  assert.throws(() => acc.checkPassword('owner@bvy.ca', 'mauvais mot de passe'), /Courriel ou mot de passe incorrect/);
  assert.strictEqual(acc.checkPassword('OWNER@bvy.ca', PW).id, admin.id);
  for (let i = 0; i < 10; i++) assert.throws(() => acc.checkPassword('owner@bvy.ca', 'mauvais mot de passe'));
  assert.throws(() => acc.checkPassword('owner@bvy.ca', PW), /15 minutes/);
  clock.advance(POLICY.lockMs + 1);
  assert.ok(acc.checkPassword('owner@bvy.ca', PW));

  const code = acc.startEmailCode(admin);
  assert.match(code, /^\d{6}$/);
  assert.throws(() => acc.verifyEmailCode(admin, code === '000000' ? '111111' : '000000'), /incorrect/);
  assert.ok(acc.verifyEmailCode(admin, code));
  assert.throws(() => acc.verifyEmailCode(admin, code), /expiré/);
  const c2 = acc.startEmailCode(admin);
  for (let i = 0; i < 5; i++) assert.throws(() => acc.verifyEmailCode(admin, c2 === '999999' ? '888888' : '999999'));
  assert.throws(() => acc.verifyEmailCode(admin, c2), /expiré/); // 5 essais max
  const c3 = acc.startEmailCode(admin);
  clock.advance(POLICY.codeTtl + 1);
  assert.throws(() => acc.verifyEmailCode(admin, c3), /expiré/);
});

test('sessions : 2e étape obligatoire, jeton renouvelé, expiration, désactivation', () => {
  const { acc, admin, clock } = setup();
  const pre = acc.createSession(admin, { mfaDone: false });
  const s = acc.getSession(pre);
  assert.strictEqual(s.mfa_done, 0);
  const full = acc.completeMfa(s, {});
  assert.strictEqual(acc.getSession(pre), null, 'ancien jeton invalide');
  assert.strictEqual(acc.getSession(full).mfa_done, 1);
  clock.advance(POLICY.sessionIdle + 1);
  assert.strictEqual(acc.getSession(full), null, 'inactivité');
  const t2 = acc.createSession(admin, { mfaDone: true });
  for (let i = 0; i < 13; i++) { clock.advance(59 * 60_000); acc.getSession(t2); }
  assert.strictEqual(acc.getSession(t2), null, 'durée maximale 12 h');
  assert.throws(() => acc.setStatus(admin, admin.id, 'disabled'), /dernier administrateur/);
});

test('RBAC : un client ne voit que son entreprise ; le personnel seulement ses clients assignés', () => {
  const { db, acc, admin } = setup();
  const a = acc.createClient(admin, 'Alpha inc.');
  const b = acc.createClient(admin, 'Bêta inc.');
  const mk = (email, role, clientId) => { const { token } = acc.invite(admin, { email, name: email, role, clientId }); return acc.acceptInvite(token, PW); };
  const clientA = mk('ca@a.ca', 'client', a.id);
  const book = mk('tl@bvy.ca', 'bookkeeper');
  const lead = mk('lead@bvy.ca', 'lead');
  acc.setAssignment(admin, book.id, a.id, true);

  assert.ok(canAccessClient(db, clientA, a.id));
  assert.ok(!canAccessClient(db, clientA, b.id));
  assert.ok(canAccessClient(db, book, a.id));
  assert.ok(!canAccessClient(db, book, b.id));
  assert.ok(canAccessClient(db, lead, b.id));
  assert.ok(canAccessClient(db, admin, b.id));
  assert.deepStrictEqual(visibleClients(db, clientA).map((c) => c.name), ['Alpha inc.']);
  assert.deepStrictEqual(visibleClients(db, book).map((c) => c.name), ['Alpha inc.']);
  assert.strictEqual(visibleClients(db, lead).length, 2);
  assert.ok(!can(clientA, 'audit.view'));
  assert.ok(!can(book, 'users.invite_client'));
  assert.ok(can(lead, 'users.invite_client') && !can(lead, 'users.invite_staff'));
  assert.throws(() => acc.invite(lead, { email: 'x@bvy.ca', name: 'X', role: 'tax' }), /ne pouvez pas/);
  assert.throws(() => acc.setAssignment(admin, clientA.id, b.id, true), /Seul le personnel/);

  acc.setStatus(admin, clientA.id, 'disabled');
  assert.ok(!canAccessClient(db, acc.userById(clientA.id), a.id));
});

test('réinitialisation : lien de 30 min, sessions fermées, pas d’indice pour un courriel inconnu', () => {
  const { acc, admin, clock } = setup();
  assert.strictEqual(acc.requestReset('personne@x.ca'), null);
  const sess = acc.createSession(admin, { mfaDone: true });
  const { token } = acc.requestReset('owner@bvy.ca');
  acc.resetPassword(token, 'nouvelle phrase secrète');
  assert.strictEqual(acc.getSession(sess), null);
  assert.ok(acc.checkPassword('owner@bvy.ca', 'nouvelle phrase secrète'));
  const r2 = acc.requestReset('owner@bvy.ca');
  clock.advance(POLICY.resetTtl + 1);
  assert.throws(() => acc.resetPassword(r2.token, 'encore une autre phrase'), /plus valide/);
});

test('journal d’audit : ajout seulement', () => {
  const { db } = setup();
  const n = db.prepare('SELECT COUNT(*) AS n FROM audit_logs').get().n;
  assert.ok(n >= 2);
  assert.throws(() => db.exec('DELETE FROM audit_logs'), /ajout seulement/);
  assert.throws(() => db.exec("UPDATE audit_logs SET action = 'x'"), /ajout seulement/);
});
