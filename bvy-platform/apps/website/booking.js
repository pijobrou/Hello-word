'use strict';

/**
 * Prise de rendez-vous par Jessica : disponibilités, réservation dans Google Agenda, ligne dans
 * Google Sheets (Drive), copie locale au Canada (data/rendez-vous.jsonl) et courriels de confirmation.
 *
 * Garde-fous côté serveur (le modèle ne peut pas les contourner) :
 *   - seul un créneau encore libre, recalculé au moment de réserver, est accepté ;
 *   - coordonnées validées, consentement explicite requis ;
 *   - 2 réservations par adresse IP par jour, 1 par courriel par jour, 15 par jour pour le site.
 */

const fsp = require('node:fs/promises');
const path = require('node:path');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function bookingConfigFromEnv(env = process.env) {
  const num = (v, d) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
  return {
    timeZone: env.BOOKING_TZ || 'America/Toronto', // heure du Québec
    startHour: num(env.BOOKING_START_HOUR, 8),
    endHour: num(env.BOOKING_END_HOUR, 17),
    durationMin: 30,
    daysAhead: num(env.BOOKING_DAYS_AHEAD, 14),
    minLeadHours: num(env.BOOKING_MIN_LEAD_HOURS, 18),
    maxPerDay: num(env.BOOKING_MAX_PER_DAY, 15),
  };
}

/* ------------------------------------------------------------- fuseau horaire */

// Décalage (minutes) du fuseau par rapport à UTC à un instant donné.
function tzOffsetMin(ms, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms));
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+v.year, +v.month - 1, +v.day, +v.hour, +v.minute, +v.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

// Heure locale (fuseau) → instant UTC en millisecondes.
function zonedToUtc(y, m, d, h, min, timeZone) {
  const guess = Date.UTC(y, m - 1, d, h, min);
  let ms = guess - tzOffsetMin(guess, timeZone) * 60000;
  ms = guess - tzOffsetMin(ms, timeZone) * 60000; // corrige autour des changements d'heure
  return ms;
}

function localParts(ms, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(ms));
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { y: +v.year, m: +v.month, d: +v.day, h: +v.hour, min: +v.minute, weekday: v.weekday };
}

// « mardi 7 octobre 2026 à 10 h 00 »
function formatFr(ms, timeZone) {
  const day = new Intl.DateTimeFormat('fr-CA', { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ms));
  const p = localParts(ms, timeZone);
  return `${day} à ${p.h} h ${String(p.min).padStart(2, '0')}`;
}

// ISO avec décalage local, ex. 2026-10-07T10:00:00-04:00 (identifiant stable d'un créneau).
function isoLocal(ms, timeZone) {
  const p = localParts(ms, timeZone);
  const off = tzOffsetMin(ms, timeZone);
  const sign = off < 0 ? '-' : '+';
  const a = Math.abs(off);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}:00${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

/* ----------------------------------------------------------------- créneaux */

// Créneaux libres (lundi–vendredi, heures d'ouverture, hors périodes occupées et délai minimal).
function freeSlots(cfg, nowMs, busy) {
  const slots = [];
  const first = localParts(nowMs, cfg.timeZone);
  const base = Date.UTC(first.y, first.m - 1, first.d);
  const earliest = nowMs + cfg.minLeadHours * 3600_000;
  for (let i = 0; i <= cfg.daysAhead; i++) {
    const day = new Date(base + i * DAY_MS);
    const y = day.getUTCFullYear(); const m = day.getUTCMonth() + 1; const d = day.getUTCDate();
    const wd = day.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    for (let t = cfg.startHour * 60; t + cfg.durationMin <= cfg.endHour * 60; t += cfg.durationMin) {
      const start = zonedToUtc(y, m, d, Math.floor(t / 60), t % 60, cfg.timeZone);
      const end = start + cfg.durationMin * 60000;
      if (start < earliest) continue;
      if (busy.some((b) => b.start < end && b.end > start)) continue;
      slots.push({ start, end });
    }
  }
  return slots;
}

/* -------------------------------------------------------------- outils (IA) */

const TOOLS = [
  {
    name: 'voir_disponibilites',
    description: 'Liste les moments libres pour la consultation gratuite de 30 minutes dans l’agenda de BVY (heure du Québec), pour les prochains jours ouvrables. Utilise uniquement les moments retournés par cet outil.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'reserver_rendez_vous',
    description: 'Réserve la consultation dans l’agenda de BVY et enregistre les coordonnées. À appeler SEULEMENT après que la personne a donné son accord à l’enregistrement de ses coordonnées ET confirmé explicitement le récapitulatif (moment, prénom, nom, courriel, téléphone).',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        debut: { type: 'string', description: 'Identifiant exact du moment choisi, tel que retourné par voir_disponibilites (ex. 2026-10-07T10:00:00-04:00).' },
        prenom: { type: 'string' },
        nom: { type: 'string' },
        courriel: { type: 'string' },
        telephone: { type: 'string' },
        sujet: { type: 'string', description: 'Le besoin en une phrase (ex. « tenue de livres pour une boutique Shopify »).' },
        consentement: { type: 'boolean', description: 'true seulement si la personne a accepté que ses coordonnées soient enregistrées par BVY.' },
      },
      required: ['debut', 'prenom', 'nom', 'courriel', 'telephone', 'sujet', 'consentement'],
      additionalProperties: false,
    },
  },
];

function bookingPrompt(cfg) {
  return `
Prise de rendez-vous dans la conversation (outils voir_disponibilites et reserver_rendez_vous) :
- Tu peux réserver la consultation gratuite de 30 minutes. Elle se fait par appel téléphonique : un membre de l’équipe BVY appelle la personne au numéro donné, au moment choisi. Les heures sont celles du Québec (heure de l’Est).
- Étapes, dans l’ordre :
  1. Appelle voir_disponibilites, puis propose 3 à 5 moments (ou ceux du jour demandé). N’invente jamais un moment : utilise seulement ceux de l’outil, recopiés exactement.
  2. Demande le prénom, le nom, le courriel, le numéro de téléphone et le besoin en une phrase. Rien d’autre : jamais de NAS, de date de naissance, de revenus ou de numéros de compte.
  3. Explique que ces coordonnées seront enregistrées dans l’agenda et le registre de rendez-vous de BVY (services Google, hors du Canada) et utilisées seulement pour ce rendez-vous, puis demande son accord.
  4. Fais un récapitulatif (moment, prénom, nom, courriel, téléphone) et demande une confirmation claire (« oui »).
  5. Seulement après ce oui, appelle reserver_rendez_vous. Si l’outil répond que le moment n’est plus libre, rappelle voir_disponibilites et propose d’autres moments.
- Après la réservation, dis que la confirmation part par courriel et que, pour changer ou annuler, il suffit de répondre à ce courriel.
- Si l’outil est indisponible, donne le formulaire ${'https://bvyaccountingtax.ca'}/rendez-vous/.`;
}

/* ------------------------------------------------------------- réservation */

const clean = (v, max) => String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
// Évite qu'une valeur soit interprétée comme une formule si la feuille est exportée.
const cell = (v) => (/^[=+\-@]/.test(v) ? `'${v}` : v);

function createDailyCounter() {
  const map = new Map();
  let day = '';
  return {
    count(key) {
      const today = new Date().toISOString().slice(0, 10);
      if (today !== day) { day = today; map.clear(); }
      return map.get(key) || 0;
    },
    add(key) { map.set(key, (map.get(key) || 0) + 1); },
  };
}

function createBooking(cfg, { google, mail, dataDir, now = () => Date.now() }) {
  const perIp = createDailyCounter();
  const perEmail = createDailyCounter();
  const site = createDailyCounter();

  async function availability() {
    const t = now();
    const busy = await google.busy(new Date(t).toISOString(), new Date(t + (cfg.daysAhead + 1) * DAY_MS).toISOString());
    return freeSlots(cfg, t, busy);
  }

  async function listAvailability() {
    const slots = await availability();
    if (!slots.length) return { ok: true, message: 'Aucun moment libre dans les prochains jours. Propose le formulaire /rendez-vous/.' };
    const byDay = new Map();
    for (const s of slots) {
      const label = new Intl.DateTimeFormat('fr-CA', { timeZone: cfg.timeZone, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(s.start));
      if (!byDay.has(label)) byDay.set(label, []);
      byDay.get(label).push(isoLocal(s.start, cfg.timeZone));
    }
    return { ok: true, fuseau: 'heure du Québec', jours: [...byDay].map(([jour, moments]) => ({ jour, moments })) };
  }

  async function book(input, ip) {
    const v = {
      debut: clean(input.debut, 40),
      prenom: clean(input.prenom, 80),
      nom: clean(input.nom, 80),
      courriel: clean(input.courriel, 160).toLowerCase(),
      telephone: clean(input.telephone, 40),
      sujet: clean(input.sujet, 300),
    };
    const errors = [];
    if (input.consentement !== true) errors.push('la personne n’a pas donné son accord à l’enregistrement de ses coordonnées');
    if (!v.prenom || !v.nom) errors.push('prénom et nom requis');
    if (!EMAIL_RE.test(v.courriel)) errors.push('courriel invalide');
    const digits = v.telephone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) errors.push('numéro de téléphone invalide (10 à 15 chiffres)');
    if (errors.length) return { ok: false, erreur: errors.join('; ') };

    if (site.count('all') >= cfg.maxPerDay) return { ok: false, erreur: 'limite quotidienne de réservations atteinte : propose le formulaire /rendez-vous/' };
    if (perIp.count(ip) >= 2) return { ok: false, erreur: 'trop de réservations depuis cet appareil aujourd’hui' };
    if (perEmail.count(v.courriel) >= 1) return { ok: false, erreur: 'un rendez-vous a déjà été réservé aujourd’hui avec ce courriel ; pour le modifier, répondre au courriel de confirmation' };

    const slots = await availability();
    const slot = slots.find((s) => isoLocal(s.start, cfg.timeZone) === v.debut);
    if (!slot) return { ok: false, erreur: 'ce moment n’est plus libre ou n’existe pas ; rappelle voir_disponibilites' };

    const when = formatFr(slot.start, cfg.timeZone);
    const event = await google.insertEvent({
      summary: `Consultation BVY — ${v.prenom} ${v.nom}`,
      description: [
        'Consultation gratuite de 30 minutes réservée par Jessica sur bvyaccountingtax.ca.',
        'Appeler la personne au numéro ci-dessous.',
        '',
        `Nom : ${v.prenom} ${v.nom}`,
        `Courriel : ${v.courriel}`,
        `Téléphone : ${v.telephone}`,
        `Besoin : ${v.sujet || '(non précisé)'}`,
      ].join('\n'),
      start: { dateTime: new Date(slot.start).toISOString(), timeZone: cfg.timeZone },
      end: { dateTime: new Date(slot.end).toISOString(), timeZone: cfg.timeZone },
      reminders: { useDefault: true },
    });
    perIp.add(ip); perEmail.add(v.courriel); site.add('all');

    const record = { reserveLe: new Date(now()).toISOString(), rendezVous: when, debut: v.debut, ...v, evenement: event.id || '', source: 'Jessica' };
    try {
      await google.appendRow([record.reserveLe, when, v.prenom, v.nom, v.courriel, v.telephone, v.sujet, record.evenement, 'Jessica'].map(cell));
    } catch (err) {
      console.error('Rendez-vous : ligne Google Sheets non ajoutée :', err.message);
    }
    try {
      await fsp.mkdir(dataDir, { recursive: true });
      await fsp.appendFile(path.join(dataDir, 'rendez-vous.jsonl'), JSON.stringify(record) + '\n', { mode: 0o600 });
    } catch (err) {
      console.error('Rendez-vous : copie locale non écrite :', err.message);
    }
    if (mail) mail(record).catch((err) => console.error('Rendez-vous : courriel non envoyé :', err.message));
    return { ok: true, confirmation: `Rendez-vous réservé le ${when} (heure du Québec). Un courriel de confirmation est envoyé à ${v.courriel}.` };
  }

  // Exécute un appel d'outil du modèle ; ne lève jamais d'exception (l'erreur est rendue au modèle).
  async function runTool(name, input, ip) {
    try {
      if (name === 'voir_disponibilites') return await listAvailability();
      if (name === 'reserver_rendez_vous') return await book(input || {}, ip);
      return { ok: false, erreur: `outil inconnu : ${name}` };
    } catch (err) {
      console.error(`Rendez-vous : ${name} en échec :`, err.message);
      return { ok: false, erreur: 'l’agenda est momentanément indisponible ; propose le formulaire /rendez-vous/' };
    }
  }

  return { tools: TOOLS, prompt: bookingPrompt(cfg), runTool };
}

// Courriels de confirmation (client) et d'avis (BVY) d'un rendez-vous.
function appointmentMessages(r, { replyTo } = {}) {
  const client = {
    to: [r.courriel],
    replyTo,
    subject: `Votre consultation BVY — ${r.rendezVous}`,
    text: [
      `Bonjour ${r.prenom},`,
      '',
      'Votre consultation gratuite de 30 minutes avec BVY Accounting & Tax Services est confirmée :',
      '',
      `${r.rendezVous} (heure du Québec)`,
      `Un membre de notre équipe vous appellera au ${r.telephone}.`,
      '',
      'Pour changer ou annuler ce rendez-vous, répondez simplement à ce courriel.',
      'Par prudence, ne nous transmettez aucun renseignement sensible (NAS, mots de passe, numéros de compte) par courriel.',
      '',
      'Au plaisir de vous parler,',
      '',
      'L’équipe BVY',
      'BVY Accounting & Tax Services Inc.',
      'https://bvyaccountingtax.ca',
      '',
      '—',
      'Ce rendez-vous a été réservé avec Jessica, l’assistante virtuelle (IA) de notre site.',
      'Si ce n’est pas vous, répondez à ce courriel et nous l’annulerons.',
    ].join('\n'),
  };
  const team = {
    replyTo: r.courriel,
    subject: `Nouveau rendez-vous BVY — ${r.prenom} ${r.nom} — ${r.rendezVous}`,
    text: [
      'Rendez-vous réservé par Jessica sur bvyaccountingtax.ca (inscrit dans Google Agenda et Google Sheets).',
      '',
      `Moment : ${r.rendezVous}`,
      `Nom : ${r.prenom} ${r.nom}`,
      `Courriel : ${r.courriel}`,
      `Téléphone : ${r.telephone}`,
      `Besoin : ${r.sujet || '(non précisé)'}`,
    ].join('\n'),
  };
  return { client, team };
}

module.exports = {
  bookingConfigFromEnv, createBooking, appointmentMessages, freeSlots, zonedToUtc, isoLocal, formatFr, tzOffsetMin, TOOLS,
};
