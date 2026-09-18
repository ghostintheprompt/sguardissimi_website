// Sguardissimi - Pro Article Renderer
// Clean, scalable, and matches editorial CSS
// Handles drop caps, pull quotes, galleries, videos, and meta info

// Utility: Wrap first paragraph with drop cap
function applyDropCap(html) {
  return html.replace(/<p>([\s\S]*?)<\/p>/, '<p class="drop-cap">$1</p>');
}

// Utility: Wrap blockquotes as pull quotes
function stylePullQuotes(html) {
  return html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, '<blockquote class="pull-quote">$1</blockquote>');
}

// Utility: Wrap gallery blocks
function wrapGalleries(html) {
  return html.replace(/<div class="gallery">([\s\S]*?)<\/div>/g, '<div class="gallery-wrapper">$1</div>');
}

// Utility: Style gallery images and captions
function styleGalleryImages(html) {
  html = html.replace(/<img([^>]*)class="gallery-image"([^>]*)>/g, '<img$1 class="gallery-image"$2>');
  html = html.replace(/<figcaption([^>]*)>/g, '<div class="gallery-caption"$1>');
  html = html.replace(/<\/figcaption>/g, '</div>');
  return html;
}

// Utility: Wrap videos
function wrapVideos(html) {
  return html.replace(/<video([^>]*)>([\s\S]*?)<\/video>/g, '<div class="video-wrapper"><video class="video-frame"$1>$2</video></div>');
}

// Utility: Add gold accent to highlights
function styleGoldAccents(html) {
  return html.replace(/<mark>([\s\S]*?)<\/mark>/g, '<span class="gold-accent">$1</span>');
}

// Utility: Add meta info block
function addMetaInfo(attributes) {
  let meta = '';
  // Always use Michael d Subrizi as author
  meta += '<div class="article-meta">Michael d Subrizi';
  if (attributes.photographer) meta += ` &nbsp;Photography by ${attributes.photographer}`;
  if (attributes.date) meta += ` &nbsp;${attributes.date}`;
  meta += '</div>';
  return meta;
}

// Utility: Render CR grid card
function renderCRCard(article, size = 'cr-medium') {
  // Use real assets only: videoPreview if provided, or main image as fallback
  let previewImage = article.videoPreview || article.image || 'images/default-video-cover.jpg';
  
  return `
    <div class="cr-card ${size}">
      <img src="${previewImage}" alt="${article.title}" class="video-preview-fullbleed" />
      <div class="cr-card-text">
        <h2>${article.title}</h2>
        <p>${article.category} • ${article.date}</p>
      </div>
    </div>
  `;
}

// Utility: Render hero overlay
function renderHeroOverlay(article) {
  // Use real assets only: videoPreview if provided, or main image as fallback
  let previewImage = article.videoPreview || article.image || 'images/default-video-cover.jpg';
  
  return `
    <div class="hero-image-overlay">
      <img src="${previewImage}" alt="${article.title}" class="hero-full-bleed video-preview-fullbleed" />
      <div class="hero-overlay-text">
        <h1 class="hero-title">${article.title}</h1>
        <p class="hero-summary">${article.summary}</p>
        <span class="hero-meta">${article.category} • ${article.date}</span>
      </div>
    </div>
  `;
}

// Main render function
function renderArticle({ title, excerpt, body, ...attributes }) {
  let html = marked.parse(body || '');
  html = applyDropCap(html);
  html = stylePullQuotes(html);
  html = wrapGalleries(html);
  html = styleGalleryImages(html);
  html = wrapVideos(html);
  html = styleGoldAccents(html);

  let meta = addMetaInfo(attributes);
  let articleHtml = `
    <h1 class="article-title">${title || ''}</h1>
    ${meta}
    <div class="article-body">${html}</div>
  `;
  if (excerpt) {
    articleHtml = `<div class="featured-excerpt">${excerpt}</div>` + articleHtml;
  }
  return articleHtml;
}

// Main render function for homepage grid
function renderCRGrid(articles) {
  // Assume articles[0] is hero, next 2 are medium, next 2 are small
  let html = '';
  if (articles[0]) html += renderHeroOverlay(articles[0]);
  html += '<section class="cr-grid">';
  if (articles[1]) html += renderCRCard(articles[1], 'cr-feature');
  if (articles[2]) html += renderCRCard(articles[2], 'cr-medium');
  if (articles[3]) html += renderCRCard(articles[3], 'cr-medium');
  if (articles[4]) html += renderCRCard(articles[4], 'cr-small');
  if (articles[5]) html += renderCRCard(articles[5], 'cr-small');
  html += '</section>';
  return html;
}

// Expose for global use
window.renderArticle = renderArticle;
window.renderCRGrid = renderCRGrid;
