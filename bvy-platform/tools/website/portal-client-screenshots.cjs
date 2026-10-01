// Captures du portail client (phase 3), données fictives « Atelier Boréal ».
// node --disable-warning=ExperimentalWarning tools/website/portal-client-screenshots.cjs  → review/portal-client/
const path = require('path');
const fs = require('fs'); const os = require('os');
const APP = path.resolve(__dirname, '../../apps/portal');
const OUT = path.resolve(__dirname, '../../review/portal-client');
const { createServer } = require(path.join(APP, 'server.js'));
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.resolve(__dirname, '../../apps/website/node_modules/playwright'))); }
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(40000, 65)]);
(async () => {
  const mails = [];
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shots3-'));
  const probe = createServer({ port: 0, dataDir, smtp: null, sendMail: async () => {}, publicUrl: 'http://localhost:1' });
  await new Promise((r) => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; probe.close();
  const srv = createServer({ port, dataDir, smtp: null, sendMail: async (m) => mails.push(m), publicUrl: `http://localhost:${port}` });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));
  const acc = srv.accounts; const db = srv.db; const PW = 'une phrase assez longue';
  const mk = (email, name, role, clientId) => { const { token } = acc.invite(null, { email, name, role, clientId }); return acc.acceptInvite(token, PW); };
  const admin = mk('pierre@bvy.ca', 'Pierre-Jean Brouillette', 'admin');
  const c = acc.createClient(admin, 'Atelier Boréal inc.'); acc.createClient(admin, 'Boutique Laurentides inc.');
  const marie = mk('marie@atelierboreal.ca', 'Marie-Ève Bouchard', 'client', c.id);
  // Données fictives via la même logique que l'interface
  const { createPortal } = require(path.join(APP, 'lib/portal.js'));
  const portal = createPortal(db, { dataDir, audit: acc.audit });
  portal.setQboUrl(admin, c.id, 'https://qbo.intuit.com/app/homepage');
  portal.saveSnapshot(admin, c.id, { asOf: '2026-09-30', cash: '48 215,60', cashNote: 'Dans vos 2 comptes bancaires — 2 750 $ de plus qu’au 31 août.',
    receivable: '18 430', receivableNote: '7 factures envoyées, dont 2 en retard de plus de 30 jours (5 120 $).',
    payable: '9 876,45', payableNote: '5 factures de fournisseurs à payer d’ici le 31 octobre. Aucune en retard.',
    health: 'watch', healthWhy: 'Vos dépenses ont augmenté de 12 % ce mois-ci, plus vite que vos revenus (+ 8 %). Votre encaisse reste solide : rien d’urgent, mais à suivre en octobre.',
    changes: 'Revenus + 8 % | Deux nouveaux clients en septembre.\nDépenses + 12 % | Surtout la publicité en ligne (1 900 $).\n2 factures en retard | 5 120 $ attendus depuis plus de 30 jours : un rappel peut aider.',
    work: 'Tenue de livres — septembre | 85 %\nRapprochement bancaire | 65 %\nTPS/TVQ — 3e trimestre | en attente de la tenue de livres\nPaie | à jour' });
  portal.createTask(admin, c.id, { kind: 'question', title: 'Nous avons trouvé un paiement Costco de 842,37 $. Était-ce une dépense d’entreprise ?', detail: 'Payé le 18 septembre avec la carte Visa entreprise •• 4417.', qboUrl: 'https://qbo.intuit.com/app/register' });
  portal.createTask(admin, c.id, { kind: 'document', title: 'Envoyez la facture Hydro-Québec de septembre', detail: 'Nous en avons besoin pour préparer votre déclaration de TPS/TVQ.', dueDate: '2026-10-10' });
  portal.createTask(admin, c.id, { kind: 'approval', title: 'Approuvez les heures de paie du 15 au 28 septembre', detail: '3 employés, 212 heures au total.' });
  portal.saveDocument(admin, c.id, { name: 'Résumé de septembre 2026.pdf', data: PDF }, { category: 'report', note: 'Vos chiffres du mois expliqués en une page.' });
  portal.saveDocument(marie, c.id, { name: 'Relevé Desjardins septembre.pdf', data: PDF }, {});
  portal.postMessage(marie, c.id, 'Bonjour, est-ce que je dois garder les reçus papier après les avoir envoyés ?');
  portal.postMessage(admin, c.id, 'Bonjour Marie-Ève, une photo lisible envoyée dans le portail suffit. Gardez les originaux 6 ans par prudence, dans une boîte simple.');
  const B = `http://localhost:${port}`;
  const b = await chromium.launch();
  const shot = async (page, name) => { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); console.log('✔', name); };
  const lastCode = () => mails[mails.length - 1].subject.match(/(\d{6})/)[1];
  async function login(page, email) {
    await page.goto(`${B}/connexion`); await page.fill('#email', email); await page.fill('#password', PW);
    await page.click('button[type=submit]'); await page.waitForURL(/verification/);
    await page.fill('#code', lastCode()); await page.click('button[type=submit]'); await page.waitForURL(/accueil/);
  }
  const problems = [];
  for (const [vp, w, h] of [['bureau', 1440, 900], ['mobile', 390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => problems.push(`${vp} ${e.message}`));
    await login(page, 'marie@atelierboreal.ca');
    for (const [p, n] of [['/accueil', '01-tableau-de-bord'], ['/a-faire', '02-a-faire'], ['/documents', '03-documents'], ['/messages', '04-messages'], ['/rapports', '05-rapports']]) {
      await page.goto(B + p); await shot(page, `${n}-${vp}`);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push(`${vp} débordement ${p}`);
    }
    if (vp === 'mobile') { await page.goto(`${B}/accueil`); await page.click('[data-sheet]'); await page.screenshot({ path: `${OUT}/06-menu-plus-mobile.png` }); console.log('✔ 06-menu-plus-mobile'); }
    const s2 = await (await b.newContext({ viewport: { width: w, height: h }, ignoreHTTPSErrors: true })).newPage();
    await login(s2, 'pierre@bvy.ca');
    await shot(s2, `07-equipe-clients-${vp}`);
    await s2.goto(`${B}/clients/${c.id}`); await shot(s2, `08-equipe-tableau-${vp}`);
    await s2.goto(`${B}/clients/${c.id}/taches`); await shot(s2, `09-equipe-taches-${vp}`);
    if (await s2.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push(`${vp} débordement équipe`);
    await ctx.close();
  }
  console.log('problèmes', problems);
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
