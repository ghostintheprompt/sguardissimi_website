// article-standardizer.js
// Run with: node article-standardizer.js
// This script standardizes gallery/video frontmatter and tags in all markdown articles.

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const ARTICLES_DIR = path.join(__dirname, 'articles');

function standardizeArticle(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = matter(raw);
  let changed = false;

  // Standardize gallery
  if (parsed.data.gallery) {
    parsed.data.gallery = parsed.data.gallery.map((gallery, i) => {
      if (!gallery.title) gallery.title = `Gallery ${i+1}`;
      if (Array.isArray(gallery.images)) {
        gallery.images = gallery.images.map((img, j) => {
          if (typeof img === 'string') {
            img = { url: img, alt: `Gallery ${i+1} Image ${j+1}` };
            changed = true;
          } else {
            if (!img.alt) {
              img.alt = `Gallery ${i+1} Image ${j+1}`;
              changed = true;
            }
          }
          return img;
        });
      }
      return gallery;
    });
  }

  // Standardize video
  if (parsed.data.video) {
    parsed.data.video = parsed.data.video.map((video, i) => {
      if (!video.title) video.title = `Video ${i+1}`;
      if (Array.isArray(video.sources)) {
        video.sources = video.sources.map((src, j) => {
          if (typeof src === 'string') {
            src = { url: src, type: 'video/mp4' };
            changed = true;
          } else {
            if (!src.type) {
              src.type = 'video/mp4';
              changed = true;
            }
          }
          return src;
        });
      }
      return video;
    });
  }

  // Standardize tags in body
  let body = parsed.content;
  // Replace duplicate or out-of-order tags
  if (parsed.data.gallery) {
    parsed.data.gallery.forEach((_, i) => {
      const regex = new RegExp(`\\[GALLERY:[^\\]]*\\]`, 'g');
      body = body.replace(regex, (match, idx) => `[GALLERY:${i}]`);
    });
    changed = true;
  }
  if (parsed.data.video) {
    parsed.data.video.forEach((_, i) => {
      const regex = new RegExp(`\\[VIDEO:[^\\]]*\\]`, 'g');
      body = body.replace(regex, (match, idx) => `[VIDEO:${i}]`);
    });
    changed = true;
  }

  if (changed) {
    const newRaw = matter.stringify(body, parsed.data);
    fs.writeFileSync(filePath, newRaw, 'utf8');
    console.log(`Standardized: ${filePath}`);
  }
}

fs.readdirSync(ARTICLES_DIR).forEach(file => {
  if (file.endsWith('.md')) {
    standardizeArticle(path.join(ARTICLES_DIR, file));
  }
});

console.log('Standardization complete.');
