'use strict';

/**
 * Échéances fiscales et administratives calculées à partir du profil d'un client (workflow 05).
 * Fonction pure : aucune base de données, aucune horloge implicite. Règles à faire valider par le cabinet.
 *
 * profil : { kind: 'entreprise'|'autonome'|'particulier', yearEndMonth: 1-12, gstFreq: 'none'|'monthly'|'quarterly'|'annual',
 *            payroll: bool, installments: bool }
 */

const KINDS = Object.freeze({ entreprise: 'Entreprises', autonome: 'Travailleurs autonomes', particulier: 'Particuliers' });
const KIND_ONE = Object.freeze({ entreprise: 'Entreprise (société)', autonome: 'Travailleur autonome', particulier: 'Particulier' });
const GST_FREQ = Object.freeze({ none: 'Non inscrit', monthly: 'Mensuelle', quarterly: 'Trimestrielle', annual: 'Annuelle' });

const DAY = 86_400_000;
const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
// Dernier jour du mois (m de 1 à 12, peut dépasser : normalisé)
function monthEnd(y, m) {
  const d = new Date(Date.UTC(y, m, 0)); // jour 0 du mois suivant
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
const norm = (y, m) => { const d = new Date(Date.UTC(y, m - 1, 1)); return [d.getUTCFullYear(), d.getUTCMonth() + 1]; };
// Samedi ou dimanche → lundi suivant (les jours fériés ne sont pas encore décalés).
function businessDay(date) {
  const d = new Date(`${date}T00:00:00Z`);
  const w = d.getUTCDay();
  if (w === 6) d.setUTCDate(d.getUTCDate() + 2);
  if (w === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const deMois = (m) => (/^[aeiouyéè]/i.test(MONTHS[m - 1]) ? `d’${MONTHS[m - 1]}` : `de ${MONTHS[m - 1]}`);
const dayFr = (date) => { const [y, m, d] = date.split('-').map(Number); return `${d === 1 ? '1er' : d} ${MONTHS[m - 1]} ${y}`; };

function computeDeadlines(profile, today, { back = 90, ahead = 400 } = {}) {
  const p = profile || {};
  if (!KINDS[p.kind]) return [];
  const E = Number(p.yearEndMonth) >= 1 && Number(p.yearEndMonth) <= 12 ? Number(p.yearEndMonth) : 12;
  const t = Date.parse(`${today}T00:00:00Z`);
  const from = new Date(t - back * DAY).toISOString().slice(0, 10);
  const to = new Date(t + ahead * DAY).toISOString().slice(0, 10);
  const ty = Number(today.slice(0, 4));
  const out = [];
  const add = (key, title, due, area) => {
    const date = businessDay(due);
    if (date >= from && date <= to) out.push({ key, title, date, area });
  };

  for (let Y = ty - 1; Y <= ty + 2; Y++) {
    /* impôt sur le revenu */
    if (p.kind === 'particulier') add(`t1:${Y - 1}`, `Déclarations de revenus ${Y - 1} (T1 et TP-1)`, iso(Y, 4, 30), 'impot');
    if (p.kind === 'autonome') {
      add(`t1:${Y - 1}`, `Déclarations de revenus ${Y - 1} (T1 et TP-1, revenus d’entreprise)`, iso(Y, 6, 15), 'impot');
      add(`t1pay:${Y - 1}`, `Paiement du solde d’impôt ${Y - 1}`, iso(Y, 4, 30), 'impot');
    }
    if (p.kind === 'entreprise') {
      const ye = monthEnd(Y, E);
      const [y6, m6] = norm(Y, E + 6); const [y2, m2] = norm(Y, E + 2);
      add(`t2:${ye}`, `Déclarations T2 et CO-17 (exercice terminé le ${dayFr(ye)})`, monthEnd(y6, m6), 'impot');
      add(`t2pay:${ye}`, `Solde d’impôt de la société (exercice terminé le ${dayFr(ye)})`, monthEnd(y2, m2), 'impot');
      add(`req:${ye}`, `Mise à jour annuelle au Registraire des entreprises (avec la CO-17)`, monthEnd(y6, m6), 'admin');
    }
    /* acomptes provisionnels */
    if (p.installments) {
      if (p.kind === 'entreprise') {
        for (let m = 1; m <= 12; m++) add(`acompte:${Y}-${pad(m)}`, `Acompte provisionnel de la société (${MONTHS[m - 1]} ${Y})`, monthEnd(Y, m), 'impot');
      } else {
        for (const m of [3, 6, 9, 12]) add(`acompte:${Y}-${pad(m)}`, `Acompte provisionnel (${MONTHS[m - 1]} ${Y})`, iso(Y, m, 15), 'impot');
      }
    }
    /* TPS/TVQ */
    if (p.kind !== 'particulier' && p.gstFreq && p.gstFreq !== 'none') {
      if (p.gstFreq === 'monthly') {
        for (let m = 1; m <= 12; m++) {
          const [yn, mn] = norm(Y, m + 1);
          add(`taxes:${Y}-${pad(m)}`, `TPS/TVQ — ${MONTHS[m - 1]} ${Y}`, monthEnd(yn, mn), 'taxes');
        }
      } else if (p.gstFreq === 'quarterly') {
        const ends = [0, 3, 6, 9].map((k) => ((E - 1 - k + 12) % 12) + 1);
        for (const qm of ends) {
          const [yn, mn] = norm(Y, qm + 1);
          add(`taxes:${Y}-${pad(qm)}`, `TPS/TVQ — trimestre terminé le ${dayFr(monthEnd(Y, qm))}`, monthEnd(yn, mn), 'taxes');
        }
      } else if (p.gstFreq === 'annual') {
        if (p.kind === 'autonome') {
          add(`taxes:${Y - 1}`, `TPS/TVQ — déclaration annuelle ${Y - 1}`, iso(Y, 6, 15), 'taxes');
          add(`taxespay:${Y - 1}`, `TPS/TVQ — paiement annuel ${Y - 1}`, iso(Y, 4, 30), 'taxes');
        } else {
          const ye = monthEnd(Y, E); const [y3, m3] = norm(Y, E + 3);
          add(`taxes:${ye}`, `TPS/TVQ — déclaration annuelle (exercice terminé le ${dayFr(ye)})`, monthEnd(y3, m3), 'taxes');
        }
      }
    }
    /* paie */
    if (p.payroll && p.kind !== 'particulier') {
      for (let m = 1; m <= 12; m++) {
        const [yn, mn] = norm(Y, m + 1);
        add(`das:${Y}-${pad(m)}`, `Retenues à la source — paies ${deMois(m)} ${Y}`, iso(yn, mn, 15), 'paie');
      }
      add(`t4:${Y - 1}`, `Feuillets T4 et RL-1 ${Y - 1} et sommaires`, monthEnd(Y, 2), 'paie');
      add(`cnesst:${Y - 1}`, `CNESST — déclaration des salaires ${Y - 1}`, iso(Y, 3, 15), 'paie');
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.key < b.key ? -1 : 1));
}

// « en retard », « cette semaine », « ce mois-ci », ou « plus tard »
function urgency(date, today) {
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
  if (days < 0) return { level: 'late', days, label: `En retard de ${-days} jour${-days > 1 ? 's' : ''}` };
  if (days === 0) return { level: 'week', days, label: 'Aujourd’hui' };
  if (days <= 7) return { level: 'week', days, label: `Dans ${days} jour${days > 1 ? 's' : ''}` };
  if (days <= 31) return { level: 'month', days, label: `Dans ${days} jours` };
  return { level: 'later', days, label: `Dans ${days} jours` };
}

module.exports = { computeDeadlines, urgency, businessDay, monthEnd, dayFr, KINDS, KIND_ONE, GST_FREQ };
