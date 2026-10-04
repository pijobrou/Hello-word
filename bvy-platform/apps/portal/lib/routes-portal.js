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
const PV = require('./views-payroll.js');
const TV = require('./views-salestax.js');
const IV = require('./views-incometax.js');
const RV = require('./views-inbox.js');
const AV = require('./views-anomalies.js');
const GV = require('./views-govrequests.js');
const SV = require('./views-summaries.js');
const CV = require('./views-classify.js');

function createPortalRoutes({ db, portal, notifyClient, notifyTeam, qboService = null, workqueue, payroll, payrollTick = () => {}, salestax, incometax, inbox, anomalies, gov, health, summaries, classifier }) {
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
    return { tasks: portal.openTaskCount(u, clientId), unread: portal.unreadCount(u, clientId), suggestions: qboService ? qboService.newSuggestionCount(clientId) : 0, qbo: qboStatus(clientId),
      toFile: db.prepare('SELECT COUNT(*) AS n FROM documents WHERE client_id = ? AND filed = 0').get(Number(clientId)).n, anomalies: anomalies.openCount(clientId), gov: gov.openCount(clientId) };
  }

  // Courriel de rappel : jamais de titre ni de montant, seulement le nombre d'éléments en attente.
  const reminderSubject = (n) => `Rappel : ${n} élément${n > 1 ? 's' : ''} vous attend${n > 1 ? 'ent' : ''} dans votre portail BVY`;
  // Retour après une action : seulement vers une page interne connue.
  const backTo = (v, fallback) => (/^\/(reception|anomalies|clients\/\d+\/(documents|taches|anomalies))$/.test(String(v || '')) ? v : fallback);
  const anomalyFilter = (url) => ({ severity: url.searchParams.get('gravite') || '', status: url.searchParams.get('etat') === 'closed' ? 'closed' : 'active' });

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
          return send200(res, P.clientHome(s, { client, snap: portal.getSnapshot(u, u.client_id), tasks: portal.listTasks(u, u.client_id, { open: true }), nav: clientNav(u), flash: flashOf(url), sync: qboStatus(u.client_id), pays: payroll ? payroll.openRunsFor(u.client_id) : [], gov: gov.openForClient(u.client_id), health: health.forClient(u.client_id) })), true;
        }
        const data = workqueue.dashboard(u, { qboStatus, suggestions: (id) => (qboService ? qboService.newSuggestionCount(id) : 0), unread: (id) => portal.unreadCount(u, id) });
        data.summary.urgent = anomalies.urgentCount(u);
        return send200(res, W.staffDashboard(s, { data, flash: flashOf(url) })), true;
      }

      /* ------------------------------------------------------ côté client */
      if (u.role === 'client') {
        const cid = u.client_id;
        if (p === '/a-faire' && GET) return send200(res, P.clientTasks(s, { tasks: portal.listTasks(u, cid), nav: clientNav(u), flash: flashOf(url) })), true;
        const m = p.match(/^\/a-faire\/(\d+)\/repondre$/);
        if (m && POST) {
          const t = portal.answerTask(u, m[1], form, ip);
          anomalies.onAnswer(t); // mémoire des réponses (workflow 08) et anomalie « Réponse reçue »
          notifyTeam(cid, `Réponse du client : ${t.title}`);
          return ok('/a-faire', 'Merci, votre réponse est envoyée à BVY.'), true;
        }
        if (p === '/documents' && GET) return send200(res, P.clientDocuments(s, { docs: portal.listDocuments(u, cid), nav: clientNav(u), flash: flashOf(url), type: url.searchParams.get('type') || '' })), true;
        if (p === '/documents' && POST) {
          const file = (form._files || []).find((f) => f.field === 'file');
          portal.saveDocument(u, cid, file && { name: file.filename, data: file.data }, { note: form.note, taskId: form.taskId || null, docType: form.docType || null }, ip);
          notifyTeam(cid, 'Nouveau document envoyé par le client');
          return ok(form.taskId ? '/a-faire' : '/documents', 'Document reçu. Merci !'), true;
        }
        /* paie : heures et approbation */
        const pr = p.match(/^\/paie\/(\d+)(\/(?:heures|decision))?$/);
        if (pr) {
          const run = payroll.runFor(u, pr[1]);
          if (!pr[2] && GET) return send200(res, PV.payRunClient(s, { run, employees: payroll.employees(cid), nav: clientNav(u), flash: flashOf(url) })), true;
          if (pr[2] === '/heures' && POST) {
            const file = (form._files || []).find((f) => f.field === 'file' && f.data && f.data.length);
            const docId = file ? portal.saveDocument(u, cid, { name: file.filename, data: file.data }, { note: `Feuille de temps — paie du ${run.pay_date}`, docType: 'paie', link: `pay_run:${run.id}`, filed: true }, ip) : null;
            payroll.submitHours(u, run.id, form, docId, ip);
            notifyTeam(cid, `Heures de paie reçues (paie du ${run.pay_date})`);
            return ok(`/paie/${run.id}`, 'Merci, vos heures sont envoyées à BVY.'), true;
          }
          if (pr[2] === '/decision' && POST) {
            payroll.decide(u, run.id, form, ip);
            notifyTeam(cid, form.decision === 'approve' ? `Paie du ${run.pay_date} approuvée par le client` : `Paie du ${run.pay_date} refusée par le client`);
            return ok(`/paie/${run.id}`, form.decision === 'approve' ? 'Merci, la paie est approuvée.' : 'Votre commentaire est envoyé à BVY.'), true;
          }
        }
        /* Impôts : documents et approbation */
        const ic = p.match(/^\/impots\/(\d+)(\/(?:document|envoye|decision))?$/);
        if (ic) {
          const f = incometax.fileFor(u, ic[1]);
          if (!ic[2] && GET) return send200(res, IV.itFileClient(s, { f, nav: clientNav(u), flash: flashOf(url) })), true;
          if (ic[2] === '/document' && POST) {
            const file = (form._files || []).find((x) => x.field === 'file' && x.data && x.data.length);
            if (file) {
              const item = f.docs.find((x) => x.k === form.item);
              const docId = portal.saveDocument(u, cid, { name: file.filename, data: file.data }, { note: `Impôts ${f.year_label} — ${item ? item.label : 'document'}`, docType: 'impots', link: `tax_file:${f.id}`, filed: true }, ip);
              incometax.docItem(u, f.id, form.item, 'received', docId, ip);
              return ok(`/impots/${f.id}`, 'Document reçu. Merci !'), true;
            }
            if (form.status === 'na') { incometax.docItem(u, f.id, form.item, 'na', null, ip); return ok(`/impots/${f.id}`, 'Noté : ce document ne s’applique pas.'), true; }
            throw new PortalError('Choisissez un fichier.');
          }
          if (ic[2] === '/envoye' && POST) {
            incometax.docsComplete(u, f.id, ip);
            notifyTeam(cid, `Documents d’impôts reçus (${f.year_label})`);
            return ok(`/impots/${f.id}`, 'Merci, BVY a tout reçu.'), true;
          }
          if (ic[2] === '/decision' && POST) {
            incometax.decide(u, f.id, form, ip);
            notifyTeam(cid, form.decision === 'approve' ? 'Déclarations de revenus approuvées par le client' : 'Déclarations de revenus refusées par le client');
            return ok(`/impots/${f.id}`, form.decision === 'approve' ? 'Merci, vos déclarations sont approuvées.' : 'Votre commentaire est envoyé à BVY.'), true;
          }
        }
        /* TPS/TVQ : approbation de la déclaration */
        const tx = p.match(/^\/tps-tvq\/(\d+)(\/decision)?$/);
        if (tx) {
          const r = salestax.returnFor(u, tx[1]);
          if (!tx[2] && GET) return send200(res, TV.taxReturnClient(s, { r, period: salestax.periodOf(r), nav: clientNav(u), flash: flashOf(url) })), true;
          if (tx[2] && POST) {
            salestax.decide(u, r.id, form, ip);
            notifyTeam(cid, form.decision === 'approve' ? 'Déclaration de TPS/TVQ approuvée par le client' : 'Déclaration de TPS/TVQ refusée par le client');
            return ok(`/tps-tvq/${r.id}`, form.decision === 'approve' ? 'Merci, la déclaration est approuvée.' : 'Votre commentaire est envoyé à BVY.'), true;
          }
        }
        if (p === '/rapports' && GET) return send200(res, P.clientReports(s, { docs: portal.listDocuments(u, cid, { category: 'report' }), summaries: summaries.forClient(u, cid), nav: clientNav(u) })), true;
        const rs = p.match(/^\/rapports\/resume\/(\d+)$/);
        if (rs && GET) return send200(res, SV.clientSummary(s, { x: summaries.publishedFor(u, rs[1]), nav: clientNav(u) })), true;
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
          return ok(backTo(form.back, `/clients/${task.client_id}/taches`), form.status === 'cancelled' ? 'Tâche annulée.' : 'Tâche terminée.'), true;
        }
        /* Anomalies (workflow 06) et questions au client (workflow 08) */
        if (p === '/anomalies' && GET) {
          const filter = anomalyFilter(url);
          return send200(res, AV.anomaliesPage(s, { items: anomalies.list(u, filter), filter, questionFor: anomalies.questionFor, flash: flashOf(url) })), true;
        }
        const an = p.match(/^\/anomalies\/(\d+)\/(prendre|resoudre|ignorer|precedente|rouvrir|demander)$/);
        if (an && POST) {
          if (an[2] === 'demander') {
            const r = anomalies.ask(u, an[1], form, ip);
            notifyClient(r.clientId, u.id, 'Vous avez une nouvelle question de BVY dans votre portail');
            return ok(backTo(form.back, `/clients/${r.clientId}/anomalies`), 'Question envoyée au client ; il est prévenu par courriel.'), true;
          }
          const action = { prendre: 'take', resoudre: 'resolve', ignorer: 'dismiss', precedente: 'previous', rouvrir: 'reopen' }[an[2]];
          const cid = anomalies.act(u, an[1], action, form, ip);
          const msg = { take: 'Vous êtes responsable de cette anomalie.', resolve: 'Anomalie résolue.', dismiss: 'Anomalie ignorée : elle ne sera plus signalée.', previous: 'Anomalie résolue avec la réponse précédente du client.', reopen: 'Anomalie rouverte.' }[action];
          return ok(backTo(form.back, `/clients/${cid}/anomalies`), msg), true;
        }
        /* Réglages de l'IA (workflow 07) : administrateur */
        if (p === '/admin/suggestions') {
          if (u.role !== 'admin') throw new PortalError('Accès refusé.');
          if (GET) {
            const calls = db.prepare('SELECT a.*, c.name AS client FROM ai_calls a LEFT JOIN clients c ON c.id = a.client_id ORDER BY a.id DESC LIMIT 20').all();
            return send200(res, CV.aiSettingsPage(s, { settings: classifier.settings(), calls, flash: flashOf(url) })), true;
          }
          if (POST) { classifier.saveSettings(u, form, ip); return ok('/admin/suggestions', 'Réglages des suggestions enregistrés.'), true; }
        }
        /* Résumés (workflow 16) */
        if (p === '/resumes' && GET) {
          const status = url.searchParams.get('etat') === 'published' ? 'published' : 'draft';
          return send200(res, SV.board(s, { items: summaries.list(u, { status }), status, flash: flashOf(url) })), true;
        }
        if (p === '/resumes/preparer' && POST) {
          if (form.clientId) {
            const sid = await summaries.generate(u, form.clientId, form.type, form.endYm || null, ip);
            return ok(`/resumes/${sid}`, 'Brouillon préparé : relisez-le avant de le publier.'), true;
          }
          const r = await summaries.generateAll(u, form.type, form.endYm || null, ip);
          return ok('/resumes', `${r.created} brouillon${r.created > 1 ? 's' : ''} préparé${r.created > 1 ? 's' : ''}${r.skipped ? ` (${r.skipped} client${r.skipped > 1 ? 's' : ''} sans période terminée)` : ''}.`), true;
        }
        const sm = p.match(/^\/resumes\/(\d+)(\/(?:modifier|publier|actualiser))?$/);
        if (sm) {
          if (!sm[2] && GET) return send200(res, SV.editor(s, { x: summaries.get(u, sm[1]), flash: flashOf(url) })), true;
          if (sm[2] === '/modifier' && POST) { summaries.update(u, sm[1], form, ip); return ok(`/resumes/${sm[1]}`, 'Résumé enregistré.'), true; }
          if (sm[2] === '/actualiser' && POST) {
            const x = summaries.get(u, sm[1]);
            await summaries.generate(u, x.client_id, x.period_type, x.period_end.slice(0, 7), ip);
            return ok(`/resumes/${sm[1]}`, 'Sections recalculées ; votre texte « En bref » est gardé.'), true;
          }
          if (sm[2] === '/publier' && POST) {
            const r = summaries.publish(u, sm[1], ip);
            notifyClient(r.clientId, u.id, `Votre résumé (${r.label}) est disponible dans votre portail BVY`);
            return ok(`/resumes/${sm[1]}`, 'Résumé publié ; le client est prévenu par courriel.'), true;
          }
        }
        /* Demandes du gouvernement (workflow 17) */
        if (p === '/gouvernement' && GET) {
          const closed = url.searchParams.get('etat') === 'closed';
          return send200(res, GV.govBoard(s, { items: gov.list(u, { closed }), closed, clients: visibleClients(db, u), flash: flashOf(url) })), true;
        }
        if (p === '/gouvernement' && POST) {
          const rid = gov.create(u, form.clientId, form, ip);
          anomalies.scanClient(Number(form.clientId));
          return ok(`/gouvernement/${rid}`, 'Demande enregistrée : la date limite est suivie.'), true;
        }
        if (p === '/gouvernement/nouvelle' && GET) {
          const cid = Number(url.searchParams.get('client'));
          portal.listTasks(u, cid, { open: true }); // contrôle d'accès
          const client = portal.client(cid);
          if (!client || client.is_firm) return send200(res, V.errorPage(404, 'Ce dossier n’existe pas.'), 404), true;
          const docId = Number(url.searchParams.get('doc')) || null;
          const doc = docId ? db.prepare('SELECT id, name, client_id FROM documents WHERE id = ?').get(docId) : null;
          return send200(res, GV.newPage(s, { client, doc: doc && doc.client_id === cid ? doc : null, flash: flashOf(url) })), true;
        }
        const gr = p.match(/^\/gouvernement\/(\d+)(\/(?:etape|modifier|element|ajouter|demander))?$/);
        if (gr) {
          const rid = Number(gr[1]);
          if (!gr[2] && GET) return send200(res, GV.sheet(s, { r: gov.get(u, rid), flash: flashOf(url) })), true;
          if (gr[2] && POST) {
            let msg = 'Enregistré.';
            if (gr[2] === '/etape') {
              const cid = gov.advance(u, rid, form.action, form, ip);
              anomalies.scanClient(cid);
              msg = { ready: 'Réponse prête à envoyer.', sent: 'Réponse envoyée : en attente de l’organisme.', closed: 'Demande fermée.', back: 'Retour à l’étape précédente.' }[form.action] || msg;
            } else if (gr[2] === '/modifier') { gov.update(u, rid, form, ip); anomalies.scanClient(gov.get(u, rid).client_id); msg = 'Demande mise à jour.'; }
            else if (gr[2] === '/element') { gov.setItem(u, rid, form.item, form.status, ip); msg = 'Liste des documents mise à jour.'; }
            else if (gr[2] === '/ajouter') { gov.addItem(u, rid, form.label, ip); msg = 'Document ajouté à la liste.'; }
            else {
              const r = gov.askClient(u, rid, ip);
              notifyClient(r.clientId, u.id, 'BVY a besoin de documents de votre part');
              msg = 'Documents demandés au client ; il est prévenu par courriel et relancé automatiquement.';
            }
            return ok(`/gouvernement/${rid}`, msg), true;
          }
        }
        /* Réception et rappels (workflows 09 et 10) */
        if (p === '/reception' && GET) return send200(res, RV.inboxPage(s, { data: inbox.inbox(u), flash: flashOf(url) })), true;
        const cl = p.match(/^\/documents\/(\d+)\/classer$/);
        if (cl && POST) {
          const r = inbox.fileDocument(u, cl[1], form, ip);
          return ok(backTo(form.back, `/clients/${r.clientId}/documents`), 'Document classé.'), true;
        }
        const rl = p.match(/^\/taches\/(\d+)\/(relancer|rappels)$/);
        if (rl && POST) {
          if (rl[2] === 'relancer') {
            const r = inbox.remindNow(u, rl[1], ip);
            notifyClient(r.clientId, null, reminderSubject(r.count));
            return ok(`/clients/${r.clientId}/taches`, 'Rappel envoyé au client par courriel.'), true;
          }
          const cid = inbox.setNoReminder(u, rl[1], form.off === '1', ip);
          return ok(`/clients/${cid}/taches`, form.off === '1' ? 'Plus de relance automatique pour cette tâche.' : 'Relances automatiques reprises.'), true;
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
        /* Impôts (workflow 14) : administrateur, comptable principal, fiscalité */
        if (p === '/impots' && GET) {
          if (!incometax.canStaff(u)) throw new PortalError('Accès refusé.');
          payrollTick();
          return send200(res, IV.itBoard(s, { board: incometax.board(u), flash: flashOf(url) })), true;
        }
        const it = p.match(/^\/impots\/(\d+)(\/(?:etape|montants|document|ajouter))?$/);
        if (it) {
          const f = incometax.fileFor(u, it[1]);
          if (!it[2] && GET) return send200(res, IV.itFileStaff(s, { f, client: portal.client(f.client_id), events: incometax.events(f.id), booksReady: incometax.booksReady(f.client_id), flash: flashOf(url) })), true;
          if (it[2] === '/montants' && POST) { incometax.saveFigures(u, f.id, form, ip); return ok(`/impots/${f.id}`, 'Montants enregistrés.'), true; }
          if (it[2] === '/document' && POST) { incometax.docItem(u, f.id, form.item, form.status, null, ip); return ok(`/impots/${f.id}`, 'Liste des documents mise à jour.'), true; }
          if (it[2] === '/ajouter' && POST) { incometax.addDocItem(u, f.id, form.label, ip); notifyClient(f.client_id, u.id, 'BVY vous demande un document de plus pour vos impôts'); return ok(`/impots/${f.id}`, 'Document ajouté à la liste du client.'), true; }
          if (it[2] === '/etape' && POST) {
            const out = incometax.advance(u, f.id, form, ip);
            if (out && out.notifyClient) notifyClient(f.client_id, u.id, 'Vos déclarations de revenus sont prêtes à approuver');
            return ok(`/impots/${f.id}`, 'Dossier mis à jour.'), true;
          }
        }
        /* TPS/TVQ (workflow 13) : administrateur, comptable principal, tenue de livres, fiscalité */
        if (p === '/tps-tvq' && GET) {
          if (!salestax.canStaff(u)) throw new PortalError('Accès refusé.');
          payrollTick();
          return send200(res, TV.taxBoard(s, { board: salestax.board(u), flash: flashOf(url) })), true;
        }
        const tr = p.match(/^\/tps-tvq\/(\d+)(\/(?:etape|montants))?$/);
        if (tr) {
          const r = salestax.returnFor(u, tr[1]);
          if (!tr[2] && GET) {
            return send200(res, TV.taxReturnStaff(s, { r, client: portal.client(r.client_id), period: salestax.periodOf(r), events: salestax.events(r.id), booksReady: salestax.booksReady(r.client_id), flash: flashOf(url) })), true;
          }
          if (tr[2] === '/montants' && POST) { salestax.saveFigures(u, r.id, form, ip); return ok(`/tps-tvq/${r.id}`, 'Montants enregistrés.'), true; }
          if (tr[2] === '/etape' && POST) {
            const out = salestax.advance(u, r.id, form, ip);
            if (out && out.notifyClient) notifyClient(r.client_id, u.id, 'Votre déclaration de TPS/TVQ est prête à approuver');
            return ok(`/tps-tvq/${r.id}`, 'Déclaration mise à jour.'), true;
          }
        }
        /* Paie (workflow 12) : administrateur, comptable principal, paie */
        if (p === '/paie' && GET) {
          if (!payroll.canStaff(u)) throw new PortalError('Accès refusé.');
          payrollTick();
          return send200(res, PV.payrollBoard(s, { board: payroll.board(u), flash: flashOf(url) })), true;
        }
        const ps = p.match(/^\/paie\/(\d+)(\/(?:sommaire|etat))?$/);
        if (ps) {
          const run = payroll.runFor(u, ps[1]);
          if (!ps[2] && GET) {
            return send200(res, PV.payRunStaff(s, { run, client: portal.client(run.client_id), events: payroll.events(run.id), qboUrl: payroll.qboUrlFor(run.client_id), flash: flashOf(url) })), true;
          }
          if (ps[2] === '/sommaire' && POST) {
            const before = run.status;
            payroll.saveSummary(u, run.id, form, ip);
            if (before === 'hours_received') notifyClient(run.client_id, u.id, `Votre paie du ${run.pay_date} est prête à approuver`);
            return ok(`/paie/${run.id}`, before === 'hours_received' ? 'Sommaire envoyé : le client doit approuver la paie.' : 'Sommaire corrigé.'), true;
          }
          if (ps[2] === '/etat' && POST) {
            payroll.move(u, run.id, form.action, form.note, ip);
            return ok(`/paie/${run.id}`, 'État de la paie mis à jour.'), true;
          }
        }
        const pc = p.match(/^\/clients\/(\d+)\/paie(\/(?:calendrier|employes|employes\/(\d+)\/(desactiver|reactiver)))?$/);
        if (pc && POST) {
          const cid = Number(pc[1]);
          if (pc[2] === '/calendrier') { payroll.saveSchedule(u, cid, form, ip); payrollTick(); return ok(`/clients/${cid}/paie`, 'Calendrier de paie enregistré.'), true; }
          if (pc[2] === '/employes') { payroll.addEmployee(u, cid, form, ip); return ok(`/clients/${cid}/paie`, 'Employé ajouté.'), true; }
          if (pc[4]) { payroll.setEmployeeActive(u, cid, pc[3], pc[4] === 'reactiver', ip); return ok(`/clients/${cid}/paie`, pc[4] === 'reactiver' ? 'Employé rétabli.' : 'Employé retiré.'), true; }
        }
        /* Facturation : qui doit quoi à BVY (administrateur et comptable principal) */
        if (p === '/facturation' && GET) {
          const data = workqueue.billing(u);
          return send200(res, W.billingPage(s, { data, firmQbo: data.firm ? qboStatus(data.firm.id) : null, flash: flashOf(url) })), true;
        }
        /* QuickBooks et obligations du cabinet : administrateur seulement */
        if (p === '/cabinet' || p.startsWith('/cabinet/')) {
          if (u.role !== 'admin') throw new PortalError('Accès refusé.');
          if (p === '/cabinet' && GET) {
            const firm = workqueue.requireFirm(u);
            const deadlinesHtml = W.staffDeadlines(s, { client: firm, deadlines: workqueue.listDeadlines(u, firm.id), shell: (x) => x, base: '/cabinet', firm: true });
            return send200(res, W.firmPage(s, { qbo: qboStatus(firm.id), enabled: Boolean(qboService && qboService.enabled), deadlinesHtml, flash: flashOf(url) })), true;
          }
          const fd = p.match(/^\/cabinet\/(profil|echeances|echeances\/marquer|echeances\/(\d+)\/supprimer)$/);
          if (fd && POST) {
            const firm = workqueue.requireFirm(u);
            const back = (msg) => ok('/cabinet#obligations', msg);
            if (fd[1] === 'profil') { workqueue.saveProfile(u, firm.id, form, ip); return back('Profil fiscal de BVY enregistré.'), true; }
            if (fd[1] === 'echeances') { workqueue.addCustomDeadline(u, firm.id, form, ip); return back('Échéance ajoutée.'), true; }
            if (fd[1] === 'echeances/marquer') { workqueue.markDeadline(u, firm.id, form.key, form.status, ip); return back(form.status === 'open' ? 'Échéance rétablie.' : 'Échéance mise à jour.'), true; }
            workqueue.deleteCustomDeadline(u, firm.id, fd[2], ip);
            return back('Échéance supprimée.'), true;
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
        const dl = p.match(/^\/clients\/(\d+)\/(profil|tenue|echeances|echeances\/marquer|echeances\/(\d+)\/supprimer)$/);
        if (dl && POST) {
          const cid = Number(dl[1]);
          if (dl[2] === 'tenue') {
            workqueue.setBooks(u, cid, form.status, ip);
            const c0 = portal.client(cid);
            return ok('/accueil', `Tenue de livres de ${c0.name} : ${{ done: 'à jour', progress: 'en cours', todo: 'pas encore traitée' }[form.status]}.`), true;
          }
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
        const c = p.match(/^\/clients\/(\d+)(\/(?:tableau|quickbooks|taches|documents|messages|echeances|paie|tps-tvq|impots|historique|anomalies|gouvernement|sante|resumes|classement|classement\/relancer))?$/);
        if (c) {
          const cid = Number(c[1]);
          const sub = c[2] || '';
          portal.listTasks(u, cid, { open: true }); // contrôle d'accès (lève PortalError sinon)
          const client = portal.client(cid);
          if (!client || client.is_firm) return send200(res, V.errorPage(404, 'Ce dossier n’existe pas.'), 404), true;
          if (sub === '/impots' && GET) {
            if (!incometax.canStaff(u)) throw new PortalError('Accès refusé.');
            return send200(res, IV.clientItTab(s, { client, files: incometax.forClient(u, cid), shell: (inner) => P.staffClientShell(s, client, '/impots', inner, flashOf(url), counts(u, cid)) })), true;
          }
          if (sub === '/tps-tvq' && GET) {
            if (!salestax.canStaff(u)) throw new PortalError('Accès refusé.');
            return send200(res, TV.clientTaxTab(s, { client, returns: salestax.forClient(u, cid), shell: (inner) => P.staffClientShell(s, client, '/tps-tvq', inner, flashOf(url), counts(u, cid)) })), true;
          }
          if (sub === '/paie' && GET) {
            if (!payroll.canStaff(u)) throw new PortalError('Accès refusé.');
            const year = new Date().getUTCFullYear();
            const yearEnd = client.kind ? workqueue.deadlinesFor(client).filter((d) => /^(t4|cnesst):/.test(d.key) || /^Relevé d’emploi/.test(d.title)) : [];
            return send200(res, PV.clientPayrollTab(s, { client, schedule: payroll.schedule(cid), employees: payroll.employees(cid, { all: true }), runs: payroll.runsForClient(u, cid),
              qboUrl: payroll.qboUrlFor(cid), ytd: payroll.yearToDate(u, cid, year), yearEnd,
              shell: (inner) => P.staffClientShell(s, client, '/paie', inner, flashOf(url), counts(u, cid)) })), true;
          }
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
            // Ancien champ « santé » du formulaire : devient l'évaluation de l'équipe (workflow 15), le mot au client est gardé
            if (form.health) health.saveNote(u, cid, { state: form.health, why: form.healthWhy, comment: (health.forClient(cid) || {}).comment || '' }, ip);
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
          if (sub === '/taches' && GET) {
            const tasks = portal.listTasks(u, cid).map((t) => ({ ...t, next_reminder: inbox.nextReminder(t) }));
            return send200(res, P.staffTasks(s, { client, tasks, flash: flashOf(url), counts: counts(u, cid) })), true;
          }
          if (sub === '/anomalies' && GET) {
            const filter = anomalyFilter(url);
            return send200(res, AV.clientAnomaliesTab(s, { client, items: anomalies.list(u, { ...filter, clientId: cid }), filter, questionFor: anomalies.questionFor,
              shell: (inner) => P.staffClientShell(s, client, '/anomalies', inner, flashOf(url), counts(u, cid)) })), true;
          }
          if (sub === '/classement' && GET) {
            return send200(res, CV.classifyTab(s, { client, groups: classifier.groups(u, cid), chart: classifier.chartFor(u, cid), settings: classifier.settings(),
              shell: (inner) => P.staffClientShell(s, client, '/classement', inner, flashOf(url), counts(u, cid)) })), true;
          }
          if (sub === '/classement' && POST) {
            const r = classifier.decide(u, cid, form.group, form, ip);
            const msg = form.action === 'undo' ? 'Décision annulée : de nouveau à classer.' : `${r.count} opération${r.count > 1 ? 's' : ''} de ${r.party} à classer en « ${r.account} » dans QuickBooks.`;
            return ok(`/clients/${cid}/classement`, msg), true;
          }
          if (sub === '/classement/relancer' && POST) {
            const r = await classifier.classifyClient(cid, { retry: true });
            return ok(`/clients/${cid}/classement`, `Suggestions relancées : ${r.history} d’après l’historique, ${r.ai} automatiques.`), true;
          }
          if (sub === '/sante' && GET) {
            return send200(res, SV.healthTab(s, { client, h: health.forActor(u, cid), shell: (inner) => P.staffClientShell(s, client, '/sante', inner, flashOf(url), counts(u, cid)) })), true;
          }
          if (sub === '/sante' && POST) {
            health.saveNote(u, cid, form, ip);
            return ok(`/clients/${cid}/sante`, 'Santé financière mise à jour pour le client.'), true;
          }
          if (sub === '/resumes' && GET) {
            return send200(res, SV.clientTab(s, { client, items: summaries.list(u, { status: 'all', clientId: cid }), shell: (inner) => P.staffClientShell(s, client, '/resumes', inner, flashOf(url), counts(u, cid)) })), true;
          }
          if (sub === '/gouvernement' && GET) {
            return send200(res, GV.clientGovTab(s, { client, items: gov.list(u, { clientId: cid }).concat(gov.list(u, { clientId: cid, closed: true })),
              shell: (inner) => P.staffClientShell(s, client, '/gouvernement', inner, flashOf(url), counts(u, cid)) })), true;
          }
          if (sub === '/historique' && GET) {
            return send200(res, RV.historyTab(s, { events: inbox.timeline(u, cid), shell: (inner) => P.staffClientShell(s, client, '/historique', inner, flashOf(url), counts(u, cid)) })), true;
          }
          if (sub === '/taches' && POST) {
            portal.createTask(u, cid, form, ip);
            notifyClient(cid, u.id, 'Vous avez une nouvelle tâche dans votre portail BVY');
            return ok(`/clients/${cid}/taches`, 'Tâche créée ; le client est prévenu par courriel.'), true;
          }
          if (sub === '/documents' && GET) {
            const filters = { q: url.searchParams.get('q') || '', type: url.searchParams.get('type') || '', period: url.searchParams.get('period') || '' };
            return send200(res, RV.staffDocuments(s, { client, docs: inbox.searchDocuments(u, cid, filters), filters, links: inbox.linkOptions(cid),
              uploadForm: P.uploadForm(s, `/clients/${cid}/documents`, { staff: true }), shell: (inner) => P.staffClientShell(s, client, '/documents', inner, flashOf(url), counts(u, cid)) })), true;
          }
          if (sub === '/documents' && POST) {
            const file = (form._files || []).find((f) => f.field === 'file');
            portal.saveDocument(u, cid, file && { name: file.filename, data: file.data }, { note: form.note, category: form.category, docType: form.docType || null }, ip);
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
      if (/^(Tâche|Document|Résumé|Anomalie|Demande) introuvable\.$/.test(err.message)) { // page demandée qui n’existe pas (ou pas pour vous)
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
