// Gabarit des pages sectorielles : src/niches/<slug>.json → page /<slug>/
// Utilisé par build.js. Les textes JSON sont du texte brut : tout est échappé ici.
'use strict';

const SITE = 'https://bvyaccountingtax.ca';
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const h = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const icon = (id, cls = 'i') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const arrow = icon('arrow', 'i i-sm');
const img = (slug, suffix = '') => `/assets/img/secteurs/${slug}${suffix}.webp`;
const frDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d === 1 ? '1er' : d} ${MONTHS[m - 1]} ${y}`; };
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

const REQUIRED = ['slug', 'title', 'description', 'breadcrumb', 'card', 'image', 'image2', 'eyebrow', 'h1', 'quote', 'intro',
  'reality', 'stages', 'flow', 'expertise', 'services', 'changes', 'faq', 'cta'];

function validate(n, file) {
  for (const k of REQUIRED) if (n[k] == null) throw new Error(`${file}: champ « ${k} » manquant`);
  if (!/^[a-z0-9-]+$/.test(n.slug)) throw new Error(`${file}: slug invalide`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(n.changes.updated || '')) throw new Error(`${file}: changes.updated doit être AAAA-MM-JJ`);
}

// Carte de l'accueil et de /secteurs/
function card(n, eager = false) {
  return `<a class="sector-card" href="/${n.slug}/">
        <figure class="sector-media"><img src="${img(n.slug)}" alt="${h(n.image.alt)}" width="1080" height="810" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></figure>
        <div class="sector-body">
          <h3 class="h3">${h(n.card.title)}</h3>
          <p>${h(n.card.text)}</p>
          <span class="link-arrow">${h(n.card.button)} ${arrow}</span>
        </div>
      </a>`;
}

function render(n) {
  const path = `/${n.slug}/`;
  const url = SITE + path;
  const para = (list) => list.map((p) => `<p>${h(p)}</p>`).join('\n        ');

  const stages = n.stages.items.map((s, i) => `
        <li class="stage">
          <span class="stage-n">0${i + 1}</span>
          <h3>${h(s.name)}</h3>
          <p>${h(s.text)}</p>
          ${s.needs && s.needs.length ? `<ul class="needs">${s.needs.map((x) => `<li>${h(x)}</li>`).join('')}</ul>` : ''}
        </li>`).join('');

  const flow = n.flow.steps.map((s) => `
        <li><b>${h(s.label)}</b><span>${h(s.detail)}</span></li>`).join('');

  const services = n.services.items.map((s) => `
        <a class="card lift svc" href="${h(s.link)}"><h3 class="h3">${h(s.name)}</h3><p>${h(s.text)}</p><span class="link-arrow">En savoir plus ${arrow}</span></a>`).join('');

  const changes = n.changes.items.map((c) => `
        <article class="card change">
          <span class="kicker">${h(c.kind)}</span>
          <h3 class="h3">${h(c.title)}</h3>
          <p>${h(c.text)}</p>
          ${c.link ? `<a class="link-arrow" href="${h(c.link)}">Lire la ressource ${arrow}</a>` : ''}
          ${c.source ? `<a class="source" href="${h(c.source)}" target="_blank" rel="noopener">Source officielle ${icon('ext', 'i i-sm')}</a>` : ''}
        </article>`).join('');

  const faq = n.faq.map((f) => `
        <details><summary>${h(f.q)}</summary><p>${h(f.a)}</p></details>`).join('');

  const offer = n.offer ? `
<section class="section tight" id="offre">
  <div class="wrap">
    <div class="offer reveal">
      <div>
        <p class="eyebrow">Offre de départ</p>
        <h2 class="h2">${h(n.offer.name)}</h2>
        <p class="lead">${h(n.offer.text)}</p>
        <p class="offer-price">${h(n.offer.price)} <span>prix fixe · paiement unique</span></p>
        <a class="btn btn-gold" href="/rendez-vous/?service=${h(n.cta.service)}">${h(n.offer.button)} ${arrow}</a>
      </div>
      <div>
        <h3 class="h3">Ce qui est inclus</h3>
        <ul class="list">${n.offer.includes.map((x) => `<li>${h(x)}</li>`).join('')}</ul>
        ${n.offer.limits ? `<p class="note" style="margin-top:16px">${h(n.offer.limits)}</p>` : ''}
      </div>
    </div>
  </div>
</section>` : '';

  const ld = [
    { '@context': 'https://schema.org', '@type': 'Service', name: n.breadcrumb, serviceType: n.h1, description: n.description, url,
      areaServed: [{ '@type': 'AdministrativeArea', name: 'Québec' }, { '@type': 'Country', name: 'Canada' }],
      provider: { '@type': 'AccountingService', name: 'BVY Accounting & Tax Services Inc.', url: SITE + '/' } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Secteurs', item: SITE + '/secteurs/' },
      { '@type': 'ListItem', position: 3, name: n.breadcrumb, item: url }] },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: n.faq.map((f) => ({
      '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ].map(jsonLd).join('\n');

  const body = `${ld}
<section class="page-hero dark dark-glow dark-grid niche-hero">
  <div class="wrap split">
    <div>
      <nav class="crumbs" aria-label="Fil d’Ariane"><a href="/">Accueil</a> / <a href="/secteurs/">Secteurs</a> / ${h(n.breadcrumb)}</nav>
      <p class="eyebrow">${h(n.eyebrow)}</p>
      <h1 class="h1" style="font-size:clamp(34px,4.2vw,56px)">${h(n.h1)}</h1>
      <blockquote class="quote">${h(n.quote)}</blockquote>
      <div class="actions" style="margin-top:28px">
        <a class="btn btn-gold" href="/rendez-vous/?service=${h(n.cta.service)}">${h(n.cta.button)} ${arrow}</a>
        <a class="btn btn-light" href="#parcours">Voir le parcours</a>
      </div>
    </div>
    <figure class="niche-photo"><img src="${img(n.slug)}" alt="${h(n.image.alt)}" width="1080" height="810" fetchpriority="high" decoding="async"></figure>
  </div>
</section>

<section class="section">
  <div class="wrap split" style="align-items:start">
    <div class="reveal prose-lite">
      ${para(n.intro)}
      <h2 class="h2" style="margin-top:28px">${h(n.reality.h2)}</h2>
      ${para(n.reality.paragraphs)}
    </div>
    <figure class="niche-photo side reveal"><img src="${img(n.slug, '-2')}" alt="${h(n.image2.alt)}" width="1080" height="720" loading="lazy" decoding="async"></figure>
  </div>
</section>

<section class="section bg-cream" id="parcours">
  <div class="wrap">
    <div class="head reveal">
      <p class="eyebrow">Une entreprise en mouvement</p>
      <h2 class="h2">${h(n.stages.h2)}</h2>
      ${n.stages.intro ? `<p class="lead">${h(n.stages.intro)}</p>` : ''}
    </div>
    <ol class="stages reveal">${stages}
    </ol>
  </div>
</section>

<section class="section dark dark-glow">
  <div class="wrap">
    <div class="head reveal">
      <p class="eyebrow">La circulation de l’argent</p>
      <h2 class="h2">${h(n.flow.h2)}</h2>
      ${n.flow.intro ? `<p class="lead">${h(n.flow.intro)}</p>` : ''}
    </div>
    <ol class="moneyflow reveal">${flow}
    </ol>
    <p class="flow-result reveal">${icon('eye')}<span>${h(n.flow.result)}</span></p>
  </div>
</section>

<section class="section">
  <div class="wrap split" style="align-items:start">
    <div class="reveal">
      <p class="eyebrow">Notre expertise appliquée à votre réalité</p>
      <h2 class="h2">${h(n.expertise.h2)}</h2>
      ${n.expertise.intro ? `<p class="lead">${h(n.expertise.intro)}</p>` : ''}
    </div>
    <ul class="chips-lg reveal">${n.expertise.items.map((x) => `<li>${icon('check', 'i i-sm')}${h(x)}</li>`).join('')}</ul>
  </div>
</section>
${offer}
<section class="section bg-cream">
  <div class="wrap">
    <div class="head reveal">
      <p class="eyebrow">Services adaptés</p>
      <h2 class="h2">${h(n.services.h2)}</h2>
    </div>
    <div class="grid g3 reveal">${services}
    </div>
  </div>
</section>

<section class="section" id="ce-qui-change">
  <div class="wrap">
    <div class="head reveal">
      <p class="eyebrow">Veille sectorielle</p>
      <h2 class="h2">Ce qui change dans votre secteur</h2>
      <p class="updated">Dernière mise à jour : <time datetime="${h(n.changes.updated)}">${frDate(n.changes.updated)}</time></p>
    </div>
    <div class="grid g3 reveal">${changes}
    </div>
  </div>
</section>

<section class="section bg-cream">
  <div class="wrap">
    <div class="head center reveal">
      <p class="eyebrow">Questions fréquentes</p>
      <h2 class="h2">Vos questions, nos réponses</h2>
    </div>
    <div class="faq reveal">${faq}
    </div>
  </div>
</section>

<section class="section dark alt cta-band">
  <div class="wrap reveal">
    <p class="eyebrow">Consultation de 30 minutes</p>
    <h2 class="h2">${h(n.cta.title)}</h2>
    <p class="lead">${h(n.cta.text)}</p>
    <div class="actions">
      <a class="btn btn-gold" href="/rendez-vous/?service=${h(n.cta.service)}">${h(n.cta.button)} ${arrow}</a>
      <a class="btn btn-light" href="/services/">Tous nos services</a>
    </div>
    <p class="cta-links"><a href="/a-propos/">À propos de BVY</a> · <a href="/tarifs/">Offres et tarifs</a> · <a href="/contact/">Contact</a> · <a href="/secteurs/">Autres secteurs</a></p>
  </div>
</section>`;

  return {
    meta: { title: n.title, description: n.description, path, nav: 'secteurs', robots: n.robots || 'index,follow' },
    body,
  };
}

module.exports = { render, card, validate };
