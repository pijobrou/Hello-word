'use strict';

/**
 * Avis des utilisateurs (clients et équipe) pour améliorer le logiciel.
 * Chacun voit ses propres avis et la réponse de BVY ; l'administrateur voit tout, répond et suit l'état.
 * Les avis sont aussi la mémoire « ce qui gêne nos utilisateurs » (docs/cerveau-ia.md).
 */

const { PortalError } = require('./portal.js');

const TOPICS = { bug: 'Quelque chose ne fonctionne pas', difficile: 'C’est difficile à comprendre', idee: 'Une idée pour améliorer', merci: 'Ça m’a aidé', autre: 'Autre' };
const STATUS = { new: 'Reçu', read: 'Lu', planned: 'Prévu', done: 'Fait', declined: 'Pas retenu' };
const EASE = { 1: 'Très difficile', 2: 'Difficile', 3: 'Correct', 4: 'Facile', 5: 'Très facile' };

function createFeedback(db, { audit, now = () => Date.now() }) {
  const iso = () => new Date(now()).toISOString();

  function submit(actor, input, ip) {
    const topic = String(input.topic || '');
    if (!TOPICS[topic]) throw new PortalError('Choisissez le sujet de votre avis.');
    const message = String(input.message || '').trim();
    if (message.length < 3) throw new PortalError('Écrivez quelques mots : ce qui va, ce qui ne va pas, ou votre idée.');
    if (message.length > 2000) throw new PortalError('Votre avis ne doit pas dépasser 2000 caractères.');
    const ease = input.ease ? Number(input.ease) : null;
    if (ease !== null && !EASE[ease]) throw new PortalError('Choix invalide.');
    // Dix avis par jour et par personne au plus
    const today = db.prepare("SELECT COUNT(*) AS n FROM feedback WHERE user_id = ? AND created_at >= ?").get(actor.id, new Date(now() - 86400_000).toISOString()).n;
    if (today >= 10) throw new PortalError('Merci ! Vous avez déjà envoyé 10 avis aujourd’hui : écrivez-nous dans Messages pour la suite.');
    const page = String(input.page || '').slice(0, 120) || null;
    const id = Number(db.prepare(`INSERT INTO feedback (user_id, client_id, role, ease, topic, message, page, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(actor.id, actor.client_id || null, actor.role, ease, topic, message, page, iso()).lastInsertRowid);
    audit({ userId: actor.id, action: 'feedback.submit', target: `feedback:${id}`, clientId: actor.client_id || null, ip, details: { topic, ease } });
    return id;
  }

  const mine = (actor) => db.prepare('SELECT * FROM feedback WHERE user_id = ? ORDER BY id DESC LIMIT 30').all(actor.id);

  function list(actor, { status = null } = {}) {
    if (actor.role !== 'admin') throw new PortalError('Accès refusé.');
    return db.prepare(`SELECT f.*, u.name AS user_name, c.name AS client_name FROM feedback f JOIN users u ON u.id = f.user_id LEFT JOIN clients c ON c.id = f.client_id
      ${status ? 'WHERE f.status = ?' : ''} ORDER BY CASE f.status WHEN 'new' THEN 0 ELSE 1 END, f.id DESC LIMIT 200`).all(...(status ? [status] : []));
  }

  function summary(actor) {
    if (actor.role !== 'admin') throw new PortalError('Accès refusé.');
    const since = new Date(now() - 90 * 86400_000).toISOString();
    const ease = db.prepare('SELECT AVG(ease) AS avg, COUNT(ease) AS n FROM feedback WHERE ease IS NOT NULL AND created_at >= ?').get(since);
    const topics = db.prepare('SELECT topic, COUNT(*) AS n FROM feedback WHERE created_at >= ? GROUP BY topic ORDER BY n DESC').all(since);
    const pages = db.prepare("SELECT page, COUNT(*) AS n FROM feedback WHERE created_at >= ? AND page IS NOT NULL AND topic IN ('bug','difficile') GROUP BY page ORDER BY n DESC LIMIT 5").all(since);
    return { ease: ease.n ? Math.round(ease.avg * 10) / 10 : null, easeCount: ease.n, topics, pages, fresh: countNew() };
  }

  function answer(actor, id, input, ip) {
    if (actor.role !== 'admin') throw new PortalError('Accès refusé.');
    const f = db.prepare('SELECT * FROM feedback WHERE id = ?').get(Number(id));
    if (!f) throw new PortalError('Avis introuvable.');
    const status = String(input.status || '');
    if (!STATUS[status]) throw new PortalError('État invalide.');
    const reply = String(input.reply || '').trim().slice(0, 1000) || null;
    db.prepare('UPDATE feedback SET status = ?, reply = COALESCE(?, reply), replied_by = ?, replied_at = ? WHERE id = ?').run(status, reply, actor.id, iso(), f.id);
    audit({ userId: actor.id, action: 'feedback.answer', target: `feedback:${f.id}`, clientId: f.client_id, ip, details: { status } });
    return f;
  }

  const countNew = () => db.prepare("SELECT COUNT(*) AS n FROM feedback WHERE status = 'new'").get().n;

  return { submit, mine, list, summary, answer, countNew };
}

module.exports = { createFeedback, TOPICS, STATUS, EASE };
