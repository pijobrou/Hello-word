'use strict';

/**
 * Case « Je ne suis pas un robot » du formulaire de consultation.
 * Fournisseur au choix (variables du serveur, jamais dans le dépôt) :
 *   CAPTCHA_PROVIDER=recaptcha  → Google reCAPTCHA v2 « case à cocher » (images à choisir si le visiteur semble suspect)
 *   CAPTCHA_PROVIDER=hcaptcha   → hCaptcha (images à choisir plus souvent)
 *   CAPTCHA_SITE_KEY=…  (clé publique, affichée dans la page)   CAPTCHA_SECRET=…  (clé secrète, serveur seulement)
 * Sans ces variables, le formulaire fonctionne comme avant (sans la case).
 */

const PROVIDERS = {
  recaptcha: { verifyUrl: 'https://www.google.com/recaptcha/api/siteverify', field: 'g-recaptcha-response' },
  hcaptcha: { verifyUrl: 'https://api.hcaptcha.com/siteverify', field: 'h-captcha-response' },
};

// Politique de sécurité du contenu des pages qui portent le formulaire : les deux fournisseurs y sont permis
const FORM_CSP = "default-src 'self'; img-src 'self' data:; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://hcaptcha.com https://*.hcaptcha.com; font-src https://fonts.gstatic.com; " +
  "script-src 'self' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://hcaptcha.com https://*.hcaptcha.com; " +
  "frame-src https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/ https://hcaptcha.com https://*.hcaptcha.com; " +
  "connect-src 'self' https://hcaptcha.com https://*.hcaptcha.com; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'";

function captchaConfigFromEnv(env = process.env) {
  const provider = String(env.CAPTCHA_PROVIDER || '').toLowerCase();
  if (!PROVIDERS[provider] || !env.CAPTCHA_SITE_KEY || !env.CAPTCHA_SECRET) return null;
  return { provider, siteKey: env.CAPTCHA_SITE_KEY, secret: env.CAPTCHA_SECRET, hostname: env.CAPTCHA_HOSTNAME || 'bvyaccountingtax.ca' };
}

// → { ok: true, checked: true } | { ok: true, checked: false } (service injoignable) | { ok: false }
async function verifyCaptcha(cfg, token, ip, { fetchImpl = fetch } = {}) {
  if (!cfg) return { ok: true, checked: false, off: true };
  if (typeof token !== 'string' || token.length < 20 || token.length > 4000) return { ok: false };
  const body = new URLSearchParams({ secret: cfg.secret, response: token, remoteip: ip || '' });
  if (cfg.provider === 'hcaptcha') body.set('sitekey', cfg.siteKey);
  let data;
  try {
    const r = await fetchImpl(PROVIDERS[cfg.provider].verifyUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(), signal: AbortSignal.timeout(5000) });
    data = await r.json();
  } catch (err) {
    // Service du fournisseur injoignable : on ne bloque pas les vrais clients ; les autres filtres restent actifs
    console.error('Vérification « Je ne suis pas un robot » impossible :', err.message);
    return { ok: true, checked: false };
  }
  if (!data || data.success !== true) return { ok: false };
  if (cfg.hostname && data.hostname && data.hostname !== cfg.hostname && data.hostname !== `www.${cfg.hostname}`) return { ok: false };
  return { ok: true, checked: true };
}

module.exports = { captchaConfigFromEnv, verifyCaptcha, FORM_CSP, PROVIDERS };
