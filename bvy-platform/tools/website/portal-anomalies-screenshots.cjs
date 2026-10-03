// Captures des anomalies et des questions au client (workflows 06 et 08), données fictives → review/portal-anomalies/
const path = require('path'); const fs = require('fs'); const os = require('os');
const APP = path.resolve(__dirname, '../../apps/portal');
const OUT = path.resolve(__dirname, '../../review/portal-anomalies');
const { createServer } = require(path.join(APP, 'server.js'));
const { findDuplicates, findUnusual } = require(path.join(APP, 'lib/anomalies.js'));
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.resolve(__dirname, '../../apps/website/node_modules/playwright'))); }
const DAY = 86_400_000;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const NOW = Date.UTC(2026, 9, 5, 14, 0); const TODAY = '2026-10-05';
  const ago = (d) => new Date(NOW - d * DAY).toISOString();
  const mails = []; const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shots06-'));
  const probe = createServer({ port: 0, dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'probe-')), smtp: null, sendMail: async () => {}, publicUrl: 'http://localhost:1' });
  await new Promise((r) => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; probe.close();
  const srv = createServer({ port, dataDir, smtp: null, sendMail: async (m) => mails.push(m), publicUrl: `http://localhost:${port}`, now: () => NOW });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));
  const acc = srv.accounts; const db = srv.db; const an = srv.anomalies; const wq = srv.workqueue; const PW = 'une phrase assez longue';
  const mk = (email, name, role, clientId) => { const { token } = acc.invite(null, { email, name, role, clientId }); return acc.acceptInvite(token, PW); };
  const admin = mk('pierre@bvy.ca', 'Pierre-Joseph Brouillette', 'admin');
  const lea = mk('lea@bvy.ca', 'Léa Gagnon', 'lead');
  const mkc = (name, kind) => { const c = acc.createClient(admin, name); if (kind) wq.saveProfile(admin, c.id, { kind, yearEndMonth: '12' }); return c; };
  const soc = mkc('Atelier Boréal inc.', 'entreprise');
  const cons = mkc('Construction Laurentides ltée', 'entreprise');
  const sophie = mkc('Sophie Gagnon, graphiste', 'autonome');
  mkc('Jean Tremblay', null);
  db.prepare("UPDATE clients SET profile_since = '2026-01-01'").run();
  const marie = mk('marie@boreal.ca', 'Marie Bouchard', 'client', soc.id);
  mk('marc@laurentides.ca', 'Marc Pelletier', 'client', cons.id);
  const Q = 'https://app.qbo.intuit.com/app';
  const tx = (id, date, amount, party, type = 'Purchase') => ({ type, id: String(id), date, amount, party, url: `${Q}/${type === 'Bill' ? 'bill' : 'expense'}?txnId=${id}` });
  const snap = (cid, cash, pay) => db.prepare('INSERT INTO client_snapshots (client_id, data, updated_at, source) VALUES (?, ?, ?, ?)').run(cid, JSON.stringify({ asOf: TODAY, cash: { amount: cash }, receivable: { amount: 0 }, payable: { amount: pay } }), ago(0), 'qbo');
  snap(cons.id, -184250, 1260000); snap(soc.id, 4812000, 930000);
  wq.addCustomDeadline(admin, cons.id, { title: 'Acompte provisionnel de la société', date: '2026-10-07' });
  db.prepare("INSERT INTO pay_runs (client_id, pay_date, status, created_at, updated_at) VALUES (?, '2026-10-06', 'waiting', ?, ?)").run(soc.id, ago(4), ago(4));
  const item = (cid, kind, type, qid, date, amount, party, detail) => db.prepare(`INSERT INTO qbo_items (client_id, kind, qbo_type, qbo_id, txn_date, amount_cents, counterparty, detail, qbo_url, first_seen, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(cid, kind, type, qid, date, amount, party, detail, `${Q}/expense?txnId=${qid}`, ago(1), ago(1));
  item(soc.id, 'uncategorized', 'Purchase', '77', '2026-09-14', 84237, 'Costco', 'Achat magasin');
  item(cons.id, 'overdue_invoice', 'Invoice', '90', '2026-06-28', 1180000, 'Promoteur Rive-Nord inc.', 'Facture n° 1042');
  db.prepare(`INSERT INTO qbo_connections (client_id, realm_id, company_name, environment, status, connected_at, last_sync_at, last_sync_status) VALUES (?, 'r2', 'Sophie Gagnon design', 'production', 'needs_reconnect', ?, ?, 'ok')`).run(sophie.id, ago(60), ago(3));
  const t = srv.portal.createTask(lea, cons.id, { kind: 'document', title: 'Envoyez le relevé Visa d’août' });
  db.prepare('UPDATE tasks SET created_at = ?, reminders_sent = 2, last_reminder_at = ? WHERE id = ?').run(ago(16), ago(9), t);
  const txns = [tx(1, '2026-09-02', 31000, 'Hydro-Québec'), tx(2, '2026-09-03', 31000, 'Hydro-Québec', 'Bill'),
    tx(11, '2026-05-10', 10000, 'Bureau en Gros'), tx(12, '2026-06-10', 12000, 'Bureau en Gros'), tx(13, '2026-07-10', 9000, 'Bureau en Gros'), tx(14, '2026-09-12', 498000, 'Bureau en Gros')];
  an.setQboFindings(soc.id, [...findDuplicates(txns, TODAY), ...findUnusual(txns, TODAY)]);
  srv.payrollTick();
  // Une question déjà répondue (mémoire) : ancien doublon Hydro-Québec
  db.prepare('INSERT INTO client_decisions (client_id, counterparty, question, answer, answered_at) VALUES (?, ?, ?, ?, ?)').run(soc.id, 'hydro-quebec', 'duplicate', 'Non, le même achat payé ou saisi deux fois', ago(40));
  const un = db.prepare("SELECT id FROM anomalies WHERE type = 'unusual'").get().id;
  an.ask(admin, un, {});
  const unc = db.prepare("SELECT id FROM anomalies WHERE type = 'uncategorized'").get().id;
  an.act(lea, unc, 'take', {});
  const task = db.prepare('SELECT id FROM tasks WHERE anomaly_id = ?').get(un).id;
  srv.portal.answerTask(marie, task, { choice: 'Achat d’équipement', comment: '' }); an.onAnswer({ id: task });

  const B = `http://localhost:${port}`; const br = await chromium.launch();
  const lastCode = () => mails.filter((m) => /code BVY/.test(m.subject)).pop().subject.match(/(\d{6})/)[1];
  async function login(page, email) {
    await page.goto(`${B}/connexion`); await page.fill('#email', email); await page.fill('#password', PW);
    await page.click('button[type=submit]'); await page.waitForURL(/verification/); await page.fill('#code', lastCode()); await page.click('button[type=submit]'); await page.waitForURL(/accueil/);
  }
  const problems = [];
  const shot = async (p, name, vp) => { await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/${name}-${vp}.png`, fullPage: true });
    if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push(`${vp} débordement ${name}`, ...(process.env.OVF ? await require(process.env.OVF)(p) : [])); };
  for (const [vp, w, h] of [['bureau', 1440, 900], ['mobile', 390, 844]]) {
    const p = await (await br.newContext({ viewport: { width: w, height: h } })).newPage();
    await login(p, 'pierre@bvy.ca');
    await p.goto(`${B}/accueil`); await shot(p, '01-tableau-de-bord', vp);
    await p.goto(`${B}/anomalies`); await shot(p, '02-anomalies', vp);
    await p.goto(`${B}/clients/${soc.id}/anomalies`); await p.evaluate(() => document.querySelectorAll('details.an-more').forEach((d, i) => { if (i < 3) d.open = true; })); await shot(p, '03-anomalies-dossier', vp);
    // Une question envoyée au client pour le doublon
    if (vp === 'bureau') { const dup = db.prepare("SELECT id FROM anomalies WHERE type = 'duplicate'").get().id; an.ask(admin, dup, {}); }
    const q = await (await br.newContext({ viewport: { width: w, height: h } })).newPage();
    await login(q, 'marie@boreal.ca');
    await q.goto(`${B}/a-faire`); await shot(q, '04-client-question', vp);
  }
  console.log('problèmes', problems); await br.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
