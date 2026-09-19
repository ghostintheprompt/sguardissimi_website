// Uploads the media the site references from the LaCie originals to Cloudflare R2.
//
//   node scripts/media-upload/upload.mjs              upload everything in plan.json
//   node scripts/media-upload/upload.mjs --limit 3    upload only the first 3 pending files (smoke test)
//   node scripts/media-upload/upload.mjs --show Faith_Connexion_Paris_Autumn_Winter_2019
//
// Idempotent: every successful upload is recorded in manifest.json (key + byte size).
// A file already in the manifest at the same size is skipped, so re-running never repeats work
// and an interrupted run resumes where it stopped.
//
// Requires `wrangler login` to the account that owns the buckets. wrangler v4 defaults to a
// LOCAL simulated bucket, so --remote is passed explicitly on every put.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
// msubrizi@gmail.com's Cloudflare account, which owns the fashion-photos / fashion-videos buckets.
const ACCOUNT_ID = 'dc8d83e68ad798999ac00a4bdd7d40ce';
const here = path.dirname(fileURLToPath(import.meta.url));
const planPath = path.join(here, 'plan.json');
const manifestPath = path.join(here, 'manifest.json');
const root = path.join(here, '../..');

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
const limit = flag('--limit') ? Number(flag('--limit')) : Infinity;
const show = flag('--show');
const CONCURRENCY = Number(flag('--concurrency') || 6);

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
const id = (p) => `${p.bucket}/${p.key}`;

let pending = plan.filter((p) => manifest[id(p)] !== p.size);
if (show) pending = pending.filter((p) => p.key.startsWith(`${show}/`));
pending = pending.slice(0, limit);

console.log(`plan ${plan.length} | already uploaded ${plan.length - plan.filter((p) => manifest[id(p)] !== p.size).length} | this run ${pending.length}`);

let done = 0, failed = [];
const save = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));

async function upload(p) {
  if (!fs.existsSync(p.file)) throw new Error(`source missing: ${p.file}`);
  // Size on disk must still match the plan, otherwise the manifest would lie.
  const size = fs.statSync(p.file).size;
  if (size !== p.size) throw new Error(`size changed on disk (${size} vs plan ${p.size})`);
  await run('npx', ['--no-install', 'wrangler', 'r2', 'object', 'put', id(p),
    '--file', p.file, '--content-type', p.ct,
    '--cache-control', 'public, max-age=31536000, immutable', '--remote'],
    // Pin the target account so a `wrangler login` to a different identity mid-run can only
    // cause failures here, never uploads into another account's bucket of the same name.
    { cwd: root, maxBuffer: 10 * 1024 * 1024, env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID } });
  manifest[id(p)] = p.size;
}

async function worker(queue) {
  while (queue.length) {
    const p = queue.shift();
    try {
      await upload(p);
      done++;
      if (done % 25 === 0 || done === pending.length) { save(); console.log(`uploaded ${done}/${pending.length}`); }
    } catch (e) {
      failed.push({ key: id(p), error: String(e.stderr || e.message).split('\n').filter(Boolean).slice(-2).join(' | ') });
    }
  }
}

const queue = [...pending];
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)));
save();
console.log(`done: ${done} uploaded, ${failed.length} failed`);
if (failed.length) {
  fs.writeFileSync(path.join(here, 'failed.json'), JSON.stringify(failed, null, 1));
  console.log('failures written to scripts/media-upload/failed.json; first:', failed.slice(0, 3));
  process.exit(1);
}
