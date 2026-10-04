'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server.js');
const { historySuggest } = require('../lib/classify.js');

const ORIGIN = 'https://portail.bvyaccountingtax.ca';
const PW = 'une phrase assez longue';
const NOW = Date.UTC(2026, 9, 5, 14, 0);
const N = (x) => String(x).replace(/[  ]/g, ' ');

// Fausse IA : garde ce qui lui est envoyé, répond selon le bénéficiaire
const sent = [];
const fakeAi = {
  model: 'faux-modele',
  async classify(lines, accounts) {
    sent.push({ lines, accounts });
    return { model: 'faux-modele', usage: { input_tokens: 900, output_tokens: 120 }, results: lines.map((l) => (
      /amazon/i.test(l.party) ? { ref: l.ref, account_id: '64', confidence: 91, reason: 'Achats en ligne de fournitures pour le bureau.' }
        : /mystere/i.test(l.party) ? { ref: l.ref, account_id: 'aucun', confidence: 20, reason: 'Impossible de savoir.' }
          : { ref: l.ref, account_id: '9999', confidence: 99, reason: 'Compte inventé.' })) };
  },
};

test('classement : règle de l’historique (80 % d’au moins 3 paiements)', () => {
  assert.deepStrictEqual(historySuggest([{ account_id: '60', n: 14, total_cents: 1 }, { account_id: '61', n: 1, total_cents: 1 }]), { accountId: '60', confidence: 93, n: 15, count: 14 });
  assert.strictEqual(historySuggest([{ account_id: '60', n: 2, total_cents: 1 }]), null, 'moins de 3');
  assert.strictEqual(historySuggest([{ account_id: '60', n: 3, total_cents: 1 }, { account_id: '61', n: 1, total_cents: 1 }]), null, '75 %');
  assert.strictEqual(historySuggest([{ account_id: '60', n: 4, total_cents: 1 }]).confidence, 95, '100 % moins 5 points sous 5 paiements');
});

async function setup() {
  const mails = [];
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-rc-'));
  const app = createServer({ port: 0, dataDir, smtp: null, publicUrl: ORIGIN, sendMail: async (m) => { mails.push(m); }, now: () => NOW, ai: fakeAi });
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
  const soc = acc.createClient(admin, 'Atelier Boréal inc.');
  const jean = acc.createClient(admin, 'Jean Tremblay');
  mk('marie@boreal.ca', 'Marie Bouchard', 'client', soc.id);
  const lise = mk('lise@bvy.ca', 'Lise Comptable', 'bookkeeper');
  acc.setAssignment(admin, lise.id, soc.id, true);
  return { app, mails, login, admin, soc, jean };
}

const loc = (r) => decodeURIComponent(r.headers.location || '');

test('classement de bout en bout : historique, IA validée, regroupement, décisions, rôles', async () => {
  const { app, login, admin, soc, jean } = await setup();
  const db = app.db; const cl = app.classifier;
  try {
    cl.saveChart(soc.id, [{ Id: '60', Name: 'Repas et représentation', AccountType: 'Expense' }, { Id: '64', Name: 'Fournitures de bureau', AccountType: 'Expense' },
      { Id: '80', Name: 'Dépenses non catégorisées', AccountType: 'Expense' }, { Id: '1', Name: 'Desjardins', AccountType: 'Bank' }]);
    cl.saveHistory(soc.id, [1, 2, 3, 4, 5, 6].map((i) => ({ party: 'Costco', accountId: i < 6 ? '60' : '64', amount: 10000, date: `2026-0${i}-10` })));
    const item = (qid, party, amount, detail) => Number(db.prepare(`INSERT INTO qbo_items (client_id, kind, qbo_type, qbo_id, txn_date, amount_cents, counterparty, detail, qbo_url, first_seen, last_seen)
      VALUES (?, 'uncategorized', 'Purchase', ?, '2026-09-14', ?, ?, ?, ?, ?, ?)`).run(soc.id, qid, amount, party, detail, `https://app.qbo.intuit.com/app/expense?txnId=${qid}`, 'x', 'x').lastInsertRowid);
    item('1', 'Amazon', 4299, 'AMZN Mktp CA'); item('2', 'Amazon', 12850, null); item('3', 'AMAZON', 2105, null);
    item('4', 'Costco', 84237, 'Achat magasin'); item('5', 'Costco', 15000, null);
    item('6', 'Mystère inc.', 50000, null); item('7', 'Inventé ltée', 1000, null);

    // IA désactivée par défaut : seulement l'historique, l'IA n'est pas appelée
    let r = await cl.classifyClient(soc.id);
    assert.deepStrictEqual(r, { history: 2, ai: 0 });
    assert.strictEqual(sent.length, 0);
    const owner = await login('owner@bvy.ca');
    r = await owner.get(`/clients/${soc.id}/classement`);
    assert.match(N(r.body), /Costco — 2 opérations non classées — 992,37 \$/);
    assert.match(r.body, /Catégorie proposée : <b>Repas et représentation<\/b> · confiance 83 %/);
    assert.match(r.body, /d’après l’historique du dossier — 5 paiements sur 6 à Costco classés en « Repas et représentation »/);
    assert.match(r.body, /IA désactivée par l’administrateur/);

    // Réglages : administrateur seulement, seuils validés
    const lise = await login('lise@bvy.ca');
    r = await lise.post('/admin/ia', { aiEnabled: '1', strong: '95', suggest: '75' });
    assert.strictEqual(r.status, 403);
    r = await owner.post('/admin/ia', { aiEnabled: '1', strong: '70', suggest: '75' });
    assert.match(loc(r), /Seuils invalides/);
    r = await owner.post('/admin/ia', { aiEnabled: '1', strong: '95', suggest: '75' });
    assert.match(loc(r), /Réglages de l’IA enregistrés/);

    // Relance : l'IA reçoit seulement le reste, sans le nom du client ; une réponse hors du plan comptable est rejetée
    r = await owner.post(`/clients/${soc.id}/classement/relancer`);
    assert.match(loc(r), /2 par l’historique, 3 par l’IA|0 par l’historique, 3 par l’IA/);
    assert.strictEqual(sent.length, 1);
    assert.deepStrictEqual(sent[0].lines.map((l) => l.party).sort(), ['AMAZON', 'Amazon', 'Amazon', 'Inventé ltée', 'Mystère inc.']);
    assert.doesNotMatch(JSON.stringify(sent[0]), /Atelier|Boréal|Marie/, 'jamais le nom du client');
    assert.ok(!sent[0].accounts.some((a) => a.type === 'Bank'), 'pas les comptes bancaires dans le plan proposé');
    const sug = (qid) => db.prepare("SELECT s.* FROM ai_suggestions s JOIN qbo_items i ON i.id = s.item_id WHERE i.qbo_id = ?").get(qid);
    assert.strictEqual(sug('1').source, 'ai'); assert.strictEqual(sug('1').account_name, 'Fournitures de bureau'); assert.strictEqual(sug('1').confidence, 91);
    assert.strictEqual(sug('6').source, 'none'); assert.strictEqual(sug('7').source, 'none', 'compte inventé rejeté');
    const call = db.prepare('SELECT * FROM ai_calls').get();
    assert.strictEqual(call.items, 5); assert.strictEqual(call.ok, 1); assert.strictEqual(call.input_tokens, 900);

    // Regroupement par bénéficiaire et niveaux
    r = await owner.get(`/clients/${soc.id}/classement`);
    assert.match(N(r.body), /Amazon — 3 opérations non classées — 192,54 \$/);
    assert.match(r.body, /Fournitures de bureau<\/b> · confiance 91 % <span class="badge b-info">Suggestion<\/span>/);
    assert.match(r.body, /Mystère inc\. — 1 opération[\s\S]*Validation requise/);
    assert.match(r.body, /IA active \(faux-modele\)/);

    // Décisions : accepter, choisir, annuler ; « À faire dans QuickBooks »
    const g = (party) => cl.groups(admin, soc.id).find((x) => x.party.toLowerCase().startsWith(party));
    r = await owner.post(`/clients/${soc.id}/classement`, { group: g('amazon').key, action: 'accept' });
    assert.match(loc(r), /3 opérations de Amazon à classer en « Fournitures de bureau » dans QuickBooks/);
    r = await owner.post(`/clients/${soc.id}/classement`, { group: g('myst').key, action: 'choose', accountId: '9999' });
    assert.match(loc(r), /Choisissez un compte du plan comptable/);
    r = await owner.post(`/clients/${soc.id}/classement`, { group: g('myst').key, action: 'choose', accountId: '60' });
    assert.strictEqual(sug('6').status, 'chosen'); assert.strictEqual(sug('6').chosen_account_name, 'Repas et représentation'); assert.strictEqual(sug('6').decided_by, admin.id);
    r = await owner.get(`/clients/${soc.id}/classement`);
    assert.match(r.body, /À faire dans QuickBooks[\s\S]*Amazon — 3 opérations/);
    r = await owner.post(`/clients/${soc.id}/classement`, { group: g('myst').key, action: 'undo' });
    assert.strictEqual(sug('6').status, 'new');
    const auditRow = db.prepare("SELECT details FROM audit_logs WHERE action = 'ai.accept'").get();
    assert.match(auditRow.details, /"suggested":"Fournitures de bureau".*"confidence":91.*"source":"ai"/);

    // Fait dans QuickBooks : la synchronisation résout les opérations, elles quittent la liste
    db.prepare("UPDATE qbo_items SET status = 'resolved' WHERE qbo_id IN ('1','2','3')").run();
    await cl.classifyClient(soc.id);
    assert.strictEqual(sug('1').status, 'done');
    r = await owner.get(`/clients/${soc.id}/classement`);
    assert.doesNotMatch(r.body, /Amazon/);
    assert.strictEqual(sent.length, 1, 'l’IA n’est pas rappelée pour ce qui a déjà une proposition');

    // Rôles et isolation
    r = await lise.get(`/clients/${soc.id}/classement`);
    assert.strictEqual(r.status, 200);
    r = await lise.get(`/clients/${jean.id}/classement`);
    assert.strictEqual(r.status, 403);
    const marie = await login('marie@boreal.ca');
    r = await marie.get(`/clients/${soc.id}/classement`);
    assert.notStrictEqual(r.status, 200);
    r = await owner.get('/admin/ia');
    assert.match(r.body, /Derniers appels à l’IA[\s\S]*Atelier Boréal inc\./);
  } finally { app.close(); }
});
