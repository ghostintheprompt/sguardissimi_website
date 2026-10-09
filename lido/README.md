# Publish LIDO's first film

The public page is `/lido/`. Until the first story is ready it displays the designed illustrated placeholder, without a fake player or invented contributor credits.

Edit `lido/story.json`:
- `title`, `deck`: the approved story heading and introduction.
- `video`: the uploaded video URL (use the existing video.sguardissimi.com host).
- `poster`: an actual still image, ideally local `/img/posters/...jpg`.
- `photographer`: contributor's credited name; `creditLabel`: their exact role (e.g. Fotografie or Film); `photographerUrl`: optional portfolio URL.
- `credits`: additional credit lines, including the exact film credit if different from photography.
- `paragraphs`: article paragraphs as plain text, in reading order.
- Set `published` to `true` when ready. A title, photographer, video and poster are required to replace the placeholder.

Run `npm run build` and preview `/lido/`. Deploy separately with the project's usual Wrangler workflow. The build copies this folder (excluding this README) into `dist/lido/`. This is a first-story slot, not yet a multi-story archive. Before a second story, give each published story a permanent URL.
