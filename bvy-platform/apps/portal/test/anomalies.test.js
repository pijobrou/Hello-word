'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server.js');
const { findDuplicates, findUnusual } = require('../lib/anomalies.js');

const ORIGIN = 'https://portail.bvyaccountingtax.ca';
const PW = 'une phrase assez longue';
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 5, 14, 0); // lundi 2026-10-05
let NOW = T0;
const TODAY = '2026-10-05';
const tx = (id, date, amount, party, type = 'Purchase') => ({ type, id: String(id), date, amount, party, url: `https://app.qbo.intuit.com/app/${type.toLowerCase()}?txnId=${id}` });

test('anomalies : règles des doublons et des paiements inhabituels', () => {
  const dup = findDuplicates([tx(1, '2026-09-02', 31000, 'Hydro-Québec'), tx(2, '2026-09-03', 31000, 'Hydro-Quebec', 'Bill'), tx(3, '2026-09-20', 31000, 'Hydro-Québec'),
    tx(4, '2026-09-02', 12000, 'Bell'), tx(5, '2026-09-04', 12500, 'Bell')], TODAY);
  assert.strictEqual(dup.length, 1, 'même montant, même bénéficiaire, 3 jours ou moins');
  assert.strictEqual(dup[0].ref, 'dup:Bill:2+Purchase:1');
  assert.match(dup[0].title, /Deux paiements de 310,00\s\$ à Hydro-Québec/);
  assert.strictEqual(findDuplicates([tx(1, '2025-01-02', 31000, 'Hydro'), tx(2, '2025-01-03', 31000, 'Hydro')], TODAY).length, 0, 'trop ancien');
  const hist = [tx(1, '2026-05-10', 10000, 'Bureau en Gros'), tx(2, '2026-06-10', 12000, 'Bureau en Gros'), tx(3, '2026-07-10', 9000, 'Bureau en Gros')];
  const un = findUnusual([...hist, tx(4, '2026-09-12', 498000, 'Bureau en Gros'), tx(5, '2026-09-13', 600000, 'Nouveau fournisseur inc.'), tx(6, '2026-09-14', 400000, 'Autre nouveau')], TODAY);
  assert.deepStrictEqual(un.map((x) => x.ref).sort(), ['unusual:Purchase:4', 'unusual:Purchase:5']);
  assert.match(un.find((x) => x.ref === 'unusual:Purchase:4').explanation, /Habituellement environ 100,00\s\$ \(3 paiements/);
  assert.strictEqual(findUnusual([...hist, tx(7, '2026-09-12', 40000, 'Bureau en Gros')], TODAY).length, 0, 'moins de 500 $');
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
  mk('marie@boreal.ca', 'Marie Bouchard', 'client', soc.id);
  const lise = mk('lise@bvy.ca', 'Lise Comptable', 'bookkeeper');
  acc.setAssignment(admin, lise.id, soc.id, true);
  app.workqueue.saveProfile(admin, soc.id, { kind: 'entreprise', yearEndMonth: '6' });
  return { app, mails, login, admin, soc, jean };
}

test('anomalies : détection, questions au client, mémoire, fermeture et rôles', async () => {
  NOW = T0;
  const { app, login, admin, soc, jean } = await setup();
  const db = app.db; const an = app.anomalies;
  const iso = (d) => new Date(T0 - d * DAY).toISOString();
  const of = (cid, type) => db.prepare('SELECT * FROM anomalies WHERE client_id = ? AND type = ? ORDER BY id').all(cid, type);
  try {
    // Données du dossier
    const snap = (cash) => db.prepare(`INSERT INTO client_snapshots (client_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(client_id) DO UPDATE SET data = excluded.data`)
      .run(soc.id, JSON.stringify({ asOf: TODAY, cash: { amount: cash }, receivable: { amount: 0 }, payable: { amount: 420000 } }), iso(0));
    snap(-150000);
    app.workqueue.addCustomDeadline(admin, soc.id, { title: 'Avis de cotisation à contester', date: '2026-10-08' });
    db.prepare("INSERT INTO pay_runs (client_id, pay_date, status, created_at, updated_at) VALUES (?, '2026-10-06', 'waiting', ?, ?)").run(soc.id, iso(3), iso(3));
    const item = (kind, type, qid, date, amount, party, detail) => Number(db.prepare(`INSERT INTO qbo_items (client_id, kind, qbo_type, qbo_id, txn_date, amount_cents, counterparty, detail, qbo_url, first_seen, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(soc.id, kind, type, qid, date, amount, party, detail, `https://app.qbo.intuit.com/app/expense?txnId=${qid}`, iso(1), iso(1)).lastInsertRowid);
    item('uncategorized', 'Purchase', '77', '2026-02-14', 84237, 'Costco', null);
    item('overdue_invoice', 'Invoice', '90', '2026-07-01', 120000, 'Client lent inc.', 'Facture n° 1042');
    const docTask = app.portal.createTask(admin, soc.id, { kind: 'document', title: 'Relevé Visa de juillet' });
    db.prepare('UPDATE tasks SET created_at = ? WHERE id = ?').run(iso(15), docTask);
    db.prepare(`INSERT INTO qbo_connections (client_id, realm_id, environment, status, connected_at, last_sync_status, last_error) VALUES (?, 'r1', 'production', 'connected', ?, 'failed', 'QuickBooks 503')`).run(soc.id, iso(30));
    const txns = [tx(1, '2026-09-02', 31000, 'Hydro-Québec'), tx(2, '2026-09-03', 31000, 'Hydro-Québec', 'Bill'),
      tx(11, '2026-05-10', 10000, 'Bureau en Gros'), tx(12, '2026-06-10', 12000, 'Bureau en Gros'), tx(13, '2026-07-10', 9000, 'Bureau en Gros'), tx(14, '2026-09-12', 498000, 'Bureau en Gros')];
    an.setQboFindings(soc.id, [...findDuplicates(txns, TODAY), ...findUnusual(txns, TODAY)]);
    app.payrollTick();

    const types = db.prepare("SELECT type, severity FROM anomalies WHERE client_id = ? AND status = 'open' ORDER BY type").all(soc.id).map((x) => `${x.type}:${x.severity}`);
    for (const t of ['cash:urgent', 'deadline:urgent', 'payroll_risk:urgent', 'overdue_major:urgent', 'sync_failed:system', 'uncategorized:standard', 'duplicate:standard', 'unusual:standard'])
      assert.ok(types.includes(t), `${t} détectée (${types.join(', ')})`);
    assert.strictEqual(of(soc.id, 'missing_document')[0].status, 'waiting_client');
    assert.strictEqual(of(jean.id, 'missing_data').length, 1);
    assert.match(of(soc.id, 'deadline')[0].title, /Avis de cotisation à contester — dans 3 jours/);
    assert.match(of(soc.id, 'cash')[0].title, /Solde bancaire négatif/);

    // Écran : la commis ne voit que ses clients ; le client n'y a pas accès
    const lise = await login('lise@bvy.ca');
    let r = await lise.get('/anomalies');
    assert.strictEqual(r.status, 200);
    assert.match(r.body, /Deux paiements de 310,00\s\$ à Hydro-Québec/);
    assert.match(r.body, /Action recommandée/);
    assert.doesNotMatch(r.body, /Profil fiscal à compléter/);
    assert.match(r.body, /aria-label="4 anomalies urgentes"/);
    const jeanAn = of(jean.id, 'missing_data')[0];
    r = await lise.post(`/anomalies/${jeanAn.id}/prendre`, { back: '/anomalies' });
    assert.strictEqual(r.status, 403);
    const marie = await login('marie@boreal.ca');
    r = await marie.get('/anomalies');
    assert.notStrictEqual(r.status, 200);

    // Question au client pour le doublon : formulation simple, aucun numéro de compte
    const owner = await login('owner@bvy.ca');
    const dup = of(soc.id, 'duplicate')[0];
    r = await owner.post(`/anomalies/${dup.id}/demander`, { back: '/anomalies' });
    assert.match(decodeURIComponent(r.headers.location), /Question envoyée au client/);
    const q = db.prepare('SELECT * FROM tasks WHERE anomaly_id = ?').get(dup.id);
    assert.match(q.title, /deux paiements de 310,00\s\$ à Hydro-Québec, le 2026-09-02 et le 2026-09-03\. S’agit-il de deux achats différents/);
    assert.deepStrictEqual(JSON.parse(q.choices), ['Oui, deux achats différents', 'Non, le même achat payé ou saisi deux fois', 'Je ne sais pas']);
    assert.doesNotMatch(q.title, /\b\d{4,5}\b(?!-)/, 'pas de numéro de compte');
    assert.strictEqual(of(soc.id, 'duplicate')[0].status, 'waiting_client');
    r = await owner.post(`/anomalies/${dup.id}/demander`, { back: '/anomalies' });
    assert.match(decodeURIComponent(r.headers.location), /déjà en attente/);
    await marie.get('/a-faire');
    await marie.post(`/a-faire/${q.id}/repondre`, { choice: 'Non, le même achat payé ou saisi deux fois' });
    assert.strictEqual(of(soc.id, 'duplicate')[0].status, 'answered');
    r = await owner.get(`/clients/${soc.id}/anomalies`);
    assert.match(r.body, /Réponse du client :<\/b> Non, le même achat payé ou saisi deux fois/);

    // Catégorie incertaine : la question habituelle de QuickBooks
    const unc = of(soc.id, 'uncategorized')[0];
    r = await owner.post(`/anomalies/${unc.id}/demander`, { back: '/anomalies' });
    const q2 = db.prepare('SELECT * FROM tasks WHERE anomaly_id = ?').get(unc.id);
    assert.match(q2.title, /paiement de 842,37\s\$ à Costco le 2026-02-14\. Était-ce une dépense d’entreprise/);
    assert.strictEqual(db.prepare("SELECT status FROM qbo_items WHERE qbo_id = '77'").get().status, 'sent');

    // Mémoire : un nouveau doublon Hydro-Québec montre la réponse précédente et peut être résolu avec elle
    const txns2 = [...txns, tx(21, '2026-10-01', 29000, 'Hydro-Québec'), tx(22, '2026-10-02', 29000, 'HYDRO-QUÉBEC', 'Bill')];
    an.setQboFindings(soc.id, [...findDuplicates(txns2, TODAY), ...findUnusual(txns2, TODAY)]);
    const dup2 = of(soc.id, 'duplicate')[1];
    r = await owner.get('/anomalies');
    assert.match(r.body, /Dernière réponse du client pour Hydro-Québec : <b>Non, le même achat payé ou saisi deux fois<\/b>/);
    r = await owner.post(`/anomalies/${dup2.id}/precedente`, { back: '/anomalies' });
    assert.match(of(soc.id, 'duplicate')[1].resolution, /^Réponse précédente du client \(2026-10-05\) : Non, le même achat/);

    // Résoudre et ignorer exigent une note ; une anomalie ignorée n'est pas relevée de nouveau
    const un = of(soc.id, 'unusual')[0];
    r = await owner.post(`/anomalies/${un.id}/resoudre`, { note: '', back: '/anomalies' });
    assert.match(decodeURIComponent(r.headers.location), /Écrivez en une phrase/);
    r = await owner.post(`/anomalies/${un.id}/prendre`, { back: '/anomalies' });
    assert.strictEqual(of(soc.id, 'unusual')[0].owner_id, admin.id);
    r = await owner.post(`/anomalies/${un.id}/resoudre`, { note: 'Imprimante achetée : classée en équipement (DPA).', back: '/anomalies' });
    assert.strictEqual(of(soc.id, 'unusual')[0].status, 'resolved');
    r = await owner.post(`/anomalies/${jeanAn.id}/ignorer`, { note: 'Client inactif, dossier fermé à la fin du mois.', back: '/anomalies' });
    an.scanAll();
    assert.strictEqual(of(jean.id, 'missing_data')[0].status, 'dismissed', 'pas relevée de nouveau');
    assert.strictEqual(of(jean.id, 'missing_data').length, 1);

    // Fermeture automatique quand ce n'est plus détecté, réouverture si cela revient
    snap(900000);
    an.scanAll();
    const cash = of(soc.id, 'cash')[0];
    assert.strictEqual(cash.status, 'resolved'); assert.strictEqual(cash.resolution, 'Plus détecté');
    snap(-5000);
    an.scanAll();
    assert.strictEqual(of(soc.id, 'cash')[0].status, 'open');
    an.setQboFindings(soc.id, []);
    assert.strictEqual(of(soc.id, 'duplicate')[0].status, 'resolved', 'corrigé dans QuickBooks');
    assert.strictEqual(db.prepare('SELECT status FROM tasks WHERE id = ?').get(q.id).status, 'done');
    assert.strictEqual(of(soc.id, 'unusual')[0].status, 'resolved');
    assert.ok(of(soc.id, 'unusual')[0].resolved_by, 'la résolution par une personne est gardée');

    // Historique et tuile du tableau de bord
    r = await owner.get('/anomalies?etat=closed');
    assert.match(r.body, /Question envoyée au client/);
    assert.match(r.body, /Plus détecté : fermée automatiquement/);
    r = await owner.get('/accueil');
    assert.match(r.body, /Anomalies urgentes/);
  } finally { app.close(); }
});
