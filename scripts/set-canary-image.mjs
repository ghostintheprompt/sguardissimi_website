#!/usr/bin/env node
/**
 * Switch or add a canary decoy image.
 *
 *   node scripts/set-canary-image.mjs <path/to/photo.jpg> [imageId]
 *
 * Encodes the JPEG as base64 and writes it into src/canary-image.js under
 * `imageId` (default "default"). Existing images are preserved. After running:
 *
 *   npx wrangler deploy
 *
 * Then point a token at the image in src/canary.js (TOKENS[...].image = imageId).
 */
import fs from 'node:fs';

const [file, id = 'default'] = process.argv.slice(2);
if (!file) {
  console.error('usage: node scripts/set-canary-image.mjs <photo.jpg> [imageId]');
  process.exit(1);
}
if (!fs.existsSync(file)) { console.error(`not found: ${file}`); process.exit(1); }

const out = new URL('../src/canary-image.js', import.meta.url);

// Preserve any images already stored.
let map = {};
try {
  const mod = await import(out.href + '?t=' + Date.now());
  if (mod.CANARY_IMAGES) map = { ...mod.CANARY_IMAGES };
} catch { /* first run or old format — start fresh */ }

const b64 = fs.readFileSync(file).toString('base64');
map[id] = b64;

const body =
`// Auto-generated base64 decoy images for the canary Worker. Do not hand-edit.
// Switch/add with: node scripts/set-canary-image.mjs <photo.jpg> [imageId]
export const CANARY_IMAGES = ${JSON.stringify(map)};
`;
fs.writeFileSync(out, body);
console.log(`Set image "${id}" (${Math.round(b64.length / 1024)} KB). Images now: ${Object.keys(map).join(', ')}`);
console.log('Next: npx wrangler deploy');
