# fiamma.love — start here

Read this, then read the code. Do not ask questions this file answers.

## What it is

The magazine. 46 articles, Italian, first-person where it's good. Photography and
writing from ten years of shows. Not a portfolio — agencyforza.com is the studio
and carries the bio, the credits and the booking address. Fiamma carries the work.

## Stack, exactly

- Source: `index.html` (front page), `articles/*.md` (46), `css/`, `img/`
- Build: `npm run build` → regenerates `dist/` **and** `articles-metadata.json`
- Deploy: `npx wrangler deploy` — ships `./dist`. **Git push does NOT deploy.**
- Worker: `src/index.js` — sets CSP/HSTS. Needs `run_worker_first = true` in
  `wrangler.toml` or the headers silently vanish.
- Media: `media.fiamma.love` (R2). Photos at
  `fashion_photos/<Collection>/<Collection>_<n>.jpg`, numbering **contiguous 1..N,
  no gaps**, 35 collections, 1,682 frames. Video at `fashion_video/<name>.mp4`.
- **Video poster .jpg files do NOT exist on the CDN.** Any `cover:` pointing at
  `fashion_video/*.jpg` 404s. It's invisible on video articles because the hero
  renders `<video poster=...>` and autoplay covers it. Use `/img/` for real posters.

## Accounts — this will bite you

`gh` and `wrangler` are shared across four identities. Before touching fiamma:

```
gh auth switch --user Fiamma-Editorial
npx wrangler whoami        # must say Fiamma Editorial, not agencyforza
```

Deploying fiamma while wrangler is on the agencyforza token fails. The permanent
fix is a scoped `CLOUDFLARE_API_TOKEN` in `.env` per repo — not done yet.

## Front page

`SELECTED_SLUGS` in `index.html` drives the hero and the selected grid. Everything
not in it goes to the archive. That's the lever for what's highlighted — it does not
hide anything.

Current order leads with Tory Burch (biggest name, video piece), then the strongest
by length + gallery depth + first-person voice.

## Known state (verified this session)

- Accents, `e`→`è`, imperial units: **clean** across all 46 articles and `dist/`
- `word_count`/`reading_time`: regenerated from real body text (23 were wrong)
- Front page copy: still the old third-person positioning text — **not yet replaced**
- 611 KB `articles-metadata.json` loads before any image renders; archive images are
  ~835 KB masters with no thumbnails. Cloudflare image resizing is **not enabled**
  (`/cdn-cgi/image/` 404s), so there's no on-the-fly fix without turning it on.
- `<html lang="it">`, `currentLang` hardcoded to `'it'`. fr/es/en translations exist
  in `UI_COPY` and are dead code.
- Footer links Ghost, MDRN, FutureBudz alongside agencyforza.

## Open

1. `PREVIEW_V2.html` — replacement front page. One look per screen, lightbox archive
   (needs only collection name + count), copy pulled from the articles instead of
   positioning text. **Six frames are all `_1`, which is arbitrary.** `PROVINI.html`
   is a numbered contact sheet of all 542 frames across those six collections —
   open it, call the numbers, then this ships as `index.html`.
2. 5 stub articles (<150 real words): 4× Naeem Khan, 1× Alberto Zambelli. **Not
   merging shows. Not writing content before fashion week.** They stay in the
   archive, out of `SELECTED_SLUGS`.
3. 27 of 46 articles are third-person press-release voice; 18 are first-person.
   The front page pulls only from the 18.

## Working rules

- Fix what you find. Don't report a defect and move on.
- Verify against the live site or the built `dist/`, not the source file.
- Audit before deploy.
- No recaps, no summaries, no commentary on the work or on me.
- Never write content or invent detail about a show. I was there, you weren't.
