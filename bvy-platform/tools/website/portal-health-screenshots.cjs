// Captures de la santé financière et des résumés (workflows 15 et 16), données fictives → review/portal-sante/
const path = require('path'); const fs = require('fs'); const os = require('os');
const APP = path.resolve(__dirname, '../../apps/portal');
const OUT = path.resolve(__dirname, '../../review/portal-sante');
const { createServer } = require(path.join(APP, 'server.js'));
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.resolve(__dirname, '../../apps/website/node_modules/playwright'))); }
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const NOW = Date.UTC(2026, 9, 5, 14, 0);
  const at = (d) => `${d}T15:00:00.000Z`;
  const mails = []; const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shots15-'));
  const probe = createServer({ port: 0, dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'probe-')), smtp: null, sendMail: async () => {}, publicUrl: 'http://localhost:1' });
  await new Promise((r) => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; probe.close();
  const srv = createServer({ port, dataDir, smtp: null, sendMail: async (m) => mails.push(m), publicUrl: `http://localhost:${port}`, now: () => NOW });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));
  const acc = srv.accounts; const db = srv.db; const portal = srv.portal; const wq = srv.workqueue; const PW = 'une phrase assez longue';
  const mk = (email, name, role, clientId) => { const { token } = acc.invite(null, { email, name, role, clientId }); return acc.acceptInvite(token, PW); };
  const admin = mk('pierre@bvy.ca', 'Pierre-Joseph Brouillette', 'admin');
  const lea = mk('lea@bvy.ca', 'Léa Gagnon', 'lead');
  const mkc = (name, kind, extra = {}) => { const c = acc.createClient(admin, name); wq.saveProfile(admin, c.id, { kind, yearEndMonth: '12', gstFreq: 'quarterly', ...extra }); return c; };
  const soc = mkc('Atelier Boréal inc.', 'entreprise');
  const cons = mkc('Construction Laurentides ltée', 'entreprise');
  db.prepare("UPDATE clients SET profile_since = '2026-01-01'").run();
  const marie = mk('marie@boreal.ca', 'Marie Bouchard', 'client', soc.id);
  mk('marc@laurentides.ca', 'Marc Pelletier', 'client', cons.id);
  const snap = (cid, d) => db.prepare('INSERT INTO client_snapshots (client_id, data, updated_at, source) VALUES (?, ?, ?, ?)').run(cid, JSON.stringify(d), at('2026-10-05'), 'qbo');
  snap(soc.id, { asOf: '2026-10-05', cash: { amount: 4812000, note: 'Dans 2 comptes bancaires, selon QuickBooks.', hint: '2 comptes bancaires' }, receivable: { amount: 1874000, note: '7 factures impayées, dont 2 en retard.', hint: '2 factures en retard', tone: 'down' },
    payable: { amount: 930000, note: '4 factures de fournisseurs.', hint: '4 factures de fournisseurs' }, late: { count: 2, amount: 412000 },
    pl: { months: ['2026-08', '2026-09'], income: [4000000, 3600000], expenses: [3000000, 3900000] },
    changes: [{ what: 'Revenus de septembre 2026 : 36 000,00 $ (− 10 %)', why: 'Comparé à août 2026 (40 000,00 $), selon QuickBooks.', label: 'Revenus', delta: '− 10 %', tone: 'down' },
      { what: 'Dépenses de septembre 2026 : 39 000,00 $ (+ 30 %)', why: 'Comparé à août 2026 (30 000,00 $), selon QuickBooks.', label: 'Dépenses', delta: '+ 30 %', tone: 'down' }], work: [{ name: 'Tenue de livres de septembre', progress: 80, status: '' }] });
  snap(cons.id, { asOf: '2026-10-05', cash: { amount: 2380000 }, receivable: { amount: 920000 }, payable: { amount: 610000 }, late: { count: 0, amount: 0 }, pl: { months: ['2026-08', '2026-09'], income: [6100000, 6650000], expenses: [5200000, 5340000] }, changes: [], work: [] });
  // Activité de septembre pour « Ce que BVY a fait »
  for (const [n, d] of [['Releve Desjardins 2026-09.pdf', '2026-09-08'], ['Visa septembre 2026.pdf', '2026-09-10'], ['Facture Bell 2026-09.pdf', '2026-09-22']]) {
    const id = portal.saveDocument(marie, soc.id, { name: n, data: Buffer.from(`%PDF-1.4\n% ${n}\n`) }, {});
    db.prepare('UPDATE documents SET filed = 1, filed_at = ? WHERE id = ?').run(at(d), id);
  }
  const q = portal.createTask(admin, soc.id, { kind: 'question', title: 'Paiement Costco ?' });
  db.prepare("UPDATE tasks SET status = 'done', answer = 'Oui', answered_by = ?, answered_at = ? WHERE id = ?").run(marie.id, at('2026-09-20'), q);
  portal.createTask(lea, soc.id, { kind: 'document', title: 'Envoyez le contrat de location du local', dueDate: '2026-10-15' });
  srv.health.saveNote(lea, soc.id, { comment: 'La hausse des dépenses vient surtout de la nouvelle scie (équipement). On en parle à notre rencontre du 15 octobre.' });
  srv.payrollTick(); await new Promise((r) => setTimeout(r, 200));
  const sid = db.prepare('SELECT id FROM summaries WHERE client_id = ?').get(soc.id).id;
  srv.summaries.update(lea, sid, { intro: 'Septembre a été plus calme que l’été : vos revenus ont baissé de 10 % et vos dépenses ont augmenté avec l’achat de la nouvelle scie. Résultat : une perte de 3 000,00 $ ce mois-ci, mais votre trésorerie reste solide (48 120,00 $ en banque).', income: '36 000', expenses: '39 000' });
  srv.summaries.publish(lea, sid);

  const B = `http://localhost:${port}`; const br = await chromium.launch();
  const lastCode = () => mails.filter((m) => /code BVY/.test(m.subject)).pop().subject.match(/(\d{6})/)[1];
  async function login(page, email) {
    await page.goto(`${B}/connexion`); await page.fill('#email', email); await page.fill('#password', PW);
    await page.click('button[type=submit]'); await page.waitForURL(/verification/); await page.fill('#code', lastCode()); await page.click('button[type=submit]'); await page.waitForURL(/accueil/);
  }
  const problems = [];
  const shot = async (p, name, vp) => { await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/${name}-${vp}.png`, fullPage: true });
    if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push(`${vp} débordement ${name}`, ...(process.env.OVF ? await require(process.env.OVF)(p) : [])); };
  const consSum = db.prepare('SELECT id FROM summaries WHERE client_id = ?').get(cons.id).id;
  for (const [vp, w, h] of [['bureau', 1440, 900], ['mobile', 390, 844]]) {
    const q2 = await (await br.newContext({ viewport: { width: w, height: h } })).newPage();
    await login(q2, 'marie@boreal.ca');
    await q2.goto(`${B}/accueil`); await shot(q2, '01-client-accueil-sante', vp);
    await q2.goto(`${B}/rapports/resume/${sid}`); await shot(q2, '02-client-resume', vp);
    const p = await (await br.newContext({ viewport: { width: w, height: h } })).newPage();
    await login(p, 'pierre@bvy.ca');
    await p.goto(`${B}/clients/${soc.id}/sante`); await shot(p, '03-equipe-sante', vp);
    await p.goto(`${B}/resumes`); await shot(p, '04-resumes', vp);
    await p.goto(`${B}/resumes/${consSum}`); await shot(p, '05-resume-brouillon', vp);
  }
  console.log('problèmes', problems); await br.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
