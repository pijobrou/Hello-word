'use strict';

/**
 * Petit générateur de PDF pour les tests : texte positionné (police Courier, largeur fixe), plusieurs pages.
 * Sert à fabriquer des relevés bancaires FICTIFS au format Desjardins ou RBC — jamais de vrais relevés dans le dépôt.
 */

const CW = 0.6; // largeur d'un caractère Courier, en fraction de la taille

// items : [{ x, y, text, right?: true, size?: 8 }] ; right : x est le bord droit (montants alignés à droite)
function makePdf(pages) {
  const objs = [];
  const add = (body) => { objs.push(body); return objs.length; };
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');
  const pagesId = add(null);
  const kids = [];
  for (const items of pages) {
    const ops = items.map((it) => {
      const size = it.size || 8;
      const x = it.right ? it.x - it.text.length * size * CW : it.x;
      const esc = Buffer.from(it.text, 'latin1').toString('latin1').replace(/[\\()]/g, (c) => `\\${c}`);
      return `BT /F1 ${size} Tf ${x.toFixed(2)} ${it.y} Td (${esc}) Tj ET`;
    }).join('\n');
    const content = add(`<< /Length ${Buffer.byteLength(ops, 'latin1')} >>\nstream\n${ops}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let out = '%PDF-1.4\n'; const offsets = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

const fmtFr = (c) => { const neg = c < 0; const s = (Math.abs(c) / 100).toFixed(2).split('.'); return `${s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${s[1]}${neg ? '-' : ''}`; };
const fmtEn = (c) => { const s = (Math.abs(c) / 100).toFixed(2).split('.'); return `${s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${s[1]}`; };

// Relevé fictif de type Desjardins : lines = [{ day: '1 SEP', code, desc, more?, amount (cents, + dépôt) }]
function desjardinsPdf({ opening, lines, closingOverride = null }) {
  const COL = { frais: 360, retrait: 430, depot: 500, solde: 575 };
  const head = [
    { x: 107, y: 772, text: 'CAISSE DESJARDINS DE TEST' }, { x: 413, y: 749, text: 'du 1er septembre au 30 septembre 2025' },
    { x: 259, y: 694, text: 'RELEVÉ DE COMPTE' }, { x: 65, y: 650, text: 'ENTREPRISE FICTIVE INC.' },
    { x: 46, y: 569, text: 'EOP' }, { x: 120, y: 569, text: 'EPARGNE AVEC OPERATIONS (C)' },
    { x: 56, y: 553, text: 'Date' }, { x: 84, y: 553, text: 'Code' }, { x: 196, y: 553, text: 'Description' },
    { x: COL.frais, y: 553, text: 'Frais', right: true }, { x: COL.retrait, y: 553, text: 'Retrait', right: true },
    { x: COL.depot, y: 553, text: 'Dépôt', right: true }, { x: COL.solde, y: 553, text: 'Solde', right: true },
    { x: 108, y: 538, text: 'Solde reporté' }, { x: COL.solde, y: 538, text: fmtFr(opening), right: true },
  ];
  let y = 526; let bal = opening;
  for (const l of lines) {
    bal += l.amount;
    head.push({ x: 59, y, text: l.day }, { x: 84, y, text: l.code });
    if (l.more) { head.push({ x: 108, y, text: l.desc }); y -= 12; head.push({ x: 108, y, text: l.more }); } else head.push({ x: 108, y, text: l.desc });
    head.push({ x: l.amount > 0 ? COL.depot : COL.retrait, y, text: fmtFr(Math.abs(l.amount)), right: true });
    head.push({ x: COL.solde, y, text: fmtFr(l === lines[lines.length - 1] && closingOverride !== null ? closingOverride : bal), right: true });
    y -= 12;
  }
  head.push({ x: 513, y: 727, text: 'Page 1 de 1' });
  return makePdf([head]);
}

// Relevé fictif de type RBC : days = [{ day: '11 Dec', lines: [{ desc, more?, amount }] }] ; solde imprimé en fin de journée
function rbcPdf({ opening, days }) {
  const all = days.flatMap((d) => d.lines);
  const credits = all.filter((l) => l.amount > 0); const debits = all.filter((l) => l.amount < 0);
  const cr = credits.reduce((s, l) => s + l.amount, 0); const db = -debits.reduce((s, l) => s + l.amount, 0);
  const closing = opening + cr - db;
  const COL = { debit: 362, credit: 467, balance: 567 };
  const items = [
    { x: 117, y: 731, text: 'ROYAL BANK OF CANADA' }, { x: 355, y: 722, text: 'Business Account Statement' },
    { x: 398, y: 664, text: 'December 8, 2023 to January 8, 2024' }, { x: 72, y: 647, text: 'FICTIVE CANADA INC.' },
    { x: 45, y: 449, text: 'Opening balance on December 8, 2023' }, { x: 380, y: 449, text: `$${fmtEn(opening)}`, right: true },
    { x: 45, y: 431, text: `Total deposits & credits (${credits.length})` }, { x: 380, y: 431, text: `+ ${fmtEn(cr)}`, right: true },
    { x: 45, y: 413, text: `Total cheques & debits (${debits.length})` }, { x: 380, y: 413, text: `- ${fmtEn(db)}`, right: true },
    { x: 45, y: 396, text: 'Closing balance on January 8, 2024' }, { x: 380, y: 396, text: `= $${fmtEn(closing)}`, right: true },
    { x: 45, y: 322, text: 'Date' }, { x: 90, y: 322, text: 'Description' },
    { x: COL.debit, y: 322, text: 'Cheques & Debits ($)', right: true }, { x: COL.credit, y: 322, text: 'Deposits & Credits ($)', right: true },
    { x: COL.balance, y: 322, text: 'Balance ($)', right: true },
    { x: 90, y: 308, text: 'Opening balance' }, { x: COL.balance, y: 308, text: fmtEn(opening), right: true },
  ];
  let y = 293; let bal = opening;
  for (const d of days) {
    d.lines.forEach((l, i) => {
      bal += l.amount;
      if (i === 0) items.push({ x: 45, y, text: d.day });
      if (l.more) { items.push({ x: 90, y, text: l.desc }); y -= 12; items.push({ x: 94, y, text: l.more }); } else items.push({ x: 90, y, text: l.desc });
      items.push({ x: l.amount < 0 ? COL.debit : COL.credit, y, text: fmtEn(Math.abs(l.amount)), right: true });
      if (i === d.lines.length - 1) items.push({ x: COL.balance, y, text: fmtEn(bal), right: true });
      y -= 14;
    });
  }
  items.push({ x: 571, y: 80, text: '1 of 1' });
  return makePdf([items]);
}

module.exports = { makePdf, desjardinsPdf, rbcPdf };
