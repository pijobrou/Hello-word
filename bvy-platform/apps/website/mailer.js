// Envoi de courriel SMTP minimal, sans dépendance (node:net / node:tls).
// Sert à prévenir BVY à chaque nouvelle demande de contact.
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
    from: env.MAIL_FROM || env.SMTP_USER || '',
    to: (env.MAIL_TO || '').split(',').map((s) => s.trim()).filter(Boolean),
    rejectUnauthorized: env.SMTP_TLS_INSECURE !== '1',
  };
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

async function sendMail(cfg, msg, { timeoutMs = 15000 } = {}) {
  if (!cfg || !cfg.host || !cfg.to.length || !cfg.from) throw new Error('SMTP non configuré');
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
    for (const rcpt of cfg.to) {
      cmd(`RCPT TO:<${addr(rcpt)}>`);
      await expect([250, 251], 'RCPT TO');
    }
    cmd('DATA');
    await expect([354], 'DATA');
    const data = buildMessage({ ...msg, from: cfg.from, to: cfg.to }).replace(/^\./gm, '..');
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
    field('Courriel', lead.courriel),
    field('Téléphone', lead.telephone),
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

module.exports = { smtpConfigFromEnv, sendMail, leadMessage, buildMessage };
