'use strict';

/**
 * Types de documents (workflow 09) et identification déterministe : réponse du client, nom du fichier, contexte.
 * Aucune lecture du contenu (pas d'OCR à cette étape) : une suggestion n'est jamais présentée comme certaine.
 */

const DOC_TYPES = {
  facture_achat: 'Facture d’achat ou de fournisseur',
  facture_vente: 'Facture de vente',
  releve_banque: 'Relevé bancaire',
  releve_carte: 'Relevé de carte de crédit',
  recu: 'Reçu de dépense',
  impots: 'Document d’impôt',
  paie: 'Paie',
  taxes: 'TPS/TVQ',
  gouvernement: 'Lettre du gouvernement',
  contrat: 'Contrat, bail ou entente',
  autre: 'Autre',
};
// Libellés plus parlants pour le client (« De quoi s'agit-il ? »)
const CLIENT_LABELS = {
  ...DOC_TYPES,
  impots: 'Document d’impôt (feuillet T4, relevé 1, avis de cotisation…)',
  paie: 'Paie (feuille de temps, talon de paie…)',
  gouvernement: 'Lettre de l’ARC, de Revenu Québec ou de la CNESST',
};

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_.\-]+/g, ' ');

// Ordre important : le plus précis d'abord (un « relevé 1 » est un feuillet d'impôt, pas un relevé bancaire).
const RULES = [
  ['impots', /\b(t4a?|t4rsp|t4rif|t5|t5008|t2202|t1|tp ?1|rl ?\d{1,2}|releve ?(1|2|3|8|24|31)|avis de cotisation|cotisation|reer|rrsp|celi|impots?|declaration de revenus)\b/],
  ['paie', /\b(paie|payroll|feuilles? de temps|timesheet|heures|talons?( de paie)?|pay ?stub|paystub)\b/],
  ['taxes', /\b(tps|tvq|gst|qst|hst|taxes? de vente)\b/],
  ['gouvernement', /\b(arc|cra|revenu quebec|cnesst|avis|lettre|agence du revenu)\b/],
  ['releve_carte', /\b(visa|mastercard|master card|amex|american express|carte de credit|credit card)\b/],
  ['releve_banque', /\b(releve|releves|statement|desjardins|rbc|td|bmo|scotia|scotiabank|banque|bnc|tangerine|compte cheque|cheques?)\b/],
  ['contrat', /\b(contrat|bail|lease|entente|agreement|soumission signee)\b/],
  ['facture_vente', /\b(facture (client|vente)|vente|sales invoice)\b/],
  ['facture_achat', /\b(factures?|invoice|bill|fournisseur)\b/],
  ['recu', /\b(recus?|receipts?|ticket|costco|amazon|walmart|essence|restaurant)\b/],
];

function suggestType(name, note) {
  const text = norm(`${name || ''} ${note || ''}`);
  for (const [type, re] of RULES) if (re.test(text)) return type;
  return null;
}

const MONTHS = { janv: 1, jan: 1, fevr: 2, fev: 2, feb: 2, mars: 3, mar: 3, avr: 4, apr: 4, mai: 5, may: 5, juin: 6, jun: 6, juil: 7, jul: 7, aout: 8, aug: 8, sept: 9, sep: 9, oct: 10, nov: 11, dec: 12 };

// Période tirée du nom : 2026-02, 202602, « fevrier 2026 », sinon l'année seule.
// Une année plausible seulement (2000 à l'an prochain) : « IMG_2034 » est un numéro de photo, pas une année.
function periodFrom(name, now = Date.now()) {
  const max = new Date(now).getUTCFullYear() + 1;
  const ok = (y) => Number(y) <= max;
  const t = norm(name).replace(/\b(img|dsc|scan|photo|pxl|image)\s?\d+/g, ' ');
  let m = t.match(/\b(20\d{2}) ?(0[1-9]|1[0-2])\b/) || t.match(/\b(20\d{2})(0[1-9]|1[0-2])\d{0,2}\b/);
  if (m && ok(m[1])) return `${m[1]}-${m[2]}`;
  m = t.match(/\b([a-z]{3,9}) ?(20\d{2})\b/);
  if (m && ok(m[2])) {
    const key = Object.keys(MONTHS).find((k) => m[1].startsWith(k));
    if (key) return `${m[2]}-${String(MONTHS[key]).padStart(2, '0')}`;
  }
  m = t.match(/\b(20\d{2})\b/);
  return m && ok(m[1]) ? m[1] : null;
}

const validPeriod = (p) => /^20\d{2}(-(0[1-9]|1[0-2]))?$/.test(p);

module.exports = { DOC_TYPES, CLIENT_LABELS, suggestType, periodFrom, validPeriod };
