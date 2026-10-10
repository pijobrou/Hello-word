'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server.js');
const { computeHealth } = require('../lib/health.js');

const ORIGIN = 'https://portail.bvyaccountingtax.ca';
const PW = 'une phrase assez longue';
const T0 = Date.UTC(2026, 9, 5, 14, 0); // lundi 2026-10-05
let NOW = T0;
// Espaces insécables du format français (milliers, devise) → espaces simples, pour des expressions lisibles
const N = (x) => String(x).replace(/[\u00a0\u202f]/g, ' ');
const match = (x, re, m) => assert.match(N(x), re, m);
const noMatch = (x, re, m) => assert.doesNotMatch(N(x), re, m);
const pick = (h, k) => (h.indicators.find((i) => i.key === k) || {});
const snapOf = (o) => ({ cash: { amount: o.cash }, payable: { amount: o.pay ?? 0 }, receivable: { amount: o.recv ?? null }, late: o.late === undefined ? null : { amount: o.late },
  pl: o.inc ? { months: ['2026-08', '2026-09'], income: o.inc, expenses: o.exp } : null });

test('santé : seuils de chaque indicateur, état global = le pire, données manquantes omises', () => {
  assert.strictEqual(pick(computeHealth({ snap: snapOf({ cash: -100 }) }), 'cash').state, 'action');
  assert.strictEqual(pick(computeHealth({ snap: snapOf({ cash: 500000, pay: 600000 }) }), 'cash').state, 'action');
  let h = computeHealth({ snap: snapOf({ cash: 800000, pay: 200000, inc: [1500000, 1500000], exp: [1000000, 1000000] }) });
  assert.strictEqual(pick(h, 'cash').state, 'watch');
  match(pick(h, 'cash').why, /moins d’un mois de dépenses \(10 000,00 \$ en septembre 2026\)/);
  h = computeHealth({ snap: snapOf({ cash: 3000000, inc: [1500000, 1500000], exp: [1000000, 1000000] }) });
  assert.strictEqual(pick(h, 'cash').state, 'good');
  match(pick(h, 'cash').why, /environ 3 mois de dépenses/);
  assert.strictEqual(pick(computeHealth({ snap: snapOf({ cash: 1, inc: [100, 100], exp: [200, 200] }) }), 'profit').state, 'action');
  h = computeHealth({ snap: snapOf({ cash: 1, inc: [4000000, 3600000], exp: [3000000, 3900000] }) });
  assert.strictEqual(pick(h, 'profit').state, 'watch');
  match(pick(h, 'profit').why, /Perte de 3 000,00 \$ en septembre 2026 \(bénéfice de 10 000,00 \$ le mois d’avant\)/);
  assert.strictEqual(pick(h, 'expenses').state, 'watch', '+30 %');
  assert.strictEqual(pick(computeHealth({ snap: snapOf({ cash: 1, inc: [1, 2], exp: [1000, 1100] }) }), 'expenses').state, 'good', '+10 %');
  assert.strictEqual(pick(computeHealth({ snap: snapOf({ cash: 1, recv: 1000, late: 500 }) }), 'receivable').state, 'action');
  assert.strictEqual(pick(computeHealth({ snap: snapOf({ cash: 1, recv: 1000, late: 200 }) }), 'receivable').state, 'watch');
  assert.strictEqual(pick(computeHealth({ snap: snapOf({ cash: 1, recv: 1000, late: 100 }) }), 'receivable').state, 'good');
  const d = (days, title = 'Déclaration de TPS/TVQ') => ({ title, date: '2026-10-10', urgency: { days } });
  assert.strictEqual(pick(computeHealth({ dl: [d(-2), d(3)] }), 'taxes').state, 'action');
  assert.strictEqual(pick(computeHealth({ dl: [d(3)] }), 'taxes').state, 'watch');
  assert.strictEqual(pick(computeHealth({ dl: [d(40)], gov: [{ due_date: '2026-10-28' }] }), 'taxes').state, 'watch');
  match(pick(computeHealth({ dl: [d(40)] }), 'taxes').why, /Rien en retard\. Prochaine obligation : Déclaration de TPS\/TVQ/);
  assert.strictEqual(pick(computeHealth({ pay: { enabled: true, atRisk: [{ pay_date: '2026-10-06' }], dasLate: false } }), 'payroll').state, 'action');
  h = computeHealth({ snap: snapOf({ cash: 3000000 }) });
  assert.deepStrictEqual(h.indicators.map((i) => i.key), ['cash'], 'pas de rentabilité ni de clients sans données');
  assert.strictEqual(h.overall, 'good');
  assert.strictEqual(computeHealth({}).overall, null);
  assert.strictEqual(computeHealth({ snap: snapOf({ cash: 3000000, inc: [100, 100], exp: [200, 200] }), dl: [d(3)] }).overall, 'action');
});

async function setup() {
  const mails = [];
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-rc-'));
  const app = createServer({ port: 0, dataDir, smtp: null, publicUrl: ORIGIN, sendMail: async (m) => { mails.push(m); }, now: () => NOW });
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
  const cons = acc.createClient(admin, 'Construction Laurentides ltée');
  app.workqueue.saveProfile(admin, soc.id, { kind: 'entreprise', yearEndMonth: '12' });
  app.db.prepare("UPDATE clients SET profile_since = '2026-01-01'").run();
  mk('marie@boreal.ca', 'Marie Bouchard', 'client', soc.id);
  mk('marc@laurentides.ca', 'Marc Pelletier', 'client', cons.id);
  const lise = mk('lise@bvy.ca', 'Lise Comptable', 'bookkeeper');
  acc.setAssignment(admin, lise.id, soc.id, true);
  return { app, mails, login, admin, soc, jean, cons };
}

const flush = () => new Promise((r) => setTimeout(r, 30));
const loc = (r) => decodeURIComponent(r.headers.location || '');

test('santé et résumés de bout en bout', async () => {
  NOW = T0;
  const { app, mails, login, admin, soc, jean, cons } = await setup();
  const db = app.db;
  const at = (d) => `${d}T15:00:00.000Z`;
  try {
    db.prepare('INSERT INTO client_snapshots (client_id, data, updated_at, source) VALUES (?, ?, ?, ?)').run(soc.id, JSON.stringify({
      asOf: '2026-10-05', cash: { amount: 4812000 }, receivable: { amount: 1000000 }, payable: { amount: 930000 }, late: { count: 0, amount: 0 },
      pl: { months: ['2026-08', '2026-09'], income: [4000000, 3600000], expenses: [3000000, 3900000] },
      changes: [{ what: 'Revenus de septembre 2026 : 36 000,00 $ (− 10 %)', why: 'Comparé à août 2026 (40 000,00 $), selon QuickBooks.' }], work: [] }), at('2026-10-05'), 'qbo');
    // Activité de septembre (et une d'août, hors période)
    const marie = db.prepare("SELECT * FROM users WHERE email = 'marie@boreal.ca'").get();
    const doc = app.portal.saveDocument(marie, soc.id, { name: 'Releve 2026-09.pdf', data: Buffer.from('%PDF-1.4\n% a\n') }, {});
    db.prepare('UPDATE documents SET filed = 1, filed_at = ? WHERE id = ?').run(at('2026-09-12'), doc);
    const q = app.portal.createTask(admin, soc.id, { kind: 'question', title: 'Paiement Costco ?' });
    db.prepare("UPDATE tasks SET status = 'done', answer = 'Oui', answered_by = ?, answered_at = ? WHERE id = ?").run(marie.id, at('2026-09-20'), q);
    const g = app.gov.create(admin, soc.id, { agency: 'rq', kind: 'documents', program: 'taxes', letterDate: '2026-09-01', dueDate: '2026-09-30', summary: 'Demande de documents TPS/TVQ.' });
    db.prepare("INSERT INTO gov_request_events (request_id, from_status, to_status, user_id, at) VALUES (?, 'ready', 'sent', ?, ?)").run(g, admin.id, at('2026-09-25'));
    db.prepare("UPDATE gov_requests SET status = 'sent' WHERE id = ?").run(g);
    db.prepare("INSERT INTO anomalies (client_id, type, severity, source, ref, title, explanation, action, status, first_seen, last_seen) VALUES (?, 'cash', 'urgent', 'rule', 'x', 't', 'e', 'a', 'resolved', ?, ?)").run(soc.id, at('2026-08-01'), at('2026-08-30'));
    db.prepare("INSERT INTO anomaly_events (anomaly_id, from_status, to_status, at) VALUES (last_insert_rowid(), 'open', 'resolved', ?)").run(at('2026-08-30'));

    // Santé : onglet de l'équipe et accueil du client
    const owner = await login('owner@bvy.ca');
    let r = await owner.get(`/clients/${soc.id}/sante`);
    match(r.body, /Rentabilité<\/b> · À surveiller/);
    match(r.body, /Perte de 3 000,00 \$ en septembre 2026/);
    const marieA = await login('marie@boreal.ca');
    r = await marieA.get('/accueil');
    match(r.body, /Santé financière <span class="badge b-watch">/);
    match(r.body, /Dépenses de septembre 2026 en hausse de 30 %/);
    r = await owner.post(`/clients/${soc.id}/sante`, { state: 'good', why: '', comment: '' });
    match(loc(r), /Expliquez toujours l’état choisi/);
    r = await owner.post(`/clients/${soc.id}/sante`, { state: 'good', why: 'La perte de septembre vient d’un achat d’équipement payé comptant ; la trésorerie reste solide.', comment: 'On en parle à notre rencontre du 15 octobre.' });
    r = await marieA.get('/accueil');
    match(r.body, /Santé financière <span class="badge b-good">/);
    match(r.body, /achat d’équipement payé comptant[\s\S]*Évaluée par BVY \(Pierre Owner\) le 2026-10-05/);
    match(r.body, /Le mot de BVY :<\/b> On en parle à notre rencontre du 15 octobre/);

    // Brouillons mensuels : le 3 du mois et après, seulement pour les clients qui ont un accès
    app.payrollTick(); await flush();
    const drafts = db.prepare("SELECT * FROM summaries WHERE period_type = 'month'").all();
    assert.deepStrictEqual(drafts.map((x) => x.client_id).sort(), [soc.id, cons.id].sort());
    const sum = drafts.find((x) => x.client_id === soc.id);
    assert.strictEqual(sum.label, 'Septembre 2026'); assert.strictEqual(sum.status, 'draft');
    match(sum.intro, /^En septembre 2026, vos revenus ont été de 36 000,00 \$ et vos dépenses de 39 000,00 \$ : une perte de 3 000,00 \$\.$/);
    const data = JSON.parse(sum.data);
    assert.deepStrictEqual(data.bvy, [{ label: 'Documents reçus et classés', n: 1 }, { label: 'Questions réglées avec vous', n: 1 }, { label: 'Réponses envoyées au gouvernement', n: 1 }]);
    assert.strictEqual(data.balances.cash, 4812000);
    app.payrollTick(); await flush();
    assert.strictEqual(db.prepare("SELECT COUNT(*) AS n FROM summaries WHERE period_type = 'month'").get().n, 2, 'pas de doublon');

    // Non publié : invisible pour le client
    r = await marieA.get('/rapports');
    noMatch(r.body, /Septembre 2026/);
    r = await marieA.get(`/rapports/resume/${sum.id}`);
    assert.strictEqual(r.status, 404);

    // Relire, publier ; courriel sans montant
    r = await owner.post(`/resumes/${sum.id}/modifier`, { intro: 'Court', income: '36 000', expenses: '39 000' });
    match(loc(r), /Écrivez le paragraphe/);
    r = await owner.post(`/resumes/${sum.id}/modifier`, { intro: 'Septembre a été plus calme, avec une perte de 3 000,00 $ due à l’achat de la nouvelle scie.', income: '360 00,00', expenses: '39 000' });
    assert.strictEqual(JSON.parse(db.prepare('SELECT figures FROM summaries WHERE id = ?').get(sum.id).figures).source, 'qbo', 'montants inchangés : QuickBooks reste la source');
    const before = mails.length;
    r = await owner.post(`/resumes/${sum.id}/publier`);
    match(loc(r), /Résumé publié/);
    const notice = mails.slice(before).find((m) => m.to[0] === 'marie@boreal.ca');
    match(notice.subject, /Votre résumé \(Septembre 2026\) est disponible/);
    noMatch(`${notice.subject} ${notice.text}`, /\$|perte|000/);
    r = await marieA.get('/rapports');
    match(r.body, new RegExp(`/rapports/resume/${sum.id}">Septembre 2026`));
    r = await marieA.get(`/rapports/resume/${sum.id}`);
    match(r.body, /Septembre a été plus calme/);
    match(r.body, /Ce que BVY a fait pour vous[\s\S]*Réponses envoyées au gouvernement/);
    match(r.body, /Perte<\/th><td class="num">3 000,00/);

    // Correction après publication : le client garde la version 1 jusqu'à la nouvelle publication
    await owner.post(`/resumes/${sum.id}/modifier`, { intro: 'Version corrigée : la perte vient de la scie, payée comptant.', income: '36 000', expenses: '39 000' });
    r = await marieA.get(`/rapports/resume/${sum.id}`);
    match(r.body, /Septembre a été plus calme/);
    await owner.post(`/resumes/${sum.id}/publier`);
    r = await marieA.get(`/rapports/resume/${sum.id}`);
    match(r.body, /Version corrigée/);
    assert.strictEqual(db.prepare('SELECT COUNT(*) AS n FROM summary_versions WHERE summary_id = ?').get(sum.id).n, 2);

    // Trimestre sans QuickBooks : chiffres saisis par l'équipe
    r = await owner.post('/resumes/preparer', { clientId: soc.id, type: 'quarter', endYm: '' });
    const qid = Number(r.headers.location.match(/^\/resumes\/(\d+)/)[1]);
    const qs = db.prepare('SELECT * FROM summaries WHERE id = ?').get(qid);
    assert.strictEqual(qs.label, 'Trimestre de juillet à septembre 2026');
    assert.strictEqual(JSON.parse(qs.figures).income, null);
    r = await owner.get(`/resumes/${qid}`);
    match(r.body, /Chiffres non disponibles pour cette période/);
    await owner.post(`/resumes/${qid}/modifier`, { intro: 'Votre trimestre en bref, préparé par BVY.', income: '118 500,00', expenses: '101 250' });
    assert.deepStrictEqual((({ income, expenses, source }) => ({ income, expenses, source }))(JSON.parse(db.prepare('SELECT figures FROM summaries WHERE id = ?').get(qid).figures)), { income: 11850000, expenses: 10125000, source: 'staff' });
    r = await owner.post('/resumes/preparer', { clientId: soc.id, type: 'month', endYm: '2026-10' });
    match(loc(r), /pas encore terminée/);

    // Rôles et isolation
    const marc = await login('marc@laurentides.ca');
    r = await marc.get(`/rapports/resume/${sum.id}`);
    assert.strictEqual(r.status, 404);
    const lise = await login('lise@bvy.ca');
    r = await lise.get('/resumes?etat=published');
    match(r.body, /Atelier Boréal/);
    const cs = drafts.find((x) => x.client_id === cons.id);
    r = await lise.get(`/resumes/${cs.id}`);
    assert.strictEqual(r.status, 403);
    r = await marieA.get('/resumes');
    assert.notStrictEqual(r.status, 200);
    void jean;
  } finally { app.close(); }
});
