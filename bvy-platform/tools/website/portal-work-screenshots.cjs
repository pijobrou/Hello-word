// Captures du tableau de bord de l'équipe (workflow 05) avec des données fictives → review/portal-work/
const path = require('path'); const fs = require('fs'); const os = require('os'); const crypto = require('crypto');
const APP = path.resolve(__dirname, '../../apps/portal');
const OUT = path.resolve(__dirname, '../../review/portal-work');
const { createServer } = require(path.join(APP, 'server.js'));
const { createQbo } = require(path.join(APP, 'lib/qbo.js'));
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.resolve(__dirname, '../../apps/website/node_modules/playwright'))); }
(async () => {
  const mails = []; const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shots5-'));
  const qbo = createQbo({ clientId: 'x', clientSecret: 'y', key: crypto.randomBytes(32), environment: 'production', redirectUri: 'x', apiBase: 'x', appBase: 'https://app.qbo.intuit.com' });
  const probe = createServer({ port: 0, dataDir, smtp: null, sendMail: async () => {}, publicUrl: 'http://localhost:1', qbo });
  await new Promise((r) => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; probe.close();
  const srv = createServer({ port, dataDir, smtp: null, sendMail: async (m) => mails.push(m), publicUrl: `http://localhost:${port}`, qbo });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));
  const acc = srv.accounts; const db = srv.db; const wq = srv.workqueue; const PW = 'une phrase assez longue';
  const mk = (email, name, role, clientId) => { const { token } = acc.invite(null, { email, name, role, clientId }); return acc.acceptInvite(token, PW); };
  const admin = mk('pierre@bvy.ca', 'Pierre-Joseph Brouillette', 'admin');
  const t = new Date().toISOString(); const today = t.slice(0, 10);
  const since = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
  const clients = [
    ['Atelier Boréal inc.', { kind: 'entreprise', yearEndMonth: '12', gstFreq: 'quarterly', payroll: '1' }],
    ['Construction Laurentides ltée', { kind: 'entreprise', yearEndMonth: '6', gstFreq: 'monthly', payroll: '1' }],
    ['Boutique Fleur de Sel inc.', { kind: 'entreprise', yearEndMonth: '3', gstFreq: 'annual' }],
    ['Sophie Gagnon, graphiste', { kind: 'autonome', gstFreq: 'annual', installments: '1' }],
    ['Marc Bélanger, électricien', { kind: 'autonome', gstFreq: 'quarterly' }],
    ['Jean Tremblay', { kind: 'particulier' }],
    ['Nadia Côté', { kind: 'particulier', installments: '1' }],
    ['Nouveau client', null],
  ];
  const ids = {};
  for (const [name, prof] of clients) { const c = acc.createClient(admin, name); ids[name] = c.id; if (prof) wq.saveProfile(admin, c.id, prof); }
  db.prepare('UPDATE clients SET profile_since = ? WHERE is_firm = 0').run(since);
  // Quelques échéances déjà faites pour un portrait réaliste
  const mark = (name, key) => db.prepare("INSERT INTO deadline_marks (client_id, key, status, marked_by, marked_at) VALUES (?, ?, 'done', ?, ?)").run(ids[name], key, admin.id, t);
  for (const k of wq.deadlinesFor(db.prepare('SELECT * FROM clients WHERE id = ?').get(ids['Atelier Boréal inc.']), today).filter((d) => d.date < today).map((d) => d.key)) mark('Atelier Boréal inc.', k);
  for (const k of wq.deadlinesFor(db.prepare('SELECT * FROM clients WHERE id = ?').get(ids['Boutique Fleur de Sel inc.']), today).filter((d) => d.date < today).map((d) => d.key)) mark('Boutique Fleur de Sel inc.', k);
  // Cabinet relié, factures de BVY
  const firm = wq.firmClient(true);
  db.prepare(`INSERT INTO qbo_connections (client_id, realm_id, company_name, environment, access_enc, refresh_enc, access_expires, refresh_expires, status, connected_by, connected_at, last_sync_at, last_sync_status)
    VALUES (?, '7777', 'BVY Accounting & Tax Services', 'production', 'x', 'x', 0, 0, 'connected', ?, ?, ?, 'ok')`).run(firm.id, admin.id, t, t);
  const cust = db.prepare('INSERT INTO firm_customers (customer_id, name) VALUES (?, ?)');
  const rec = db.prepare('INSERT INTO firm_receivables (customer_id, customer_name, balance_cents, overdue_cents, invoices, oldest_due, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  [['11', 'Atelier Boréal inc.', 57500, 0, 1, null], ['12', 'Construction Laurentides ltée', 241500, 172500, 3, '2026-08-15'], ['13', 'Sophie Gagnon', 34500, 34500, 1, '2026-09-01'], ['14', 'Nadia Côté', 0, 0, 0, null]].forEach(([id, n, b, o, k, d]) => { cust.run(id, n); if (b) rec.run(id, n, b, o, k, d, t); });
  db.prepare('UPDATE clients SET billing_customer_id = ? WHERE id = ?').run('13', ids['Sophie Gagnon, graphiste']);
  // QuickBooks des clients
  const qc = db.prepare(`INSERT INTO qbo_connections (client_id, realm_id, company_name, environment, access_enc, refresh_enc, access_expires, refresh_expires, status, connected_by, connected_at, last_sync_at, last_sync_status)
    VALUES (?, ?, ?, 'production', 'x', 'x', 0, 0, ?, ?, ?, ?, ?)`);
  qc.run(ids['Atelier Boréal inc.'], '9130', 'Atelier Boréal', 'connected', admin.id, t, t, 'ok');
  qc.run(ids['Construction Laurentides ltée'], '9131', 'Construction Laurentides', 'needs_reconnect', admin.id, t, t, 'failed');
  qc.run(ids['Boutique Fleur de Sel inc.'], '9132', 'Fleur de Sel', 'connected', admin.id, t, t, 'ok');
  db.prepare(`INSERT INTO qbo_items (client_id, kind, qbo_type, qbo_id, txn_date, amount_cents, counterparty, qbo_url, first_seen, last_seen) VALUES (?, 'uncategorized', 'Purchase', '901', '2026-09-18', 84237, 'Costco', 'x', ?, ?)`).run(ids['Atelier Boréal inc.'], t, t);
  // Demandes aux clients
  const task = db.prepare("INSERT INTO tasks (client_id, kind, title, status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)");
  task.run(ids['Atelier Boréal inc.'], 'document', 'Relevé bancaire de septembre', 'open', admin.id, t);
  task.run(ids['Construction Laurentides ltée'], 'question', 'Paiement Home Depot de 1 240 $', 'open', admin.id, t);
  task.run(ids['Construction Laurentides ltée'], 'approval', 'Heures de paie', 'answered', admin.id, t);
  task.run(ids['Sophie Gagnon, graphiste'], 'document', 'Feuillets T4A 2025', 'open', admin.id, t);
  const B = `http://localhost:${port}`; const b = await chromium.launch();
  const lastCode = () => mails[mails.length - 1].subject.match(/(\d{6})/)[1];
  async function login(page, email) {
    await page.goto(`${B}/connexion`); await page.fill('#email', email); await page.fill('#password', PW);
    await page.click('button[type=submit]'); await page.waitForURL(/verification/); await page.fill('#code', lastCode()); await page.click('button[type=submit]'); await page.waitForURL(/accueil/);
  }
  const problems = [];
  for (const [vp, w, h] of [['bureau', 1440, 900], ['mobile', 390, 844]]) {
    const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
    await login(p, 'pierre@bvy.ca'); await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/01-tableau-de-bord-${vp}.png`, fullPage: true });
    if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push(`${vp} débordement tableau de bord`, ...(process.env.OVF ? await require(process.env.OVF)(p) : []));
    await p.goto(`${B}/clients/${ids['Atelier Boréal inc.']}/echeances`); await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/02-echeances-client-${vp}.png`, fullPage: true });
    if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push(`${vp} débordement échéances`, ...(process.env.OVF ? await require(process.env.OVF)(p) : []));
    await p.goto(`${B}/cabinet`); await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/03-quickbooks-du-cabinet-${vp}.png`, fullPage: true });
    if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push(`${vp} débordement cabinet`, ...(process.env.OVF ? await require(process.env.OVF)(p) : []));
  }
  console.log('problèmes', problems); await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
