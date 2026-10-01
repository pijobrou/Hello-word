'use strict';

/**
 * Administration du portail sur le serveur.
 *   node cli.js create-admin <courriel> "<Prénom Nom>"   premier administrateur : affiche un lien d'invitation (72 h)
 *   node cli.js list-users                               liste des comptes
 *   node cli.js unlock <courriel>                        déverrouille un compte après trop d'essais
 *   node cli.js backup [jours]                           copie cohérente de la base dans DATA_DIR/backups (garde N jours, 14 par défaut)
 */

const fs = require('node:fs');
const path = require('node:path');

try { process.loadEnvFile(path.join(__dirname, '.env')); } catch { /* facultatif */ }

const { openDb } = require('./lib/db.js');
const { createAccounts, AccountError } = require('./lib/accounts.js');

function main(argv, out = console) {
  const dataDir = path.resolve(__dirname, process.env.PORTAL_DATA_DIR || 'data');
  const publicUrl = (process.env.PORTAL_URL || 'https://portail.bvyaccountingtax.ca').replace(/\/+$/, '');
  const db = openDb(path.join(dataDir, 'portail.sqlite'));
  const acc = createAccounts(db);
  const [cmd, a, b] = argv;
  try {
    if (cmd === 'create-admin') {
      if (!a || !b) throw new AccountError('Usage : node cli.js create-admin <courriel> "<Prénom Nom>"');
      const { user, token } = acc.invite(null, { email: a, name: b, role: 'admin' });
      out.log(`Invitation créée pour ${user.email} (administrateur). Lien valable 72 heures, à usage unique :`);
      out.log(`${publicUrl}/invitation?jeton=${encodeURIComponent(token)}`);
      return 0;
    }
    if (cmd === 'list-users') {
      for (const u of db.prepare('SELECT email, name, role, status, totp_enabled FROM users ORDER BY role, name').all()) {
        out.log(`${u.status.padEnd(8)} ${u.role.padEnd(10)} ${u.email}  (${u.name})${u.totp_enabled ? '  [application]' : ''}`);
      }
      return 0;
    }
    if (cmd === 'backup') {
      const keep = Math.max(1, Number(a) || 14);
      const dir = path.join(dataDir, 'backups');
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const file = path.join(dir, `portail-${new Date().toISOString().slice(0, 23).replace(/[:T.]/g, '-')}.sqlite`);
      db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
      fs.chmodSync(file, 0o600);
      const old = fs.readdirSync(dir).filter((f) => /^portail-.*\.sqlite$/.test(f)).sort();
      for (const f of old.slice(0, Math.max(0, old.length - keep))) fs.unlinkSync(path.join(dir, f));
      out.log(`Sauvegarde : ${file}`);
      return 0;
    }
    if (cmd === 'unlock') {
      const u = acc.userByEmail(a || '');
      if (!u) throw new AccountError('Compte introuvable.');
      acc.unlock(u.id);
      out.log(`Compte ${u.email} déverrouillé.`);
      return 0;
    }
    out.log('Commandes : create-admin <courriel> "<Prénom Nom>" | list-users | unlock <courriel> | backup [jours]');
    return 1;
  } catch (err) {
    if (!(err instanceof AccountError)) throw err;
    out.error(err.message);
    return 1;
  } finally {
    db.close();
  }
}

module.exports = { main };

if (require.main === module) process.exitCode = main(process.argv.slice(2));
