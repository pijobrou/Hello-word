// Captures des demandes du gouvernement (workflow 17), données fictives → review/portal-gouvernement/
const path = require('path'); const fs = require('fs'); const os = require('os');
const APP = path.resolve(__dirname, '../../apps/portal');
const OUT = path.resolve(__dirname, '../../review/portal-gouvernement');
const { createServer } = require(path.join(APP, 'server.js'));
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.resolve(__dirname, '../../apps/website/node_modules/playwright'))); }
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const NOW = Date.UTC(2026, 9, 5, 14, 0);
  const mails = []; const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shots17-'));
  const probe = createServer({ port: 0, dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'probe-')), smtp: null, sendMail: async () => {}, publicUrl: 'http://localhost:1' });
  await new Promise((r) => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; probe.close();
  const srv = createServer({ port, dataDir, smtp: null, sendMail: async (m) => mails.push(m), publicUrl: `http://localhost:${port}`, now: () => NOW });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));
  const acc = srv.accounts; const db = srv.db; const gov = srv.gov; const portal = srv.portal; const wq = srv.workqueue; const PW = 'une phrase assez longue';
  const mk = (email, name, role, clientId) => { const { token } = acc.invite(null, { email, name, role, clientId }); return acc.acceptInvite(token, PW); };
  const admin = mk('pierre@bvy.ca', 'Pierre-Joseph Brouillette', 'admin');
  const lea = mk('lea@bvy.ca', 'Léa Gagnon', 'lead');
  const mkc = (name, kind) => { const c = acc.createClient(admin, name); wq.saveProfile(admin, c.id, { kind, yearEndMonth: '12' }); return c; };
  const soc = mkc('Atelier Boréal inc.', 'entreprise');
  const cons = mkc('Construction Laurentides ltée', 'entreprise');
  const jean = mkc('Jean Tremblay', 'particulier');
  const sophie = mkc('Sophie Gagnon, graphiste', 'autonome');
  db.prepare("UPDATE clients SET profile_since = '2026-01-01'").run();
  const marie = mk('marie@boreal.ca', 'Marie Bouchard', 'client', soc.id);
  const pdf = (t) => Buffer.from(`%PDF-1.4\n% ${t}\n`);
  const letter = portal.saveDocument(marie, soc.id, { name: 'Lettre Revenu Quebec - verification TPS-TVQ.pdf', data: pdf('l') }, {});
  const r1 = gov.create(admin, soc.id, { agency: 'rq', kind: 'verification', program: 'taxes', reference: 'VR-2026-118', letterDate: '2026-09-28', dueDate: '2026-10-28',
    summary: 'Vérification de la TPS/TVQ du 2026-01-01 au 2026-06-30. L’agente demande les pièces justificatives des crédits de taxe sur les intrants de plus de 500 $ et les relevés bancaires de la période.',
    letterDocId: letter, items: 'Relevés bancaires de janvier à juin 2026\nFactures d’achat de plus de 500 $ (liste jointe à la lettre)\nContrats de vente avec les clients hors Québec\nRegistre des ventes du 1er semestre' });
  const items = JSON.parse(db.prepare('SELECT items FROM gov_requests WHERE id = ?').get(r1).items);
  gov.setItem(admin, r1, items[3].k, 'received'); gov.setItem(admin, r1, items[2].k, 'na');
  gov.askClient(admin, r1);
  const t = db.prepare('SELECT id FROM tasks WHERE gov_request_id = ?').get(r1).id;
  portal.saveDocument(marie, soc.id, { name: 'releves-banque-janvier-juin.pdf', data: pdf('r') }, { taskId: t });
  gov.create(lea, cons.id, { agency: 'arc', kind: 'documents', program: 'paie', reference: 'PD7-4471', letterDate: '2026-09-24', dueDate: '2026-10-08',
    summary: 'Demande de renseignements sur les retenues à la source de 2025 : écart de 2 410,00 $ entre les T4 et les versements.', amount: '2 410,00', items: 'Sommaire T4 2025\nRelevés de versements 2025' });
  const r3 = gov.create(admin, jean.id, { agency: 'arc', kind: 'cotisation', program: 't1', letterDate: '2026-09-15', dueDate: '',
    summary: 'Nouvelle cotisation 2024 : frais de garde de 6 200,00 $ refusés faute de reçus.', amount: '1 250,00', items: '' });
  const r4 = gov.create(admin, sophie.id, { agency: 'cnesst', kind: 'autre', program: 'cnesst', letterDate: '2026-09-10', dueDate: '2026-10-20', summary: 'Mise à jour de la déclaration des salaires 2025 demandée.', items: '' });
  gov.advance(admin, r4, 'ready', {}); gov.advance(admin, r4, 'sent', { sentOn: '2026-10-02', sentHow: 'Autre', confirmation: 'DS-55120' });
  void r3;
  srv.anomalies.scanAll();

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
    await p.goto(`${B}/gouvernement`); await shot(p, '01-gouvernement', vp);
    await p.goto(`${B}/gouvernement/${r1}`); await shot(p, '02-demande', vp);
    await p.goto(`${B}/anomalies?gravite=urgent&etat=active`); await shot(p, '03-anomalies-urgentes', vp);
    const q = await (await br.newContext({ viewport: { width: w, height: h } })).newPage();
    await login(q, 'marie@boreal.ca');
    await q.goto(`${B}/accueil`); await shot(q, '04-client-accueil', vp);
  }
  console.log('problèmes', problems); await br.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
