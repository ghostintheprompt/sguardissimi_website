'use strict';
// Builds /lido/, the swimwear section front page. Each LIDO story is a normal article in
// articles/*.md with `lido` in its categories, so it gets the standard article template and
// a permanent /articles/<slug>/ URL; this page just lists them. See lido/README.md.
const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');

const SITE = 'https://sguardissimi.com';
const SRC = path.join(__dirname, '../lido');
const OUT = path.join(__dirname, '../dist/lido');

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const httpUrl = value => {
  if (typeof value !== 'string' || !value.trim()) return null;
  try { const u = new URL(value, SITE); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; }
};

function shell({ title, description, canonical, ogImage, ogType, body }) {
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="${ogType}"><meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/lido/lido.css">
</head>
<body>
<a class="skip" href="#contenuto">Vai al contenuto</a>
<div class="page">
<header><a class="parent" href="/">Sguardissimi ↖</a><span>Il supplemento swimwear</span><a href="/#archivio">L’archivio</a></header>
<main id="contenuto">
${body}
<aside class="invitation"><p>Un posto al sole.<br><em>Altri sguardi.</em></p><div><p>LIDO è il supplemento swimwear di Sguardissimi. Fotografie e film, con la firma di chi li crea.</p><a href="/">Rientra in Sguardissimi ↗</a></div></aside>
</main>
<footer><span>LIDO · Sguardissimi © Michael d Subrizi</span><a href="https://agencyforza.com">Studio → Agency Forza</a></footer>
</div>
</body></html>
`;
}

const cover = `<section class="cover" aria-labelledby="lido-title">
<div class="eyebrow"><span>Sguardissimi presenta</span><span>Fotografie · Film · Incontri</span></div>
<div class="masthead"><h1 id="lido-title"><a href="/lido/">LIDO</a></h1><span class="ticket">N° 001<span>ESTATE</span><small>un’estate Sguardissimi</small></span></div>
<div class="cover-line"><p>Costumi, corpi, sole.</p><span class="scribble">Il sole è di tutti.</span></div>
</section>`;

function indexPage(stories) {
  const cards = stories.length
    ? `<ul class="stories">${stories.map(s => `<li><a class="card" href="/articles/${esc(s.slug)}/"><img src="${esc(s.cover)}" alt="" loading="lazy"><span class="card-meta">${esc(s.date || '')}</span><strong>${esc(s.title)}</strong><span>${esc(s.excerpt || '')}</span></a></li>`).join('')}</ul>`
    : `<div class="media" id="story-media"><div class="placeholder"><div class="sun" aria-hidden="true"></div><p>Ci vediamo<br><em>al Lido.</em></p><span>Il primo film, presto qui.</span><div class="stripes" aria-hidden="true"></div></div></div>`;
  const body = `${cover}
<section class="story-list" aria-labelledby="storie"><div class="story-rail"><span id="storie">Le storie</span><span>${stories.length ? stories.length + ' / LIDO' : 'Prossimamente'}</span></div>${cards}</section>`;
  return shell({ title: 'LIDO — Sguardissimi', description: 'Costumi, corpi, sole. LIDO, il supplemento swimwear di Sguardissimi. Fotografie, film e nuovi incontri.', canonical: `${SITE}/lido/`, ogImage: stories.length ? new URL(stories[0].cover, SITE).href : `${SITE}/img/og-card.jpg`, ogType: 'website', body });
}

function buildLido(articles) {
  const stories = (articles || []).filter(a => Array.isArray(a.categories) && a.categories.includes('lido'))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  fse.removeSync(OUT);
  fse.ensureDirSync(OUT);
  fse.copySync(path.join(SRC, 'lido.css'), path.join(OUT, 'lido.css'));
  fs.writeFileSync(path.join(OUT, 'index.html'), indexPage(stories));
  console.log(`LIDO: built index with ${stories.length} stor${stories.length === 1 ? 'y' : 'ies'}`);
  return stories;
}

module.exports = { buildLido };
