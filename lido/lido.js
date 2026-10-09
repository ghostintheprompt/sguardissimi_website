'use strict';
// Text is inserted as textContent; contributor URLs allow only HTTP(S).
function mediaUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try { const url = new URL(value, location.origin); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
fetch('/lido/story.json').then(response => {
  if (!response.ok) throw new Error('Story unavailable');
  return response.json();
}).then(story => {
  const videoUrl = mediaUrl(story.video), posterUrl = mediaUrl(story.poster);
  // Keep the designed placeholder until the story, attribution and media are ready.
  if (story.published !== true || !story.title || !story.photographer || !videoUrl || !posterUrl) return;
  const video = document.createElement('video');
  video.controls = true; video.playsInline = true; video.preload = 'none';
  video.poster = posterUrl; video.src = videoUrl; video.setAttribute('aria-label', story.title);
  video.addEventListener('error', () => {
    document.getElementById('story-media').replaceChildren(document.createTextNode('Il film non è disponibile in questo momento. Riprova tra poco.'));
  }, {once:true});
  document.getElementById('story-media').replaceChildren(video);
  document.getElementById('story-title').textContent = story.title;
  document.getElementById('story-deck').textContent = story.deck || '';
  document.getElementById('story-status').textContent = 'Film / Editoriale';
  const credits = document.getElementById('story-credits'), credit = document.createElement('p');
  credit.append((story.creditLabel || 'Fotografie') + ': ');
  const url = mediaUrl(story.photographerUrl);
  const name = document.createElement(url ? 'a' : 'span');
  name.textContent = story.photographer; if (url) name.href = url;
  credit.append(name); credits.append(credit);
  for (const text of Array.isArray(story.credits) ? story.credits : []) {
    const p = document.createElement('p'); p.textContent = text; credits.append(p);
  }
  credits.hidden = false;
  const body = document.getElementById('story-body');
  for (const text of Array.isArray(story.paragraphs) ? story.paragraphs : []) {
    const p = document.createElement('p'); p.textContent = text; body.append(p);
  }
  body.hidden = !body.childElementCount;
}).catch(() => { /* The static invitation remains available without story data. */ });
