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
const W = require('./views-work.js');

function createPortalRoutes({ db, portal, notifyClient, notifyTeam, qboService = null, workqueue }) {
  const isStaff = (u) => STAFF_ROLES.includes(u.role);

  const qboStatus = (clientId) => (qboService ? qboService.status(clientId) : null);

  // Lien « Ouvrir QuickBooks » : celui saisi par l'équipe, sinon l'accueil QuickBooks si l'entreprise est connectée.
  function clientNav(u) {
    const c = portal.client(u.client_id);
    const q = qboStatus(u.client_id);
    const home = q ? (q.environment === 'sandbox' ? 'https://app.sandbox.qbo.intuit.com/app/homepage' : 'https://app.qbo.intuit.com/app/homepage') : null;
    return { tasks: portal.openTaskCount(u, u.client_id), messages: portal.unreadCount(u, u.client_id), qboUrl: (c && c.qbo_url) || home };
  }

  function counts(u, clientId) {
    return { tasks: portal.openTaskCount(u, clientId), unread: portal.unreadCount(u, clientId), suggestions: qboService ? qboService.newSuggestionCount(clientId) : 0, qbo: qboStatus(clientId) };
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
          return send200(res, P.clientHome(s, { client, snap: portal.getSnapshot(u, u.client_id), tasks: portal.listTasks(u, u.client_id, { open: true }), nav: clientNav(u), flash: flashOf(url), sync: qboStatus(u.client_id) })), true;
        }
        const data = workqueue.dashboard(u, { qboStatus, suggestions: (id) => (qboService ? qboService.newSuggestionCount(id) : 0), unread: (id) => portal.unreadCount(u, id) });
        return send200(res, W.staffDashboard(s, { data, flash: flashOf(url) })), true;
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
        // Retour d'Intuit après l'autorisation (la session de l'employé suit, témoin SameSite=Lax).
        if (p === '/quickbooks/retour' && GET) {
          if (url.searchParams.get('error')) {
            return redirect(res, `/accueil?erreur=${encodeURIComponent('La connexion QuickBooks a été annulée ou refusée.')}`), true;
          }
          if (!qboService) throw new PortalError('QuickBooks n’est pas encore configuré sur ce serveur.');
          const cid = await qboService.finishConnect(u, { code: url.searchParams.get('code'), state: url.searchParams.get('state'), realmId: url.searchParams.get('realmId') }, ip);
          let msg = 'QuickBooks est connecté.';
          try { await qboService.sync(cid, 'connect', u); msg += ' Première synchronisation terminée.'; } catch (err) { msg += ` La première synchronisation a échoué : ${err.message}`; }
          const firm = workqueue.firmClient();
          return ok(firm && firm.id === cid ? '/cabinet' : `/clients/${cid}/quickbooks`, msg), true;
        }
        /* QuickBooks du cabinet : administrateur seulement */
        if (p === '/cabinet' || p.startsWith('/cabinet/')) {
          if (u.role !== 'admin') throw new PortalError('Accès refusé.');
          if (p === '/cabinet' && GET) {
            const firm = workqueue.firmClient();
            const links = new Map();
            for (const c of visibleClients(db, u)) { const o = workqueue.owedBy(c); if (o) links.set(o.customerId, c); }
            return send200(res, W.firmPage(s, { qbo: firm ? qboStatus(firm.id) : null, enabled: Boolean(qboService && qboService.enabled),
              receivables: firm ? workqueue.firmReceivables() : [], links, flash: flashOf(url) })), true;
          }
          const fq = p.match(/^\/cabinet\/quickbooks\/(connecter|synchroniser|deconnecter)$/);
          if (fq && POST) {
            if (!qboService || !qboService.enabled) throw new PortalError('QuickBooks n’est pas encore configuré sur ce serveur.');
            const firm = workqueue.firmClient(fq[1] === 'connecter');
            if (!firm) throw new PortalError('Le QuickBooks du cabinet n’est pas relié.');
            if (fq[1] === 'connecter') return redirect(res, qboService.startConnect(u, firm.id)), true;
            if (fq[1] === 'synchroniser') {
              const st = await qboService.sync(firm.id, 'manual', u);
              return ok('/cabinet', `Lu : ${st.invoices} facture(s) impayée(s), ${st.owing} client(s) concerné(s).`), true;
            }
            await qboService.disconnect(u, firm.id, ip);
            return ok('/cabinet', 'QuickBooks du cabinet déconnecté : les autorisations sont retirées.'), true;
          }
        }
        /* échéances et profil fiscal d'un client */
        const dl = p.match(/^\/clients\/(\d+)\/(profil|echeances|echeances\/marquer|echeances\/(\d+)\/supprimer)$/);
        if (dl && POST) {
          const cid = Number(dl[1]);
          if (dl[2] === 'profil') { workqueue.saveProfile(u, cid, form, ip); return ok(`/clients/${cid}/echeances`, 'Profil fiscal enregistré : les échéances sont recalculées.'), true; }
          if (dl[2] === 'echeances') { workqueue.addCustomDeadline(u, cid, form, ip); return ok(`/clients/${cid}/echeances`, 'Échéance ajoutée.'), true; }
          if (dl[2] === 'echeances/marquer') {
            workqueue.markDeadline(u, cid, form.key, form.status, ip);
            return ok(`/clients/${cid}/echeances`, form.status === 'open' ? 'Échéance rétablie.' : form.status === 'na' ? 'Marquée « ne s’applique pas ».' : 'Échéance marquée comme faite.'), true;
          }
          workqueue.deleteCustomDeadline(u, cid, dl[4], ip);
          return ok(`/clients/${cid}/echeances`, 'Échéance supprimée.'), true;
        }
        const sg = p.match(/^\/suggestions\/(\d+)\/(envoyer|ignorer)$/);
        if (sg && POST && qboService) {
          if (sg[2] === 'envoyer') {
            const r = qboService.sendSuggestion(u, sg[1], ip);
            notifyClient(r.clientId, u.id, 'Vous avez une nouvelle tâche dans votre portail BVY');
            return ok(`/clients/${r.clientId}/quickbooks`, 'Tâche envoyée au client.'), true;
          }
          const cid = qboService.dismissSuggestion(u, sg[1], ip);
          return ok(`/clients/${cid}/quickbooks`, 'Suggestion ignorée.'), true;
        }
        const q = p.match(/^\/clients\/(\d+)\/quickbooks\/(connecter|synchroniser|deconnecter)$/);
        if (q && POST) {
          const cid = Number(q[1]);
          if (!qboService || !qboService.enabled) throw new PortalError('QuickBooks n’est pas encore configuré sur ce serveur.');
          if (q[2] === 'connecter') return redirect(res, qboService.startConnect(u, cid)), true;
          if (q[2] === 'synchroniser') {
            const st = await qboService.sync(cid, 'manual', u);
            return ok(`/clients/${cid}/quickbooks`, `Synchronisé : ${st.banks} compte(s) bancaire(s), ${st.invoices} facture(s) impayée(s), ${st.bills} facture(s) à payer.`), true;
          }
          await qboService.disconnect(u, cid, ip);
          return ok(`/clients/${cid}/quickbooks`, 'QuickBooks déconnecté : les autorisations sont retirées.'), true;
        }
        const c = p.match(/^\/clients\/(\d+)(\/(?:tableau|quickbooks|taches|documents|messages|echeances))?$/);
        if (c) {
          const cid = Number(c[1]);
          const sub = c[2] || '';
          portal.listTasks(u, cid, { open: true }); // contrôle d'accès (lève PortalError sinon)
          const client = portal.client(cid);
          if (!client || client.is_firm) return send200(res, V.errorPage(404, 'Ce dossier n’existe pas.'), 404), true;
          if (sub === '/echeances' && GET) {
            const firm = workqueue.firmClient();
            const fq = firm ? qboStatus(firm.id) : null;
            return send200(res, W.staffDeadlines(s, { client, deadlines: workqueue.listDeadlines(u, cid), customers: workqueue.firmCustomers(),
              owed: workqueue.owedBy(client), firmConnected: Boolean(fq && fq.status === 'connected'),
              shell: (inner) => P.staffClientShell(s, client, '/echeances', inner, flashOf(url), counts(u, cid)) })), true;
          }
          if (sub === '' && GET) return send200(res, P.staffDashboardForm(s, { client, snap: portal.getSnapshot(u, cid), flash: flashOf(url), counts: counts(u, cid) })), true;
          if (sub === '/tableau' && POST) {
            portal.saveSnapshot(u, cid, form, ip);
            notifyClient(cid, u.id, 'Votre tableau de bord BVY a été mis à jour');
            return ok(`/clients/${cid}`, 'Tableau de bord publié pour le client.'), true;
          }
          if (sub === '/quickbooks' && GET) {
            return send200(res, P.staffQuickbooks(s, { client, sync: qboStatus(cid), items: qboService ? qboService.suggestions(u, cid) : [],
              enabled: Boolean(qboService && qboService.enabled), flash: flashOf(url), counts: counts(u, cid) })), true;
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
