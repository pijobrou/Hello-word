'use strict';

/**
 * Format des dates du portail, choisi par le propriétaire : 2026-10-02 (et 2026-10-02 14:30 avec l'heure).
 * Heure du Québec (America/Toronto) pour les horodatages ; une date seule (AAAA-MM-JJ) est reprise telle quelle.
 */

const TZ = 'America/Toronto';
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const parts = (d, opts) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hourCycle: 'h23', ...opts }).formatToParts(d).map((p) => [p.type, p.value]));

function isoDay(x) {
  if (x === null || x === undefined || x === '') return '';
  if (typeof x === 'string' && DAY_RE.test(x)) return x;
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return '';
  const p = parts(d, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${p.year}-${p.month}-${p.day}`;
}

function isoDateTime(x, { seconds = false } = {}) {
  const d = new Date(x);
  if (Number.isNaN(d.getTime())) return '';
  const p = parts(d, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}) });
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}${seconds ? `:${p.second}` : ''}`;
}

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
function todayLabel(now = Date.now()) {
  const day = isoDay(now);
  return `${WEEKDAYS[new Date(`${day}T12:00:00Z`).getUTCDay()]} ${day}`;
}

module.exports = { isoDay, isoDateTime, todayLabel, TZ };
