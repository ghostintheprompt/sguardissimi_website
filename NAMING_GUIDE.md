# Naming guide — read before uploading any show

For when you're culling each show down to first-look/backstage/video and reuploading
from backup. This is what the site's code actually reads (`index.html`'s image-URL
builder, `build/build-system.js`) — not a suggestion, a requirement. Get these wrong
and the gallery breaks silently.

## Collection name

`Designer_Show_City_Season_Year` — underscore-separated, exact case.

Example: `Elie_Saab_Paris_Autumn_Winter_2019`

This exact string is used as:
- the R2 folder name under `fashion_photos/`
- the `data-col` value on the homepage `<section class="look" data-col="...">`

It has to match **everywhere** — homepage, article frontmatter, R2 folder — or the
gallery points at nothing.

## Photos

Inside `fashion_photos/<Collection>/`:

```
<Collection>_<n>.jpg
```

Numbered **1 through however many survive the cull, with no gaps.**

The site loops `1..N` (`data-n` on the homepage, `word_count`-style counts in the
article gallery) to build image URLs. If you keep 12 horizontals out of an original
80 riser shots, renumber them 1–12 clean. Do not keep the original shot numbers
(e.g. don't ship `_14, _37, _52...`) — a gap 404s that frame and everything past it
looks broken in the lightbox.

## Video

```
fashion_video/<name>.mp4
```

Lowercase with underscores — e.g. `tory_burch_nyfw.mp4`. This is the one place the
convention genuinely differs from the Title_Case photo folders. That's the existing
pattern, not a typo — keep it lowercase.

Every video needs a **poster** — never generate one by grabbing a frame from the
video itself. Checked three of these tonight (Tory Burch, Berta, Naeem Khan) and
every single video-frame grab was bad: blurry, wrong crop, or literally had the
video player's pause/play button baked into the image. Video frames are not photos.

The fix is simpler than shooting something new: **use one of the real stills from
that same show's own gallery as the poster.** You're already shooting stills at
every show — just pick whichever one works best as a cover and point `cover:` at
it (`https://media.fiamma.love/fashion_photos/<Collection>/<Collection>_<n>.jpg`,
or a local file under `/img/` if you're hand-picking one). No separate capture
step, no screengrabbing.

Poster `.jpg`s hosted on `fashion_video/*.jpg` (i.e. inside the video folder
itself) 404 silently — you won't notice because autoplay covers the gap, but the
`og:image`/`twitter:image` share preview will be broken. Always point `cover:` at
`fashion_photos/`, never `fashion_video/`.

## Orientation

Nothing to name specially. The gallery CSS already uses `object-fit: contain`, so
horizontal shots display at their natural aspect ratio with no cropping — no
filename suffix or special folder needed.

`coverOrientation` in an article's frontmatter (`"landscape"` / `"portrait"`) is
**not currently wired into any layout logic** — it's documentation only right now,
not a real switch. Set it accurately if you like, but don't expect it to change
anything on its own.

## Quick checklist per show

1. Pick the survivors — first looks, backstage, video. No riser.
2. Rename the collection folder to `Designer_Show_City_Season_Year`.
3. Renumber photos `1..N` contiguous, no gaps.
4. Video goes in `fashion_video/`, lowercase_underscore name.
5. For any video, pick one real still from that show's own gallery as its poster —
   never a frame grabbed from the video itself.
6. Update the article's frontmatter (`data-col`, `data-n`, `hero_shots`,
   `videos[].url`, `cover`) to match exactly.
