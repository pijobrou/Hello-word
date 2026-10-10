'use strict';

/**
 * Vérification des coordonnées avant d'accepter une demande (formulaire et Jessica) — protection contre les
 * fraudeurs et les fautes de frappe. Aucun service externe : syntaxe, domaines jetables, faute de frappe connue,
 * et le domaine du courriel doit pouvoir recevoir du courrier (enregistrement MX dans le DNS public).
 * Limite honnête : on vérifie que l'adresse PEUT recevoir du courrier, pas qu'elle appartient à la personne.
 */

const dns = require('node:dns').promises;

// Domaines de courriel jetables (adresses temporaires utilisées par les robots et les fraudeurs)
const DISPOSABLE = new Set(`mailinator.com guerrillamail.com guerrillamail.net guerrillamail.org sharklasers.com grr.la
  10minutemail.com 10minutemail.net tempmail.com temp-mail.org temp-mail.io tempmail.net tempmailo.com tempr.email
  yopmail.com yopmail.fr yopmail.net trashmail.com trashmail.de trashmail.net getnada.com nada.email dispostable.com
  maildrop.cc mailnesia.com mintemail.com mohmal.com throwawaymail.com fakeinbox.com spamgourmet.com mailcatch.com
  emailondeck.com mytemp.email tmpmail.org tmpmail.net burnermail.io inboxkitten.com 33mail.com mail.tm moakt.com
  emailfake.com fakemail.net discard.email spambox.us mailpoof.com tempinbox.com jetable.org`.split(/\s+/).filter(Boolean));

// Fautes de frappe fréquentes → domaine probable
const TYPOS = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.cm': 'gmail.com',
  'gmal.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmaill.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmail.ca': 'gmail.com', 'gmail.fr': 'gmail.com',
  'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.co': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'hotmal.com': 'hotmail.com',
  'hotmial.ca': 'hotmail.ca', 'hotmai.ca': 'hotmail.ca', 'hotmal.ca': 'hotmail.ca',
  'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com', 'outlook.co': 'outlook.com', 'outlook.con': 'outlook.com',
  'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahoo.co': 'yahoo.com', 'yahoo.con': 'yahoo.com', 'yaho.ca': 'yahoo.ca',
  'icloud.co': 'icloud.com', 'iclod.com': 'icloud.com', 'videotron.com': 'videotron.ca', 'videotro.ca': 'videotron.ca',
  'sympatico.com': 'sympatico.ca', 'protonmail.co': 'protonmail.com', 'protonmal.com': 'protonmail.com', 'live.co': 'live.com',
};

const EMAIL_SYNTAX = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i;

// Le domaine reçoit-il du courrier ? MX, sinon une adresse (règle du courriel). Si le DNS du serveur est en panne
// (même gmail.com ne répond pas), on laisse passer plutôt que de bloquer de vrais clients.
function createDomainChecker({ resolveMx = (d) => dns.resolveMx(d), resolve4 = (d) => dns.resolve4(d), timeoutMs = 3000 } = {}) {
  const cache = new Map();
  const withTimeout = (p) => {
    let timer;
    const t = new Promise((_, rej) => { timer = setTimeout(() => rej(Object.assign(new Error('délai'), { code: 'ETIMEOUT' })), timeoutMs); });
    return Promise.race([p, t]).finally(() => clearTimeout(timer));
  };
  async function lookup(domain) {
    try {
      const mx = await withTimeout(resolveMx(domain));
      if (mx.some((m) => m.exchange && m.exchange !== '.')) return 'yes';
      if (mx.length) return 'no'; // « MX nul » : le domaine déclare ne recevoir aucun courrier
    } catch (err) {
      if (!['ENOTFOUND', 'ENODATA', 'NXDOMAIN'].includes(err.code)) return 'unknown';
    }
    try { const a = await withTimeout(resolve4(domain)); return a.length ? 'yes' : 'no'; } catch (err) {
      return ['ENOTFOUND', 'ENODATA', 'NXDOMAIN'].includes(err.code) ? 'no' : 'unknown';
    }
  }
  return async function receivesMail(domain) {
    const hit = cache.get(domain);
    if (hit && hit.until > Date.now()) return hit.value;
    let value = await lookup(domain);
    if (value === 'no' && domain !== 'gmail.com' && (await receivesMail('gmail.com')) !== 'yes') value = 'unknown';
    cache.set(domain, { value, until: Date.now() + (value === 'unknown' ? 60_000 : 6 * 3600_000) });
    if (cache.size > 5000) cache.delete(cache.keys().next().value);
    return value;
  };
}

// → { ok, email, error?, suggestion?, check: 'verified' | 'unverified' }
async function checkEmail(raw, receivesMail) {
  const email = String(raw || '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'Indiquez votre courriel.' };
  if (email.length > 160 || !EMAIL_SYNTAX.test(email)) return { ok: false, error: 'Cette adresse courriel n’est pas valide. Exemple : vous@entreprise.ca' };
  const domain = email.split('@')[1];
  if (TYPOS[domain]) {
    const suggestion = `${email.split('@')[0]}@${TYPOS[domain]}`;
    return { ok: false, suggestion, error: `Vérifiez votre courriel : vouliez-vous écrire ${suggestion} ?` };
  }
  if (DISPOSABLE.has(domain) || [...DISPOSABLE].some((d) => domain.endsWith(`.${d}`))) {
    return { ok: false, error: 'Les adresses courriel temporaires ne sont pas acceptées. Indiquez votre courriel habituel.' };
  }
  const r = receivesMail ? await receivesMail(domain) : 'unknown';
  if (r === 'no') return { ok: false, error: `Le domaine « ${domain} » ne reçoit pas de courriel. Vérifiez l’orthographe de votre adresse.` };
  return { ok: true, email, check: r === 'yes' ? 'verified' : 'unverified' };
}

// Indicatifs régionaux du Canada (plan de numérotation nord-américain)
const CANADA = new Set(`204 226 236 249 250 257 263 289 306 343 354 365 367 368 382 403 416 418 428 431 437 438 450 468 474 506
  514 519 548 579 581 584 587 600 604 613 622 639 647 672 683 705 709 742 753 778 780 782 807 819 825 867 873 879 902 905 942`.split(/\s+/).filter(Boolean));

// → { ok, error?, e164?, display?, region? } — numéros nord-américains vérifiés ; numéros internationaux avec « + »
function checkPhone(raw, { required = true } = {}) {
  const text = String(raw || '').trim();
  if (!text) return required ? { ok: false, error: 'Indiquez votre numéro de téléphone.' } : { ok: true, e164: '', display: '' };
  if (text.length > 40 || /[^\d\s().+\-–/]|(?:ext|poste)/i.test(text.replace(/\s*(?:poste|ext\.?|x)\s*\d{1,6}$/i, ''))) {
    return { ok: false, error: 'Ce numéro de téléphone contient des caractères invalides.' };
  }
  const main = text.replace(/\s*(?:poste|ext\.?|x)\s*(\d{1,6})$/i, '');
  const ext = (text.match(/(?:poste|ext\.?|x)\s*(\d{1,6})$/i) || [])[1];
  let d = main.replace(/\D/g, '');
  const intl = main.startsWith('+') && !main.startsWith('+1');
  if (intl) {
    if (d.length < 8 || d.length > 15) return { ok: false, error: 'Numéro international invalide (8 à 15 chiffres après le +).' };
    return { ok: true, e164: `+${d}`, display: `+${d}${ext ? ` poste ${ext}` : ''}`, region: 'international' };
  }
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  if (d.length !== 10) return { ok: false, error: 'Le numéro doit avoir 10 chiffres, indicatif régional compris. Exemple : 418 555-1234' };
  const area = d.slice(0, 3); const exch = d.slice(3, 6); const line = d.slice(6);
  const invalid = /[01]/.test(area[0]) || /[01]/.test(exch[0]) || area[1] === '1' && area[2] === '1' || exch[1] === '1' && exch[2] === '1'
    || /^(\d)\1{9}$/.test(d) || d === '1234567890' || (exch === '555' && /^01\d\d$/.test(line)) || area === '555' || area === '900' || area === '976';
  if (invalid) return { ok: false, error: 'Ce numéro de téléphone n’existe pas. Vérifiez l’indicatif régional et le numéro.' };
  return { ok: true, e164: `+1${d}`, display: `(${area}) ${exch}-${line}${ext ? ` poste ${ext}` : ''}`, region: CANADA.has(area) ? 'Canada' : 'États-Unis' };
}

// Choix offerts par le formulaire : une autre valeur veut dire que le formulaire n'a pas été rempli à l'écran (robot)
const SERVICES = ['', 'diagnostic', 'mise-au-clair-shopify', 'tenue-de-livres', 'paie', 'tps-tvq', 'impot-societes', 'travailleurs-autonomes',
  'etats-financiers', 'incorporation', 'domiciliation', 'plateforme', 'autre'];
const REGIONS = ['', 'Québec, Canada', 'Ontario, Canada', 'Autre province canadienne', 'France', 'Belgique', 'Suisse', 'Maroc', 'Sénégal', 'Côte d’Ivoire', 'Autre pays'];

// Modèle de pourriel connu : « Bonjour, je voulais connaître votre prix » envoyé en toutes les langues par des robots
const PRICE_TEMPLATE = [
  /muốn biết giá/i, /wanted to know your price/i, /quería saber su precio/i, /queria saber o seu preço/i, /wollte (ihren|deinen) preis/i,
  /volevo sapere il (tuo|vostro) prezzo/i, /je voulais connaître votre prix/i, /wilde je prijs weten/i, /chciałem poznać twoją cenę/i,
  /хотел узнать вашу цену/i, /fiyatınızı öğrenmek/i, /dashur të di çmimin/i, /halusin tietää hintasi/i, /ville vide din pris/i,
  /norėjau sužinoti jūsų kainą/i, /gribēju uzzināt jūsu cenu/i, /tahtsin teada teie hinda/i, /ήθελα να μάθω την τιμή/i, /исках да знам цената/i,
  /хотів дізнатися вашу ціну/i, /am vrut să știu prețul/i, /želio sam znati vašu cijenu/i, /jag ville veta ditt pris/i, /ég vildi vita verðið/i,
  /أردت أن أعرف سعرك/, /רציתי לדעת את המחיר/, /価格を知りたかった/, /想知道你的价格/, /가격을 알고 싶었/, /आपकी कीमत जानना/,
  /ingin tahu harga/i, /gusto kong malaman ang presyo/i, /azt akartam kérdezni, hogy mennyi/i, /chtěl jsem znát vaši cenu/i,
];
// Lettres propres au vietnamien (le site s'adresse au Québec et à la francophonie)
const VIET = /[ạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹđươă]/gi;
const BIG_BRANDS = /^(google|facebook|meta|amazon|apple|microsoft|youtube|instagram|tiktok|test|company|business|n\/?a)$/i;

// Signes de robot ou de pourriel → raison (la demande est alors ignorée en silence), sinon null
function spamReason(data, { elapsedMs } = {}) {
  if (Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs < 3000) return 'rempli en moins de 3 secondes';
  const str = (k) => (typeof data[k] === 'string' ? data[k].trim() : '');
  if (data.service !== undefined && !SERVICES.includes(str('service'))) return 'service hors de la liste du formulaire';
  if (data.region !== undefined && !REGIONS.includes(str('region'))) return 'région hors de la liste du formulaire';
  if (PRICE_TEMPLATE.some((re) => re.test(str('message')))) return 'modèle de pourriel « votre prix »';
  // Noms générés par les logiciels de pourriel : « JasonCheltGM RobertChelt » (2 majuscules collées, même fin de nom)
  const pn = str('prenom'); const nm = str('nom');
  if (/[a-z][A-Z]{2,}$/.test(pn) || /[a-z][A-Z]{2,}$/.test(nm)) return 'nom généré (majuscules collées)';
  const tail = (w) => (w.match(/[A-Z][a-z]{3,}$/) || [''])[0];
  if (tail(pn) && tail(pn) === tail(nm) && pn !== nm && /[a-z][A-Z]/.test(pn + nm)) return 'nom généré (même fin de nom)';
  const viet = (str('message').match(VIET) || []).length;
  if (viet >= 3) return 'message en vietnamien (pourriel)';
  // Signes faibles : deux ensemble suffisent
  const weak = [];
  const local = str('courriel').split('@')[0] || '';
  if (/[a-z]{3,}\d[a-z0-9]*\d[a-z0-9]*$/i.test(local) && /\d.*[a-z].*\d|[a-z]\d[a-z]/i.test(local.replace(/^[a-z]+/i, ''))) weak.push('courriel à suite aléatoire');
  if (local && pn && nm && !local.toLowerCase().includes(pn.toLowerCase().slice(0, 4)) && !local.toLowerCase().includes(nm.toLowerCase().slice(0, 4))) weak.push('courriel sans rapport avec le nom');
  if (BIG_BRANDS.test(str('entreprise'))) weak.push('entreprise fictive');
  // « RobertChelt » ; pas « McDonald », « MacKay », « LeBlanc »
  if (/[A-Z][a-z]{3,}[A-Z][a-z]{2,}/.test(pn) || /[A-Z][a-z]{3,}[A-Z][a-z]{2,}/.test(nm)) weak.push('nom collé');
  if (weak.length >= 2) return `plusieurs signes : ${weak.join(', ')}`;
  const urls = (s) => (String(s || '').match(/https?:\/\/|www\.|\[url|<a\s/gi) || []).length;
  if (['prenom', 'nom', 'entreprise', 'region'].some((k) => urls(data[k]))) return 'lien dans un nom';
  if (urls(data.message) > 2) return 'trop de liens dans le message';
  const all = `${data.prenom || ''} ${data.nom || ''} ${data.message || ''}`;
  const foreign = (all.match(/[Ѐ-ӿ一-鿿぀-ヿ฀-๿]/g) || []).length;
  if (foreign > 10 && foreign > all.replace(/\s/g, '').length / 3) return 'écriture étrangère au site (pourriel)';
  if (data.prenom && data.nom && data.prenom.length > 2 && data.prenom.toLowerCase() === data.nom.toLowerCase() && /\d/.test(data.prenom)) return 'nom généré';
  if (/\b(casino|viagra|crypto ?invest|seo services|backlinks?|bitcoin doubler|loan offer)\b/i.test(all)) return 'mots de pourriel';
  return null;
}

module.exports = { checkEmail, checkPhone, spamReason, createDomainChecker, DISPOSABLE, TYPOS, CANADA, SERVICES, REGIONS };
