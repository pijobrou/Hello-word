'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const tls = require('node:tls');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createServer } = require('../server.js');
const { smtpConfigFromEnv, leadMessage, confirmationMessage } = require('../mailer.js');

function selfSignedCert() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-smtp-'));
  try {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost',
      '-keyout', path.join(dir, 'k.pem'), '-out', path.join(dir, 'c.pem')], { stdio: 'ignore' });
  } catch { return null; }
  return { key: fs.readFileSync(path.join(dir, 'k.pem')), cert: fs.readFileSync(path.join(dir, 'c.pem')) };
}

// Faux serveur SMTP (TLS direct) qui enregistre la conversation.
function fakeSmtp(cert) {
  const log = { cmds: [], data: '' };
  const server = tls.createServer(cert, (s) => {
    let buf = ''; let inData = false; const cmds = []; let data = ''; // état propre à chaque connexion
    s.write('220 fake ESMTP\r\n');
    s.on('data', (chunk) => {
      buf += chunk.toString();
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (inData) {
          if (line === '.') { inData = false; log.data += (data += '\n'); s.write('250 OK queued\r\n'); } else data += line + '\n';
          continue;
        }
        log.cmds.push(line); cmds.push(line);
        if (/^EHLO/.test(line)) s.write('250-fake\r\n250 AUTH LOGIN\r\n');
        else if (line === 'AUTH LOGIN') s.write('334 VXNlcm5hbWU6\r\n');
        else if (cmds[cmds.length - 2] === 'AUTH LOGIN') s.write('334 UGFzc3dvcmQ6\r\n');
        else if (cmds[cmds.length - 3] === 'AUTH LOGIN') s.write('235 ok\r\n');
        else if (/^(MAIL|RCPT)/.test(line)) s.write('250 ok\r\n');
        else if (line === 'DATA') { inData = true; s.write('354 go\r\n'); }
        else if (line === 'QUIT') { s.write('221 bye\r\n'); s.end(); }
      }
    });
  });
  return { server, log };
}

test('smtpConfigFromEnv : désactivé sans SMTP_HOST, port 465 = TLS direct', () => {
  assert.strictEqual(smtpConfigFromEnv({}), null);
  const c = smtpConfigFromEnv({ SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'a@b.ca', SMTP_PASS: 'x', MAIL_TO: 'x@y.ca, z@w.ca' });
  assert.strictEqual(c.port, 465); assert.strictEqual(c.secure, true);
  assert.deepStrictEqual(c.to, ['x@y.ca', 'z@w.ca']);
  assert.strictEqual(c.from, '"BVY Accounting & Tax Services" <a@b.ca>');
  assert.strictEqual(c.confirmation, true);
  assert.strictEqual(smtpConfigFromEnv({ SMTP_HOST: 'h', SMTP_USER: 'a@b.ca', MAIL_FROM_NAME: '' }).from, 'a@b.ca');
  assert.strictEqual(smtpConfigFromEnv({ SMTP_HOST: 'h', MAIL_FROM: 'X <a@b.ca>' }).from, 'X <a@b.ca>');
  assert.strictEqual(smtpConfigFromEnv({ SMTP_HOST: 'h', CONFIRMATION_EMAIL: '0' }).confirmation, false);
  assert.strictEqual(smtpConfigFromEnv({ SMTP_HOST: 'h', SMTP_PORT: '587' }).secure, false);
});

test('leadMessage : sujet, réponse au client, champs vides omis', () => {
  const m = leadMessage({ prenom: 'Marie', nom: 'Tremblay', courriel: 'marie@ex.ca', telephone: '', service: 'paie', message: '', receivedAt: 'T' });
  assert.match(m.subject, /Marie Tremblay \(paie\)/);
  assert.strictEqual(m.replyTo, 'marie@ex.ca');
  assert.ok(!m.text.includes('Téléphone'));
});

test('une demande valide envoie un courriel de notification', async (t) => {
  const cert = selfSignedCert();
  if (!cert) return t.skip('openssl absent');
  const { server: smtp, log } = fakeSmtp(cert);
  await new Promise((r) => smtp.listen(0, '127.0.0.1', r));
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-data-'));
  const app = createServer({ port: 0, receivesMail: async () => 'yes', dataDir, webhookUrl: '', smtp: {
    host: '127.0.0.1', port: smtp.address().port, secure: true, rejectUnauthorized: false,
    user: 'robot@bvy.ca', pass: 'secret', from: 'BVY <robot@bvy.ca>', to: ['bvypjb@protonmail.com'] } });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  try {
    const res = await fetch(`http://127.0.0.1:${app.address().port}/api/contact`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ prenom: 'Jean', nom: 'Côté', courriel: 'jean@ex.ca', telephone: '418 387-2001', consentement: true, service: 'mise-au-clair-shopify', message: 'Bonjour' }),
    });
    assert.strictEqual(res.status, 201);
    for (let i = 0; i < 50 && !log.cmds.includes('QUIT'); i++) await new Promise((r) => setTimeout(r, 50));
    assert.ok(log.cmds.includes('MAIL FROM:<robot@bvy.ca>'));
    assert.ok(log.cmds.includes('RCPT TO:<bvypjb@protonmail.com>'));
    assert.ok(log.cmds.includes(Buffer.from('robot@bvy.ca').toString('base64')));
    assert.match(log.data, /Reply-To: jean@ex.ca/);
    const body = Buffer.from(log.data.split('\n\n').slice(1).join('').replace(/\s/g, ''), 'base64').toString('utf8');
    assert.match(body, /Nom : Jean Côté/);
    assert.match(body, /Service : mise-au-clair-shopify/);
  } finally {
    app.close(); smtp.close();
  }
});

test('confirmationMessage : adressé au client, signé BVY, lien de rendez-vous, sans recopier le message', () => {
  const m = confirmationMessage(
    { prenom: 'Ana\r\nBcc: x@y.ca', nom: 'L', courriel: 'ana@ex.ca', service: 'mise-au-clair-shopify', message: 'TEXTE-SECRET' },
    { replyTo: 'bvypjb@protonmail.com' });
  assert.deepStrictEqual(m.to, ['ana@ex.ca']);
  assert.strictEqual(m.replyTo, 'bvypjb@protonmail.com');
  assert.match(m.text, /^Bonjour Ana Bcc: x@y.ca,/);
  assert.match(m.text, /concernant la Mise au clair Shopify/);
  assert.match(m.text, /https:\/\/bvyaccountingtax\.ca\/rendez-vous\//);
  assert.match(m.text, /L’équipe BVY\nBVY Accounting & Tax Services Inc\./);
  assert.ok(!m.text.includes('TEXTE-SECRET'));
  assert.ok(!/CPA/.test(m.text));
  assert.ok(!confirmationMessage({ prenom: 'A', courriel: 'a@b.ca', service: '<script>' }).text.includes('concernant'));
  const booked = confirmationMessage({ prenom: 'A', courriel: 'a@b.ca' }, { bookingUrl: 'https://calendar.app.google/AbC' });
  assert.match(booked.text, /Réservez directement dans notre agenda : https:\/\/calendar\.app\.google\/AbC/);
});

function decodeBodies(data) {
  return data.split(/\nMIME-Version/).slice(1).map((part) =>
    Buffer.from(part.split('\n\n').slice(1).join('').replace(/\s/g, ''), 'base64').toString('utf8'));
}

test('une demande valide envoie aussi l’accusé de réception au client (plafonné par jour)', async (t) => {
  const cert = selfSignedCert();
  if (!cert) return t.skip('openssl absent');
  const { server: smtp, log } = fakeSmtp(cert);
  await new Promise((r) => smtp.listen(0, '127.0.0.1', r));
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-data-'));
  const app = createServer({ port: 0, receivesMail: async () => 'yes', dataDir, webhookUrl: '', confirmationsPerDay: 1, smtp: {
    host: '127.0.0.1', port: smtp.address().port, secure: true, rejectUnauthorized: false, confirmation: true,
    user: 'robot@bvy.ca', pass: 'secret', from: 'BVY <robot@bvy.ca>', to: ['bvypjb@protonmail.com'] } });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const post = (courriel) => fetch(`http://127.0.0.1:${app.address().port}/api/contact`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ prenom: 'Jean', nom: 'Côté', courriel, telephone: '418 387-2001', consentement: true, service: 'paie', message: 'Bonjour' }),
  });
  const quits = () => log.cmds.filter((c) => c === 'QUIT').length;
  try {
    assert.strictEqual((await post('jean@ex.ca')).status, 201);
    for (let i = 0; i < 60 && quits() < 2; i++) await new Promise((r) => setTimeout(r, 50));
    assert.ok(log.cmds.includes('RCPT TO:<bvypjb@protonmail.com>'));
    assert.ok(log.cmds.includes('RCPT TO:<jean@ex.ca>'));
    assert.match(log.data, /Reply-To: bvypjb@protonmail.com/);
    const bodies = decodeBodies(log.data);
    const confirmation = bodies.find((b) => b.startsWith('Bonjour Jean,'));
    assert.ok(confirmation, 'accusé de réception envoyé');
    assert.match(confirmation, /concernant la paie/);
    assert.match(confirmation, /\/rendez-vous\//);

    // Plafond quotidien atteint : seule la notification interne part.
    assert.strictEqual((await post('autre@ex.ca')).status, 201);
    for (let i = 0; i < 60 && quits() < 3; i++) await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => setTimeout(r, 150));
    assert.strictEqual(quits(), 3);
    assert.ok(!log.cmds.includes('RCPT TO:<autre@ex.ca>'));
  } finally {
    app.close(); smtp.close();
  }
});
