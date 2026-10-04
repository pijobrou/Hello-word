// Captures des impôts (workflow 14) avec des données fictives → review/portal-incometax/
const path = require('path'); const fs = require('fs'); const os = require('os');
const APP = path.resolve(__dirname, '../../apps/portal');
const OUT = path.resolve(__dirname, '../../review/portal-incometax');
const { createServer } = require(path.join(APP, 'server.js'));
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.resolve(__dirname, '../../apps/website/node_modules/playwright'))); }
(async () => {
  const NOW = Date.UTC(2027, 1, 10, 15, 0); const mails = []; const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shots14-'));
  const probe = createServer({ port: 0, dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'probe-')), smtp: null, sendMail: async () => {}, publicUrl: 'http://localhost:1' });
  await new Promise((r) => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; probe.close();
  const srv = createServer({ port, dataDir, smtp: null, sendMail: async (m) => mails.push(m), publicUrl: `http://localhost:${port}`, now: () => NOW });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));
  const acc = srv.accounts; const db = srv.db; const wq = srv.workqueue; const it = srv.incometax; const PW = 'une phrase assez longue';
  const mk = (email, name, role, clientId) => { const { token } = acc.invite(null, { email, name, role, clientId }); return acc.acceptInvite(token, PW); };
  const admin = mk('pierre@bvy.ca', 'Pierre-Joseph Brouillette', 'admin');
  const lea = mk('lea@bvy.ca', 'Léa Gagnon', 'lead');
  const mkc = (name, kind, ye) => { const c = acc.createClient(admin, name); wq.saveProfile(admin, c.id, { kind, yearEndMonth: String(ye || 12) }); return c; };
  const soc = mkc('Atelier Boréal inc.', 'entreprise', 6);
  const soc2 = mkc('Construction Laurentides ltée', 'entreprise', 3);
  const auto = mkc('Sophie Gagnon, graphiste', 'autonome');
  const jean = mkc('Jean Tremblay', 'particulier');
  const nadia = mkc('Nadia Côté', 'particulier');
  db.prepare("UPDATE clients SET profile_since = '2026-01-01'").run();
  wq.setBooks(admin, soc.id, 'done'); wq.setBooks(admin, soc2.id, 'progress');
  mk('jean@tremblay.ca', 'Jean Tremblay', 'client', jean.id);
  // Date simulée : 2027-02-10 (dossiers T1 2026 ouverts, T2 des exercices terminés)
  srv.payrollTick();
  const files = db.prepare('SELECT id, client_id, form, status FROM tax_files').all();
  const f = (cid) => files.find((x) => x.client_id === cid);
  // Société : fermeture faite, montants inscrits, en révision
  const fs1 = f(soc.id);
  if (fs1) { it.advance(admin, fs1.id, { action: 'books' }); it.advance(admin, fs1.id, { action: 'closing', chk_bank: '1', chk_cca: '1', chk_recon: '1', chk_fs: '1' });
    it.saveFigures(admin, fs1.id, { bookIncome: '84 300', taxable: '80 100', fedTax: '7 209', qcTax: '2 563,20', paid: '6 000' }); }
  // Particulier : 4 documents reçus
  const fj = f(jean.id);
  if (fj) { const docs = JSON.parse(db.prepare('SELECT docs FROM tax_files WHERE id = ?').get(fj.id).docs); ['t4', 'rrsp', 'noa'].forEach((k) => { docs.find((d) => d.k === k).status = 'received'; }); docs.find((d) => d.k === 'childcare').status = 'na';
    db.prepare('UPDATE tax_files SET docs = ? WHERE id = ?').run(JSON.stringify(docs), fj.id); }
  console.log('dossiers', files.map((x) => `${x.client_id}:${x.form}:${x.status}`).join(' '));
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
    await p.goto(`${B}/impots`); await shot(p, '01-impots-equipe', vp);
    if (fs1) { await p.goto(`${B}/impots/${fs1.id}`); await shot(p, '02-t2-revision', vp); }
    if (fj) { await p.goto(`${B}/impots/${fj.id}`); await shot(p, '03-t1-documents-equipe', vp); }
    const q = await (await br.newContext({ viewport: { width: w, height: h } })).newPage();
    await login(q, 'jean@tremblay.ca');
    if (fj) { await q.goto(`${B}/impots/${fj.id}`); await shot(q, '04-client-documents', vp); }
  }
  console.log('problèmes', problems); await br.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
