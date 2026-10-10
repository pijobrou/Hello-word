// Captures de la conciliation assistée (workflow 07, partie B) — relevé FICTIF et QuickBooks simulé → review/portal-conciliation/
const path = require('path'); const fs = require('fs'); const os = require('os');
const APP = path.resolve(__dirname, '../../apps/portal');
const OUT = path.resolve(__dirname, '../../review/portal-conciliation');
const { createServer } = require(path.join(APP, 'server.js'));
const { desjardinsPdf } = require(path.join(APP, 'test/pdf-fixture.js'));
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.resolve(__dirname, '../../apps/website/node_modules/playwright'))); }
const DJ = { opening: 110085, lines: [
  { day: '1 SEP', code: 'DI', desc: 'Dépôt direct / CIUSSS FICTIF', amount: 2578534 },
  { day: '1 SEP', code: 'PWW', desc: 'Paiement facture - AccèsD Internet /', more: 'HYDRO ENTREPRISE', amount: -150000 },
  { day: '2 SEP', code: 'RA', desc: 'Câble / VIDEOTRON LTEE', amount: -49294 },
  { day: '2 SEP', code: 'RA', desc: 'Assurance / INTACT ASSURANCE', amount: -67150 },
  { day: '4 SEP', code: 'DCN', desc: 'Chèque no 388', amount: -582016 },
  { day: '4 SEP', code: 'DCN', desc: 'Chèque no 389', amount: -685125 },
  { day: '12 SEP', code: 'CT', desc: 'Dépôt / LOYERS DE LA SEMAINE', amount: 310000 },
  { day: '15 SEP', code: 'RA', desc: 'Location automobile / SUBARU FINANCE', amount: -60007 },
  { day: '22 SEP', code: 'ACH', desc: 'Achat / RESTO LE GODEFROY', amount: -3677 },
  { day: '24 SEP', code: 'RA', desc: 'Paiement / SERVICES DE PAIE', amount: -1954590 },
  { day: '30 SEP', code: 'FIX', desc: "Frais fixes d'utilisation", amount: -7050 },
] };
const q = (id, date, amount, type, name, docNum) => ({ type, id, date, amount, name, memo: null, docNum: docNum || null, url: `https://app.qbo.intuit.com/app/expense?txnId=${id}` });
const LEDGER = [q('1', '2025-08-30', 2578534, 'Dépôt', 'CIUSSS'), q('2', '2025-09-01', -150000, 'Paiement de facture', 'Hydro-Québec'),
  q('3', '2025-09-02', -49294, 'Dépense', 'Vidéotron'), q('4', '2025-09-02', -67150, 'Dépense', 'Intact Assurance'),
  q('5', '2025-08-28', -582016, 'Chèque', 'Fournitures Médicales', '388'), q('6', '2025-08-29', -658125, 'Chèque', 'Plomberie Roy', '389'),
  q('7', '2025-09-10', 120000, 'Paiement reçu', 'Résident A'), q('8', '2025-09-11', 190000, 'Paiement reçu', 'Résident B'),
  q('9', '2025-09-15', -60007, 'Dépense', 'Subaru Finance'), q('10', '2025-09-24', -1954590, 'Dépense', 'Services de paie'),
  q('11', '2025-09-17', -60007, 'Dépense', 'Subaru Finance'), q('12', '2025-09-29', -110015, 'Chèque', 'Loyer du local', '390')];
// QuickBooks simulé en mémoire (aucun appel réel)
const STORE = {}; let NEXT = 700;
const qboApi = { withToken: async (cid, fn) => fn({ realm: 'r', token: 't', appBase: 'https://app.qbo.intuit.com', qbo: {
  get: async (realm, p) => { const [path, id] = p.split('/'); const T = path === 'deposit' ? 'Deposit' : 'Purchase'; return { [T]: JSON.parse(JSON.stringify(STORE[`${T}:${id}`])) }; },
  post: async (realm, path, token, obj, params) => { const T = path === 'deposit' ? 'Deposit' : 'Purchase';
    if (params && params.operation === 'delete') { delete STORE[`${T}:${obj.Id}`]; return { [T]: obj }; }
    const o = JSON.parse(JSON.stringify(obj)); if (!o.Id) o.Id = String(NEXT++); o.TotalAmt = o.Line.reduce((t, l) => t + Math.round(l.Amount * 100), 0) / 100; STORE[`${T}:${o.Id}`] = o; return { [T]: o }; } } }) };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const NOW = Date.UTC(2025, 9, 6, 14, 0);
  const mails = []; const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shotsB-'));
  const probe = createServer({ port: 0, dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'probe-')), smtp: null, sendMail: async () => {}, publicUrl: 'http://localhost:1' });
  await new Promise((r) => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; probe.close();
  const srv = createServer({ port, dataDir, smtp: null, sendMail: async (m) => mails.push(m), publicUrl: `http://localhost:${port}`, now: () => NOW, ledger: async () => LEDGER, qboApi });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));
  const acc = srv.accounts; const PW = 'une phrase assez longue';
  const mk = (email, name, role, clientId) => { const { token } = acc.invite(null, { email, name, role, clientId }); return acc.acceptInvite(token, PW); };
  const admin = mk('pierre@bvy.ca', 'Pierre-Joseph Brouillette', 'admin');
  const soc = acc.createClient(admin, 'Résidence Fictive inc.');
  srv.workqueue.saveProfile(admin, soc.id, { kind: 'entreprise', yearEndMonth: '12' });
  srv.classifier.saveChart(soc.id, [{ Id: '35', Name: 'Desjardins — opérations', AccountType: 'Bank' }, { Id: '60', Name: 'Repas et représentation', AccountType: 'Expense' },
    { Id: '61', Name: 'Frais bancaires', AccountType: 'Expense' }, { Id: '62', Name: 'Entretien et réparations', AccountType: 'Expense' }, { Id: '80', Name: 'Dépenses non catégorisées', AccountType: 'Expense' }]);
  srv.classifier.saveTaxCodes(soc.id, [{ Id: '7', Name: 'TPS/TVQ QC - 9,975' }, { Id: '9', Name: 'Exonéré' }]);
  srv.classifier.saveHistory(soc.id, [1, 2, 3, 4].map((i) => ({ party: 'Resto le Godefroy', accountId: '60', amount: 3000, date: `2025-0${i}-10`, taxCode: '7' }))
    .concat([1, 2, 3].map((i) => ({ party: 'Frais fixes', accountId: '61', amount: 7050, date: `2025-0${i}-30`, taxCode: '9' }))));
  STORE['Purchase:900'] = { Id: '900', SyncToken: '0', TotalAmt: 412.5, Line: [{ Amount: 412.5, DetailType: 'AccountBasedExpenseLineDetail', AccountBasedExpenseLineDetail: { AccountRef: { value: '80' } } }] };
  srv.db.prepare(`INSERT INTO qbo_items (client_id, kind, qbo_type, qbo_id, txn_date, amount_cents, counterparty, qbo_url, first_seen, last_seen)
    VALUES (?, 'uncategorized', 'Purchase', '900', '2025-09-18', 41250, 'Plomberie Roy', 'https://app.qbo.intuit.com/app/expense?txnId=900', 'x', 'x')`).run(soc.id);
  srv.classifier.saveHistory(soc.id, [1, 2, 3, 4].map((i) => ({ party: 'Resto le Godefroy', accountId: '60', amount: 3000, date: `2025-0${i}-10`, taxCode: '7' }))
    .concat([1, 2, 3].map((i) => ({ party: 'Frais fixes', accountId: '61', amount: 7050, date: `2025-0${i}-30`, taxCode: '9' })))
    .concat([1, 2, 3].map((i) => ({ party: 'Plomberie Roy', accountId: '62', amount: 40000, date: `2025-0${i}-12`, taxCode: '7' }))));
  await srv.classifier.classifyClient(soc.id);
  const docId = srv.portal.saveDocument(admin, soc.id, { name: 'releve-septembre-2025.pdf', data: desjardinsPdf(DJ) }, { docType: 'releve_banque' });
  const rid = await srv.reconciler.start(admin, soc.id, { docId, accountId: '35' });
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
    await p.goto(`${B}/conciliations/${rid}`); await shot(p, '01-conciliation', vp);
    await p.goto(`${B}/clients/${soc.id}/conciliation`); await shot(p, '02-onglet', vp);
    await p.goto(`${B}/clients/${soc.id}/classement`); await shot(p, '03-classement', vp);
    if (vp === 'bureau') {
      await p.goto(`${B}/conciliations/${rid}`); await p.click('form[action$="/creer-tout"] button'); await p.waitForURL(/ok=/); await shot(p, '04-apres-creation', vp);
    }
  }
  console.log('problèmes', problems); await br.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
