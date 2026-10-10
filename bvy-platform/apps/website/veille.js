'use strict';

/**
 * Veille de sécurité BVY : rapport quotidien envoyé par courriel à BVY (minuterie systemd « bvy-veille »).
 * Règles fixes, aucun service externe : on lit les journaux nginx, les bannissements fail2ban, le registre des
 * demandes ignorées (data/spam.jsonl), l'état du site et du portail, et l'échéance du certificat HTTPS.
 * Lancer à la main :  sudo systemctl start bvy-veille   (ou  node veille.js --afficher  pour voir sans envoyer)
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { smtpConfigFromEnv, sendMail } = require('./mailer.js');

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const LINE = /^(\S+) \S+ \S+ \[(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})\] "(\S+) (\S+)[^"]*" (\d{3}) \S+ "[^"]*" "([^"]*)"/;

function parseLine(l) {
  const m = LINE.exec(l);
  if (!m) return null;
  const tz = (m[8][0] === '-' ? -1 : 1) * (Number(m[8].slice(1, 3)) * 60 + Number(m[8].slice(3)));
  const at = Date.UTC(+m[4], MONTHS[m[3]], +m[2], +m[5], +m[6], +m[7]) - tz * 60000;
  return { ip: m[1], at, method: m[9], path: m[10], status: Number(m[11]), ua: m[12] };
}

function family(ua) {
  const m = /(GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-\w+|anthropic-ai|CCBot|Google-Extended|GoogleOther|Bytespider|meta-external\w+|PerplexityBot|Perplexity-User|Amazonbot|cohere[\w-]*|Diffbot|Scrapy|HTTrack|python-\w+|aiohttp|Go-http-client|Wget|curl|HeadlessChrome|PhantomJS|FirecrawlAgent|Crawl4AI|img2dataset)/i.exec(ua || '');
  return m ? m[1] : ua ? 'autre' : '(aucun navigateur déclaré)';
}

const top = (map, n = 5) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n);
const count = (map, k) => map.set(k, (map.get(k) || 0) + 1);

// Pur : construit le rapport à partir des données déjà lues (testé dans test/veille.test.js)
function buildReport({ now, site = [], portal = [], trap = [], bans = null, spam = [], leads = 0, health = {}, certDays = null }) {
  const since = now - 24 * 3600_000;
  const recent = (ls) => ls.map(parseLine).filter((x) => x && x.at >= since);
  const s = recent(site); const p = recent(portal); const t = recent(trap);
  const humans = new Set(s.filter((x) => x.status < 400 && !/bot|crawl|spider|slurp/i.test(x.ua)).map((x) => x.ip));
  const refused = new Map(); for (const x of [...s, ...p]) if (x.status === 403) count(refused, family(x.ua));
  const probes = new Map(); for (const x of t) count(probes, x.path === '/acces-reserve/' ? 'piège /acces-reserve/' : x.path.slice(0, 60));
  const trapIps = new Set(t.map((x) => x.ip));
  const tooMany = [...s, ...p].filter((x) => x.status === 429).length;
  const errors = [...s, ...p].filter((x) => x.status >= 500).length;
  const loginFails = p.filter((x) => x.method === 'POST' && /^\/(connexion|verification)/.test(x.path) && x.status === 429).length;
  const spamDay = spam.filter((x) => Date.parse(x.receivedAt) >= since);
  const reasons = new Map(); for (const x of spamDay) count(reasons, String(x.reason).replace(/ :.*/, ''));

  const alerts = [];
  if (health.site === false) alerts.push('Le site ne répond pas.');
  if (health.portal === false) alerts.push('Le portail ne répond pas.');
  if (errors > 20) alerts.push(`${errors} erreurs du serveur (500) en 24 h.`);
  if (certDays !== null && certDays < 21) alerts.push(`Le certificat HTTPS expire dans ${certDays} jour(s) : vérifier le renouvellement (certbot).`);
  if (bans === null) alerts.push('fail2ban ne répond pas : les bannissements automatiques sont peut-être arrêtés.');
  if (loginFails > 20) alerts.push(`${loginFails} connexions au portail freinées (essais de mots de passe répétés).`);
  if (trapIps.size > 200) alerts.push(`${trapIps.size} adresses ont cherché des failles : attaque en cours possible.`);

  const fmtTop = (m) => (m.size ? top(m).map(([k, v]) => `   - ${k} : ${v}`).join('\n') : '   (aucun)');
  const state = alerts.length ? 'À VÉRIFIER' : 'Rien d’anormal';
  const text = [
    `Veille de sécurité BVY — dernières 24 heures — ${state}`,
    '',
    ...(alerts.length ? ['À vérifier :', ...alerts.map((a) => ` • ${a}`), ''] : []),
    `Site : ${health.site === false ? 'NE RÉPOND PAS' : health.site ? 'en ligne' : 'non vérifié'} · Portail : ${health.portal === false ? 'NE RÉPOND PAS' : health.portal ? 'en ligne' : 'non vérifié'}${certDays !== null ? ` · Certificat HTTPS : ${certDays} jours restants` : ''}`,
    `Visiteurs (adresses distinctes) : ${humans.size} · Demandes de consultation reçues : ${leads}`,
    '',
    `Robots d’IA et outils d’aspiration refusés : ${[...refused.values()].reduce((a, b) => a + b, 0)}`,
    fmtTop(refused),
    `Recherches de failles et piège à robots : ${t.length} (${trapIps.size} adresses, bannies 24 h)`,
    fmtTop(probes),
    `Requêtes freinées (trop rapides) : ${tooMany}`,
    `Fausses demandes de consultation ignorées : ${spamDay.length}`,
    fmtTop(reasons),
    `Adresses bannies en ce moment : ${bans === null ? 'inconnu' : Object.entries(bans).map(([j, n]) => `${j} ${n}`).join(' · ') || '0'}`,
    '',
    'Rapport automatique du serveur (règles fixes). Les adresses bannies le sont automatiquement ; rien à faire',
    'sauf si une ligne « À vérifier » apparaît. Débannir une adresse : sudo fail2ban-client set bvy-piege unbanip <adresse>',
  ].join('\n');
  return { subject: `Veille de sécurité BVY — ${new Date(now).toISOString().slice(0, 10)} — ${state}`, text, alerts };
}

/* ------------------------------------------------------- collecte sur le serveur */
function readLog(file) {
  const out = [];
  for (const f of [file, `${file}.1`]) { try { out.push(...fs.readFileSync(f, 'utf8').split('\n')); } catch { /* absent */ } }
  return out;
}
function readJsonl(file) {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; }
}
function fail2banBans() {
  try {
    const out = {};
    for (const jail of ['bvy-piege', 'bvy-abus', 'recidive', 'sshd']) {
      try { const s = execFileSync('fail2ban-client', ['status', jail], { encoding: 'utf8', timeout: 5000 }); const m = /Currently banned:\s*(\d+)/.exec(s); if (m) out[jail] = Number(m[1]); } catch { /* prison absente */ }
    }
    return Object.keys(out).length ? out : null;
  } catch { return null; }
}
async function ping(url) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(5000) }); return r.ok; } catch { return false; }
}
function certDaysLeft(file) {
  try { const c = new crypto.X509Certificate(fs.readFileSync(file)); return Math.floor((Date.parse(c.validTo) - Date.now()) / 86400_000); } catch { return null; }
}

async function main() {
  const now = Date.now();
  const dataDir = path.resolve(__dirname, process.env.DATA_DIR || 'data');
  const leads = readJsonl(path.join(dataDir, 'leads.jsonl')).filter((x) => Date.parse(x.receivedAt) >= now - 86400_000 && !x.doublon).length;
  // Loi 25 : les fausses demandes (adresse IP, courriel) ne sont pas gardées plus de 30 jours
  const spamFile = path.join(dataDir, 'spam.jsonl');
  const spam = readJsonl(spamFile);
  const kept = spam.filter((x) => Date.parse(x.receivedAt) >= now - 30 * 86400_000);
  if (kept.length < spam.length) { try { fs.writeFileSync(spamFile, kept.map((x) => JSON.stringify(x)).join('\n') + (kept.length ? '\n' : '')); } catch { /* lecture seule */ } }
  const report = buildReport({
    now,
    site: readLog('/var/log/nginx/bvy-website.access.log'),
    portal: readLog('/var/log/nginx/bvy-portail.access.log'),
    trap: readLog('/var/log/nginx/bvy-piege.log'),
    bans: fail2banBans(),
    spam: kept,
    leads,
    health: { site: await ping(`http://127.0.0.1:${process.env.PORT || 3000}/api/health`), portal: await ping(`http://127.0.0.1:${process.env.PORTAL_PORT || 3100}/sante`) },
    certDays: certDaysLeft('/etc/letsencrypt/live/bvyaccountingtax.ca/cert.pem'),
  });
  const smtp = smtpConfigFromEnv();
  if (process.argv.includes('--afficher') || !smtp) {
    console.log(`${report.subject}\n\n${report.text}`);
    if (!smtp) console.log('\n(SMTP non configuré : rapport affiché seulement)');
    return;
  }
  await sendMail(smtp, { subject: report.subject, text: report.text });
  console.log(`Rapport envoyé : ${report.subject}`);
}

if (require.main === module) main().catch((err) => { console.error('Veille de sécurité en échec :', err.message); process.exit(1); });

module.exports = { buildReport, parseLine, family };
