'use strict';

/**
 * Routes du portail client (phase 3) et de l'espace client côté équipe.
 * handle(ctx) renvoie true si la route a été traitée. Les contrôles d'accès sont dans lib/portal.js.
 */

const fs = require('node:fs');
const { visibleClients, STAFF_ROLES } = require('./rbac.js');
const { PortalError } = require('./portal.js');
const P = require('./views-portal.js');
const V = require('./views.js');

function createPortalRoutes({ db, portal, notifyClient, notifyTeam }) {
  const isStaff = (u) => STAFF_ROLES.includes(u.role);

  function clientNav(u) {
    const c = portal.client(u.client_id);
    return { tasks: portal.openTaskCount(u, u.client_id), messages: portal.unreadCount(u, u.client_id), qboUrl: c && c.qbo_url };
  }

  function counts(u, clientId) {
    return { tasks: portal.openTaskCount(u, clientId), unread: portal.unreadCount(u, clientId) };
  }

  async function handle(ctx) {
    const { req, res, p, s, form, ip, send200, redirect, flashOf, url } = ctx;
    const u = s.user;
    const GET = req.method === 'GET' || req.method === 'HEAD';
    const POST = req.method === 'POST';
    const ok = (path, msg) => redirect(res, `${path}${path.includes('?') ? '&' : '?'}ok=${encodeURIComponent(msg)}`);

    try {
      /* ---------------------------------------------------------- accueil */
      if (p === '/accueil' && GET) {
        if (u.role === 'client') {
          const client = portal.client(u.client_id);
          return send200(res, P.clientHome(s, { client, snap: portal.getSnapshot(u, u.client_id), tasks: portal.listTasks(u, u.client_id, { open: true }), nav: clientNav(u), flash: flashOf(url) })), true;
        }
        const rows = visibleClients(db, u).map((c) => {
          const snap = db.prepare('SELECT data FROM client_snapshots WHERE client_id = ?').get(c.id);
          return { ...c, tasks: portal.openTaskCount(u, c.id), unread: portal.unreadCount(u, c.id), asOf: snap ? JSON.parse(snap.data).asOf : null };
        });
        return send200(res, P.staffHome(s, { rows, flash: flashOf(url) })), true;
      }

      /* ------------------------------------------------------ côté client */
      if (u.role === 'client') {
        const cid = u.client_id;
        if (p === '/a-faire' && GET) return send200(res, P.clientTasks(s, { tasks: portal.listTasks(u, cid), nav: clientNav(u), flash: flashOf(url) })), true;
        const m = p.match(/^\/a-faire\/(\d+)\/repondre$/);
        if (m && POST) {
          const t = portal.answerTask(u, m[1], form, ip);
          notifyTeam(cid, `Réponse du client : ${t.title}`);
          return ok('/a-faire', 'Merci, votre réponse est envoyée à BVY.'), true;
        }
        if (p === '/documents' && GET) return send200(res, P.clientDocuments(s, { docs: portal.listDocuments(u, cid), nav: clientNav(u), flash: flashOf(url) })), true;
        if (p === '/documents' && POST) {
          const file = (form._files || []).find((f) => f.field === 'file');
          portal.saveDocument(u, cid, file && { name: file.filename, data: file.data }, { note: form.note, taskId: form.taskId || null }, ip);
          notifyTeam(cid, 'Nouveau document envoyé par le client');
          return ok(form.taskId ? '/a-faire' : '/documents', 'Document reçu. Merci !'), true;
        }
        if (p === '/rapports' && GET) return send200(res, P.clientReports(s, { docs: portal.listDocuments(u, cid, { category: 'report' }), nav: clientNav(u) })), true;
        if (p === '/messages' && GET) {
          const messages = portal.listMessages(u, cid);
          return send200(res, P.clientMessages(s, { messages, nav: clientNav(u), flash: flashOf(url) })), true;
        }
        if (p === '/messages' && POST) {
          portal.postMessage(u, cid, form.body, ip);
          notifyTeam(cid, 'Nouveau message du client');
          return ok('/messages', 'Message envoyé.'), true;
        }
      }

      /* -------------------------------------------- téléchargement (tous) */
      const dl = p.match(/^\/documents\/(\d+)\/telecharger$/);
      if (dl && GET) {
        const { doc, file } = portal.openDocument(u, dl[1], ip);
        const st = fs.statSync(file, { throwIfNoEntry: false });
        if (!st) return send200(res, V.errorPage(404, 'Ce fichier est introuvable sur le serveur.'), 404), true;
        res.writeHead(200, {
          ...ctx.securityHeaders,
          'Content-Type': doc.mime,
          'Content-Length': st.size,
          'Content-Disposition': `attachment; filename="${doc.name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
        });
        fs.createReadStream(file).pipe(res);
        return true;
      }

      /* ------------------------------------------------- côté équipe BVY */
      if (isStaff(u)) {
        const t = p.match(/^\/taches\/(\d+)\/fermer$/);
        if (t && POST) {
          const task = portal.taskFor(u, t[1]);
          portal.closeTask(u, task.id, form.status, ip);
          return ok(`/clients/${task.client_id}/taches`, form.status === 'cancelled' ? 'Tâche annulée.' : 'Tâche terminée.'), true;
        }
        const c = p.match(/^\/clients\/(\d+)(\/(?:tableau|quickbooks|taches|documents|messages))?$/);
        if (c) {
          const cid = Number(c[1]);
          const sub = c[2] || '';
          portal.listTasks(u, cid, { open: true }); // contrôle d'accès (lève PortalError sinon)
          const client = portal.client(cid);
          if (sub === '' && GET) return send200(res, P.staffDashboardForm(s, { client, snap: portal.getSnapshot(u, cid), flash: flashOf(url), counts: counts(u, cid) })), true;
          if (sub === '/tableau' && POST) {
            portal.saveSnapshot(u, cid, form, ip);
            notifyClient(cid, u.id, 'Votre tableau de bord BVY a été mis à jour');
            return ok(`/clients/${cid}`, 'Tableau de bord publié pour le client.'), true;
          }
          if (sub === '/quickbooks' && POST) {
            portal.setQboUrl(u, cid, form.qboUrl, ip);
            return ok(`/clients/${cid}`, 'Lien QuickBooks enregistré.'), true;
          }
          if (sub === '/taches' && GET) return send200(res, P.staffTasks(s, { client, tasks: portal.listTasks(u, cid), flash: flashOf(url), counts: counts(u, cid) })), true;
          if (sub === '/taches' && POST) {
            portal.createTask(u, cid, form, ip);
            notifyClient(cid, u.id, 'Vous avez une nouvelle tâche dans votre portail BVY');
            return ok(`/clients/${cid}/taches`, 'Tâche créée ; le client est prévenu par courriel.'), true;
          }
          if (sub === '/documents' && GET) return send200(res, P.staffDocuments(s, { client, docs: portal.listDocuments(u, cid), flash: flashOf(url), counts: counts(u, cid) })), true;
          if (sub === '/documents' && POST) {
            const file = (form._files || []).find((f) => f.field === 'file');
            portal.saveDocument(u, cid, file && { name: file.filename, data: file.data }, { note: form.note, category: form.category }, ip);
            notifyClient(cid, u.id, form.category === 'report' ? 'Un nouveau rapport est disponible dans votre portail BVY' : 'BVY a partagé un document dans votre portail');
            return ok(`/clients/${cid}/documents`, 'Document partagé avec le client.'), true;
          }
          if (sub === '/messages' && GET) {
            const messages = portal.listMessages(u, cid);
            return send200(res, P.staffMessages(s, { client, messages, flash: flashOf(url), counts: counts(u, cid) })), true;
          }
          if (sub === '/messages' && POST) {
            portal.postMessage(u, cid, form.body, ip);
            notifyClient(cid, u.id, 'Vous avez un nouveau message de BVY');
            return ok(`/clients/${cid}/messages`, 'Message envoyé ; le client est prévenu par courriel.'), true;
          }
        }
      }
    } catch (err) {
      if (!(err instanceof PortalError) && !(err && err.constructor && err.constructor.name === 'AccountError')) throw err;
      if (err.message === 'Accès refusé.' || err.message === 'Réservé à l’équipe BVY.') {
        ctx.audit({ userId: u.id, action: 'access.denied', target: p, ip });
        return send200(res, V.errorPage(403, 'Vous n’avez pas accès à cet élément.'), 403), true;
      }
      if (err.message === 'Tâche introuvable.' || err.message === 'Document introuvable.') {
        return send200(res, V.errorPage(404, err.message), 404), true;
      }
      // Erreur de saisie : retour à la page avec le message.
      const back = req.headers.referer ? new URL(req.headers.referer).pathname : '/accueil';
      return redirect(res, `${back}?erreur=${encodeURIComponent(err.message)}`), true;
    }
    return false;
  }

  return { handle };
}

module.exports = { createPortalRoutes };
