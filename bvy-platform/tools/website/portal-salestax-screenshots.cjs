// Captures de la TPS/TVQ (workflow 13) avec des données fictives → review/portal-salestax/
const path = require('path'); const fs = require('fs'); const os = require('os');
const APP = path.resolve(__dirname, '../../apps/portal');
const OUT = path.resolve(__dirname, '../../review/portal-salestax');
const { createServer } = require(path.join(APP, 'server.js'));
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.resolve(__dirname, '../../apps/website/node_modules/playwright'))); }
(async () => {
  const mails = []; const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shots13-'));
  const probe = createServer({ port: 0, dataDir, smtp: null, sendMail: async () => {}, publicUrl: 'http://localhost:1' });
  await new Promise((r) => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; probe.close();
  const srv = createServer({ port, dataDir, smtp: null, sendMail: async (m) => mails.push(m), publicUrl: `http://localhost:${port}` });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));
  const acc = srv.accounts; const db = srv.db; const wq = srv.workqueue; const tax = srv.salestax; const PW = 'une phrase assez longue';
  const mk = (email, name, role, clientId) => { const { token } = acc.invite(null, { email, name, role, clientId }); return acc.acceptInvite(token, PW); };
  const admin = mk('pierre@bvy.ca', 'Pierre-Joseph Brouillette', 'admin');
  const lea = mk('lea@bvy.ca', 'Léa Gagnon', 'lead');
  const mkc = (name, freq, books) => { const c = acc.createClient(admin, name); wq.saveProfile(admin, c.id, { kind: 'entreprise', yearEndMonth: '12', gstFreq: freq }); wq.setBooks(admin, c.id, books);
    db.prepare("UPDATE clients SET profile_since = '2026-01-01' WHERE id = ?").run(c.id); return c; };
  const a = mkc('Atelier Boréal inc.', 'quarterly', 'done');
  const b = mkc('Construction Laurentides ltée', 'monthly', 'todo');
  const c = mkc('Boutique Fleur de Sel inc.', 'quarterly', 'done');
  mk('marie@atelierboreal.ca', 'Marie-Ève Bouchard', 'client', a.id);
  srv.payrollTick();
  const ret = (cid, key) => db.prepare('SELECT id FROM tax_returns WHERE client_id = ? AND deadline_key = ?').get(cid, key);
  const all = (fn) => db.prepare('SELECT id, client_id, deadline_key FROM tax_returns').all().forEach(fn);
  // Les périodes anciennes sont déjà produites ; on garde le dernier trimestre ou mois en cours de traitement
  all((r) => { if (!['taxes:2026-09'].includes(r.deadline_key)) db.prepare("UPDATE tax_returns SET status = 'filed', filed_at = '2026-08-28T15:00:00Z', confirmation = 'RQ-0042', gst_cents = 410000, itc_cents = 98000, qst_cents = 817950, itr_cents = 195500, sales_cents = 8200000 WHERE id = ?").run(r.id); });
  const ra = ret(a.id, 'taxes:2026-09').id;
  tax.advance(admin, ra, { action: 'books' }); tax.advance(admin, ra, { action: 'validate', chk_bank: '1', chk_uncat: '1', chk_codes: '1', chk_docs: '1' });
  tax.saveFigures(admin, ra, { sales: '96 400,00', gst: '4 820,00', itc: '1 312,45', qst: '9 615,90', itr: '2 618,40' });
  tax.advance(lea, ra, { action: 'reviewed' });
  const rc = ret(c.id, 'taxes:2026-09').id;
  tax.advance(admin, rc, { action: 'books' }); tax.advance(admin, rc, { action: 'validate', chk_bank: '1', chk_uncat: '1', chk_codes: '1', chk_docs: '1' });
  tax.saveFigures(admin, rc, { sales: '41 250,00', gst: '1 650,00', itc: '980,10', qst: '4 114,69', itr: '1 955,00' });
  const B = `http://localhost:${port}`; const br = await chromium.launch();
  const lastCode = () => mails[mails.length - 1].subject.match(/(\d{6})/)[1];
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
    await p.goto(`${B}/tps-tvq`); await shot(p, '01-tps-tvq-equipe', vp);
    await p.goto(`${B}/tps-tvq/${ret(b.id, 'taxes:2026-09').id}`); await shot(p, '02-declaration-bloquee', vp);
    await p.goto(`${B}/tps-tvq/${rc}`); await shot(p, '03-declaration-revision', vp);
    await p.goto(`${B}/clients/${a.id}/tps-tvq`); await shot(p, '04-onglet-client', vp);
    const q = await (await br.newContext({ viewport: { width: w, height: h } })).newPage();
    await login(q, 'marie@atelierboreal.ca');
    await q.goto(`${B}/tps-tvq/${ra}`); await shot(q, '05-client-approbation', vp);
  }
  console.log('problèmes', problems); await br.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
