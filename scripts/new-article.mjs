#!/usr/bin/env node
// Scaffold a Sguardissimi article DRAFT from a folder of exported photos (and optionally one film),
// upload the media to R2, verify it is publicly reachable, and leave a draft in drafts/.
//
//   node scripts/new-article.mjs --folder "/path/to/exports" --show "Chloe" --city Paris \
//        --season "Spring Summer 2027" [--date 2026-10-01] [--video /path/film.mov] [--dry]
//
// What it does NOT do: write. The draft is full of TODO markers on purpose. scripts/publish.mjs refuses to
// ship a draft that still has one, so nothing unfinished can go live. The words are yours.
//
// Photos are numbered 1..N in natural filename order, so export/rename them in the order you want the
// gallery to read. Keys look like  Chloe_Paris_Spring_Summer_2027/Chloe_Paris_Spring_Summer_2027_1.jpg

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (n, d = null) => { const i = argv.indexOf('--' + n); return i === -1 ? d : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
const has = (n) => argv.includes('--' + n);
const die = (m) => { console.error('\nERROR: ' + m + '\n'); process.exit(1); };

const folder = opt('folder'), show = opt('show'), city = opt('city'), season = opt('season');
const dry = has('dry'), videoIn = opt('video');
const date = opt('date') || new Date().toISOString().slice(0, 10);
if (!folder || !show || !city || !season) die('Need --folder, --show, --city and --season. Example:\n  node scripts/new-article.mjs --folder ~/Desktop/chloe --show Chloe --city Paris --season "Spring Summer 2027"');
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) die('--date must be YYYY-MM-DD');
if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) die(`Folder not found: ${folder}`);

const ascii = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ');
const keyPart = (s) => ascii(s).replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).join('_');
const slugify = (s) => ascii(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const folderKey = [show, city, season].map(keyPart).join('_');
const slug = [show, city, season].map(slugify).join('-');
const draftPath = path.join(root, 'drafts', `${slug}-${date}.md`);
if (fs.existsSync(draftPath)) die(`Draft already exists: ${path.relative(root, draftPath)}`);
if (fs.existsSync(path.join(root, 'articles', `${slug}-${date}.md`))) die('An article with that slug and date already exists.');

// ---- photos
const photos = fs.readdirSync(folder)
  .filter((f) => /\.jpe?g$/i.test(f) && !f.startsWith('.'))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
if (!photos.length) die(`No .jpg files in ${folder}`);
const big = photos.filter((f) => fs.statSync(path.join(folder, f)).size > 6 * 1024 * 1024);
if (big.length) console.warn(`WARNING: ${big.length} file(s) over 6 MB (e.g. ${big[0]}). Web exports around 1-2 MB load faster.`);

const entries = photos.map((f, i) => {
  const file = path.join(folder, f);
  return { bucket: 'fashion-photos', key: `${folderKey}/${folderKey}_${i + 1}.jpg`, file, ct: 'image/jpeg', size: fs.statSync(file).size };
});

// show the gallery order so a wrong sort is obvious before anything uploads
const shown = photos.length > 8 ? [...photos.slice(0, 4), '...', ...photos.slice(-2)] : photos;
console.log('Gallery order (file -> position):');
shown.forEach((f) => { const i = photos.indexOf(f); console.log(f === '...' ? '   ...' : `   ${f} -> ${i + 1}`); });

// ---- optional film (re-encoded so it plays everywhere; HEVC does not)
let videoKey = null;
if (videoIn) {
  if (!fs.existsSync(videoIn)) die(`Video not found: ${videoIn}`);
  if (spawnSync('ffmpeg', ['-version']).status !== 0) die('ffmpeg is needed to encode the film (brew install ffmpeg).');
  const outDir = path.join(root, 'scripts', 'media-upload', 'encoded');
  fs.mkdirSync(outDir, { recursive: true });
  videoKey = `${folderKey.toLowerCase()}.mp4`;
  const out = path.join(outDir, videoKey);
  console.log('Encoding film (720p, H.264, faststart)...');
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', videoIn, '-vf', 'scale=1280:-2', '-c:v', 'libx264', '-profile:v', 'high', '-crf', '25',
    '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out], { stdio: 'inherit' });
  if (r.status !== 0) die('ffmpeg failed.');
  entries.push({ bucket: 'fashion-videos', key: videoKey, file: out, ct: 'video/mp4', size: fs.statSync(out).size });
}

// ---- plan.json (idempotent: same key + same file is skipped; same key + different file aborts)
const planPath = path.join(root, 'scripts', 'media-upload', 'plan.json');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const byId = new Map(plan.map((p) => [`${p.bucket}/${p.key}`, p]));
let added = 0;
for (const e of entries) {
  const prev = byId.get(`${e.bucket}/${e.key}`);
  if (prev && prev.file !== e.file) die(`Key already used by another file: ${e.key}\nChoose a different --show/--city/--season, or remove that entry from scripts/media-upload/plan.json.`);
  if (!prev) { plan.push(e); added++; }
}
console.log(`${photos.length} photo(s)${videoKey ? ' + 1 film' : ''}; ${added} new plan entr${added === 1 ? 'y' : 'ies'}; folder key ${folderKey}`);

// ---- draft (written before upload so a failed upload never loses the scaffold)
const url = (k) => `https://photos.sguardissimi.com/${k}`;
const imgs = entries.filter((e) => e.bucket === 'fashion-photos').map((e) => url(e.key));
const hero = imgs.slice(0, 3);
const fm = [
  '---',
  `template: ${videoKey ? 'gallery-video' : 'gallery'}`,
  'title: "TODO title, a full line, no colon"',
  `date: '${date}'`,
  'categories:',
  '  - high-fashion-and-culture',
  'excerpt: >-',
  '  TODO one or two sharp lines',
  'author: Michael d Subrizi',
  'photographer: Michael d Subrizi',
  'word_count: 1',
  'reading_time: 1',
  'featured: false',
  'cover: >-',
  `  ${imgs[0]}`,
  'coverOrientation: "portrait"',
  ...(videoKey ? ['video:', `  - title: ${city} ${season}`, `    url: 'https://video.sguardissimi.com/${videoKey}'`] : []),
  'hero_shots:',
  ...hero.flatMap((u) => ['  - >-', `    ${u}`]),
  'gallery:',
  `  - title: ${city} ${season}`,
  '    images:',
  ...imgs.flatMap((u) => ['      - url: >-', `          ${u}`, '        alt: Immagine di galleria']),
  '---',
  '',
  ...(videoKey ? ['[VIDEO:0]', ''] : []),
  '[GALLERY:0]',
  '',
  'TODO write it. Your voice: first person, short fragments, only what you saw. No colon in the title.',
  ''
].join('\n');
fs.mkdirSync(path.dirname(draftPath), { recursive: true });
fs.writeFileSync(draftPath, fm);
console.log(`Draft written: ${path.relative(root, draftPath)}`);

if (dry) { console.log('\n--dry: plan.json NOT saved, nothing uploaded.'); process.exit(0); }

fs.writeFileSync(planPath, JSON.stringify(plan, null, 1));

// ---- upload (resumable: the manifest skips anything already uploaded)
console.log('\nUploading to R2...');
const up = spawnSync('node', [path.join('scripts', 'media-upload', 'upload.mjs')], { cwd: root, stdio: 'inherit' });
if (up.status !== 0) die('Upload had failures. Fix the cause (wrangler login as the personal account?) and re-run the same command; finished files are skipped.');

// ---- verify every URL is public
console.log('\nVerifying public URLs...');
const targets = entries.map((e) => `https://${e.bucket === 'fashion-photos' ? 'photos' : 'video'}.sguardissimi.com/${e.key}`);
const bad = [];
for (let i = 0; i < targets.length; i += 12) {
  await Promise.all(targets.slice(i, i + 12).map(async (u) => {
    try { const r = await fetch(u, { headers: { Range: 'bytes=0-1023' } }); if (r.status !== 206 && r.status !== 200) bad.push(`${r.status} ${u}`); }
    catch (e) { bad.push(`ERR ${u}`); }
  }));
}
if (bad.length) { console.error('Not reachable:\n' + bad.join('\n')); process.exit(1); }
console.log(`All ${targets.length} URLs return 200/206.`);

console.log(`\nNext:\n  1. Write the story in ${path.relative(root, draftPath)} (replace every TODO).\n  2. node scripts/publish.mjs ${slug}-${date}`);
