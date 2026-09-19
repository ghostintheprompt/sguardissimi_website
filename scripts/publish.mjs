#!/usr/bin/env node
// Publish a finished draft: gate -> move into articles/ -> build -> deploy -> verify live -> audit.
//
//   node scripts/publish.mjs <draft-name-or-part-of-it> [--no-deploy] [--skip-audit]
//
// Refuses to ship while the draft contains TODO, a colon in the title, or media that is not publicly reachable.
// Checks the Cloudflare login BEFORE touching anything, so a wrong account leaves the draft where it was.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const query = argv.find((a) => !a.startsWith('--'));
const noDeploy = argv.includes('--no-deploy'), skipAudit = argv.includes('--skip-audit');
const PERSONAL = 'dc8d83e68ad798999ac00a4bdd7d40ce';
const die = (m) => { console.error('\nSTOPPED: ' + m + '\n'); process.exit(1); };
const run = (cmd, args, o = {}) => spawnSync(cmd, args, { cwd: root, stdio: 'inherit', ...o });

const draftsDir = path.join(root, 'drafts');
if (!query) die('Say which draft. Available:\n  ' + (fs.existsSync(draftsDir) ? fs.readdirSync(draftsDir).filter((f) => f.endsWith('.md')).join('\n  ') : '(no drafts folder)'));
const matches = fs.existsSync(draftsDir) ? fs.readdirSync(draftsDir).filter((f) => f.endsWith('.md') && f.includes(query)) : [];
if (matches.length !== 1) die(matches.length ? `"${query}" matches ${matches.length} drafts:\n  ${matches.join('\n  ')}` : `No draft matches "${query}".`);
const file = matches[0], slug = file.replace(/\.md$/, ''), draftPath = path.join(draftsDir, file);
let raw = fs.readFileSync(draftPath, 'utf8');
const [fm, ...rest] = raw.split('\n---\n');
const body = rest.join('\n---\n');

// ---- gate: nothing unfinished ships
const problems = [];
if (/TODO/.test(raw)) problems.push('still contains TODO (title, excerpt, or body)');
const title = (fm.match(/^title:\s*(.*)$/m) || [])[1] || '';
if (!title) problems.push('no title');
if (title.includes(':')) problems.push('title contains a colon');
if (!/^author:\s*Michael d Subrizi\s*$/m.test(fm)) problems.push('author must be exactly "Michael d Subrizi" (lowercase d)');
if (/\bMichael D\.? Subrizi/.test(raw)) problems.push('capital D in the name');
if (/\brunway\b/i.test(body)) console.warn('NOTE: the word "runway" appears in the body. Coverage wording is first looks, backstage, fittings, fashion films.');
if (/quinta strada|settima strada|sesta strada/i.test(raw)) problems.push('Italianized New York street name (use Fifth Avenue etc.)');
if (problems.length) die('Not ready to publish:\n  - ' + problems.join('\n  - '));

// ---- gate: every media URL must be reachable
const urls = [...new Set(raw.match(/https:\/\/(photos|video)\.sguardissimi\.com\/[^\s'"]+/g) || [])];
const bad = [];
for (let i = 0; i < urls.length; i += 12) {
  await Promise.all(urls.slice(i, i + 12).map(async (u) => {
    try { const r = await fetch(u, { headers: { Range: 'bytes=0-1023' } }); if (r.status !== 206 && r.status !== 200) bad.push(`${r.status} ${u}`); }
    catch (e) { bad.push(`ERR ${u}`); }
  }));
}
if (bad.length) die(`${bad.length} media URL(s) not reachable (upload finished? typo?):\n  ` + bad.slice(0, 10).join('\n  '));
console.log(`Gate passed: no TODO, ${urls.length} media URLs reachable.`);

// ---- deploy account check BEFORE moving anything
if (!noDeploy) {
  const w = spawnSync('npx', ['--no-install', 'wrangler', 'whoami'], { cwd: root, encoding: 'utf8' });
  if (!(w.stdout || '').includes(PERSONAL)) die('Wrangler is not on the personal Cloudflare account (dc8d83e6...).\nRun:  npx wrangler login --browser=false   and open the link in the browser signed into msubrizi@gmail.com.\nThe draft has not been moved.');
}

// ---- word count / reading time from the finished body
const words = body.replace(/\[(GALLERY|VIDEO):\d+\]/g, ' ').replace(/[#*_>`-]/g, ' ').split(/\s+/).filter(Boolean).length;
raw = raw.replace(/^word_count:.*$/m, `word_count: ${words}`).replace(/^reading_time:.*$/m, `reading_time: ${Math.max(1, Math.round(words / 200))}`);
const outPath = path.join(root, 'articles', file);
if (fs.existsSync(outPath)) die(`articles/${file} already exists.`);
fs.writeFileSync(outPath, raw);
fs.unlinkSync(draftPath);
console.log(`Moved to articles/${file} (${words} words).`);

if (run('npm', ['run', 'build']).status !== 0) die(`Build failed. The article is in articles/${file}; fix it there and run "npm run build".`);
if (noDeploy) { console.log('\n--no-deploy: built locally, not published.'); process.exit(0); }
if (run('npx', ['--no-install', 'wrangler', 'deploy']).status !== 0) die('Deploy failed.');

// ---- verify live
const live = `https://sguardissimi.com/articles/${slug}/`;
let ok = false;
for (let i = 0; i < 8 && !ok; i++) {
  await new Promise((r) => setTimeout(r, 4000));
  try { const r = await fetch(`${live}?cb=${Date.now()}`); if (r.status === 200) { const t = await r.text(); ok = t.includes('photos.sguardissimi.com'); } } catch (e) { /* retry */ }
}
if (!ok) die(`Deployed, but ${live} did not come up with its photos. Check it in a browser.`);
console.log(`\nLIVE: ${live}`);

if (!skipAudit) { console.log('\nRunning the full link audit...'); const a = run('python3', ['scripts/link-audit.py']); if (a.status !== 0) console.error('\nAudit reported broken links. See above.'); }
