// Captures de la phase 4 (QuickBooks) avec des données fictives déjà synchronisées → review/portal-qbo/
const path = require('path'); const fs = require('fs'); const os = require('os'); const crypto = require('crypto');
const APP = path.resolve(__dirname, '../../apps/portal');
const OUT = path.resolve(__dirname, '../../review/portal-qbo');
const { createServer } = require(path.join(APP, 'server.js'));
const { createQbo } = require(path.join(APP, 'lib/qbo.js'));
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.resolve(__dirname, '../../apps/website/node_modules/playwright'))); }
(async () => {
  const mails = []; const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shots4-'));
  const qbo = createQbo({ clientId: 'x', clientSecret: 'y', key: crypto.randomBytes(32), environment: 'sandbox', redirectUri: 'x', apiBase: 'x', appBase: 'https://app.sandbox.qbo.intuit.com' });
  const probe = createServer({ port: 0, dataDir, smtp: null, sendMail: async () => {}, publicUrl: 'http://localhost:1', qbo });
  await new Promise((r) => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; probe.close();
  const srv = createServer({ port, dataDir, smtp: null, sendMail: async (m) => mails.push(m), publicUrl: `http://localhost:${port}`, qbo });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));
  const acc = srv.accounts; const db = srv.db; const PW = 'une phrase assez longue';
  const mk = (email, name, role, clientId) => { const { token } = acc.invite(null, { email, name, role, clientId }); return acc.acceptInvite(token, PW); };
  const admin = mk('pierre@bvy.ca', 'Pierre-Jean Brouillette', 'admin');
  const c = acc.createClient(admin, 'Atelier Boréal inc.'); acc.createClient(admin, 'Boutique Laurentides inc.');
  mk('marie@atelierboreal.ca', 'Marie-Ève Bouchard', 'client', c.id);
  const t = new Date().toISOString();
  db.prepare(`INSERT INTO qbo_connections (client_id, realm_id, company_name, environment, access_enc, refresh_enc, access_expires, refresh_expires, status, connected_by, connected_at, last_sync_at, last_sync_status)
    VALUES (?, '9130', 'Atelier Boréal inc.', 'sandbox', 'x', 'x', 0, 0, 'connected', ?, ?, ?, 'ok')`).run(c.id, admin.id, t, t);
  db.prepare("INSERT INTO client_snapshots (client_id, data, updated_at, source) VALUES (?, ?, ?, 'qbo')").run(c.id, JSON.stringify({ asOf: t.slice(0, 10),
    cash: { amount: 4821560, note: 'Dans 2 comptes bancaires, selon QuickBooks.' }, receivable: { amount: 315000, note: '2 factures impayées, dont 1 en retard de plus de 30 jours (2 150,00 $).' },
    payable: { amount: 87645, note: '1 facture de fournisseur, dont 1 à payer d’ici 30 jours.' },
    health: { state: 'watch', why: 'Vos dépenses ont augmenté de 12 % en septembre, plus vite que vos revenus (+ 8 %). Votre encaisse reste solide.' },
    changes: [{ what: 'Revenus de septembre : 10 800,00 $ (+ 8 %)', why: 'Comparé à août (10 000,00 $), selon QuickBooks.' }, { what: 'Dépenses de septembre : 7 840,00 $ (+ 12 %)', why: 'Comparé à août (7 000,00 $), selon QuickBooks.' }, { what: '1 facture en retard de plus de 30 jours', why: '2 150,00 $ attendus : un rappel au client peut aider.' }],
    work: [{ name: 'Tenue de livres — septembre', progress: 85, status: '' }, { name: 'TPS/TVQ — 3e trimestre', progress: null, status: 'en attente de la tenue de livres' }] }), t);
  const ins = db.prepare(`INSERT INTO qbo_items (client_id, kind, qbo_type, qbo_id, txn_date, amount_cents, counterparty, detail, qbo_url, first_seen, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  ins.run(c.id, 'uncategorized', 'Purchase', '901', '2026-09-18', 84237, 'Costco', 'Achat magasin', 'https://app.sandbox.qbo.intuit.com/app/expense?txnId=901', t, t);
  ins.run(c.id, 'uncategorized', 'Purchase', '905', '2026-09-24', 12999, 'Amazon', null, 'https://app.sandbox.qbo.intuit.com/app/expense?txnId=905', t, t);
  ins.run(c.id, 'overdue_invoice', 'Invoice', '501', '2026-08-17', 215000, 'Client X', 'Facture n° 1042', 'https://app.sandbox.qbo.intuit.com/app/invoice?txnId=501', t, t);
  const B = `http://localhost:${port}`; const b = await chromium.launch();
  const lastCode = () => mails[mails.length - 1].subject.match(/(\d{6})/)[1];
  async function login(page, email) {
    await page.goto(`${B}/connexion`); await page.fill('#email', email); await page.fill('#password', PW);
    await page.click('button[type=submit]'); await page.waitForURL(/verification/); await page.fill('#code', lastCode()); await page.click('button[type=submit]'); await page.waitForURL(/accueil/);
  }
  const problems = [];
  for (const [vp, w, h] of [['bureau', 1440, 900], ['mobile', 390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, ignoreHTTPSErrors: true }); const p = await ctx.newPage();
    await login(p, 'pierre@bvy.ca');
    await p.screenshot({ path: `${OUT}/01-equipe-clients-${vp}.png`, fullPage: true });
    await p.goto(`${B}/clients/${c.id}/quickbooks`); await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/02-onglet-quickbooks-${vp}.png`, fullPage: true });
    if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push(`${vp} débordement onglet QuickBooks`, ...(process.env.OVF ? await require(process.env.OVF)(p) : []));
    const p2 = await (await b.newContext({ viewport: { width: w, height: h }, ignoreHTTPSErrors: true })).newPage();
    await login(p2, 'marie@atelierboreal.ca'); await p2.waitForTimeout(400); await p2.screenshot({ path: `${OUT}/03-client-tableau-synchronise-${vp}.png`, fullPage: true });
    if (await p2.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push(`${vp} débordement client`, ...(process.env.OVF ? await require(process.env.OVF)(p2) : []));
  }
  console.log('problèmes', problems); await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
