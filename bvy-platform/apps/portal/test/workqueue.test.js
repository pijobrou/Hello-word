'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server.js');
const { createQbo, TOKEN_URL, REVOKE_URL } = require('../lib/qbo.js');
const { computeDeadlines, businessDay, urgency } = require('../lib/deadlines.js');
const { normName } = require('../lib/workqueue.js');

const ORIGIN = 'https://portail.bvyaccountingtax.ca';
const PW = 'une phrase assez longue';
const NOW = Date.UTC(2026, 9, 2, 15, 0); // vendredi 2 octobre 2026
const TODAY = '2026-10-02';
const find = (list, key) => list.find((d) => d.key === key);

test('échéances : règles par type de client, fin d’exercice, TPS/TVQ, paie, week-ends', () => {
  // Société, fin d'exercice 31 décembre : T2/CO-17 le 30 juin, solde le 28 février (2 mois)
  const soc = computeDeadlines({ kind: 'entreprise', yearEndMonth: 12, gstFreq: 'quarterly', payroll: true }, TODAY);
  assert.strictEqual(find(soc, 't2:2026-12-31').date, '2027-06-30');
  assert.strictEqual(find(soc, 't2pay:2026-12-31').date, '2027-03-01', '28 février 2027 est un dimanche → lundi 1er mars');
  assert.strictEqual(find(soc, 'req:2026-12-31').date, '2027-06-30');
  // TPS/TVQ trimestrielle : trimestre terminé le 30 septembre → 31 octobre (samedi) → lundi 2 novembre
  assert.strictEqual(find(soc, 'taxes:2026-09').date, '2026-11-02');
  // Retenues à la source : paies d'octobre → 15 novembre (dimanche) → 16 novembre
  assert.strictEqual(find(soc, 'das:2026-10').date, '2026-11-16');
  assert.strictEqual(find(soc, 'das:2026-08').title, 'Retenues à la source — paies d’août 2026');
  assert.strictEqual(find(soc, 't4:2026').date, '2027-03-01');
  assert.strictEqual(find(soc, 'cnesst:2026').date, '2027-03-15');
  // Fin d'exercice 31 mars : T2 le 30 septembre ; trimestres alignés sur l'exercice (juin, sept., déc., mars)
  const mars = computeDeadlines({ kind: 'entreprise', yearEndMonth: 3, gstFreq: 'quarterly' }, TODAY);
  assert.strictEqual(find(mars, 't2:2026-03-31').date, '2026-09-30');
  assert.ok(find(mars, 'taxes:2026-12') && find(mars, 'taxes:2027-03') && !find(mars, 'taxes:2026-11'));
  assert.ok(!mars.some((d) => d.key.startsWith('das:')), 'pas de paie sans employés');
  // Travailleur autonome : production 15 juin, paiement 30 avril ; TPS/TVQ annuelle idem
  const auto = computeDeadlines({ kind: 'autonome', gstFreq: 'annual' }, TODAY);
  assert.strictEqual(find(auto, 't1:2026').date, '2027-06-15');
  assert.strictEqual(find(auto, 't1pay:2026').date, '2027-04-30');
  assert.strictEqual(find(auto, 'taxes:2026').date, '2027-06-15');
  // Particulier : 30 avril ; jamais de TPS/TVQ ni de paie, même si cochées par erreur
  const part = computeDeadlines({ kind: 'particulier', gstFreq: 'monthly', payroll: true, installments: true }, TODAY);
  assert.strictEqual(find(part, 't1:2026').date, '2027-04-30');
  assert.ok(!part.some((d) => /^(taxes|das|t4|cnesst):/.test(d.key)));
  assert.strictEqual(find(part, 'acompte:2026-12').date, '2026-12-15');
  // Tri par date, fenêtre de 90 jours en arrière
  assert.deepStrictEqual(part.map((d) => d.date), [...part.map((d) => d.date)].sort());
  assert.ok(part.every((d) => d.date >= '2026-07-04'));
  assert.deepStrictEqual(computeDeadlines({ kind: 'inconnu' }, TODAY), []);
  assert.strictEqual(businessDay('2026-10-03'), '2026-10-05');
  assert.strictEqual(urgency('2026-09-30', TODAY).level, 'late');
  assert.strictEqual(urgency('2026-10-06', TODAY).level, 'week');
  assert.strictEqual(normName('Atelier Boréal inc.'), normName('ATELIER BOREAL INC'));
});

/* ----------------------------------------------------------------- serveur */
function fakeIntuit() {
  const st = { tokens: 0 };
  const json = (status, body) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body), headers: new Headers() });
  const fetchImpl = async (url, opts = {}) => {
    if (url === TOKEN_URL) { st.tokens += 1; return json(200, { access_token: `acc-${st.tokens}`, refresh_token: `ref-${st.tokens}`, expires_in: 3600, x_refresh_token_expires_in: 8640000 }); }
    if (url === REVOKE_URL) return json(200, {});
    const u = new URL(url);
    if (u.pathname.endsWith('/companyinfo/7777')) return json(200, { CompanyInfo: { CompanyName: 'BVY Accounting & Tax Services' } });
    if (u.pathname.endsWith('/query')) {
      const q = u.searchParams.get('query');
      if (/from Customer/.test(q)) return json(200, { QueryResponse: { Customer: [{ Id: '11', DisplayName: 'ATELIER BOREAL INC' }, { Id: '12', DisplayName: 'J. Tremblay' }, { Id: '13', DisplayName: 'Autre client' }] } });
      if (/from Invoice/.test(q)) return json(200, { QueryResponse: { Invoice: [
        { Id: '1', Balance: 500, DueDate: '2026-08-31', CustomerRef: { value: '11', name: 'ATELIER BOREAL INC' } },
        { Id: '2', Balance: 120.5, DueDate: '2026-10-30', CustomerRef: { value: '11', name: 'ATELIER BOREAL INC' } },
        { Id: '3', Balance: 250, DueDate: '2026-10-20', CustomerRef: { value: '12', name: 'J. Tremblay' } },
      ] } });
    }
    return json(404, { Fault: { Error: [{ Message: `inconnu ${u.pathname}` }] } });
  };
  return { st, fetchImpl };
}

async function setup() {
  const fake = fakeIntuit();
  const qbo = createQbo({ clientId: 'cid', clientSecret: 'secret', key: crypto.randomBytes(32), environment: 'production',
    redirectUri: `${ORIGIN}/quickbooks/retour`, apiBase: 'https://quickbooks.api.intuit.com', appBase: 'https://app.qbo.intuit.com' }, { fetchImpl: fake.fetchImpl, now: () => NOW });
  const mails = [];
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-wq-'));
  const app = createServer({ port: 0, dataDir, smtp: null, publicUrl: ORIGIN, sendMail: async (m) => { mails.push(m); }, qbo, now: () => NOW });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const port = app.address().port;
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
  const acc = app.accounts;
  const mk = (email, name, role, clientId) => { const { token } = acc.invite(null, { email, name, role, clientId }); return acc.acceptInvite(token, PW); };
  mk('owner@bvy.ca', 'Pierre Owner', 'admin');
  mk('lead@bvy.ca', 'Léa Lead', 'lead');
  mk('julie@bvy.ca', 'Julie Livres', 'bookkeeper');
  return { app, db: app.db, acc, login, fake };
}

test('tableau de bord de l’équipe : clients séparés par type, prochaine échéance, demandes en attente, isolation', async () => {
  const t = await setup();
  try {
    const admin = await t.login('owner@bvy.ca');
    await admin.get('/admin');
    for (const [name, kind] of [['Atelier Boréal inc.', 'entreprise'], ['Jean Tremblay', 'particulier'], ['Marie Autonome', 'autonome'], ['Sans Type', '']]) {
      const r = await admin.post('/admin/clients', { name, kind });
      assert.strictEqual(r.status, 303);
    }
    const id = (n) => t.db.prepare('SELECT id FROM clients WHERE name = ?').get(n).id;
    const boreal = id('Atelier Boréal inc.');

    // Profil fiscal complet de la société : fin d'exercice 31 décembre, TPS/TVQ trimestrielle, employés
    await admin.get(`/clients/${boreal}/echeances`);
    let r = await admin.post(`/clients/${boreal}/profil`, { kind: 'entreprise', yearEndMonth: '12', gstFreq: 'quarterly', payroll: '1' });
    assert.match(decodeURIComponent(r.headers.location), /Profil fiscal enregistré/);
    const page = await admin.get(`/clients/${boreal}/echeances`);
    assert.match(page.body, /Retenues à la source — paies de septembre 2026/);
    assert.match(page.body, /TPS\/TVQ — trimestre terminé le 30 septembre 2026/);
    // Les échéances d'avant la mise en place du profil ne sont pas « en retard »
    assert.ok(!/En retard/.test(page.body));

    // Une demande au client et un message non lu
    await admin.get(`/clients/${boreal}/taches`);
    await admin.post(`/clients/${boreal}/taches`, { kind: 'document', title: 'Relevé bancaire de septembre' });

    let home = await admin.get('/accueil');
    assert.match(home.body, /id="g-entreprise"[\s\S]*Atelier Boréal inc\.[\s\S]*id="g-autonome"[\s\S]*Marie Autonome[\s\S]*id="g-particulier"[\s\S]*Jean Tremblay[\s\S]*id="g-unset"[\s\S]*Sans Type/);
    // Colonnes des entreprises : tenue de livres, TPS/TVQ, retenues, T2/CO-17, CNESST, en attente, QBO
    assert.match(home.body, /<th scope="col">Tenue de livres<\/th><th scope="col">TPS\/TVQ<\/th><th scope="col"><abbr title="Retenues à la source \(et T4\/RL-1\)">RS<\/abbr><\/th><th scope="col">T2 \/ CO-17<\/th><th scope="col">CNESST<\/th>/);
    // Retenues : paies de septembre → 15 octobre (dans 13 jours) ; TPS/TVQ : 2 novembre ; T2 : 30 juin 2027 ; CNESST : 15 mars 2027
    const row = home.body.slice(home.body.indexOf('Atelier Boréal inc.'), home.body.indexOf('</tr>', home.body.indexOf('Atelier Boréal inc.')));
    assert.match(row, /title="Retenues à la source — paies de septembre 2026[^"]*"><b>15 oct\.<\/b><span>dans 13 j<\/span>/);
    assert.match(row, /title="TPS\/TVQ — trimestre terminé le 30 septembre 2026[^"]*"><b>2 nov\.<\/b>/);
    // Colonne T2/CO-17 : la plus proche entre production, solde d'impôt et REQ → solde du 1er mars 2027
    assert.match(row, /title="Solde d’impôt de la société \(exercice terminé le 31 décembre 2026\)[^"]*"><b>1 mars 2027<\/b>/);
    assert.match(row, /CNESST — déclaration des salaires 2026[^"]*"><b>15 mars 2027<\/b>/);
    assert.match(row, /<option value="todo" selected>Pas encore traité<\/option>/);
    assert.match(row, /1 tâche chez le client/);
    assert.match(row, /badge b-neutral">Non relié/);
    // Particuliers : T1/TP-1 et acomptes ; pas de TPS/TVQ ni de tenue de livres
    assert.match(home.body, /id="g-particulier"[\s\S]*?<th scope="col">T1 \/ TP-1<\/th><th scope="col">Acomptes provisionnels<\/th><th scope="col">En attente/);
    assert.match(home.body, /Compléter le profil fiscal/);
    assert.match(home.body, /href="\/facturation"/, 'menu Facturation');

    // Tenue de livres : vert / orange / rouge, changé depuis le tableau de bord
    r = await admin.post(`/clients/${boreal}/tenue`, { status: 'done' });
    assert.match(decodeURIComponent(r.headers.location), /Tenue de livres de Atelier Boréal inc\. : à jour/);
    home = await admin.get('/accueil');
    assert.match(home.body, /wq-books bk-done[\s\S]*?<option value="done" selected>À jour/);
    r = await admin.post(`/clients/${boreal}/tenue`, { status: 'n-importe' });
    assert.match(decodeURIComponent(r.headers.location), /invalide/);

    // Marquer « Fait » : la colonne des retenues passe aux paies d'octobre
    await admin.get(`/clients/${boreal}/echeances`);
    r = await admin.post(`/clients/${boreal}/echeances/marquer`, { key: 'das:2026-09', status: 'done' });
    assert.match(decodeURIComponent(r.headers.location), /marquée comme faite/);
    home = await admin.get('/accueil');
    assert.match(home.body, /title="Retenues à la source — paies d’octobre 2026[^"]*"><b>16 nov\.<\/b>/);
    // Échéance ajoutée à la main : visible dans « En attente » ; clé inconnue refusée
    await admin.get(`/clients/${boreal}/echeances`);
    await admin.post(`/clients/${boreal}/echeances`, { title: 'Répondre à Revenu Québec', date: '2026-10-09' });
    home = await admin.get('/accueil');
    assert.match(home.body, /9 oct\. · Répondre à Revenu Québec/);
    await admin.get(`/clients/${boreal}/echeances`);
    r = await admin.post(`/clients/${boreal}/echeances/marquer`, { key: 'das:1999-01', status: 'done' });
    assert.match(decodeURIComponent(r.headers.location), /Échéance introuvable/);

    // Échéances en retard une fois le profil plus ancien
    t.db.prepare("UPDATE clients SET profile_since = '2026-01-01' WHERE id = ?").run(boreal);
    t.db.prepare('DELETE FROM custom_deadlines').run();
    t.db.prepare('DELETE FROM deadline_marks').run();
    home = await admin.get('/accueil');
    assert.match(home.body, /class="wq-due late"[^>]*><b>15 juil\.<\/b><span>en retard 79 j<\/span>/);
    assert.match(home.body, /\d échéances en retard/);

    // Tenue de livres : seulement ses clients assignés ; pas d'accès au cabinet
    const julieId = t.db.prepare("SELECT id FROM users WHERE email = 'julie@bvy.ca'").get().id;
    t.acc.setAssignment(t.acc.userByEmail('owner@bvy.ca'), julieId, id('Marie Autonome'), true);
    const julie = await t.login('julie@bvy.ca');
    const jh = await julie.get('/accueil');
    assert.match(jh.body, /Marie Autonome/);
    assert.ok(!/Atelier Boréal|Jean Tremblay|Sans Type/.test(jh.body), 'isolation par assignation');
    assert.strictEqual((await julie.get(`/clients/${boreal}/echeances`)).status, 403);
    assert.strictEqual((await julie.get('/cabinet')).status, 403);
    await julie.get('/accueil');
    r = await julie.post(`/clients/${boreal}/profil`, { kind: 'particulier' });
    assert.strictEqual(r.status, 403);
    assert.strictEqual((await julie.post(`/clients/${boreal}/tenue`, { status: 'done' })).status, 403);
    assert.strictEqual((await julie.get('/facturation')).status, 403);
    assert.ok(!/href="\/facturation"/.test(jh.body), 'pas de Facturation pour la tenue de livres');
  } finally { t.app.close(); }
});

test('QuickBooks du cabinet : administrateur seulement, jamais un client ; sommes dues à BVY par client', async () => {
  const t = await setup();
  try {
    const admin = await t.login('owner@bvy.ca');
    await admin.get('/admin');
    await admin.post('/admin/clients', { name: 'Atelier Boréal inc.', kind: 'entreprise' });
    await admin.post('/admin/clients', { name: 'Jean Tremblay', kind: 'particulier' });
    const id = (n) => t.db.prepare('SELECT id FROM clients WHERE name = ?').get(n).id;

    // Le comptable principal ne relie pas le cabinet
    const lead = await t.login('lead@bvy.ca');
    assert.strictEqual((await lead.get('/cabinet')).status, 403);
    await lead.get('/accueil');
    assert.strictEqual((await lead.post('/cabinet/quickbooks/connecter')).status, 403);

    // L'administrateur relie le QuickBooks du cabinet
    await admin.get('/cabinet');
    let r = await admin.post('/cabinet/quickbooks/connecter');
    assert.strictEqual(r.status, 303);
    const state = new URL(r.headers.location).searchParams.get('state');
    r = await admin.get(`/quickbooks/retour?code=abc&state=${encodeURIComponent(state)}&realmId=7777`);
    const msg = decodeURIComponent(r.headers.location);
    assert.match(msg, /^\/cabinet\?ok=QuickBooks est connecté\. Première synchronisation terminée\./);
    assert.strictEqual(t.db.prepare('SELECT COUNT(*) AS n FROM firm_receivables').get().n, 2);

    const cab = await admin.get('/cabinet');
    assert.match(cab.body, /BVY Accounting &amp; Tax Services/);
    assert.match(cab.body, /Obligations de BVY/);

    // Facturation : Boréal reconnu par son nom (500 $ en retard depuis le 31 août) ; J. Tremblay pas encore lié
    let bill = await admin.get('/facturation');
    assert.match(bill.body, /Total impayé<\/small><b>870,50\s\$<\/b>/);
    assert.match(bill.body, /Atelier Boréal inc\.[\s\S]*?620,50\s\$[\s\S]*?500,00\s\$[\s\S]*?depuis le 31 août 2026/);
    assert.match(bill.body, /customerdetail\?nameId=11/);
    assert.match(bill.body, /Soldes non liés à un dossier BVY[\s\S]*J\. Tremblay/);
    assert.strictEqual((await lead.get('/facturation')).status, 200, 'le comptable principal voit la facturation');
    let home = await admin.get('/accueil');
    assert.match(home.body, /Impayé à BVY<\/small><b>620,50\s\$<\/b>/);
    // Le cabinet n'est jamais présenté comme un client
    assert.ok(!/QuickBooks du cabinet<\/a><\/th>|BVY — QuickBooks du cabinet/.test(home.body));
    const firmId = t.db.prepare('SELECT id FROM clients WHERE is_firm = 1').get().id;
    assert.strictEqual((await admin.get(`/clients/${firmId}`)).status, 404);
    assert.throws(() => t.acc.invite(null, { email: 'x@y.ca', name: 'Intrus', role: 'client', clientId: firmId }), /entreprise/);
    assert.strictEqual((await lead.get(`/clients/${firmId}/quickbooks`)).status, 403);

    // Lier Jean Tremblay au client « J. Tremblay » du QuickBooks de BVY
    await admin.get(`/clients/${id('Jean Tremblay')}/echeances`);
    r = await admin.post(`/clients/${id('Jean Tremblay')}/profil`, { kind: 'particulier', billingCustomerId: '12' });
    assert.match(decodeURIComponent(r.headers.location), /Profil fiscal enregistré/);
    bill = await admin.get('/facturation');
    assert.match(bill.body, /Jean Tremblay[\s\S]*?250,00\s\$/);
    assert.ok(!/Soldes non liés/.test(bill.body));
    home = await admin.get('/accueil');
    assert.match(home.body, /Impayé à BVY<\/small><b>870,50\s\$<\/b>/);
    // Client QuickBooks inconnu refusé
    await admin.get(`/clients/${id('Jean Tremblay')}/echeances`);
    r = await admin.post(`/clients/${id('Jean Tremblay')}/profil`, { kind: 'particulier', billingCustomerId: '999' });
    assert.match(decodeURIComponent(r.headers.location), /introuvable/);

    // Obligations de BVY elle-même (profil fiscal du cabinet), visibles à l'administration
    await admin.get('/cabinet');
    r = await admin.post('/cabinet/profil', { yearEndMonth: '12', gstFreq: 'quarterly', payroll: '1', kind: 'particulier' });
    assert.match(decodeURIComponent(r.headers.location), /Profil fiscal de BVY enregistré/);
    assert.strictEqual(t.db.prepare('SELECT kind FROM clients WHERE is_firm = 1').get().kind, 'entreprise', 'le cabinet reste une société');
    const adm = await admin.get('/admin');
    assert.match(adm.body, /Personnes et clients/);
    assert.match(adm.body, /QBO du cabinet[\s\S]*Prochaines obligations de BVY[\s\S]*15 oct\./);
    await lead.get('/accueil');
    assert.strictEqual((await lead.post('/cabinet/profil', { gstFreq: 'none' })).status, 403);
    assert.ok(!/QBO du cabinet/.test((await lead.get('/admin')).body));

    // Déconnexion : plus de montants affichés
    await admin.get('/cabinet');
    r = await admin.post('/cabinet/quickbooks/deconnecter');
    assert.match(decodeURIComponent(r.headers.location), /déconnecté/);
    bill = await admin.get('/facturation');
    assert.match(bill.body, /Le QuickBooks du cabinet n’est pas relié|QuickBooks du cabinet déconnecté/);
  } finally { t.app.close(); }
});
