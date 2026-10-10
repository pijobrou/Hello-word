'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server.js');
const { desjardinsPdf } = require('./pdf-fixture.js');

const ORIGIN = 'https://portail.bvyaccountingtax.ca';
const PW = 'une phrase assez longue';
const NOW = Date.UTC(2025, 9, 6, 14, 0);
const N = (x) => String(x).replace(/[  ]/g, ' ');

// Relevé FICTIF de type Desjardins (septembre 2025)
const DJ = { opening: 110085, lines: [
  { day: '1 SEP', code: 'DI', desc: 'Dépôt direct / CLIENT FICTIF', amount: 2578534 },
  { day: '1 SEP', code: 'PWW', desc: 'Paiement facture - AccèsD Internet /', more: 'HYDRO ENTREPRISE', amount: -150000 },
  { day: '2 SEP', code: 'RA', desc: 'Câble / VIDEOTRON LTEE', amount: -49294 },
  { day: '4 SEP', code: 'DCN', desc: 'Chèque no 388', amount: -582016 },
  { day: '4 SEP', code: 'DCN', desc: 'Chèque no 389', amount: -2500000 },
  { day: '12 SEP', code: 'CT', desc: 'Dépôt / VENTES DE LA SEMAINE', amount: 310000 },
  { day: '22 SEP', code: 'ACH', desc: 'Achat / RESTO LE GODEFROY', amount: -3677 },
  { day: '30 SEP', code: 'FIX', desc: "Frais fixes d'utilisation", amount: -7050 },
] };


// QuickBooks FICTIF en mémoire : lecture, création, modification, suppression ; taxes simulées (+14,975 %) si demandé
const FAKE = { store: {}, next: 500, calls: [], taxBump: false };
FAKE.api = { withToken: async (cid, fn) => fn({ realm: 'r1', token: 't', appBase: 'https://app.qbo.intuit.com', qbo: {
  get: async (realm, p) => { const [path, id] = p.split('/'); const T = { purchase: 'Purchase', deposit: 'Deposit' }[path]; const o = FAKE.store[`${T}:${id}`]; if (!o) throw new Error('introuvable'); FAKE.calls.push(['get', T, id]); return { [T]: JSON.parse(JSON.stringify(o)) }; },
  post: async (realm, path, token, obj, params) => {
    const T = { purchase: 'Purchase', deposit: 'Deposit' }[path];
    FAKE.calls.push([params && params.operation === 'delete' ? 'delete' : (obj.Id ? 'update' : 'create'), T, obj.Id || null]);
    if (params && params.operation === 'delete') { delete FAKE.store[`${T}:${obj.Id}`]; return { [T]: { Id: obj.Id, status: 'Deleted' } }; }
    const o = JSON.parse(JSON.stringify(obj));
    if (!o.Id) { o.Id = String(FAKE.next++); o.SyncToken = '0'; } else o.SyncToken = String(Number(o.SyncToken || 0) + 1);
    const sum = o.Line.reduce((t, l) => t + Math.round(l.Amount * 100), 0);
    o.TotalAmt = (FAKE.taxBump && o.GlobalTaxCalculation ? Math.round(sum * 1.14975) : sum) / 100;
    FAKE.store[`${T}:${o.Id}`] = o; return { [T]: o };
  } } }) };
const ledgerCalls = [];
let LEDGER = [];
async function setup() {
  const mails = [];
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-rc-'));
  const app = createServer({ port: 0, dataDir, smtp: null, publicUrl: ORIGIN, sendMail: async (m) => { mails.push(m); }, now: () => NOW, qboApi: FAKE.api, ledger: async (...args) => { ledgerCalls.push(args); return LEDGER; } });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const port = app.address().port;
  function agent() {
    let cookie = ''; let csrf = '';
    function send(method, p, body, type) {
      const h = { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': type, 'Content-Length': body.length, Origin: ORIGIN } : {}) };
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
    const req = (method, p, form) => send(method, p, form ? Buffer.from(new URLSearchParams({ ...form, _csrf: csrf }).toString()) : null, 'application/x-www-form-urlencoded');
    function upload(p, fields, file) {
      const b = '----bvy' + Math.random().toString(16).slice(2);
      const parts = Object.entries({ ...fields, _csrf: csrf }).map(([k, v]) => Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
      parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: application/pdf\r\n\r\n`), file.data, Buffer.from(`\r\n--${b}--\r\n`));
      return send('POST', p, Buffer.concat(parts), `multipart/form-data; boundary=${b}`);
    }
    return { req, upload, get: (p) => req('GET', p), post: (p, f = {}) => req('POST', p, f) };
  }
  async function login(email) {
    const a = agent();
    await a.get('/connexion');
    await a.req('POST', '/connexion', { email, password: PW });
    await a.get('/verification');
    const r = await a.post('/verification', { method: 'email', code: mails.filter((m) => /code BVY/.test(m.subject)).pop().subject.match(/(\d{6})/)[1] });
    assert.strictEqual(r.headers.location, '/accueil');
    await a.get('/accueil');
    return a;
  }
  const acc = app.accounts;
  const mk = (email, name, role, clientId) => { const { token } = acc.invite(null, { email, name, role, clientId }); return acc.acceptInvite(token, PW); };
  const admin = mk('owner@bvy.ca', 'Pierre Owner', 'admin');
  const soc = acc.createClient(admin, 'Résidence Fictive inc.');
  const other = acc.createClient(admin, 'Autre client');
  mk('marie@fictive.ca', 'Marie Client', 'client', soc.id);
  const lise = mk('lise@bvy.ca', 'Lise Comptable', 'bookkeeper');
  acc.setAssignment(admin, lise.id, soc.id, true);
  app.classifier.saveChart(soc.id, [{ Id: '35', Name: 'Desjardins EOP', AccountType: 'Bank' }, { Id: '60', Name: 'Repas', AccountType: 'Expense' }]);
  return { app, login, soc, other };
}

const loc = (r) => decodeURIComponent(r.headers.location || '');

test('écriture dans QuickBooks : créer, corriger, classer, annuler, vérifications et rôles', async () => {
  const { app, login, soc } = await setup();
  const db = app.db; const cl = app.classifier;
  const q = (id, date, amount, type, name, docNum) => ({ type, id, date, amount, name, memo: null, docNum: docNum || null, url: `https://app.qbo.intuit.com/app/x?txnId=${id}` });
  cl.saveChart(soc.id, [{ Id: '35', Name: 'Desjardins EOP', AccountType: 'Bank' }, { Id: '60', Name: 'Repas', AccountType: 'Expense' }, { Id: '61', Name: 'Frais bancaires', AccountType: 'Expense' },
    { Id: '80', Name: 'Dépenses non catégorisées', AccountType: 'Expense' }]);
  cl.saveTaxCodes(soc.id, [{ Id: '7', Name: 'TPS/TVQ QC - 9,975' }, { Id: '9', Name: 'Exonéré' }]);
  cl.saveHistory(soc.id, [1, 2, 3].map((i) => ({ party: 'Resto le Godefroy', accountId: '60', amount: 3000, date: `2025-0${i}-10`, taxCode: '7' })));
  // Chèque 388 inscrit 5 800,16 $ dans QuickBooks, 5 820,16 $ au relevé
  FAKE.store['Purchase:4'] = { Id: '4', SyncToken: '3', TotalAmt: 5800.16, Line: [{ Amount: 5800.16, DetailType: 'AccountBasedExpenseLineDetail', AccountBasedExpenseLineDetail: { AccountRef: { value: '61' } } }] };
  LEDGER = [q('1', '2025-09-01', 2578534, 'Dépôt', 'CLIENT FICTIF'), q('2', '2025-09-01', -150000, 'Paiement de facture', 'Hydro'),
    q('3', '2025-09-02', -49294, 'Dépense', 'Vidéotron'), q('4', '2025-09-04', -580016, 'Chèque', 'Fournisseur', '388'),
    q('5', '2025-09-04', -2500000, 'Chèque', 'Fournisseur', '389'), q('6', '2025-09-12', 310000, 'Dépôt', 'Ventes')];
  try {
    const owner = await login('owner@bvy.ca');
    // Compte bancaire retenu : le seul compte bancaire du client, sans avoir à le choisir
    let r = await owner.upload(`/clients/${soc.id}/conciliation`, { docId: '' }, { name: 'releve.pdf', data: desjardinsPdf(DJ) });
    assert.match(r.headers.location || '', /^\/conciliations\/\d+\?ok=/, decodeURIComponent(r.headers.location || ''));
    const rid = Number(r.headers.location.match(/\d+/)[0]);
    const ex = () => JSON.parse(db.prepare('SELECT result FROM reconciliations WHERE id = ?').get(rid).result).exceptions;
    assert.deepStrictEqual(ex().map((e) => e.kind).sort(), ['amount', 'missing', 'missing']);
    r = await owner.get(`/conciliations/${rid}`);
    assert.match(r.body, /Créer dans QuickBooks/);
    assert.match(r.body, /Corriger dans QuickBooks/);
    assert.match(r.body, /<option value="60" selected>Repas<\/option>/, 'catégorie proposée d’après l’historique');
    assert.match(r.body, /<option value="7" selected>/, 'taxes habituelles proposées');
    assert.match(r.body, /creer-tout/);

    // Créer une ligne : total vérifié ; si QuickBooks calcule un autre total, l'opération est supprimée aussitôt
    const resto = ex().find((e) => /GODEFROY/.test(e.stmt.desc));
    FAKE.taxBump = true;
    r = await owner.post(`/conciliations/${rid}/creer`, { key: resto.key, accountId: '60', taxCodeId: '7' });
    assert.match(loc(r), /rien n’a été créé/);
    assert.strictEqual(Object.keys(FAKE.store).filter((k) => k.startsWith('Purchase:5')).length, 0, 'opération défaite');
    assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM qbo_writes').get().n, 0);
    FAKE.taxBump = false;
    r = await owner.post(`/conciliations/${rid}/creer`, { key: resto.key, accountId: '60', taxCodeId: '7' });
    assert.match(loc(r), /Créé dans QuickBooks : Repas/);
    const made = Object.values(FAKE.store).find((o) => o.TotalAmt === 36.77);
    assert.strictEqual(made.AccountRef.value, '35'); assert.strictEqual(made.TxnDate, '2025-09-22'); assert.strictEqual(made.GlobalTaxCalculation, 'TaxInclusive');
    assert.strictEqual(made.Line[0].AccountBasedExpenseLineDetail.TaxCodeRef.value, '7');
    assert.strictEqual(ex().find((e) => e.key === resto.key).done, true);
    r = await owner.post(`/conciliations/${rid}/creer`, { key: resto.key, accountId: '60' });
    assert.match(loc(r), /déjà réglée/);

    // Corriger le montant du chèque 388
    const amt = ex().find((e) => e.kind === 'amount');
    r = await owner.post(`/conciliations/${rid}/corriger`, { key: amt.key });
    assert.match(loc(r), /Montant corrigé dans QuickBooks/);
    assert.strictEqual(FAKE.store['Purchase:4'].TotalAmt, 5820.16);

    // Annuler : le montant revient, la ligne redevient à régler
    const w = db.prepare("SELECT * FROM qbo_writes WHERE action = 'amount'").get();
    r = await owner.post(`/quickbooks/ecritures/${w.id}/annuler`, { back: `/conciliations/${rid}` });
    assert.match(loc(r), /Écriture annulée/);
    assert.strictEqual(FAKE.store['Purchase:4'].TotalAmt, 5800.16);
    assert.strictEqual(ex().find((e) => e.key === amt.key).done, false);
    r = await owner.post(`/quickbooks/ecritures/${w.id}/annuler`, { back: `/conciliations/${rid}` });
    assert.match(loc(r), /déjà annulée/);
    // Annuler une création : supprimée dans QuickBooks
    const wc = db.prepare("SELECT * FROM qbo_writes WHERE action = 'create'").get();
    await owner.post(`/quickbooks/ecritures/${wc.id}/annuler`, { back: `/conciliations/${rid}` });
    assert.ok(!FAKE.store[`Purchase:${wc.qbo_id}`]);

    // Tout créer : seulement les lignes avec une catégorie proposée (le restaurant) ; les frais restent à choisir
    r = await owner.post(`/conciliations/${rid}/creer-tout`);
    assert.match(loc(r), /1 opération créée dans QuickBooks/);
    assert.strictEqual(ex().filter((e) => e.kind === 'missing' && !e.done).length, 1);

    // Classer un groupe « non catégorisé » directement dans QuickBooks
    FAKE.store['Purchase:900'] = { Id: '900', SyncToken: '0', TotalAmt: 42.99, Line: [{ Amount: 42.99, DetailType: 'AccountBasedExpenseLineDetail', AccountBasedExpenseLineDetail: { AccountRef: { value: '80' } } }] };
    db.prepare(`INSERT INTO qbo_items (client_id, kind, qbo_type, qbo_id, txn_date, amount_cents, counterparty, qbo_url, first_seen, last_seen)
      VALUES (?, 'uncategorized', 'Purchase', '900', '2025-09-14', 4299, 'Resto le Godefroy', 'https://app.qbo.intuit.com/app/expense?txnId=900', 'x', 'x')`).run(soc.id);
    await cl.classifyClient(soc.id);
    r = await owner.get(`/clients/${soc.id}/classement`);
    assert.match(r.body, /Classer dans QuickBooks<\/button>/);
    const group = r.body.match(/name="group" value="([^"]+)"/)[1];
    r = await owner.post(`/clients/${soc.id}/classement`, { group: group.replace(/&#39;/g, "'").replace(/&amp;/g, '&'), action: 'write', accountId: '60', taxCodeId: '7' });
    assert.match(loc(r), /1 opération de Resto le Godefroy classée dans QuickBooks/);
    assert.strictEqual(FAKE.store['Purchase:900'].Line[0].AccountBasedExpenseLineDetail.AccountRef.value, '60');
    assert.strictEqual(db.prepare("SELECT status FROM qbo_items WHERE qbo_id = '900'").get().status, 'resolved');
    const wr = db.prepare("SELECT * FROM qbo_writes WHERE action = 'recategorize'").get();
    await owner.post(`/quickbooks/ecritures/${wr.id}/annuler`, { back: `/clients/${soc.id}/classement` });
    assert.strictEqual(FAKE.store['Purchase:900'].Line[0].AccountBasedExpenseLineDetail.AccountRef.value, '80');
    assert.strictEqual(db.prepare("SELECT status FROM qbo_items WHERE qbo_id = '900'").get().status, 'new');

    // Réception : un relevé reçu se concilie en un clic (compte bancaire retenu pour ce client)
    const docId = Number(db.prepare("SELECT id FROM documents WHERE doc_type = 'releve_banque' ORDER BY id LIMIT 1").get().id);
    db.prepare("UPDATE documents SET filed = 0, suggested = 'releve_banque' WHERE id = ?").run(docId);
    r = await owner.get('/reception');
    assert.match(r.body, /Relevé bancaire : concilier maintenant/);
    r = await owner.post(`/clients/${soc.id}/conciliation`, { docId: String(docId) });
    assert.match(loc(r), /^\/conciliations\/\d+\?ok=Relevé comparé/);

    // Interrupteur de l'administrateur : plus aucun bouton ni écriture
    r = await owner.post('/admin/suggestions/ecriture', { on: '0' });
    assert.match(loc(r), /Écriture dans QuickBooks désactivée/);
    r = await owner.get(`/conciliations/${rid}`);
    assert.doesNotMatch(r.body, /Créer dans QuickBooks/);
    r = await owner.post(`/conciliations/${rid}/creer-tout`);
    assert.match(loc(r), /désactivée par l’administrateur/);
    await owner.post('/admin/suggestions/ecriture', { on: '1' });
    const lise = await login('lise@bvy.ca');
    r = await lise.post('/admin/suggestions/ecriture', { on: '0' });
    assert.notStrictEqual(r.status, 302);
    // Le client ne peut rien écrire
    const marie = await login('marie@fictive.ca');
    const live = db.prepare('SELECT * FROM qbo_writes WHERE undone_at IS NULL').get();
    r = await marie.post(`/quickbooks/ecritures/${live.id}/annuler`, {});
    assert.doesNotMatch(loc(r), /annulée/);
    assert.strictEqual(db.prepare('SELECT undone_at FROM qbo_writes WHERE id = ?').get(live.id).undone_at, null, 'le client ne peut rien annuler');
    assert.ok(db.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action LIKE 'qbo.write.%'").get().n >= 5, 'chaque écriture est au journal');
    assert.doesNotMatch(r.body.replace(/<[^>]+>/g, ' '), /\bIA\b|[Cc]laude/);
  } finally { app.close(); }
});
