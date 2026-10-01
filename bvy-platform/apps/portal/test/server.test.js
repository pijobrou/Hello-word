'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer, COOKIE } = require('../server.js');
const C = require('../lib/crypto.js');

const ORIGIN = 'https://portail.bvyaccountingtax.ca';
const PW = 'une phrase assez longue';

async function start(extra = {}) {
  const mails = [];
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-portail-'));
  const app = createServer({ port: 0, dataDir, smtp: null, publicUrl: ORIGIN, sendMail: async (m) => { mails.push(m); }, ...extra });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const port = app.address().port;
  // Petit client HTTP avec « bocal » à témoins.
  function agent() {
    let cookie = '';
    async function req(method, p, form, headers = {}) {
      const body = form ? new URLSearchParams(form).toString() : undefined;
      return new Promise((resolve, reject) => {
        const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body !== undefined ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), Origin: ORIGIN } : {}),
          ...headers } }, (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const sc = res.headers['set-cookie'];
            if (sc) {
              const m = String(sc[0]).match(new RegExp(`${COOKIE}=([^;]*)`));
              cookie = m && m[1] ? `${COOKIE}=${m[1]}` : '';
            }
            resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') });
          });
        });
        r.on('error', reject);
        if (body !== undefined) r.write(body);
        r.end();
      });
    }
    const csrf = (html) => (html.match(/name="_csrf" value="([^"]+)"/) || [])[1];
    return { req, csrf, get cookie() { return cookie; } };
  }
  return { app, mails, agent, acc: app.accounts, db: app.db };
}

const lastCode = (mails) => (mails[mails.length - 1].subject.match(/(\d{6})/) || [])[1];
const linkToken = (mails) => decodeURIComponent((mails[mails.length - 1].text.match(/jeton=([^\s]+)/) || [])[1]);

async function loginFlow(ctx, a, email, pw = PW) {
  const r = await a.req('POST', '/connexion', { email, password: pw });
  assert.strictEqual(r.status, 303, r.body.slice(0, 300));
  assert.strictEqual(r.headers.location, '/verification');
  const v = await a.req('GET', '/verification');
  const r2 = await a.req('POST', '/verification', { method: 'email', code: lastCode(ctx.mails), _csrf: a.csrf(v.body) });
  assert.strictEqual(r2.headers.location, '/accueil');
  return a;
}

function bootstrapAdmin(ctx) {
  const { token } = ctx.acc.invite(null, { email: 'owner@bvy.ca', name: 'Pierre Owner', role: 'admin' });
  ctx.acc.acceptInvite(token, PW);
}

test('en-têtes de sécurité, pages publiques, ressources du design system', async () => {
  const ctx = await start();
  try {
    const a = ctx.agent();
    const home = await a.req('GET', '/');
    assert.strictEqual(home.headers.location, '/connexion');
    const login = await a.req('GET', '/connexion');
    assert.strictEqual(login.status, 200);
    assert.match(login.headers['content-security-policy'], /script-src 'self'/);
    assert.ok(!/unsafe-inline/.test(login.headers['content-security-policy']));
    assert.strictEqual(login.headers['x-frame-options'], 'DENY');
    assert.strictEqual(login.headers['cache-control'], 'no-store');
    assert.match(login.headers['x-robots-tag'], /noindex/);
    assert.ok(!/<script/i.test(login.body), 'aucun script');
    assert.ok(!/style="/.test(login.body), 'aucun style en ligne (CSP)');
    for (const f of ['tokens.css', 'components.css', 'portal.css', 'icons.svg', 'bvy-logo-96.png']) {
      assert.strictEqual((await a.req('GET', `/assets/${f}`)).status, 200, f);
    }
    const trav = await a.req('GET', '/assets/../server.js');
    assert.notStrictEqual(trav.status, 200);
    assert.ok(!trav.body.includes('createServer'));
    assert.strictEqual((await a.req('GET', '/assets/%2e%2e%2fserver.js')).status, 404);
    assert.strictEqual((await a.req('GET', '/accueil')).headers.location, '/connexion');
  } finally { ctx.app.close(); }
});

test('connexion complète : mot de passe, code par courriel, cookie sécurisé, déconnexion', async () => {
  const ctx = await start();
  bootstrapAdmin(ctx);
  try {
    const a = ctx.agent();
    const bad = await a.req('POST', '/connexion', { email: 'owner@bvy.ca', password: 'mauvais mot de passe' });
    assert.strictEqual(bad.status, 401);
    assert.match(bad.body, /Courriel ou mot de passe incorrect/);
    const r = await a.req('POST', '/connexion', { email: 'owner@bvy.ca', password: PW });
    assert.match(r.headers['set-cookie'][0], /__Host-bvy_session=.+; Path=\/; HttpOnly; Secure; SameSite=Lax/);
    assert.match(ctx.mails[0].subject, /Votre code BVY : \d{6}/);
    // Avant la 2e étape : aucune page protégée.
    assert.strictEqual((await a.req('GET', '/accueil')).headers.location, '/verification');
    const before = a.cookie;
    await loginFlow(ctx, ctx.agent(), 'owner@bvy.ca'); // autre appareil
    const v = await a.req('GET', '/verification');
    const wrong = await a.req('POST', '/verification', { method: 'email', code: '000000', _csrf: a.csrf(v.body) });
    assert.strictEqual(wrong.status, 401);
    const ok = await a.req('POST', '/verification', { method: 'email', code: lastCode(ctx.mails.filter((m) => m === ctx.mails[0])), _csrf: a.csrf(v.body) });
    // Le premier code a été remplacé par celui de l'autre appareil : il n'est plus valable.
    assert.strictEqual(ok.status, 401);
    await a.req('POST', '/verification/courriel', { _csrf: a.csrf(v.body) });
    const done = await a.req('POST', '/verification', { method: 'email', code: lastCode(ctx.mails), _csrf: a.csrf(v.body) });
    assert.strictEqual(done.headers.location, '/accueil');
    assert.notStrictEqual(a.cookie, before, 'jeton de session renouvelé');
    const home = await a.req('GET', '/accueil');
    assert.match(home.body, /Bonjour Pierre/);
    const out = await a.req('POST', '/deconnexion', { _csrf: a.csrf(home.body) });
    assert.strictEqual(out.headers.location.split('?')[0], '/connexion');
    assert.strictEqual((await a.req('GET', '/accueil')).headers.location, '/connexion');
  } finally { ctx.app.close(); }
});

test('protection CSRF : origine étrangère et jeton manquant refusés', async () => {
  const ctx = await start();
  bootstrapAdmin(ctx);
  try {
    const a = await loginFlow(ctx, ctx.agent(), 'owner@bvy.ca');
    const evil = await a.req('POST', '/admin/clients', { name: 'Pirate' }, { Origin: 'https://evil.example' });
    assert.strictEqual(evil.status, 403);
    const noToken = await a.req('POST', '/admin/clients', { name: 'Pirate' });
    assert.strictEqual(noToken.status, 403);
    assert.strictEqual(ctx.db.prepare('SELECT COUNT(*) AS n FROM clients').get().n, 0);
  } finally { ctx.app.close(); }
});

test('invitation de bout en bout et isolation : un client ne voit que son entreprise et n’entre pas dans l’administration', async () => {
  const ctx = await start();
  bootstrapAdmin(ctx);
  try {
    const admin = await loginFlow(ctx, ctx.agent(), 'owner@bvy.ca');
    let page = await admin.req('GET', '/admin');
    await admin.req('POST', '/admin/clients', { name: 'Atelier Boréal inc.', _csrf: admin.csrf(page.body) });
    await admin.req('POST', '/admin/clients', { name: 'Autre entreprise inc.', _csrf: admin.csrf(page.body) });
    const boreal = ctx.db.prepare("SELECT id FROM clients WHERE name LIKE 'Atelier%'").get().id;
    const r = await admin.req('POST', '/admin/inviter', { name: 'Marie Tremblay', email: 'marie@boreal.ca', role: 'client', clientId: String(boreal), _csrf: admin.csrf(page.body) });
    assert.match(decodeURIComponent(r.headers.location), /Invitation envoyée à marie@boreal\.ca/);
    const invite = ctx.mails[ctx.mails.length - 1];
    assert.deepStrictEqual(invite.to, ['marie@boreal.ca']);
    assert.match(invite.text, /https:\/\/portail\.bvyaccountingtax\.ca\/invitation\?jeton=/);

    const marie = ctx.agent();
    const jeton = linkToken(ctx.mails);
    const form = await marie.req('GET', `/invitation?jeton=${encodeURIComponent(jeton)}`);
    assert.match(form.body, /Bienvenue, Marie/);
    const mismatch = await marie.req('POST', '/invitation', { jeton, password: PW, password2: 'autre chose ici' });
    assert.strictEqual(mismatch.status, 422);
    const ok = await marie.req('POST', '/invitation', { jeton, password: PW, password2: PW });
    assert.strictEqual(ok.headers.location, '/accueil');
    const home = await marie.req('GET', '/accueil');
    assert.match(home.body, /Atelier Boréal inc\./);
    assert.ok(!home.body.includes('Autre entreprise'));
    assert.ok(!home.body.includes('Administration'));
    const denied = await marie.req('GET', '/admin');
    assert.strictEqual(denied.status, 403);
    assert.strictEqual((await marie.req('GET', '/admin/journal')).status, 403);
    assert.strictEqual((await marie.req('GET', '/admin/utilisateurs/1')).status, 403);
    assert.strictEqual((await ctx.agent().req('GET', `/invitation?jeton=${encodeURIComponent(jeton)}`)).status, 410, 'lien à usage unique');
    assert.ok(ctx.db.prepare("SELECT 1 FROM audit_logs WHERE action = 'access.denied'").get());
  } finally { ctx.app.close(); }
});

test('application d’authentification : activation, connexion par code de l’application', async () => {
  const ctx = await start();
  bootstrapAdmin(ctx);
  try {
    const a = await loginFlow(ctx, ctx.agent(), 'owner@bvy.ca');
    let acct = await a.req('GET', '/compte');
    await a.req('POST', '/compte/application/commencer', { _csrf: a.csrf(acct.body) });
    acct = await a.req('GET', '/compte');
    const secret = acct.body.match(/class="secret mt-4">([A-Z2-7 ]+)</)[1].replace(/ /g, '');
    const wrong = await a.req('POST', '/compte/application/activer', { code: '000000', _csrf: a.csrf(acct.body) });
    assert.strictEqual(wrong.status, 422);
    const ok = await a.req('POST', '/compte/application/activer', { code: C.totpAt(secret, Math.floor(Date.now() / 30000)), _csrf: a.csrf(acct.body) });
    assert.match(decodeURIComponent(ok.headers.location), /activée/);
    assert.strictEqual(ctx.acc.userByEmail('owner@bvy.ca').totp_enabled, 1);

    const b = ctx.agent();
    const mailsBefore = ctx.mails.length;
    await b.req('POST', '/connexion', { email: 'owner@bvy.ca', password: PW });
    assert.strictEqual(ctx.mails.length, mailsBefore, 'pas de courriel quand l’application est active');
    const v = await b.req('GET', '/verification');
    assert.match(v.body, /application d’authentification/);
    // Code de la période suivante (le précédent vient d'être utilisé à l'activation)
    const next = C.totpAt(secret, Math.floor(Date.now() / 30000) + 1);
    const r = await b.req('POST', '/verification', { method: 'app', code: next, _csrf: b.csrf(v.body) });
    assert.strictEqual(r.headers.location, '/accueil');
  } finally { ctx.app.close(); }
});

test('mot de passe oublié : même réponse pour un courriel inconnu, lien unique, 2e étape toujours exigée', async () => {
  const ctx = await start();
  bootstrapAdmin(ctx);
  try {
    const a = ctx.agent();
    const unknown = await a.req('POST', '/mot-de-passe-oublie', { email: 'personne@x.ca' });
    const known = await a.req('POST', '/mot-de-passe-oublie', { email: 'owner@bvy.ca' });
    assert.strictEqual(unknown.body, known.body);
    assert.strictEqual(ctx.mails.length, 1);
    const jeton = linkToken(ctx.mails);
    const r = await a.req('POST', '/reinitialiser', { jeton, password: 'nouvelle phrase secrète', password2: 'nouvelle phrase secrète' });
    assert.strictEqual(r.headers.location.split('?')[0], '/connexion');
    assert.strictEqual((await a.req('POST', '/reinitialiser', { jeton, password: 'x', password2: 'x' })).status, 410);
    const l = await a.req('POST', '/connexion', { email: 'owner@bvy.ca', password: 'nouvelle phrase secrète' });
    assert.strictEqual(l.headers.location, '/verification');
  } finally { ctx.app.close(); }
});

test('limite de tentatives par adresse IP sur la connexion', async () => {
  const ctx = await start({ authRateMax: 3 });
  try {
    const a = ctx.agent();
    for (let i = 0; i < 3; i++) await a.req('POST', '/connexion', { email: 'x@y.ca', password: 'abc' });
    assert.strictEqual((await a.req('POST', '/connexion', { email: 'x@y.ca', password: 'abc' })).status, 429);
  } finally { ctx.app.close(); }
});

test('personnel : tenue de livres ne voit que ses clients assignés ; l’admin assigne', async () => {
  const ctx = await start();
  bootstrapAdmin(ctx);
  try {
    const admin = await loginFlow(ctx, ctx.agent(), 'owner@bvy.ca');
    const page = await admin.req('GET', '/admin');
    const csrf = admin.csrf(page.body);
    await admin.req('POST', '/admin/clients', { name: 'Alpha inc.', _csrf: csrf });
    await admin.req('POST', '/admin/clients', { name: 'Bêta inc.', _csrf: csrf });
    await admin.req('POST', '/admin/inviter', { name: 'Julie Livres', email: 'julie@bvy.ca', role: 'bookkeeper', clientId: '', _csrf: csrf });
    const julieId = ctx.acc.userByEmail('julie@bvy.ca').id;
    const alpha = ctx.db.prepare("SELECT id FROM clients WHERE name = 'Alpha inc.'").get().id;
    await admin.req('POST', `/admin/utilisateurs/${julieId}/assignation`, { clientId: String(alpha), assigned: '1', _csrf: csrf });

    const j = ctx.agent();
    const jeton = linkToken(ctx.mails);
    const r = await j.req('POST', '/invitation', { jeton, password: PW, password2: PW });
    assert.match(r.headers.location, /^\/compte\?ok=.*#application$/, 'le personnel est invité à activer l’application');
    const home = await j.req('GET', '/accueil');
    assert.match(home.body, /Alpha inc\./);
    assert.ok(!home.body.includes('Bêta inc.'));
    assert.match(home.body, /Protégez mieux votre accès/);
    assert.strictEqual((await j.req('GET', '/admin')).status, 403);

    // Désactivation : la session de Julie est fermée immédiatement.
    await admin.req('POST', `/admin/utilisateurs/${julieId}/statut`, { status: 'disabled', _csrf: csrf });
    assert.strictEqual((await j.req('GET', '/accueil')).headers.location, '/connexion');
    const journal = await admin.req('GET', '/admin/journal');
    assert.match(journal.body, /user\.disable/);
    assert.match(journal.body, /assignment\.add/);
  } finally { ctx.app.close(); }
});

test('cli : create-admin affiche un lien d’invitation', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-cli-'));
  const prev = process.env.PORTAL_DATA_DIR;
  process.env.PORTAL_DATA_DIR = dir;
  try {
    const lines = [];
    const out = { log: (s) => lines.push(s), error: (s) => lines.push(`ERR ${s}`) };
    const { main } = require('../cli.js');
    assert.strictEqual(main(['create-admin', 'owner@bvy.ca', 'Pierre Owner'], out), 0);
    assert.match(lines[1], /^https:\/\/portail\.bvyaccountingtax\.ca\/invitation\?jeton=/);
    assert.strictEqual(main(['list-users'], out), 0);
    assert.match(lines[2], /invited\s+admin\s+owner@bvy\.ca/);
    assert.strictEqual(main(['backup', '2'], out), 0);
    main(['backup', '2'], out); main(['backup', '2'], out);
    const backups = fs.readdirSync(path.join(dir, 'backups'));
    assert.ok(backups.length >= 1 && backups.length <= 2, 'rotation des sauvegardes');
    assert.strictEqual(fs.statSync(path.join(dir, 'backups', backups[0])).mode & 0o777, 0o600);
  } finally {
    if (prev === undefined) delete process.env.PORTAL_DATA_DIR; else process.env.PORTAL_DATA_DIR = prev;
  }
});

test('déploiement : les modèles nginx du portail refusent la même liste de robots que le site', () => {
  const { BLOCKED_AGENTS } = require('../../website/bots.js');
  const dir = path.join(__dirname, '..', '..', '..', 'tools', 'deployment', 'portail', 'nginx');
  for (const f of ['portail.conf', 'portail.http-only.conf']) {
    const conf = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.deepStrictEqual(conf.match(/"~\*\(([^)]+)\)" 1;/)[1].split('|'), [...BLOCKED_AGENTS], f);
    assert.match(conf, /proxy_pass http:\/\/127\.0\.0\.1:3100;/);
    assert.match(conf, /client_max_body_size 21m;/);
    assert.strictEqual((conf.match(/if \(\$bvy_portail_robot\) \{ return 403; \}/g) || []).length, 2, f);
  }
});

test('HEAD = GET : jamais traité comme une tentative de connexion ou de code', async () => {
  const ctx = await start();
  bootstrapAdmin(ctx);
  try {
    const a = ctx.agent();
    const head = await a.req('HEAD', '/connexion');
    assert.strictEqual(head.status, 200);
    assert.strictEqual(head.body, '');
    assert.ok(!ctx.db.prepare("SELECT 1 FROM audit_logs WHERE action = 'login.fail'").get(), 'aucun échec de connexion inscrit');
    await a.req('POST', '/connexion', { email: 'owner@bvy.ca', password: PW });
    for (let i = 0; i < 6; i++) assert.strictEqual((await a.req('HEAD', '/verification')).status, 200);
    const v = await a.req('GET', '/verification');
    const ok = await a.req('POST', '/verification', { method: 'email', code: lastCode(ctx.mails), _csrf: a.csrf(v.body) });
    assert.strictEqual(ok.headers.location, '/accueil', 'les HEAD n’ont pas consommé les essais du code');
  } finally { ctx.app.close(); }
});

test('CSP : les formulaires peuvent rediriger vers Intuit (bouton « Connecter QuickBooks »), pas ailleurs', () => {
  const { SECURITY_HEADERS } = require('../server.js');
  const formAction = SECURITY_HEADERS['Content-Security-Policy'].match(/form-action ([^;]+)/)[1].split(/\s+/);
  const { AUTH_URL } = require('../lib/qbo.js');
  assert.ok(formAction.includes(new URL(AUTH_URL).origin), 'la page d’autorisation Intuit doit être permise');
  assert.deepStrictEqual(formAction.filter((s) => s !== "'self'" && !/^https:\/\/([*a-z]+\.)?intuit\.com$|^https:\/\/appcenter\.intuit\.com$/.test(s)), [], 'aucune autre origine');
});
