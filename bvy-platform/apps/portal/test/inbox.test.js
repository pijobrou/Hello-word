'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server.js');
const { suggestType, periodFrom } = require('../lib/doctypes.js');
const { inSendWindow, reminderDue } = require('../lib/inbox.js');

const ORIGIN = 'https://portail.bvyaccountingtax.ca';
const PW = 'une phrase assez longue';
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 9, 5, 14, 0); // lundi 2026-10-05, 10 h à Montréal
let NOW = T0;

test('documents : type suggéré, période et fenêtre des rappels', () => {
  assert.strictEqual(suggestType('Releve Desjardins 2026-02.pdf'), 'releve_banque');
  assert.strictEqual(suggestType('releve-1_2025.pdf'), 'impots');
  assert.strictEqual(suggestType('T4 employeur.pdf'), 'impots');
  assert.strictEqual(suggestType('Visa_fevrier.pdf'), 'releve_carte');
  assert.strictEqual(suggestType('Facture Bell.pdf'), 'facture_achat');
  assert.strictEqual(suggestType('feuille de temps.xlsx'), 'paie');
  assert.strictEqual(suggestType('Avis Revenu Québec.pdf'), 'gouvernement');
  assert.strictEqual(suggestType('IMG_2034.jpg'), null);
  assert.strictEqual(periodFrom('Releve Desjardins 2026-02.pdf'), '2026-02');
  assert.strictEqual(periodFrom('visa_202603.pdf'), '2026-03');
  assert.strictEqual(periodFrom('Relevé février 2026.pdf'), '2026-02');
  assert.strictEqual(periodFrom('T4 2025.pdf'), '2025');
  assert.strictEqual(periodFrom('scan.pdf'), null);
  assert.strictEqual(periodFrom('IMG_2034.jpg', T0), null);
  assert.strictEqual(periodFrom('Plan 2041.pdf', T0), null);
  assert.ok(inSendWindow(T0), 'lundi 10 h');
  assert.ok(!inSendWindow(T0 + 9 * 3600_000), 'lundi 19 h');
  assert.ok(!inSendWindow(T0 + 5 * DAY), 'samedi');
  const t = { reminders_sent: 0, created_at: new Date(T0).toISOString(), last_reminder_at: null };
  assert.ok(!reminderDue(t, T0 + 2 * DAY));
  assert.ok(reminderDue(t, T0 + 3 * DAY));
  assert.ok(reminderDue({ ...t, reminders_sent: 1, last_reminder_at: new Date(T0 + 3 * DAY).toISOString() }, T0 + 7 * DAY));
  assert.ok(!reminderDue({ ...t, reminders_sent: 3 }, T0 + 60 * DAY));
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
  mk('jean@tremblay.ca', 'Jean Tremblay', 'client', jean.id);
  const lise = mk('lise@bvy.ca', 'Lise Comptable', 'bookkeeper');
  acc.setAssignment(admin, lise.id, soc.id, true);
  return { app, mails, login, admin, soc, jean };
}

const flush = () => new Promise((r) => setImmediate(r));
const PDF = (t) => Buffer.from(`%PDF-1.4\n% ${t}\n`);

test('réception : classement des documents, doublons, liens et isolation', async () => {
  NOW = T0;
  const { app, login, soc, jean } = await setup();
  try {
    const marie = await login('marie@boreal.ca');
    await marie.get('/documents');
    let r = await marie.upload('/documents', { note: '' }, { name: 'Releve Desjardins 2026-02.pdf', data: PDF('releve') });
    assert.strictEqual(r.status, 303);
    await marie.get('/documents');
    r = await marie.upload('/documents', { note: 'encore', docType: 'facture_achat' }, { name: 'copie.pdf', data: PDF('releve') });
    const [d1, d2] = app.db.prepare('SELECT * FROM documents WHERE client_id = ? ORDER BY id').all(soc.id);
    assert.strictEqual(d1.suggested, 'releve_banque'); assert.strictEqual(d1.suggested_by, 'name'); assert.strictEqual(d1.period, '2026-02'); assert.strictEqual(d1.filed, 0);
    assert.strictEqual(d2.duplicate_of, d1.id); assert.strictEqual(d2.suggested, 'facture_achat'); assert.strictEqual(d2.suggested_by, 'client');

    const jeanA = await login('jean@tremblay.ca');
    await jeanA.get('/documents');
    await jeanA.upload('/documents', { docType: '' }, { name: 'IMG_2034.pdf', data: PDF('photo') });
    const d3 = app.db.prepare('SELECT * FROM documents WHERE client_id = ?').get(jean.id);
    assert.strictEqual(d3.suggested, null);

    // Réception : la commis ne voit que ses clients ; le client n'y a pas accès.
    const lise = await login('lise@bvy.ca');
    r = await lise.get('/reception');
    assert.strictEqual(r.status, 200);
    assert.match(r.body, /Releve Desjardins 2026-02\.pdf/);
    assert.match(r.body, /Suggestion : Relevé bancaire/);
    assert.match(r.body, /Même fichier déjà reçu le/);
    assert.doesNotMatch(r.body, /IMG_2034/);
    assert.match(r.body, /Réception<span class="count"|aria-label="\d+ éléments à traiter"|éléments à traiter/);
    r = await lise.post(`/documents/${d3.id}/classer`, { type: 'recu', back: '/reception' });
    assert.strictEqual(r.status, 403);
    r = await marie.get('/reception');
    assert.notStrictEqual(r.status, 200);

    const owner = await login('owner@bvy.ca');
    r = await owner.get('/reception');
    assert.match(r.body, /IMG_2034/);
    // Lien vers le dossier d'un autre client : refusé.
    const ts = new Date(T0).toISOString();
    const other = Number(app.db.prepare(`INSERT INTO tax_files (client_id, form, deadline_key, year_label, period_end, due_date, status, created_at, updated_at)
      VALUES (?, 't1', 't1:2025', '2025', '2025-12-31', '2026-04-30', 'docs', ?, ?)`).run(jean.id, ts, ts).lastInsertRowid);
    r = await owner.post(`/documents/${d1.id}/classer`, { type: 'releve_banque', period: '2026-02', link: `tax_file:${other}`, back: '/reception' });
    assert.match(decodeURIComponent(r.headers.location), /ne correspond pas à un dossier de ce client/);
    r = await owner.post(`/documents/${d1.id}/classer`, { type: 'releve_banque', period: '2026-13', back: '/reception' });
    assert.match(decodeURIComponent(r.headers.location), /Période invalide/);
    r = await owner.post(`/documents/${d1.id}/classer`, { type: 'releve_banque', period: '2026-02', back: '/reception' });
    assert.match(r.headers.location, /^\/reception\?ok=/);
    r = await owner.post(`/documents/${d2.id}/classer`, { duplicate: '1', back: `/clients/${soc.id}/documents` });
    assert.match(r.headers.location, new RegExp(`^/clients/${soc.id}/documents\\?ok=`));
    const f2 = app.db.prepare('SELECT * FROM documents WHERE id = ?').get(d2.id);
    assert.strictEqual(f2.filed, 1); assert.strictEqual(f2.doc_type, 'releve_banque'); assert.strictEqual(f2.period, '2026-02');
    // Lien valide vers un dossier du même client
    r = await owner.post(`/documents/${d3.id}/classer`, { type: 'impots', period: '2025', link: `tax_file:${other}`, back: '/reception' });
    assert.match(r.headers.location, /^\/reception\?ok=/);
    r = await owner.get('/reception');
    assert.match(r.body, /Aucun document en attente/);

    // Recherche dans le dossier, type visible côté client
    r = await owner.get(`/clients/${soc.id}/documents?type=releve_banque&period=2026-02`);
    assert.match(r.body, /2 résultats/);
    r = await owner.get(`/clients/${soc.id}/documents?q=introuvable`);
    assert.match(r.body, /Aucun document ne correspond/);
    r = await owner.get(`/clients/${jean.id}/documents`);
    assert.match(r.body, /Impôts — T1 et TP-1 2025/);
    r = await marie.get('/documents');
    assert.match(r.body, /Relevé bancaire/);

    // Contexte certain (liste d'impôts, heures de paie) : classé tout de suite, n'attend pas en Réception
    const jeanUser = app.db.prepare("SELECT * FROM users WHERE email = 'jean@tremblay.ca'").get();
    const id = app.portal.saveDocument(jeanUser, jean.id, { name: 'T4.pdf', data: PDF('t4') }, { docType: 'impots', link: `tax_file:${other}`, filed: true });
    const d4 = app.db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    assert.strictEqual(d4.filed, 1); assert.strictEqual(d4.link, `tax_file:${other}`);
  } finally { app.close(); }
});

test('rappels : 3, 7 et 14 jours, regroupés, sans détail, arrêt et escalade', async () => {
  NOW = T0;
  const { app, mails, login, soc } = await setup();
  const reminders = () => mails.filter((m) => /^Rappel/.test(m.subject));
  const tick = async (ts) => { NOW = ts; app.payrollTick(); await flush(); };
  try {
    let owner = await login('owner@bvy.ca');
    await owner.get(`/clients/${soc.id}/taches`);
    await owner.post(`/clients/${soc.id}/taches`, { kind: 'question', title: 'Paiement Costco de 842,37 $ : dépense d’entreprise ?' });
    await owner.post(`/clients/${soc.id}/taches`, { kind: 'document', title: 'Relevé Visa de février' });
    await owner.post(`/clients/${soc.id}/taches`, { kind: 'document', title: 'Contrat de location' });
    const [q, doc, contrat] = app.db.prepare('SELECT * FROM tasks WHERE client_id = ? ORDER BY id').all(soc.id);
    let r = await owner.post(`/taches/${contrat.id}/rappels`, { off: '1' });
    assert.match(decodeURIComponent(r.headers.location), /Plus de relance automatique/);

    await tick(T0 + 2 * DAY);
    assert.strictEqual(reminders().length, 0, 'rien avant 3 jours');
    await tick(T0 + 3 * DAY - 3600_000 + 9 * 3600_000); // jeudi 18 h : hors fenêtre
    assert.strictEqual(reminders().length, 0, 'rien après 17 h');
    await tick(T0 + 3 * DAY);
    assert.strictEqual(reminders().length, 1, 'un seul courriel pour le client');
    const m = reminders()[0];
    assert.deepStrictEqual(m.to, ['marie@boreal.ca']);
    assert.match(m.subject, /Rappel : 3 éléments vous attendent dans votre portail BVY/);
    assert.doesNotMatch(`${m.subject} ${m.text}`, /842|Costco|Visa|\$/, 'aucun titre ni montant');
    assert.strictEqual(app.db.prepare('SELECT COUNT(*) AS n FROM task_reminders').get().n, 2, 'la tâche « ne plus relancer » est exclue');
    await tick(T0 + 3 * DAY + 3600_000);
    assert.strictEqual(reminders().length, 1, 'pas deux fois');

    // Vue équipe : prochain rappel, relance manuelle limitée à une par 24 h (nouvelle session : 3 jours ont passé)
    owner = await login('owner@bvy.ca');
    r = await owner.get(`/clients/${soc.id}/taches`);
    assert.match(r.body, /Rappel 2\/3 prévu le 2026-10-12 \(1 déjà envoyé\)/);
    assert.match(r.body, /Relances arrêtées/);
    r = await owner.post(`/taches/${contrat.id}/relancer`);
    assert.match(decodeURIComponent(r.headers.location), /Rappel envoyé/);
    await flush();
    assert.strictEqual(reminders().length, 2);
    r = await owner.post(`/taches/${contrat.id}/relancer`);
    assert.match(decodeURIComponent(r.headers.location), /dans les dernières 24 heures/);

    // La cliente répond à la question : plus de rappel pour elle, la réponse arrive en Réception
    const marie = await login('marie@boreal.ca');
    await marie.get('/a-faire');
    await marie.post(`/a-faire/${q.id}/repondre`, { choice: 'Oui, dépense d’entreprise' });

    await tick(T0 + 7 * DAY - 14 * 3600_000); // lundi 2026-10-12, 0 h : nuit
    assert.strictEqual(reminders().length, 2);
    await tick(T0 + 7 * DAY);
    assert.strictEqual(reminders().length, 3);
    assert.match(reminders()[2].subject, /Rappel : 2 éléments/);
    await tick(T0 + 14 * DAY);
    assert.strictEqual(reminders().length, 4);
    await tick(T0 + 30 * DAY);
    assert.strictEqual(reminders().length, 4, 'jamais plus de 3 rappels automatiques');
    assert.strictEqual(app.db.prepare('SELECT reminders_sent FROM tasks WHERE id = ?').get(doc.id).reminders_sent, 3);
    assert.strictEqual(app.db.prepare('SELECT reminders_sent FROM tasks WHERE id = ?').get(q.id).reminders_sent, 1);

    // Escalade et réponse en Réception
    owner = await login('owner@bvy.ca');
    r = await owner.get('/reception');
    assert.match(r.body, /Sans réponse malgré 3 rappels/);
    assert.match(r.body, /Relevé Visa de février[\s\S]*Appelez le client/);
    assert.match(r.body, /Oui, dépense d’entreprise/);
    r = await owner.post(`/taches/${q.id}/fermer`, { status: 'done', back: '/reception' });
    assert.match(r.headers.location, /^\/reception\?ok=/);

    // Historique du dossier
    r = await owner.get(`/clients/${soc.id}/historique`);
    assert.match(r.body, /Rappel envoyé : Relevé Visa de février/);
    assert.match(r.body, /Réponse : Paiement Costco/);
    assert.match(r.body, /Demande au client : Contrat de location/);
    // Commis non assignée : pas d'accès à l'historique
    const lise = await login('lise@bvy.ca');
    r = await lise.get(`/clients/${soc.id}/historique`);
    assert.strictEqual(r.status, 200);
    app.db.prepare('DELETE FROM client_assignments').run();
    r = await lise.get(`/clients/${soc.id}/historique`);
    assert.strictEqual(r.status, 403);
  } finally { app.close(); }
});
