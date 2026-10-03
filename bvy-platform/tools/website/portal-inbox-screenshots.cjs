// Captures de la Réception, des documents et de l'historique (workflows 09 et 10), données fictives → review/portal-inbox/
const path = require('path'); const fs = require('fs'); const os = require('os');
const APP = path.resolve(__dirname, '../../apps/portal');
const OUT = path.resolve(__dirname, '../../review/portal-inbox');
const { createServer } = require(path.join(APP, 'server.js'));
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.resolve(__dirname, '../../apps/website/node_modules/playwright'))); }
const DAY = 86_400_000;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const NOW = Date.UTC(2026, 9, 19, 14, 0); // lundi 2026-10-19, 10 h
  const ago = (d, h = 0) => new Date(NOW - d * DAY - h * 3600_000).toISOString();
  const mails = []; const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shots09-'));
  const probe = createServer({ port: 0, dataDir, smtp: null, sendMail: async () => {}, publicUrl: 'http://localhost:1' });
  await new Promise((r) => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; probe.close();
  const srv = createServer({ port, dataDir, smtp: null, sendMail: async (m) => mails.push(m), publicUrl: `http://localhost:${port}`, now: () => NOW });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));
  const acc = srv.accounts; const db = srv.db; const portal = srv.portal; const PW = 'une phrase assez longue';
  const mk = (email, name, role, clientId) => { const { token } = acc.invite(null, { email, name, role, clientId }); return acc.acceptInvite(token, PW); };
  const admin = mk('pierre@bvy.ca', 'Pierre-Joseph Brouillette', 'admin');
  const lea = mk('lea@bvy.ca', 'Léa Gagnon', 'lead');
  const soc = acc.createClient(admin, 'Atelier Boréal inc.');
  const cons = acc.createClient(admin, 'Construction Laurentides ltée');
  const jean = acc.createClient(admin, 'Jean Tremblay');
  const marie = mk('marie@boreal.ca', 'Marie Bouchard', 'client', soc.id);
  const marc = mk('marc@laurentides.ca', 'Marc Pelletier', 'client', cons.id);
  const jeanU = mk('jean@tremblay.ca', 'Jean Tremblay', 'client', jean.id);
  const pdf = (t) => Buffer.from(`%PDF-1.4\n% ${t}\n`);
  const doc = (u, cid, name, data, opts = {}, when = 0) => { const id = portal.saveDocument(u, cid, { name, data }, opts); db.prepare('UPDATE documents SET created_at = ? WHERE id = ?').run(ago(when, 3), id); return id; };
  doc(marie, soc.id, 'Releve Desjardins 2026-09.pdf', pdf('a'), {}, 2);
  doc(marie, soc.id, 'Visa septembre 2026.pdf', pdf('b'), { docType: 'releve_carte', note: 'Carte de l’entreprise' }, 1);
  doc(marie, soc.id, 'releve-sept.pdf', pdf('a'), { note: 'Je ne suis pas sûre de l’avoir envoyé' }, 0);
  doc(jeanU, jean.id, 'IMG_2034.pdf', pdf('c'), {}, 0);
  const filed = doc(marie, soc.id, 'Facture Bell 2026-08.pdf', pdf('d'), {}, 20);
  srv.inbox.fileDocument(admin, filed, { type: 'facture_achat', period: '2026-08' });
  doc(admin, soc.id, 'Etats financiers 2026-06-30.pdf', pdf('e'), { category: 'report', docType: 'autre' }, 15);
  // Tâches : une sans réponse malgré 3 rappels, une répondue, deux en cours de relance
  const task = (u, cid, input, created, extra = {}) => { const id = portal.createTask(u, cid, input); db.prepare('UPDATE tasks SET created_at = ? WHERE id = ?').run(ago(created), id);
    const sets = Object.keys(extra).map((k) => `${k} = ?`).join(', '); if (sets) db.prepare(`UPDATE tasks SET ${sets} WHERE id = ?`).run(...Object.values(extra), id); return id; };
  const t1 = task(admin, cons.id, { kind: 'document', title: 'Envoyez le relevé bancaire Desjardins d’août' }, 23, { reminders_sent: 3, last_reminder_at: ago(9) });
  for (const d of [20, 16, 9]) db.prepare('INSERT INTO task_reminders (task_id, client_id, manual, sent_at) VALUES (?, ?, 0, ?)').run(t1, cons.id, ago(d));
  task(admin, soc.id, { kind: 'question', title: 'Nous avons trouvé un paiement Costco de 842,37 $. Était-ce une dépense d’entreprise ?' }, 4,
    { status: 'answered', answer: 'Oui, dépense d’entreprise — fournitures pour l’atelier', answered_by: marie.id, answered_at: ago(0, 2) });
  const t3 = task(admin, soc.id, { kind: 'document', title: 'Envoyez le contrat de location du local' }, 5, { reminders_sent: 1, last_reminder_at: ago(2) });
  db.prepare('INSERT INTO task_reminders (task_id, client_id, manual, sent_at) VALUES (?, ?, 0, ?)').run(t3, soc.id, ago(2));
  task(lea, soc.id, { kind: 'approval', title: 'Approuvez les écritures de fin de mois de septembre' }, 1);
  db.prepare('INSERT INTO messages (client_id, author_id, body, created_at) VALUES (?, ?, ?, ?)').run(soc.id, lea.id, 'Bonjour Marie, pouvez-vous nous envoyer le relevé Visa de septembre ?', ago(3));
  db.prepare('INSERT INTO messages (client_id, author_id, body, created_at) VALUES (?, ?, ?, ?)').run(soc.id, marie.id, 'C’est fait, je l’ai mis dans Documents. Merci !', ago(1));
  db.prepare('INSERT INTO messages (client_id, author_id, body, created_at) VALUES (?, ?, ?, ?)').run(jean.id, jeanU.id, 'Est-ce que je dois déclarer mes revenus de location ?', ago(0, 4));
  void marc;

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
    await p.goto(`${B}/reception`); await shot(p, '01-reception', vp);
    await p.goto(`${B}/clients/${soc.id}/documents`); await shot(p, '02-documents-dossier', vp);
    await p.goto(`${B}/clients/${soc.id}/taches`); await shot(p, '03-taches-rappels', vp);
    await p.goto(`${B}/clients/${soc.id}/historique`); await shot(p, '04-historique', vp);
    const q = await (await br.newContext({ viewport: { width: w, height: h } })).newPage();
    await login(q, 'marie@boreal.ca');
    await q.goto(`${B}/documents`); await shot(q, '05-client-documents', vp);
  }
  console.log('problèmes', problems); await br.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
