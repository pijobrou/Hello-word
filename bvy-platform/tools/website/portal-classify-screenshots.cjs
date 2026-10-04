// Captures du classement (workflow 07), données fictives et fausse IA → review/portal-classement/
const path = require('path'); const fs = require('fs'); const os = require('os');
const APP = path.resolve(__dirname, '../../apps/portal');
const OUT = path.resolve(__dirname, '../../review/portal-classement');
const { createServer } = require(path.join(APP, 'server.js'));
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.resolve(__dirname, '../../apps/website/node_modules/playwright'))); }
const fakeAi = { model: 'claude-opus-5-5', async classify(lines) {
  return { model: 'claude-opus-5-5', usage: { input_tokens: 1800, output_tokens: 300 }, results: lines.map((l) => (
    /amazon/i.test(l.party) ? { ref: l.ref, account_id: '64', confidence: 91, reason: 'Achats en ligne habituels de petites fournitures de bureau.' }
      : /best buy/i.test(l.party) ? { ref: l.ref, account_id: '15', confidence: 78, reason: 'Montant élevé dans un magasin d’électronique : probablement de l’équipement informatique à amortir.' }
        : { ref: l.ref, account_id: 'aucun', confidence: 30, reason: 'Impossible de savoir.' })) }; } };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const NOW = Date.UTC(2026, 9, 5, 14, 0);
  const mails = []; const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shots07-'));
  const probe = createServer({ port: 0, dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'probe-')), smtp: null, sendMail: async () => {}, publicUrl: 'http://localhost:1' });
  await new Promise((r) => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; probe.close();
  const srv = createServer({ port, dataDir, smtp: null, sendMail: async (m) => mails.push(m), publicUrl: `http://localhost:${port}`, now: () => NOW, ai: fakeAi });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));
  const acc = srv.accounts; const db = srv.db; const cl = srv.classifier; const PW = 'une phrase assez longue';
  const mk = (email, name, role, clientId) => { const { token } = acc.invite(null, { email, name, role, clientId }); return acc.acceptInvite(token, PW); };
  const admin = mk('pierre@bvy.ca', 'Pierre-Joseph Brouillette', 'admin');
  const soc = acc.createClient(admin, 'Atelier Boréal inc.');
  srv.workqueue.saveProfile(admin, soc.id, { kind: 'entreprise', yearEndMonth: '12' });
  const marie = mk('marie@boreal.ca', 'Marie Bouchard', 'client', soc.id);
  cl.saveChart(soc.id, [['60', 'Repas et représentation'], ['64', 'Fournitures de bureau'], ['62', 'Télécommunications'], ['15', 'Équipement informatique', 'Fixed Asset'], ['70', 'Frais de véhicule'], ['80', 'Dépenses non catégorisées'], ['72', 'Publicité']]
    .map(([Id, Name, AccountType = 'Expense']) => ({ Id, Name, AccountType })));
  cl.saveHistory(soc.id, [...Array(14).fill(['Bell Canada', '62']), ['Bell Canada', '72'], ...Array(6).fill(['Ultramar', '70'])].map(([party, accountId], i) => ({ party, accountId, amount: 13452, date: `2026-0${(i % 8) + 1}-12` })));
  let n = 0;
  const item = (party, amount, date, detail) => db.prepare(`INSERT INTO qbo_items (client_id, kind, qbo_type, qbo_id, txn_date, amount_cents, counterparty, detail, qbo_url, first_seen, last_seen)
    VALUES (?, 'uncategorized', 'Purchase', ?, ?, ?, ?, ?, ?, 'x', 'x')`).run(soc.id, String(++n), date, amount, party, detail, `https://app.qbo.intuit.com/app/expense?txnId=${n}`);
  [[4299, '2026-09-03', 'AMZN Mktp CA'], [12850, '2026-09-09', 'AMZN Mktp CA'], [2105, '2026-09-15', null], [6740, '2026-09-22', 'Amazon.ca'], [8930, '2026-09-27', null]].forEach(([a, d, x]) => item('Amazon', a, d, x));
  item('Bell Canada', 13452, '2026-09-18', 'Facture mensuelle'); item('Bell Canada', 13452, '2026-08-18', null);
  item('Ultramar', 8420, '2026-09-11', 'Essence');
  item('Best Buy', 185000, '2026-09-24', 'Portable');
  item('Virement Interac — J. Roy', 50000, '2026-09-29', null);
  db.prepare("INSERT INTO client_decisions (client_id, counterparty, question, answer, answered_at) VALUES (?, 'virement interac — j. roy', 'uncategorized', 'Autre — remboursement d’un prêt personnel', '2026-07-30T14:00:00Z')").run(soc.id);
  cl.saveSettings(admin, { aiEnabled: '1', strong: '95', suggest: '75' });
  await cl.classifyClient(soc.id);
  const ul = cl.groups(admin, soc.id).find((g) => /ultramar/i.test(g.party));
  cl.decide(admin, soc.id, ul.key, { action: 'accept' });
  void marie;

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
    await p.goto(`${B}/clients/${soc.id}/classement`); await shot(p, '01-classement', vp);
    await p.goto(`${B}/admin/suggestions`); await shot(p, '02-reglages-suggestions', vp);
  }
  console.log('problèmes', problems); await br.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
