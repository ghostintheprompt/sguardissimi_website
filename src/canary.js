/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Defensive canary honeypot (Cloudflare Worker module) for sguardissimi.com.
 *  A link that looks like an ordinary shared photo but records who fetches it
 *  and when, to detect an unauthorized observer of a private channel.
 *
 *  Deploy ONLY on infrastructure you own. It yields an IP + timestamp (a lead,
 *  not an identity); identifying a person runs through your ISP / law
 *  enforcement / bank fraud team. Not for tracking people via sites you don't
 *  control.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { CANARY_IMAGES } from './canary-image.js';

/*
 * Each token is one canary. Share  https://sguardissimi.com/media/<token>
 * - `/media/<token>`      -> a photo page with Open Graph tags, so the chat
 *                            preview shows a real image card with your caption.
 * - `/media/<token>.jpg`  -> the raw image (what the preview crawler pulls).
 * Both log. `image` picks which entry in CANARY_IMAGES to serve; switch the
 * picture with scripts/set-canary-image.mjs. `title`/`desc` set the preview text.
 */
const TOKENS = {
  'italia-1982':   { image: 'azzurri82', title: 'Italia 1982 🏆🇮🇹', desc: 'Campioni del Mondo' },
  'forza-azzurri': { image: 'default', title: 'Forza Azzurri 🇮🇹', desc: '' },
  'IMG_4021':      { image: 'default', title: 'Photo', desc: '' },
  // Extra per-recipient tokens: send a DIFFERENT one to each person privately, so
  // a hit tells you WHICH link was opened. The token names here are OPAQUE on
  // purpose — the map of "which token went to whom" lives ONLY in your offline
  // sheet, never in this file. If this code is ever read by an attacker it reveals
  // nothing about who is being watched.
  'IMG_4102': { image: 'default', title: 'Photo', desc: '' },
  'IMG_4103': { image: 'default', title: 'Photo', desc: '' },
  'IMG_4104': { image: 'default', title: 'Photo', desc: '' },
  'IMG_4105': { image: 'default', title: 'Photo', desc: '' },
};

// Pull a compact device signature out of an Android Dalvik UA:
// "...; <model> Build/<BUILDID>)" -> "<model> / <BUILDID>".
// The Build string encodes the build date (…YYMMDD…), so it fingerprints a
// specific handset+patch and flags whether it's the same phone on return.
function deviceSignature(ua) {
  const m = /;\s*([^;)]+?)\s+Build\/([A-Za-z0-9._-]+)/.exec(ua || '');
  return m ? `${m[1].trim()} / ${m[2]}` : '';
}

// Known link-preview crawlers / bots. iMessage borrows Facebook's UA, so
// facebookexternalhit also catches Apple's preview fetch.
const BOT_UA = /facebookexternalhit|Facebot|WhatsApp|Twitterbot|Slackbot|Discordbot|TelegramBot|LinkedInBot|Applebot|SkypeUriPreview|Googlebot|bingbot|redditbot|Iframely|Embedly|bot|crawler|spider|preview/i;

function classify(ua) {
  if (!ua) return 'BOT';
  return BOT_UA.test(ua) ? 'BOT' : 'HUMAN?';
}

function bytesFromB64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function clean(s) { return String(s == null ? '-' : s).replace(/[\t\r\n]/g, ' '); }
function htmlEsc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// Hosting/VPN provider ASNs vs. a residential/mobile ISP. A snoop hiding behind
// a VPN egresses from one of these networks; family reads from a home/mobile ISP.
const HOSTING_RE = /amazon|aws\b|google|goog\b|cloud|azure|microsoft|digitalocean|linode|akamai|ovh|hetzner|contabo|vultr|leaseweb|m247|datacamp|choopa|colocrossing|hostwinds|scaleway|oracle|alibaba|tencent|fastly|gcore|g-core|packet|equinix|nordvpn|mullvad|expressvpn|surfshark|private internet|protonvpn|\bvpn\b|hosting|datacenter|data center|dedicated server|colo/i;

// Anonymizers that egress through REAL consumer IPs (so they read "residential"
// on ASN alone). Residential/mobile proxy + anti-detect networks, Tor, and known
// privacy relays. This is why an ASN check isn't enough — these need name-matching
// plus Cloudflare's own threat signals (see anonSignals). Still a lead, not proof.
const ANON_RE = /bright\s?data|luminati|oxylabs|smartproxy|soax|packetstream|iproyal|nimble|netnut|geosurf|infatica|zenrows|scrapingbee|brightproxy|proxyrack|proxy-?seller|storm\s?proxies|residential proxy|\bproxy\b|\btor\b|tor exit|relay|anonymizer|icloud private relay|apple-?engineering|cloudflare warp|\bwarp\b/i;

function netType(org) {
  if (!org) return 'UNKNOWN';
  if (HOSTING_RE.test(org)) return 'HOSTING/VPN';
  if (ANON_RE.test(org)) return 'PROXY/ANON';
  return 'RESIDENTIAL';
}

/** Collect every anonymizer/threat hint Cloudflare exposes on request.cf, plus
 *  our name matches. Returns a short human-readable list ('' if the hit looks
 *  clean). Cloudflare fields vary by plan; we read them defensively. */
function anonSignals(cf, org) {
  const s = [];
  if (org && HOSTING_RE.test(org)) s.push('hosting/VPN-ASN');
  if (org && ANON_RE.test(org))    s.push('proxy/anon-ASN');
  // Cloudflare bot & threat intelligence (present on paid tiers; ignored if absent).
  const bm = cf && cf.botManagement;
  if (bm) {
    if (typeof bm.score === 'number' && bm.score <= 30) s.push(`bot-score:${bm.score}`);
    if (bm.verifiedBot) s.push('verified-bot');
    if (bm.jsDetection && bm.jsDetection.passed === false) s.push('no-js');
  }
  // Some deployments surface these directly on cf:
  if (cf && cf.threatScore != null && cf.threatScore > 0) s.push(`threat:${cf.threatScore}`);
  if (cf && (cf.isEUCountry === undefined) && cf.clientTrustScore != null && cf.clientTrustScore < 30) s.push(`low-trust:${cf.clientTrustScore}`);
  // WARP / privacy-relay hints occasionally appear in these fields:
  if (cf && (cf.clientHandshake === 'warp' || cf.warp === true)) s.push('cloudflare-warp');
  return s.join(', ');
}

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': 'Thu, 01 Jan 1970 00:00:00 GMT',
};

/** Write one hit to KV (and optional alert), without delaying the response. */
function logHit(request, env, ctx, label) {
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  const ip  = request.headers.get('CF-Connecting-IP') || '-';
  const xff = request.headers.get('X-Forwarded-For') || '-';
  const ua  = request.headers.get('User-Agent') || '-';
  const ref = request.headers.get('Referer') || '-';
  const cf  = request.cf || {};
  const asn = cf.asn ? `AS${cf.asn}` : '';
  const geo = [
    [cf.city, cf.region, cf.postalCode].filter(Boolean).join(' '),
    cf.country, cf.timezone,
    [asn, cf.asOrganization].filter(Boolean).join(' '),
    (cf.latitude && cf.longitude) ? `~${cf.latitude},${cf.longitude}` : '',
  ].filter(Boolean).join(' / ') || '-';
  const kind = classify(ua);
  const nettype = netType(cf.asOrganization);
  const anon = anonSignals(cf, cf.asOrganization);   // '' if clean, else 'why it's suspicious'
  const locale  = request.headers.get('Accept-Language') || '-';
  const chPlat  = (request.headers.get('Sec-CH-UA-Platform') || '').replace(/"/g, '');
  const chMob   = request.headers.get('Sec-CH-UA-Mobile') === '?1' ? 'mobile' : '';
  const chUa    = (request.headers.get('Sec-CH-UA') || '').replace(/"/g, '');
  const device  = [chPlat, chMob, chUa].filter(Boolean).join(' ') || '-';
  const conn    = [cf.colo, (cf.clientTcpRtt != null ? `rtt${cf.clientTcpRtt}ms` : ''), cf.tlsVersion, cf.httpProtocol].filter(Boolean).join(' ') || '-';
  const sig     = deviceSignature(ua) || '-';      // e.g. "<model> / <BUILDID>"

  // The log stores ONLY neutral technical facts — no names, no baseline, no
  // attribution. Who each token/device belongs to is decided later, by you, in
  // an offline sheet. Columns appended at the end so old viewers still parse.
  const line = [now, label, kind, ip, xff, ua, ref, geo, nettype, locale, device, conn, sig, (anon || '-')].map(clean).join('\t');

  if (!env.CANARY_KV) return;
  const key = `hit:${Date.now().toString().padStart(15, '0')}:${crypto.randomUUID().slice(0, 8)}`;
  const jobs = [env.CANARY_KV.put(key, line)];

  // Alert on human hits by default. Set CANARY_ALERT_BOTS="true" to also get
  // preview-crawler hits (noisy: many per share).
  const shouldAlert = kind === 'HUMAN?' || env.CANARY_ALERT_BOTS === 'true';
  if (shouldAlert) {
    // Escalate the subject only on a purely technical signal: anonymizer/proxy
    // use. No baseline, no names — you decide who is who in your sheet.
    const flag = anon ? '🚨 ANONYMIZER —' : '🐤 Canary';
    const subject = `${flag} ${kind} — ${label}`;
    const bodyText =
      `Canary hit on "${label}"\n\n` +
      `When:      ${now}\n` +
      `Type:      ${kind}\n` +
      `Signature: ${sig}\n` +
      `Anonymizer:${anon || 'none detected'}\n` +
      `IP:        ${ip}\n` +
      `Network:   ${nettype}\n` +
      `Location:  ${geo}\n` +
      `Language:  ${locale}\n` +
      `Device:    ${ua}\n` +
      `Conn:      ${conn}\n\n` +
      (anon
        ? `🚨 Anonymizer/proxy signals present (${anon}). This party is hiding their network. Preserve.\n`
        : `Attribute this device in your offline sheet by signature + network.\n`) +
      `An IP is a lead, not an identity. Keep the log unedited as evidence.`;

    // Email via Resend (set CANARY_RESEND_KEY + CANARY_ALERT_EMAIL as secrets).
    if (env.CANARY_RESEND_KEY && env.CANARY_ALERT_EMAIL) {
      jobs.push(fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.CANARY_RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: env.CANARY_ALERT_FROM || 'Canary <canary@sguardissimi.com>',
          to: [env.CANARY_ALERT_EMAIL],
          subject,
          text: bodyText,
        }),
      }).catch(() => {}));
    }

    // Optional Slack/Discord webhook (works alongside or instead of email).
    if (env.CANARY_ALERT_WEBHOOK) {
      jobs.push(fetch(env.CANARY_ALERT_WEBHOOK, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `🐤 ${kind} on ${label}\n${now}\nIP ${ip} (${nettype})\n${geo}\nUA: ${ua}` }),
      }).catch(() => {}));
    }
  }

  const work = Promise.allSettled(jobs);
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(work);
}

function photoPage(token, meta, origin) {
  // Query-string image URL: Cloudflare treats it as dynamic, so it never gets
  // the aggressive bare-.jpg edge caching that 404-poisons fresh image paths.
  const imgUrl = `${origin}/media/${token}?raw=1`;
  const b64 = CANARY_IMAGES[meta.image];
  const title = meta.title || 'Photo';
  const desc = meta.desc || '';
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${htmlEsc(title)}</title>
<meta property="og:type" content="article">
<meta property="og:title" content="${htmlEsc(title)}">
<meta property="og:description" content="${htmlEsc(desc)}">
<meta property="og:image" content="${htmlEsc(imgUrl)}">
<meta property="og:image:type" content="image/jpeg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${htmlEsc(title)}">
<meta name="twitter:image" content="${htmlEsc(imgUrl)}">
<style>html,body{margin:0;height:100%;background:#000}img{display:block;max-width:100%;max-height:100vh;margin:0 auto}</style>
</head><body>
<img src="data:image/jpeg;base64,${b64}" alt="${htmlEsc(title)}">
</body></html>`;
}

/**
 * Returns a Response for the canary path / secret log endpoint, else null so
 * normal site handling continues untouched.
 */
export async function handleCanary(request, env, ctx, url) {
  const m = url.pathname.match(/^\/media\/([A-Za-z0-9_.-]+)$/);
  if (!m) return null;
  const seg = m[1];

  // Secret log-retrieval endpoint: /media/<CANARY_SECRET>.log
  if (env.CANARY_SECRET && seg === `${env.CANARY_SECRET}.log`) {
    return dumpLog(env);
  }

  // Preview image: /media/<token>?raw=1  (what the crawler pulls for the card).
  // Query-string form dodges Cloudflare's bare-.jpg edge caching.
  if (url.searchParams.has('raw') && TOKENS[seg]) {
    logHit(request, env, ctx, `${seg}?raw`);
    return new Response(bytesFromB64(CANARY_IMAGES[TOKENS[seg].image]), {
      headers: { 'Content-Type': 'image/jpeg', ...NO_CACHE },
    });
  }

  // Back-compat: /media/<token>.jpg  serves the raw image directly.
  if (seg.endsWith('.jpg') && TOKENS[seg.slice(0, -4)]) {
    const token = seg.slice(0, -4);
    logHit(request, env, ctx, seg);
    return new Response(bytesFromB64(CANARY_IMAGES[TOKENS[token].image]), {
      headers: { 'Content-Type': 'image/jpeg', ...NO_CACHE },
    });
  }

  // Photo page: /media/<token>  (Open Graph preview + full-size view)
  const meta = TOKENS[seg];
  if (!meta) return null;
  logHit(request, env, ctx, seg);
  return new Response(photoPage(seg, meta, url.origin), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...NO_CACHE },
  });
}

/** Concatenate all stored hits into the tab-separated .dat the viewer reads. */
async function dumpLog(env) {
  if (!env.CANARY_KV) return new Response('no store', { status: 404 });
  const lines = [];
  let cursor;
  do {
    const list = await env.CANARY_KV.list({ prefix: 'hit:', cursor });
    for (const k of list.keys) {
      const v = await env.CANARY_KV.get(k.name);
      if (v) lines.push(v);
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);
  lines.sort();
  return new Response(lines.join('\n') + (lines.length ? '\n' : ''), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'attachment; filename=".thumb_cache.dat"',
      'Cache-Control': 'no-store',
    },
  });
}
