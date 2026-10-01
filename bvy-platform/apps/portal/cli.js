'use strict';

/**
 * Administration du portail sur le serveur.
 *   node cli.js create-admin <courriel> "<Prénom Nom>"   premier administrateur : affiche un lien d'invitation (72 h)
 *   node cli.js list-users                               liste des comptes
 *   node cli.js unlock <courriel>                        déverrouille un compte après trop d'essais
 */

const path = require('node:path');

try { process.loadEnvFile(path.join(__dirname, '.env')); } catch { /* facultatif */ }

const { openDb } = require('./lib/db.js');
const { createAccounts, AccountError } = require('./lib/accounts.js');

function main(argv, out = console) {
  const dataDir = path.resolve(__dirname, process.env.DATA_DIR || 'data');
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
    if (cmd === 'unlock') {
      const u = acc.userByEmail(a || '');
      if (!u) throw new AccountError('Compte introuvable.');
      acc.unlock(u.id);
      out.log(`Compte ${u.email} déverrouillé.`);
      return 0;
    }
    out.log('Commandes : create-admin <courriel> "<Prénom Nom>" | list-users | unlock <courriel>');
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
