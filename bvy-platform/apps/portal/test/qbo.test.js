'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server.js');
const { createQbo, encrypt, decrypt, TOKEN_URL, REVOKE_URL } = require('../lib/qbo.js');
const { plTotals } = require('../lib/qbo-sync.js');

const ORIGIN = 'https://portail.bvyaccountingtax.ca';
const PW = 'une phrase assez longue';
const NOW0 = Date.UTC(2026, 9, 1, 15, 0); // 1er octobre 2026

test('chiffrement des jetons (AES-256-GCM) et rapport de résultats', () => {
  const key = crypto.randomBytes(32);
  const blob = encrypt(key, 'jeton-secret');
  assert.ok(!blob.includes('jeton-secret'));
  assert.strictEqual(decrypt(key, blob), 'jeton-secret');
  const parts = blob.split('.'); parts[3] = Buffer.from('autre').toString('base64');
  assert.throws(() => decrypt(key, parts.join('.')));
  assert.throws(() => decrypt(crypto.randomBytes(32), blob));
  assert.deepStrictEqual(plTotals({ Rows: { Row: [
    { group: 'Income', Summary: { ColData: [{ value: 'Total Income' }, { value: '10000.00' }, { value: '12000.50' }, { value: '22000.50' }] } },
    { group: 'Expenses', Summary: { ColData: [{ value: 'Total Expenses' }, { value: '8000' }, { value: '' }, { value: '8000' }] } },
  ] } }), { income: [1000000, 1200050], expenses: [800000, null] });
  assert.strictEqual(plTotals(null), null);
});

// Faux Intuit : jetons, API comptable et révocation.
function fakeIntuit(clock) {
  const st = { tokens: 0, refreshes: 0, revoked: [], failRefresh: false, uncategorizedLine: true, issued: [] };
  const json = (status, body, headers = {}) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body), headers: new Headers(headers) });
  const fetchImpl = async (url, opts = {}) => {
    if (url === TOKEN_URL) {
      const p = new URLSearchParams(opts.body);
      assert.match(opts.headers.Authorization, /^Basic /);
      if (p.get('grant_type') === 'refresh_token') {
        st.refreshes += 1;
        if (st.failRefresh) return json(400, { error: 'invalid_grant' });
        assert.strictEqual(p.get('refresh_token'), st.issued[st.issued.length - 1].refresh);
      } else {
        assert.strictEqual(p.get('code'), 'code-intuit');
        assert.strictEqual(p.get('redirect_uri'), `${ORIGIN}/quickbooks/retour`);
      }
      st.tokens += 1;
      const t = { access: `acc-${st.tokens}`, refresh: `ref-${st.tokens}` };
      st.issued.push(t);
      return json(200, { access_token: t.access, refresh_token: t.refresh, expires_in: 3600, x_refresh_token_expires_in: 8640000 });
    }
    if (url === REVOKE_URL) { st.revoked.push(JSON.parse(opts.body).token); return json(200, {}); }
    const u = new URL(url);
    if (st.forbid) return json(403, { fault: { error: [{ message: 'message=ApplicationAuthorizationFailed; errorCode=003100; statusCode=403', detail: 'SignatureAuthorizationFailed', code: '3100' }], type: 'SERVICE' } }, { intuit_tid: '1-abc' });
    assert.strictEqual(u.searchParams.get('minorversion'), '75');
    assert.strictEqual(opts.headers.Authorization, `Bearer ${st.issued[st.issued.length - 1].access}`);
    if (u.pathname.endsWith('/companyinfo/9130')) return json(200, { CompanyInfo: { CompanyName: 'Atelier Boréal (QBO)' } });
    if (u.pathname.endsWith('/reports/ProfitAndLoss')) {
      assert.strictEqual(u.searchParams.get('start_date'), '2026-08-01');
      assert.strictEqual(u.searchParams.get('end_date'), '2026-09-30');
      return json(200, { Rows: { Row: [
        { group: 'Income', Summary: { ColData: [{ value: 'Total' }, { value: '10000' }, { value: '10800' }, { value: '20800' }] } },
        { group: 'Expenses', Summary: { ColData: [{ value: 'Total' }, { value: '7000' }, { value: '7840' }, { value: '14840' }] } },
      ] } });
    }
    if (u.pathname.endsWith('/query')) {
      const q = u.searchParams.get('query');
      if (/from Account/.test(q)) return json(200, { QueryResponse: { Account: [
        { Id: '35', Name: 'Desjardins opérations', AccountType: 'Bank', CurrentBalance: 40000.6 },
        { Id: '36', Name: 'Épargne', AccountType: 'Bank', CurrentBalance: 8215 },
        { Id: '80', Name: 'Uncategorized Expense', AccountType: 'Expense', CurrentBalance: 0 },
        { Id: '60', Name: 'Fournitures', AccountType: 'Expense' },
      ] } });
      if (/from Invoice/.test(q)) return json(200, { QueryResponse: { Invoice: [
        { Id: '501', DocNumber: '1042', Balance: 2150, DueDate: '2026-08-17', CustomerRef: { name: 'Client X' } },
        { Id: '502', DocNumber: '1043', Balance: 1000, DueDate: '2026-10-15', CustomerRef: { name: 'Client Y' } },
      ] } });
      if (/from Bill/.test(q)) return json(200, { QueryResponse: { Bill: [{ Id: '701', Balance: 876.45, DueDate: '2026-10-20' }] } });
      if (/from Purchase/.test(q)) {
        assert.match(q, /TxnDate >= '2026-07-03'/);
        return json(200, { QueryResponse: { Purchase: [
          { Id: '901', TxnDate: '2026-09-18', PaymentType: 'CreditCard', EntityRef: { name: 'Costco' }, PrivateNote: 'Achat magasin',
            Line: [{ Amount: 842.37, DetailType: 'AccountBasedExpenseLineDetail', AccountBasedExpenseLineDetail: { AccountRef: { value: st.uncategorizedLine ? '80' : '60' } } }] },
          { Id: '902', TxnDate: '2026-09-20', PaymentType: 'Cash', Line: [{ Amount: 50, DetailType: 'AccountBasedExpenseLineDetail', AccountBasedExpenseLineDetail: { AccountRef: { value: '60' } } }] },
        ] } });
      }
    }
    return json(404, { Fault: { Error: [{ Message: `inconnu ${u.pathname}` }] } });
  };
  return { st, fetchImpl };
}

async function setup() {
  let now = NOW0;
  const clock = { now: () => now, advance: (ms) => { now += ms; } };
  const fake = fakeIntuit(clock);
  const qbo = createQbo({ clientId: 'cid', clientSecret: 'secret', key: crypto.randomBytes(32), environment: 'sandbox',
    redirectUri: `${ORIGIN}/quickbooks/retour`, apiBase: 'https://sandbox-quickbooks.api.intuit.com', appBase: 'https://app.sandbox.qbo.intuit.com' },
  { fetchImpl: fake.fetchImpl, now: clock.now });
  const mails = [];
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-qbo-'));
  const app = createServer({ port: 0, dataDir, smtp: null, publicUrl: ORIGIN, sendMail: async (m) => { mails.push(m); }, qbo, now: clock.now });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const port = app.address().port;
  const acc = app.accounts;
  function agent() {
    let cookie = ''; let csrf = '';
    function req(method, p, form) {
      const body = form ? Buffer.from(new URLSearchParams({ ...form, _csrf: csrf }).toString()) : null;
      const h = { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': body.length, Origin: ORIGIN } : {}) };
      return new Promise((resolve, reject) => {
        const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: h }, (res) => {
          const chunks = []; res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const sc = res.headers['set-cookie'];
            if (sc) { const m = String(sc[0]).match(/__Host-bvy_session=([^;]*)/); cookie = m && m[1] ? `__Host-bvy_session=${m[1]}` : ''; }
            const text = Buffer.concat(chunks).toString('utf8');
            const m = text.match(/name="_csrf" value="([^"]+)"/); if (m) csrf = m[1];
            resolve({ status: res.statusCode, headers: res.headers, body: text });
          });
        });
        r.on('error', reject); if (body) r.write(body); r.end();
      });
    }
    return { req, get: (p) => req('GET', p), post: (p, f = {}) => req('POST', p, f) };
  }
  async function login(email) {
    const a = agent();
    await a.get('/connexion');
    await a.req('POST', '/connexion', { email, password: PW });
    await a.get('/verification');
    const r = await a.post('/verification', { method: 'email', code: mails[mails.length - 1].subject.match(/(\d{6})/)[1] });
    assert.strictEqual(r.headers.location, '/accueil');
    await a.get('/accueil');
    return a;
  }
  const mk = (email, name, role, clientId) => { const { token } = acc.invite(null, { email, name, role, clientId }); return acc.acceptInvite(token, PW); };
  const admin = mk('owner@bvy.ca', 'Pierre Owner', 'admin');
  const boreal = acc.createClient(admin, 'Atelier Boréal inc.');
  const autre = acc.createClient(admin, 'Autre inc.');
  mk('marie@boreal.ca', 'Marie Tremblay', 'client', boreal.id);
  mk('julie@bvy.ca', 'Julie Livres', 'bookkeeper');
  return { app, db: app.db, fake, clock, login, boreal, autre, qbo };
}

async function connect(t, staff, clientId) {
  await staff.get(`/clients/${clientId}/quickbooks`);
  const r = await staff.post(`/clients/${clientId}/quickbooks/connecter`);
  assert.strictEqual(r.status, 303);
  const auth = new URL(r.headers.location);
  assert.strictEqual(auth.origin + auth.pathname, 'https://appcenter.intuit.com/connect/oauth2');
  assert.strictEqual(auth.searchParams.get('scope'), 'com.intuit.quickbooks.accounting');
  return auth.searchParams.get('state');
}

test('connexion OAuth, première synchronisation, tableau de bord et suggestions ; jetons chiffrés', async () => {
  const t = await setup();
  try {
    const staff = await t.login('owner@bvy.ca');
    const state = await connect(t, staff, t.boreal.id);
    const back = await staff.get(`/quickbooks/retour?code=code-intuit&state=${encodeURIComponent(state)}&realmId=9130`);
    assert.match(decodeURIComponent(back.headers.location), /QuickBooks est connecté\. Première synchronisation terminée\./);
    // Le même « state » ne peut pas resservir
    assert.strictEqual((await staff.get(`/quickbooks/retour?code=code-intuit&state=${encodeURIComponent(state)}&realmId=9130`)).status, 303);

    const conn = t.db.prepare('SELECT * FROM qbo_connections').get();
    assert.strictEqual(conn.company_name, 'Atelier Boréal (QBO)');
    assert.ok(!conn.access_enc.includes('acc-1') && !conn.refresh_enc.includes('ref-1'), 'jetons jamais en clair');
    assert.strictEqual(t.qbo.decrypt(conn.refresh_enc), 'ref-1');

    const snap = JSON.parse(t.db.prepare('SELECT data FROM client_snapshots').get().data);
    assert.strictEqual(snap.cash.amount, 4821560);
    assert.strictEqual(snap.receivable.amount, 315000);
    assert.match(snap.receivable.note, /2 factures impayées, dont 1 en retard de plus de 30 jours/);
    assert.strictEqual(snap.payable.amount, 87645);
    assert.match(snap.changes[0].what, /^Revenus de septembre : 10\s800,00\s\$ \(\+ 8 %\)$/);
    assert.match(snap.changes[1].what, /^Dépenses de septembre : 7\s840,00\s\$ \(\+ 12 %\)$/);
    assert.match(snap.changes[0].why, /Comparé à août/);

    const page = await staff.get(`/clients/${t.boreal.id}/quickbooks`);
    assert.match(page.body, /Connecté/);
    assert.match(page.body, /Dépense non catégorisée/);
    assert.match(page.body, /Facture en retard/);
    assert.match(page.body, /app\.sandbox\.qbo\.intuit\.com\/app\/expense\?txnId=901/);
    assert.match((await staff.get('/accueil')).body, /2 suggestions/);

    const marie = await t.login('marie@boreal.ca');
    const home = await marie.get('/accueil');
    assert.match(home.body, /QuickBooks synchronisé · (à l’instant|il y a |le )/);
    assert.match(home.body, /1 facture en retard</);
    assert.match(home.body, /<span>Revenus<\/span><span class="up">\+ 8 %<\/span>/);
    assert.match(home.body, /<span>Dépenses<\/span><span class="dn">\+ 12 %<\/span>/);
    assert.match(home.body, /Chiffres synchronisés avec QuickBooks/);
    assert.match(home.body, /48\s215,60\s\$/);
    assert.ok(!home.body.includes('Costco'), 'rien n’est montré au client sans le clic de l’équipe');
    assert.match(home.body, /app\.sandbox\.qbo\.intuit\.com\/app\/homepage/);
  } finally { t.app.close(); }
});

test('suggestion envoyée au client, puis fermée toute seule quand c’est corrigé dans QuickBooks', async () => {
  const t = await setup();
  try {
    const staff = await t.login('owner@bvy.ca');
    const state = await connect(t, staff, t.boreal.id);
    await staff.get(`/quickbooks/retour?code=code-intuit&state=${encodeURIComponent(state)}&realmId=9130`);
    const item = t.db.prepare("SELECT * FROM qbo_items WHERE kind = 'uncategorized'").get();
    await staff.get(`/clients/${t.boreal.id}/quickbooks`);
    const r = await staff.post(`/suggestions/${item.id}/envoyer`);
    assert.match(decodeURIComponent(r.headers.location), /Tâche envoyée au client/);
    const task = t.db.prepare('SELECT * FROM tasks').get();
    assert.strictEqual(task.kind, 'question');
    assert.match(task.title, /^Nous avons trouvé un paiement de 842,37\s\$ à Costco le 18 septembre 2026\. Était-ce une dépense d’entreprise \?$/);
    assert.strictEqual(task.qbo_url, 'https://app.sandbox.qbo.intuit.com/app/expense?txnId=901');

    const marie = await t.login('marie@boreal.ca');
    assert.match((await marie.get('/a-faire')).body, /Costco/);
    assert.notStrictEqual((await marie.post(`/suggestions/${item.id}/ignorer`)).status, 303, 'un client ne touche pas aux suggestions');

    // Corrigé dans QuickBooks → synchronisation → suggestion résolue, tâche fermée.
    t.fake.st.uncategorizedLine = false;
    await staff.get(`/clients/${t.boreal.id}/quickbooks`);
    const s2 = await staff.post(`/clients/${t.boreal.id}/quickbooks/synchroniser`);
    assert.match(decodeURIComponent(s2.headers.location), /Synchronisé/);
    assert.strictEqual(t.db.prepare('SELECT status FROM qbo_items WHERE id = ?').get(item.id).status, 'resolved');
    const done = t.db.prepare('SELECT status, answer FROM tasks').get();
    assert.deepStrictEqual({ ...done }, { status: 'done', answer: 'Corrigé dans QuickBooks' });

    // Ignorer : la suggestion disparaît de la liste
    const inv = t.db.prepare("SELECT id FROM qbo_items WHERE kind = 'overdue_invoice'").get();
    await staff.get(`/clients/${t.boreal.id}/quickbooks`);
    await staff.post(`/suggestions/${inv.id}/ignorer`);
    assert.match((await staff.get(`/clients/${t.boreal.id}/quickbooks`)).body, /Rien à traiter/);
  } finally { t.app.close(); }
});

test('jetons renouvelés (rotation conservée) ; autorisation retirée → reconnexion nécessaire', async () => {
  const t = await setup();
  try {
    const staff = await t.login('owner@bvy.ca');
    const state = await connect(t, staff, t.boreal.id);
    await staff.get(`/quickbooks/retour?code=code-intuit&state=${encodeURIComponent(state)}&realmId=9130`);
    t.clock.advance(2 * 3600_000);
    await t.app.qboService.sync(t.boreal.id, 'schedule');
    assert.strictEqual(t.fake.st.refreshes, 1);
    assert.strictEqual(t.qbo.decrypt(t.db.prepare('SELECT refresh_enc FROM qbo_connections').get().refresh_enc), 'ref-2');

    t.clock.advance(2 * 3600_000);
    t.fake.st.failRefresh = true;
    const r = await t.app.qboService.syncAll({ error: () => {} });
    assert.deepStrictEqual(r, { total: 1, ok: 0 });
    const c = t.db.prepare('SELECT status, last_sync_status FROM qbo_connections').get();
    assert.deepStrictEqual({ ...c }, { status: 'needs_reconnect', last_sync_status: 'failed' });
    assert.strictEqual(JSON.parse(t.db.prepare('SELECT data FROM client_snapshots').get().data).cash.amount, 4821560, 'derniers chiffres gardés');
    const marie = await t.login('marie@boreal.ca');
    assert.match((await marie.get('/accueil')).body, /Connexion QuickBooks à renouveler/);
    const staff2 = await t.login('owner@bvy.ca'); // la première session a expiré (4 h sans activité)
    assert.match((await staff2.get(`/clients/${t.boreal.id}/quickbooks`)).body, /Reconnecter QuickBooks/);
    assert.match((await staff2.get('/accueil')).body, /Reconnexion nécessaire/);
  } finally { t.app.close(); }
});

test('sécurité : « state » lié à la personne, une entreprise QBO = un client, accès selon le rôle, déconnexion révoquée', async () => {
  const t = await setup();
  try {
    const staff = await t.login('owner@bvy.ca');
    const state = await connect(t, staff, t.boreal.id);
    // Un autre employé (assigné) ne peut pas utiliser le « state » d'un collègue
    t.db.prepare('INSERT INTO client_assignments (user_id, client_id, created_at) VALUES ((SELECT id FROM users WHERE email = ?), ?, ?)').run('julie@bvy.ca', t.boreal.id, 'x');
    const julie = await t.login('julie@bvy.ca');
    const stolen = await julie.get(`/quickbooks/retour?code=code-intuit&state=${encodeURIComponent(state)}&realmId=9130`);
    assert.match(decodeURIComponent(stolen.headers.location), /ne vient pas de vous/);
    assert.strictEqual(t.db.prepare('SELECT COUNT(*) AS n FROM qbo_connections').get().n, 0);

    const s2 = await connect(t, staff, t.boreal.id);
    await staff.get(`/quickbooks/retour?code=code-intuit&state=${encodeURIComponent(s2)}&realmId=9130`);
    const s3 = await connect(t, staff, t.autre.id);
    const dup = await staff.get(`/quickbooks/retour?code=code-intuit&state=${encodeURIComponent(s3)}&realmId=9130`);
    assert.match(decodeURIComponent(dup.headers.location), /déjà reliée à un autre client/);

    // Personnel non assigné et client : refusés
    await julie.get(`/clients/${t.autre.id}`);
    assert.strictEqual((await julie.post(`/clients/${t.autre.id}/quickbooks/connecter`)).status, 403);
    const marie = await t.login('marie@boreal.ca');
    assert.notStrictEqual((await marie.post(`/clients/${t.boreal.id}/quickbooks/synchroniser`)).status, 303);
    assert.notStrictEqual((await marie.get(`/clients/${t.boreal.id}/quickbooks`)).status, 200);

    await staff.get(`/clients/${t.boreal.id}/quickbooks`);
    const off = await staff.post(`/clients/${t.boreal.id}/quickbooks/deconnecter`);
    assert.match(decodeURIComponent(off.headers.location), /déconnecté/);
    assert.deepStrictEqual(t.fake.st.revoked, ['ref-1']);
    assert.strictEqual(t.db.prepare('SELECT COUNT(*) AS n FROM qbo_connections').get().n, 0);
    const actions = t.db.prepare("SELECT action FROM audit_logs WHERE action LIKE 'qbo.%'").all().map((r) => r.action);
    assert.ok(actions.includes('qbo.connect') && actions.includes('qbo.sync') && actions.includes('qbo.disconnect'));
  } finally { t.app.close(); }
});

test('sans application Intuit configurée : le dossier l’explique, rien ne casse', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-noqbo-'));
  const app = createServer({ port: 0, dataDir, smtp: null, publicUrl: ORIGIN, sendMail: async () => {}, qbo: null });
  try {
    assert.strictEqual(app.qboService.enabled, false);
    await assert.rejects(app.qboService.sync(1), /pas encore configuré/);
  } finally { app.close(); }
});

test('403 d’Intuit (ApplicationAuthorizationFailed, format « fault » minuscule) : message clair, référence Intuit, rien n’est effacé', async () => {
  const t = await setup();
  try {
    const staff = await t.login('owner@bvy.ca');
    t.fake.st.forbid = true;
    const state = await connect(t, staff, t.boreal.id);
    const back = await staff.get(`/quickbooks/retour?code=code-intuit&state=${encodeURIComponent(state)}&realmId=9130`);
    const msg = decodeURIComponent(back.headers.location);
    assert.match(msg, /QuickBooks est connecté\. La première synchronisation a échoué : Synchronisation en échec : QuickBooks 403 : Intuit refuse l’accès/);
    assert.match(msg, /entreprise d’essai \(sandbox\)/);
    assert.match(msg, /réf\. Intuit 1-abc/);
    assert.ok(!/: erreur/.test(msg), 'plus de « erreur » sans explication');
    const conn = t.db.prepare('SELECT status, last_sync_status FROM qbo_connections').get();
    assert.strictEqual(conn.last_sync_status, 'failed');
  } finally { t.app.close(); }
});
