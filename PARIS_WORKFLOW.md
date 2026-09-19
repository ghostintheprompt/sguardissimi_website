# Paris workflow: shoot to live, fast, and still in your voice

Voice is what sets Sguardissimi apart. Everything else can be copied. So this workflow automates
the mechanical parts (naming, numbering, uploading, verifying, building, deploying) and does **not**
touch the writing. The draft that `article:new` produces is full of `TODO`, and `article:publish`
refuses to ship a draft that still has one. The words are always yours.

Overall plan for the trip is in `../agency_forza/PARIS.md`. This file is the article pipeline.

## The daily loop

1. **Shoot, cull, export.** Web JPGs, 1 to 2 MB each. Put a show in its own folder and name the files so
   they sort in the order you want the gallery to read (`01.jpg`, `02.jpg`, ... or the camera order).
2. **Scaffold** (about a minute, mostly the upload):
   ```bash
   cd sguardissimi_website
   npm run article:new -- --folder ~/Desktop/chloe --show "Chloe" --city Paris --season "Spring Summer 2027"
   ```
   Add `--video ~/Desktop/chloe.mov` for a film: it is re-encoded to 720p H.264 so it plays everywhere.
   Add `--date 2026-10-01` if the day is not today. Add `--dry` to see what it would do without uploading.
3. **Write.** Open the draft it printed (`drafts/chloe-paris-spring-summer-2027-<date>.md`) and replace
   every `TODO`: the title (a full line, no colon), the excerpt, the story. Rough fragments are fine, say them to Claude
   and let it shape them, but only what you actually saw.
4. **Publish** (about a minute):
   ```bash
   npm run article:publish -- chloe
   ```
   It checks the draft, builds, deploys, confirms the live page comes up with its photos, and runs the link audit.

Between steps 2 and 4 nothing is public. The photos are uploaded, but no page links to them.

## Before you start each day

- `npx wrangler whoami` must say `msubrizi@gmail.com` (account `dc8d83e6...`). If it does not:
  `npx wrangler login --browser=false`, open the link in the browser signed into that account, click Allow.
- ffmpeg installed (`brew install ffmpeg`) if you are doing films.

## What the scripts check for you

`article:new`: strips accents from names (Chloé becomes Chloe), numbers photos in natural order and prints the
order so a wrong sort is obvious, refuses to reuse a folder name that already points at other files, warns on
files over 6 MB, uploads with the resumable uploader, then fetches every URL to confirm it is public.

`article:publish` stops, and touches nothing, if: a `TODO` is left; the title has a colon; the author is not
exactly `Michael d Subrizi`; the name has a capital D; a New York street is Italianized (Quinta Strada);
any photo or film URL is not reachable; or wrangler is on the wrong account. It warns if "runway" appears.
After it deploys it waits for the live page to come up with its photos, then runs the full link audit.

## When something goes wrong

- **Upload failed halfway:** run the same `article:new` command again. Finished files are skipped.
- **Wrong photo order:** run the scaffold once with `--dry` first, it prints the order without uploading. If you notice after uploading, just reorder the `- url:` blocks in the draft. The gallery reads in the order of the draft, not the file numbers.
- **A photo needs replacing after publishing:** use a new file name. A same-name replacement will not show for anyone who already has it cached.
- **Deploy said wrong account:** nothing was moved. Log in as above and run the same publish command.
- **Manual fallback** (no scripts): see `../agency_forza/PARIS.md`, "Uploading".

## Front page and Agency Forza

New articles in the `high-fashion-and-culture` category (the scaffold's default) appear in the homepage archive list automatically. The front page's featured story, the
grid of five, and the countdown are hand-set in `index.html`. Agency Forza's houses index links to published
articles, so publish here first, then update Agency Forza (see `../agency_forza/PARIS.md`).

## Downtime

Polish old pieces from `POLISH_QUEUE.md`. It is a short, ranked list with what to look for. Most of the archive is good and stays as is.
