'use strict';

/**
 * Lecture d'un relevé bancaire PDF sur le serveur de BVY (workflow 07, partie B — conciliation assistée).
 * Le relevé ne quitte pas le serveur. Les lignes sont reconstruites à partir de la position du texte dans le PDF :
 * date, description, montant (colonne retraits/débits ou dépôts/crédits), solde quand il est imprimé.
 * La lecture est vérifiée par le calcul (solde d'ouverture + dépôts − retraits = solde de fermeture, soldes
 * intermédiaires, totaux du sommaire) ; une lecture qui ne balance pas est signalée, jamais présentée comme sûre.
 * Formats reconnus : relevés de type Desjardins (colonnes Frais / Retrait / Dépôt / Solde, plusieurs comptes)
 * et RBC (Cheques & Debits / Deposits & Credits / Balance, sommaire de la période).
 */

const MONTHS = {
  jan: 1, janv: 1, january: 1, janvier: 1, fev: 2, fevr: 2, feb: 2, february: 2, fevrier: 2, mar: 3, mars: 3, march: 3,
  avr: 4, apr: 4, april: 4, avril: 4, mai: 5, may: 5, jun: 6, juin: 6, june: 6, jul: 7, juil: 7, july: 7, juillet: 7,
  aou: 8, aout: 8, aug: 8, august: 8, sep: 9, sept: 9, september: 9, septembre: 9, oct: 10, october: 10, octobre: 10,
  nov: 11, november: 11, novembre: 11, dec: 12, december: 12, decembre: 12,
};
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const AMOUNT_RE = /^\$?-?\(?\d{1,3}(?:[ ,  ]\d{3})*(?:[.,]\d{2})\)?-?$/;

// « 1 100.85 », « 1,100.85 », « 377.35- », « (12.00) », « $631.38 » → cents signés
function parseAmount(str) {
  let s = String(str).trim().replace(/^\$/, '');
  let neg = false;
  if (/-$/.test(s)) { neg = true; s = s.slice(0, -1); }
  if (/^-/.test(s)) { neg = true; s = s.slice(1); }
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  const m = s.match(/^(\d{1,3}(?:[ ,  ]\d{3})*)[.,](\d{2})$/);
  if (!m) return null;
  const cents = Number(m[1].replace(/[ ,  ]/g, '')) * 100 + Number(m[2]);
  return neg ? -cents : cents;
}

// Période imprimée : « du 1er septembre au 30 septembre 2025 », « December 8, 2023 to January 8, 2024 »
function findPeriod(text) {
  const t = norm(text);
  let m = t.match(/du (\d{1,2})(?:er)? ([a-z]+)(?: (\d{4}))? au (\d{1,2})(?:er)? ([a-z]+) (\d{4})/);
  if (m && MONTHS[m[2]] && MONTHS[m[5]]) {
    const y2 = Number(m[6]); const m1 = MONTHS[m[2]]; const m2 = MONTHS[m[5]];
    const y1 = m[3] ? Number(m[3]) : (m1 > m2 ? y2 - 1 : y2);
    return { start: ymd(y1, m1, Number(m[1])), end: ymd(y2, m2, Number(m[4])) };
  }
  m = t.match(/([a-z]+) (\d{1,2}), (\d{4}) to ([a-z]+) (\d{1,2}), (\d{4})/);
  if (m && MONTHS[m[1]] && MONTHS[m[4]]) return { start: ymd(Number(m[3]), MONTHS[m[1]], Number(m[2])), end: ymd(Number(m[6]), MONTHS[m[4]], Number(m[5])) };
  return null;
}
const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// « 1 SEP », « 11 Dec » → date complète selon la période (relevé à cheval sur deux années)
function dayMonth(str, period) {
  const m = norm(str).match(/^(\d{1,2}) ([a-z]{3,9})\.?$/);
  if (!m || !MONTHS[m[2]] || !period) return null;
  const mo = MONTHS[m[2]];
  const ys = Number(period.start.slice(0, 4)); const ye = Number(period.end.slice(0, 4));
  const y = ys !== ye && mo >= Number(period.start.slice(5, 7)) ? ys : ye;
  return ymd(y, mo, Number(m[1]));
}

/* ------------------------------------------------- texte positionné du PDF */
async function pdfRows(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const rows = [];
    for (const it of tc.items) {
      const str = it.str.replace(/\s+/g, ' ').trim();
      if (!str) continue;
      const x = it.transform[4]; const y = it.transform[5];
      let row = rows.find((r) => Math.abs(r.y - y) <= 2.5);
      if (!row) { row = { y, items: [] }; rows.push(row); }
      row.items.push({ x, r: x + it.width, str });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x);
      // Montant découpé en morceaux par le PDF (« 25 » + « 785.34 ») : on recolle les morceaux voisins
      const merged = [];
      for (const it of r.items) {
        const prev = merged[merged.length - 1];
        if (prev && it.x - prev.r < 8 && /^\$?\d{1,3}([ ,]\d{3})*$/.test(prev.str) && /^\d{3}([ ,]\d{3})*([.,]\d{2})?-?$/.test(it.str)) {
          prev.str = `${prev.str} ${it.str}`; prev.r = it.r;
        } else merged.push({ ...it });
      }
      r.items = merged;
      r.text = r.items.map((i) => i.str).join(' ');
    }
    pages.push(rows);
  }
  await doc.destroy();
  return pages;
}

/* ------------------------------------------------------- analyse */
const HEAD = {
  debit: /^(retraits?|cheques & debits|cheques et debits|debits?|withdrawals?)( \(\$\))?$/,
  credit: /^(depots?|deposits & credits|deposits?|credits?|depots et credits)( \(\$\))?$/,
  balance: /^(solde|balance)( \(\$\))?$/,
  fees: /^frais$/,
  date: /^date$/,
};

function headerOf(row) {
  const cols = {};
  for (const it of row.items) {
    const n = norm(it.str);
    for (const [k, re] of Object.entries(HEAD)) if (re.test(n) && cols[k] === undefined) cols[k] = it;
  }
  return cols.debit && cols.credit && cols.balance ? cols : null;
}

// Un montant est rattaché à la colonne dont le bord droit de l'en-tête est le plus proche de son bord droit.
function columnOf(item, head) {
  const cands = [['debit', head.debit], ['credit', head.credit], ['balance', head.balance], ...(head.fees ? [['fees', head.fees]] : [])];
  let best = null; let dist = Infinity;
  for (const [k, h] of cands) { const d = Math.abs(item.r - h.r); if (d < dist) { dist = d; best = k; } }
  return best;
}

async function parseStatement(buffer) {
  const pages = await pdfRows(buffer);
  const all = pages.flat();
  const fullText = all.map((r) => r.text).join('\n');
  const period = findPeriod(fullText);
  const bank = /desjardins/i.test(fullText) ? 'Desjardins' : /royal bank|rbc/i.test(fullText) ? 'RBC' : /banque nationale|national bank/i.test(fullText) ? 'Banque Nationale' : null;
  // Sommaire (type RBC) : solde d'ouverture, totaux, solde de fermeture
  const summary = {};
  for (const r of all) {
    const n = norm(r.text);
    const amt = [...r.items].reverse().map((i) => parseAmount(i.str.replace(/^[=+-]\s*/, ''))).find((v) => v !== null);
    if (amt === undefined || amt === null) continue;
    if (/^opening balance on/.test(n)) summary.opening = amt;
    else if (/^closing balance on/.test(n)) summary.closing = amt;
    else if (/^total deposits & credits \((\d+)\)/.test(n)) { summary.credits = amt; summary.creditCount = Number(n.match(/\((\d+)\)/)[1]); }
    else if (/^total cheques & debits \((\d+)\)/.test(n)) { summary.debits = Math.abs(amt); summary.debitCount = Number(n.match(/\((\d+)\)/)[1]); }
  }

  const accounts = [];
  let acct = null; let head = null; let pending = null; let lastDate = null;
  const SKIP = /^(page \d+ de \d+|\d+ of \d+|account activity details|releve de compte|business account statement)/;
  const flushNoAmount = () => { pending = null; };
  for (const page of pages) {
    head = null;
    for (const row of page) {
      const h = headerOf(row);
      if (h) { head = h; continue; }
      const n = norm(row.text);
      // Section de compte (type Desjardins) : code à gauche (« EOP », « CS ») suivi du nom du compte
      const sec = row.items[0] && row.items[0].x < 52 && /^[A-Z]{2,4}( \d+)?$/.test(row.items[0].str) && row.items.length >= 2 ? row : null;
      if (sec && !/^\d/.test(row.items[1].str)) {
        const code = row.items[0].str; const label = row.items.slice(1).map((i) => i.str).join(' ').replace(/ \(SUITE\)$/i, '');
        acct = accounts.find((a) => a.code === code) || null;
        if (!acct) { acct = { code, label, opening: null, closing: null, lines: [] }; accounts.push(acct); }
        head = null; pending = null;
        continue;
      }
      if (!head) continue;
      if (/^(pret|sommaire des frais|compte d.epargne et de placement)$/.test(n)) { head = null; continue; }
      if (SKIP.test(n)) continue;
      if (!acct) { acct = { code: 'COMPTE', label: 'Compte', opening: null, closing: null, lines: [] }; accounts.push(acct); }
      const amounts = []; const words = [];
      let date = null;
      for (const it of row.items) {
        const s = it.str;
        // « 10 SEP IRGA » : date et code collés dans un même élément
        const dm = s.match(/^(\d{1,2} [A-Za-zéû]{3,9}\.?)(?: (.*))?$/);
        if (it.x < (head.date ? head.date.r + 30 : 80) && dm && dayMonth(dm[1], period)) {
          date = dayMonth(dm[1], period); if (dm[2]) words.push(dm[2]); continue;
        }
        if (AMOUNT_RE.test(s) && it.x > (head.debit.x - 80)) { amounts.push({ ...it, value: parseAmount(s), col: columnOf(it, head) }); continue; }
        words.push(s);
      }
      const text = words.join(' ').replace(/\s+/g, ' ').trim();
      if (/^(solde reporte|opening balance)$/.test(norm(text)) && amounts.length) { acct.opening = amounts[amounts.length - 1].value; continue; }
      if (/^(closing balance|solde de fermeture)/.test(norm(text))) continue;
      if (date) { lastDate = date; if (pending && !amounts.length) pending = null; }
      if (!amounts.length) {
        if (!text) continue;
        pending = pending ? { ...pending, desc: `${pending.desc} ${text}`.trim(), date: date || pending.date } : { desc: text, date: date || lastDate };
        continue;
      }
      const bal = amounts.find((a) => a.col === 'balance');
      const moves = amounts.filter((a) => a.col !== 'balance');
      const desc = `${pending ? pending.desc : ''} ${text}`.replace(/\s+/g, ' ').trim();
      const d = date || (pending && pending.date) || lastDate;
      pending = null;
      if (!moves.length) { if (bal && acct.lines.length) acct.lines[acct.lines.length - 1].balance = bal.value; continue; }
      for (const mv of moves) {
        const signed = mv.col === 'credit' ? mv.value : -mv.value; // frais et retraits : sorties ; « 0.01- » en frais = remboursement
        acct.lines.push({ date: d, desc, amount: signed, balance: null });
      }
      if (bal) acct.lines[acct.lines.length - 1].balance = bal.value;
    }
  }

  // Vérifications par le calcul
  for (const a of accounts) {
    if (a.opening === null && summary.opening !== undefined && accounts.length === 1) a.opening = summary.opening;
    let run = a.opening ?? 0; let chainOk = true; let checked = 0;
    for (const l of a.lines) {
      run += l.amount;
      if (l.balance !== null) { checked += 1; if (l.balance !== run) { chainOk = false; l.mismatch = l.balance - run; run = l.balance; } }
    }
    a.closing = a.lines.length ? (([...a.lines].reverse().find((l) => l.balance !== null) || {}).balance ?? run) : a.opening;
    if (accounts.length === 1 && summary.closing !== undefined) a.closing = summary.closing;
    const credits = a.lines.filter((l) => l.amount > 0); const debits = a.lines.filter((l) => l.amount < 0);
    a.totals = { credits: credits.reduce((s, l) => s + l.amount, 0), debits: -debits.reduce((s, l) => s + l.amount, 0), creditCount: credits.length, debitCount: debits.length };
    const sumOk = a.opening !== null && a.opening + a.totals.credits - a.totals.debits === a.closing;
    const summaryOk = accounts.length === 1 && summary.credits !== undefined
      ? summary.credits === a.totals.credits && summary.debits === a.totals.debits && summary.creditCount === a.totals.creditCount && summary.debitCount === a.totals.debitCount : null;
    a.check = { ok: Boolean(sumOk && chainOk && summaryOk !== false), sumOk, chainOk, balancesChecked: checked, summaryOk };
  }
  return { bank, period, accounts: accounts.filter((a) => a.lines.length || a.opening !== null) };
}

module.exports = { parseStatement, parseAmount, findPeriod, dayMonth };
