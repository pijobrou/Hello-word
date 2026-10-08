// Envoi de courriel SMTP minimal, sans dépendance (node:net / node:tls).
// Sert à prévenir BVY à chaque nouvelle demande de contact et à confirmer la réception au client.
// Ports : 465 = TLS direct ; 587 (ou autre) = STARTTLS obligatoire. Authentification AUTH LOGIN.
'use strict';
const net = require('node:net');
const tls = require('node:tls');
const os = require('node:os');

function smtpConfigFromEnv(env = process.env) {
  const host = env.SMTP_HOST || '';
  if (!host) return null;
  const port = Number(env.SMTP_PORT || 465);
  return {
    host,
    port,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === '1' : port === 465,
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: withName(env.MAIL_FROM || env.SMTP_USER || '', env.MAIL_FROM_NAME ?? 'BVY Accounting & Tax Services'),
    to: (env.MAIL_TO || '').split(',').map((s) => s.trim()).filter(Boolean),
    rejectUnauthorized: env.SMTP_TLS_INSECURE !== '1',
    // Courriel de confirmation au client : actif par défaut, CONFIRMATION_EMAIL=0 pour le couper.
    confirmation: env.CONFIRMATION_EMAIL !== '0',
  };
}

// « adresse » → « "Nom" <adresse> » (laissé tel quel si un nom est déjà présent ou si le nom est vide).
function withName(from, name) {
  if (!from || !name || from.includes('<')) return from;
  return `${encodeHeader(`"${name.replace(/["\\\r\n]/g, '')}"`)} <${from.trim()}>`;
}

// Lit les réponses SMTP (gère les réponses multi-lignes « 250-… » / « 250 … »).
function reader(socket) {
  let buf = '';
  let lines = [];
  let waiting = null;
  const onData = (chunk) => {
    buf += chunk.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      lines.push(line);
      if (/^\d{3} /.test(line) || /^\d{3}$/.test(line)) {
        const reply = { code: Number(line.slice(0, 3)), text: lines.join('\n') };
        lines = [];
        if (waiting) { const w = waiting; waiting = null; w.resolve(reply); }
      }
    }
  };
  socket.on('data', onData);
  return {
    next() {
      return new Promise((resolve, reject) => { waiting = { resolve, reject }; });
    },
    fail(err) { if (waiting) { const w = waiting; waiting = null; w.reject(err); } },
    detach() { socket.off('data', onData); },
  };
}

const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64');
const encodeHeader = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const addr = (s) => { const m = String(s).match(/<([^>]+)>/); return (m ? m[1] : String(s)).trim(); };

function buildMessage({ from, to, subject, text, replyTo }) {
  const headers = [
    `From: ${from}`,
    `To: ${to.join(', ')}`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@${os.hostname() || 'bvy'}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ];
  if (replyTo) headers.push(`Reply-To: ${replyTo}`);
  const body = b64(text.replace(/\r?\n/g, '\r\n')).replace(/.{1,76}/g, '$&\r\n');
  return headers.join('\r\n') + '\r\n\r\n' + body;
}

// msg.to (facultatif) remplace les destinataires de la configuration (MAIL_TO).
async function sendMail(cfg, msg, { timeoutMs = 15000 } = {}) {
  const to = msg.to && msg.to.length ? msg.to : cfg && cfg.to;
  if (!cfg || !cfg.host || !to || !to.length || !cfg.from) throw new Error('SMTP non configuré');
  let socket = cfg.secure
    ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host, rejectUnauthorized: cfg.rejectUnauthorized })
    : net.connect({ host: cfg.host, port: cfg.port });
  socket.setTimeout(timeoutMs, () => socket.destroy(new Error('SMTP : délai dépassé')));
  let r = reader(socket);
  socket.on('error', (err) => r.fail(err));

  const expect = async (codes, what) => {
    const reply = await r.next();
    if (!codes.includes(reply.code)) throw new Error(`SMTP ${what} : ${reply.text.slice(0, 200)}`);
    return reply;
  };
  const cmd = (line) => socket.write(line + '\r\n');
  const helo = os.hostname() || 'bvy';

  try {
    await expect([220], 'connexion');
    cmd(`EHLO ${helo}`);
    let ehlo = await expect([250], 'EHLO');
    if (!cfg.secure) {
      if (!/STARTTLS/i.test(ehlo.text)) throw new Error('SMTP : le serveur ne propose pas STARTTLS');
      cmd('STARTTLS');
      await expect([220], 'STARTTLS');
      r.detach();
      socket = tls.connect({ socket, servername: cfg.host, rejectUnauthorized: cfg.rejectUnauthorized });
      socket.setTimeout(timeoutMs, () => socket.destroy(new Error('SMTP : délai dépassé')));
      r = reader(socket);
      socket.on('error', (err) => r.fail(err));
      await new Promise((resolve, reject) => { socket.once('secureConnect', resolve); socket.once('error', reject); });
      cmd(`EHLO ${helo}`);
      ehlo = await expect([250], 'EHLO');
    }
    if (cfg.user) {
      cmd('AUTH LOGIN');
      await expect([334], 'AUTH');
      cmd(b64(cfg.user));
      await expect([334], 'AUTH utilisateur');
      cmd(b64(cfg.pass));
      await expect([235], 'AUTH mot de passe');
    }
    cmd(`MAIL FROM:<${addr(cfg.from)}>`);
    await expect([250], 'MAIL FROM');
    for (const rcpt of to) {
      cmd(`RCPT TO:<${addr(rcpt)}>`);
      await expect([250, 251], 'RCPT TO');
    }
    cmd('DATA');
    await expect([354], 'DATA');
    const data = buildMessage({ ...msg, from: cfg.from, to }).replace(/^\./gm, '..');
    socket.write(data + '\r\n.\r\n');
    await expect([250], 'envoi');
    cmd('QUIT');
  } finally {
    socket.end();
  }
}

// Courriel de notification pour une demande reçue par le formulaire.
function leadMessage(lead) {
  const name = `${lead.prenom} ${lead.nom}`.trim();
  const field = (label, value) => (value ? `${label} : ${value}` : null);
  const lines = [
    'Nouvelle demande reçue sur bvyaccountingtax.ca',
    '',
    field('Nom', name),
    field('Courriel', lead.courriel && `${lead.courriel}${lead.verification && lead.verification.courriel === 'verified' ? ' (domaine vérifié : reçoit du courriel)' : lead.verification ? ' (domaine non vérifié)' : ''}`),
    field('Téléphone', lead.telephone && `${lead.telephone}${lead.verification && lead.verification.telephone ? ` (numéro valide — ${lead.verification.telephone})` : ''}`),
    field('Entreprise', lead.entreprise),
    field('Service', lead.service),
    field('QuickBooks Online', lead.quickbooks),
    field('Région', lead.region),
    '',
    lead.message ? `Message :\n${lead.message}` : '(aucun message)',
    '',
    field('Reçue le', lead.receivedAt),
    'Répondez directement à ce courriel pour écrire à la personne.',
  ].filter((l) => l !== null);
  return {
    subject: `Nouvelle demande BVY — ${name}${lead.service ? ` (${lead.service})` : ''}`,
    text: lines.join('\n'),
    replyTo: lead.courriel,
  };
}

const SITE_URL = 'https://bvyaccountingtax.ca';
const SERVICE_LABELS = Object.freeze({
  diagnostic: 'la consultation de 30 minutes',
  'mise-au-clair-shopify': 'la Mise au clair Shopify',
  'tenue-de-livres': 'la tenue de livres mensuelle',
  paie: 'la paie',
  'tps-tvq': 'les déclarations TPS/TVQ',
  'impot-societes': 'l’impôt des sociétés (T2 / CO-17)',
  'travailleurs-autonomes': 'l’impôt des travailleurs autonomes (T1 / TP-1)',
  'etats-financiers': 'les états financiers et le soutien comptable',
  incorporation: 'l’incorporation',
  domiciliation: 'la domiciliation Canada',
  plateforme: 'une démonstration de la plateforme BVY',
});

// Accusé de réception envoyé au client. Volontairement fixe : on n'y recopie jamais le message
// reçu, pour que le formulaire ne puisse pas servir à envoyer du texte arbitraire à un tiers.
function confirmationMessage(lead, { replyTo, bookingUrl } = {}) {
  const prenom = String(lead.prenom || '').replace(/[\r\n<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  const about = SERVICE_LABELS[lead.service] ? ` concernant ${SERVICE_LABELS[lead.service]}` : '';
  const lines = [
    prenom ? `Bonjour ${prenom},` : 'Bonjour,',
    '',
    `Merci d’avoir écrit à BVY Accounting & Tax Services. Nous avons bien reçu votre demande${about}.`,
    'Un membre de notre équipe vous répondra personnellement par courriel.',
    '',
    'Vous souhaitez choisir un moment pour votre consultation gratuite de 30 minutes ?',
    bookingUrl ? `Réservez directement dans notre agenda : ${bookingUrl}` : `${SITE_URL}/rendez-vous/`,
    '',
    'Pour ajouter une précision, répondez simplement à ce courriel. Par prudence, ne nous transmettez',
    'aucun renseignement sensible (numéro d’assurance sociale, mots de passe, numéros de compte) par courriel.',
    '',
    'Au plaisir de vous accompagner,',
    '',
    'L’équipe BVY',
    'BVY Accounting & Tax Services Inc.',
    'Sainte-Marie, Chaudière-Appalaches, Québec',
    SITE_URL,
    '',
    '—',
    'Vous recevez ce message parce qu’une demande a été envoyée avec cette adresse sur bvyaccountingtax.ca.',
    'Si ce n’est pas vous, ignorez simplement ce courriel : aucune autre suite n’y sera donnée.',
  ];
  return {
    to: [lead.courriel],
    subject: 'Nous avons bien reçu votre demande — BVY Accounting & Tax Services',
    text: lines.join('\n'),
    replyTo: replyTo || undefined,
  };
}

module.exports = { smtpConfigFromEnv, sendMail, leadMessage, confirmationMessage, buildMessage, withName };
