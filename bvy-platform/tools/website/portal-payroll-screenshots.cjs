// Captures de la paie (workflow 12) avec des données fictives → review/portal-payroll/
const path = require('path'); const fs = require('fs'); const os = require('os');
const APP = path.resolve(__dirname, '../../apps/portal');
const OUT = path.resolve(__dirname, '../../review/portal-payroll');
const { createServer } = require(path.join(APP, 'server.js'));
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.resolve(__dirname, '../../apps/website/node_modules/playwright'))); }
(async () => {
  const mails = []; const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shots12-'));
  const probe = createServer({ port: 0, dataDir, smtp: null, sendMail: async () => {}, publicUrl: 'http://localhost:1' });
  await new Promise((r) => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; probe.close();
  const srv = createServer({ port, dataDir, smtp: null, sendMail: async (m) => mails.push(m), publicUrl: `http://localhost:${port}` });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));
  const acc = srv.accounts; const db = srv.db; const pay = srv.payroll; const wq = srv.workqueue; const PW = 'une phrase assez longue';
  const mk = (email, name, role, clientId) => { const { token } = acc.invite(null, { email, name, role, clientId }); return acc.acceptInvite(token, PW); };
  const admin = mk('pierre@bvy.ca', 'Pierre-Joseph Brouillette', 'admin');
  const today = new Date().toISOString().slice(0, 10);
  const plus = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const mkClient = (name, freq, next, emps) => {
    const c = acc.createClient(admin, name); wq.saveProfile(admin, c.id, { kind: 'entreprise', payroll: '1', gstFreq: 'quarterly' });
    for (const [n, t] of emps) pay.addEmployee(admin, c.id, { name: n, payType: t });
    pay.saveSchedule(admin, c.id, { frequency: freq, nextPayDate: next, leadDays: '3' });
    return c;
  };
  const a = mkClient('Atelier Boréal inc.', 'biweekly', plus(2), [['Luc Gagnon', 'hourly'], ['Sara Roy', 'salary'], ['Émile Côté', 'hourly']]);
  const b = mkClient('Construction Laurentides ltée', 'weekly', plus(1), [['Marc Pelletier', 'hourly'], ['Julie Fortin', 'hourly']]);
  const c = mkClient('Boutique Fleur de Sel inc.', 'semimonthly', plus(3), [['Nadia Lavoie', 'hourly']]);
  mk('marie@atelierboreal.ca', 'Marie-Ève Bouchard', 'client', a.id);
  mk('jean@laurentides.ca', 'Jean Pelletier', 'client', b.id);
  srv.payrollTick();
  const run = (cid) => db.prepare('SELECT id FROM pay_runs WHERE client_id = ? ORDER BY pay_date LIMIT 1').get(cid).id;
  // Construction : heures reçues, sommaire inscrit → validation
  const jean = acc.userByEmail('jean@laurentides.ca');
  const marc = db.prepare("SELECT id FROM employees WHERE name = 'Marc Pelletier'").get().id;
  pay.submitHours(jean, run(b.id), { [`reg_${marc}`]: '42', [`ot_${marc}`]: '3', note: 'Julie en congé cette semaine' }, null);
  pay.saveSummary(admin, run(b.id), { gross: '1 640,00', net: '1 238,55', remit: '587,20', employeesPaid: '1' });
  // Fleur de Sel : approuvée → en préparation
  pay.move(admin, run(c.id), 'hours', 'Feuille reçue par courriel');
  pay.saveSummary(admin, run(c.id), { gross: '860,00', net: '694,10', remit: '281,35', employeesPaid: '1' });
  db.prepare("UPDATE pay_runs SET status = 'preparing' WHERE id = ?").run(run(c.id));
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
    await p.goto(`${B}/paie`); await shot(p, '01-paie-equipe', vp);
    await p.goto(`${B}/clients/${a.id}/paie`); await shot(p, '02-onglet-paie-client', vp);
    await p.goto(`${B}/paie/${run(b.id)}`); await shot(p, '03-fiche-paie-equipe', vp);
    const q = await (await br.newContext({ viewport: { width: w, height: h } })).newPage();
    await login(q, 'marie@atelierboreal.ca');
    await q.goto(`${B}/paie/${run(a.id)}`); await shot(q, '04-client-saisie-heures', vp);
    const r = await (await br.newContext({ viewport: { width: w, height: h } })).newPage();
    await login(r, 'jean@laurentides.ca');
    await r.goto(`${B}/paie/${run(b.id)}`); await shot(r, '05-client-approbation', vp);
    await r.goto(`${B}/accueil`); await shot(r, '06-client-accueil', vp);
  }
  console.log('problèmes', problems); await br.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
