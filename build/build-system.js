'use strict';

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');
const fse = require('fs-extra');

const ARTICLES_DIR = path.join(__dirname, '../articles');
const METADATA_PATH = path.join(__dirname, '../articles-metadata.json');
const DIST_DIR = path.join(__dirname, '../dist/articles');
const DESIGNER_LINKS_PATH = path.join(__dirname, '../designer-links.json');

// og:image and twitter:image must be absolute — a locally-hosted cover comes
// through as "/img/..." and no scraper can resolve a root-relative path.
function absUrl(u) {
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return 'https://sguardissimi.com' + (u.startsWith('/') ? u : '/' + u);
}

// Load designer links
let DESIGNER_LINKS = {};
try {
  DESIGNER_LINKS = JSON.parse(fs.readFileSync(DESIGNER_LINKS_PATH, 'utf8'));
} catch (e) {
  console.warn('⚠️  Designer links file not found, continuing without designer links');
}

class ArticleBuildSystem {
  constructor() {
    this.articles = [];
    this.metadata = [];
    this.buildVersion = Date.now(); // Cache-busting timestamp
    this.buildReport = {
      totalArticles: 0,
      articlesWithGallery: 0,
      articlesWithVideo: 0,
      totalImages: 0,
      totalVideos: 0,
      warnings: [],
      errors: [],
      processedFiles: [],
      articleStats: {}
    };
  }

  // Extract designer slug from article slug
  extractDesignerSlug(articleSlug) {
    // Remove date suffix (e.g., "-2025-06-28")
    const withoutDate = articleSlug.replace(/-\d{4}-\d{2}-\d{2}$/, '');
    
    // Manual mappings for special cases
    const manualMappings = {
      'dans-le-ventre-de-la-bete-fashion-weeks-secret-heart': null, // Not a designer article
      'the-beauty-dynasty-how-5-artists-shaped-a-generation-of-runway-looks': null, // Multi-artist
      'kabuki': null, // Makeup artist, not designer
      'anna-sui-the-downtown-alchemist-who-never-sold-out': 'anna-sui',
      'michi-in-khaite-jeans': 'khaite',
      'rebecca-in-jacquemus': 'jacquemus',
      'dennis-basso-agata': 'dennis-basso',
      'tory-burch-and-shiseido': 'tory-burch',
      'the-blonds-family': 'the-blonds',
      'the-zimmermann-seduction': 'zimmermann',
      'simkhai-hamptons-chronicles': 'simkhai',
      'jil-sander-minimalism': 'jil-sander',
      'serafini-philosophy-aw19': 'serafini',
      'manuel-facchini-byblos-milano-veramente': 'byblos',
      'enaura-at-the-plaza-for-bridal-week-nyc': 'enaura',
      'pyer-moss-american-also-2018': 'pyer-moss',
      'phillip-lim-3-1-nyfw-fall-2019': '3.1-phillip-lim'
    };
    
    // Check manual mappings first
    if (withoutDate in manualMappings) {
      return manualMappings[withoutDate];
    }
    
    // Designer name patterns - try to extract designer name before location/season/type
    const locationSeasonPatterns = [
      'paris', 'milan', 'nyfw', 'new-york', 'london', 'berlin',
      'spring', 'autumn', 'fall', 'winter', 'ss', 'aw', 'fw',
      'bridal', 'profile', 'street-story', 'feature', 'article'
    ];
    
    // Build regex pattern to match any of the above
    const pattern = new RegExp(`^([a-z0-9-]+?)-(${locationSeasonPatterns.join('|')})`);
    const match = withoutDate.match(pattern);
    
    if (match) {
      const designerSlug = match[1];
      // Check if it exists in our designer links
      if (DESIGNER_LINKS[designerSlug]) {
        return designerSlug;
      }
    }
    
    // Check if the slug directly matches a designer key
    if (DESIGNER_LINKS[withoutDate]) {
      return withoutDate;
    }
    
    // No match found
    return null;
  }

  readMarkdownFiles() {
    return fs.readdirSync(ARTICLES_DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => path.join(ARTICLES_DIR, f));
  }

  validateFrontmatter(frontmatter, file, rawContent) {
    const errors = [];
    const warnings = [];
    
    // Required for all articles
    const requiredFields = ['title', 'date', 'categories', 'author', 'word_count', 'reading_time'];
    requiredFields.forEach(field => {
      if (!frontmatter[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    });

    // Optional but recommended fields
    const recommendedFields = ['excerpt', 'featured', 'photographer'];
    recommendedFields.forEach(field => {
      if (frontmatter[field] === undefined || frontmatter[field] === null) {
        warnings.push(`Missing recommended field: ${field}`);
      }
    });

    // Validate media content
    const hasGalleryContent = this.validateGalleryContent(frontmatter, warnings);
    const hasVideoContent = this.validateVideoContent(frontmatter, rawContent, warnings);

    // At least one type of content is required
    if (!hasGalleryContent && !hasVideoContent && !rawContent.trim()) {
      errors.push('Article must contain either gallery, video, or written content');
    }

    // Update template type based on content
    frontmatter.hasGallery = hasGalleryContent;
    frontmatter.hasVideo = hasVideoContent;

    if (warnings.length > 0) {
      console.log(`\nWarnings in ${path.basename(file)}:`);
      warnings.forEach(warn => {
        console.log(`- ${warn}`);
        this.buildReport.warnings.push(`${path.basename(file)}: ${warn}`);
      });
    }

    if (errors.length > 0) {
      console.error(`\nValidation errors in ${path.basename(file)}:`);
      errors.forEach(err => console.error(`- ${err}`));
      this.buildReport.errors.push(`${path.basename(file)}: ${errors.join(', ')}`);
      process.exit(1);
    }
  }

  validateGalleryContent(frontmatter, warnings) {
    let hasGalleryContent = false;

    // Check for hero shots
    if (frontmatter.hero_shots) {
      hasGalleryContent = true;
      if (Array.isArray(frontmatter.hero_shots)) {
        frontmatter.hero_shots.forEach((shot, i) => {
          if (typeof shot === 'string') {
            // Convert string URLs to proper object format
            frontmatter.hero_shots[i] = {
              url: shot,
              alt: `Immagine hero ${i + 1}`
            };
          } else if (!shot.url) {
            warnings.push(`Hero shot ${i + 1} missing url`);
          }
        });
      }
    }

    // Check for gallery sections
    if (frontmatter.gallery) {
      hasGalleryContent = true;
      if (Array.isArray(frontmatter.gallery)) {
        frontmatter.gallery.forEach((section, i) => {
          if (!section || typeof section !== 'object') {
            warnings.push(`Gallery section ${i + 1} is not a valid object`);
          } else {
            if (!section.title) {
              warnings.push(`Gallery section ${i + 1} missing title`);
            }
            if (section.images) {
              section.images = section.images.map((img, j) => {
                if (typeof img === 'string') {
                  return {
                    url: img,
                    alt: `${section.title || 'Galleria'} immagine ${j + 1}`
                  };
                }
                return img;
              });
            }
          }
        });
      }
    }

    return hasGalleryContent;
  }

  validateVideoContent(frontmatter, rawContent, warnings) {
    let hasVideoContent = false;
    
    // Check frontmatter video entries
    if (frontmatter.video_url) {
      hasVideoContent = true;
      frontmatter.videos = [{ url: frontmatter.video_url }];
    }

    if (frontmatter.videos && Array.isArray(frontmatter.videos)) {
      hasVideoContent = true;
      frontmatter.videos.forEach((video, i) => {
        if (!video.url) {
          warnings.push(`Video ${i + 1} missing url`);
        }
      });
    }

    // Check for singular 'video' field (common in gallery-video templates)
    if (frontmatter.video) {
      hasVideoContent = true;
      // Validate video field structure
      if (Array.isArray(frontmatter.video)) {
        frontmatter.video.forEach((video, i) => {
          if (!video.url) {
            warnings.push(`Video ${i + 1} missing url`);
          }
        });
      } else if (typeof frontmatter.video === 'string') {
        // Video field is a string URL, no validation needed
      }
    }

    // Check content for embedded videos
    const iframeMatches = rawContent.match(/<iframe[^>]*src="([^"]+)"[^>]*>/g) || [];
    const videoMatches = rawContent.match(/<video[^>]*src="([^"]+)"[^>]*>/g) || [];
    const videoMarkers = rawContent.match(/\[VIDEO\]/g) || [];
    const videoEmbeds = rawContent.match(/<div[^>]*class="video-embed"[^>]*>/g) || [];
    
    if (iframeMatches.length > 0 || videoMatches.length > 0 || videoMarkers.length > 0 || videoEmbeds.length > 0) {
      hasVideoContent = true;
    }

    return hasVideoContent;
  }

  validateContent(content, meta, file) {
    if (meta.hasGallery) {
      const galleryMarkers = (content.match(/\[GALLERY:\d+\]/g) || []);
      const numSections = meta.gallery?.length || 0;
      
      if (galleryMarkers.length === 0 && numSections > 0) {
        this.buildReport.warnings.push(`${meta.slug}: Gallery sections exist but no gallery markers found in content`);
      }
      
      galleryMarkers.forEach(marker => {
        const sectionNum = parseInt(marker.match(/\d+/)[0]);
        if (sectionNum > numSections) {
          this.buildReport.warnings.push(
            `${meta.slug}: Gallery marker ${marker} references non-existent section`
          );
        }
      });
    }
  }

  collectArticleStats(meta) {
    const stats = this.buildReport.articleStats[meta.slug] = {
      hasGallery: meta.hasGallery,
      hasVideo: meta.hasVideo,
      wordCount: meta.word_count || 0,
      imagesCount: 0,
      videosCount: 0,
      sections: 0
    };

    if (meta.hasGallery) {
      stats.imagesCount += meta.hero_shots?.length || 0;
      meta.gallery?.forEach(section => {
        stats.sections++;
        stats.imagesCount += section.images?.length || 0;
      });
      this.buildReport.totalImages += stats.imagesCount;
      this.buildReport.articlesWithGallery++;
    }

    if (meta.hasVideo) {
      // Count videos from frontmatter - check both 'video' and 'videos'
      let videoCount = 0;
      if (meta.video) {
        videoCount += Array.isArray(meta.video) ? meta.video.length : 1;
      }
      if (meta.videos && Array.isArray(meta.videos)) {
        videoCount += meta.videos.length;
      }
      
      // Count embedded videos in content
      const content = meta.body || '';
      const iframeCount = (content.match(/<iframe[^>]*src=/g) || []).length;
      const videoTagCount = (content.match(/<video[^>]*src=/g) || []).length;
      const videoMarkerCount = (content.match(/\[VIDEO\]/g) || []).length;
      const videoEmbedCount = (content.match(/<div[^>]*class="video-embed"[^>]*>/g) || []).length;
      
      stats.videosCount = videoCount + iframeCount + videoTagCount + videoMarkerCount + videoEmbedCount;
      this.buildReport.totalVideos += stats.videosCount;
      this.buildReport.articlesWithVideo++;
    }

    this.buildReport.totalArticles++;
  }

  // --- Editorial Markup Utilities ---
  applyDropCap(html) {
    return html.replace(/<p>([\s\S]*?)<\/p>/, '<p class="drop-cap">$1</p>');
  }

  stylePullQuotes(html) {
    return html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, '<blockquote class="pull-quote">$1</blockquote>');
  }

  wrapGalleries(html) {
    return html.replace(/<div class="gallery">([\s\S]*?)<\/div>/g, '<div class="gallery-wrapper">$1</div>');
  }

  styleGalleryImages(html) {
    html = html.replace(/<img([^>]*)class="gallery-image"([^>]*)>/g, '<img$1 class="gallery-image"$2>');
    html = html.replace(/<figcaption([^>]*)>/g, '<div class="gallery-caption"$1>');
    html = html.replace(/<\/figcaption>/g, '</div>');
    return html;
  }

  styleGoldAccents(html) {
    return html.replace(/<mark>([\s\S]*?)<\/mark>/g, '<span class="gold-accent">$1</span>');
  }

  localizeCategory(category) {
    const categoryMap = {
      'high-fashion-and-culture': 'alta moda e cultura',
      'global-chaos-and-innovation': 'caos globale e innovazione',
      'resistance-rebellion-and-icons': 'resistenza, ribellione e icone',
      'technical-insight': 'sguardo tecnico'
    };

    if (categoryMap[category]) return categoryMap[category];
    return category.replace(/-/g, ' ');
  }

  addMetaInfo(meta) {
    // Keep the archive Italian-first at the article level too.
    return '<div class="article-meta">Fotografato e scritto da Michael d Subrizi</div>';
  }

  renderDesignerLinks(designerInfo) {
    if (!designerInfo) return '';
    
    const links = [];
    
    if (designerInfo.officialSite) {
      links.push(`<a href="${designerInfo.officialSite}" target="_blank" rel="noopener noreferrer" class="designer-link official">
        Sito ufficiale
      </a>`);
    }
    
    if (designerInfo.ssense) {
      links.push(`<a href="${designerInfo.ssense}" target="_blank" rel="noopener noreferrer" class="designer-link ssense">
        Acquista su SSENSE
      </a>`);
    }
    
    if (designerInfo.farfetch) {
      links.push(`<a href="${designerInfo.farfetch}" target="_blank" rel="noopener noreferrer" class="designer-link farfetch">
        Acquista su Farfetch
      </a>`);
    }
    
    // Resale and rental (Poshmark, Rent the Runway) are deliberately not rendered.
    // These pages get sent to the house's own press office; secondhand and rental
    // links under their runway read as an affiliate blog, and there is no affiliate
    // revenue here to trade for it. Official site and stockists only.
    
    if (links.length === 0) return '';
    
    return `
      <div class="designer-links-section">
        <h3 class="designer-links-title">Dove trovare ${designerInfo.name}</h3>
        <div class="designer-links-grid">
          ${links.join('')}
        </div>
      </div>
    `;
  }

  replaceVideoTags(content, meta) {
    if (content.includes('[VIDEO')) {
      console.log('DEBUG: meta.video=', !!meta.video, 'meta.videos=', !!meta.videos, 'video value:', meta.video ? (Array.isArray(meta.video) ? 'array['+meta.video.length+']' : typeof meta.video) : 'none');
    }
    if (!meta.video && (!meta.videos || meta.videos.length === 0)) return content;
    
    // Support multiple video field formats:
    // 1. video: "url-string"
    // 2. video: [{ title, url }]
    // 3. videos: [{ url }]
    let videoUrl;
    if (meta.video) {
      if (typeof meta.video === 'string') {
        videoUrl = meta.video;
      } else if (Array.isArray(meta.video) && meta.video[0]) {
        videoUrl = meta.video[0].url;
      }
    } else if (meta.videos && meta.videos[0]) {
      videoUrl = meta.videos[0].url;
    }
    
    if (!videoUrl) return content;

    // Same source used for og:image/twitter:image, so the video's poster
    // frame matches the cover photo already chosen for the article.
    const posterUrl = absUrl(meta.cover || (meta.hero_shots && meta.hero_shots[0] ? meta.hero_shots[0].url : ''));
    const posterAttr = posterUrl ? ` poster="${posterUrl}"` : '';

    // Replace [VIDEO] or [VIDEO:n] tags where n is any number
    return content.replace(/<p>\[VIDEO(?::\d+)?\]<\/p>|\[VIDEO(?::\d+)?\]/g, () => {
      return `<div class="video-wrapper">
  <video class="video-frame" controls preload="metadata"${posterAttr}>
    <source src="${videoUrl}" type="video/mp4">
    Il tuo browser non supporta il tag video.
  </video>
</div>`;
    });
  }

  replaceGalleryTags(content, meta) {
    if (!meta.gallery || meta.gallery.length === 0) return content;
    
    // Replace [GALLERY:n] tags with actual gallery HTML
    return content.replace(/<p>\[GALLERY:(\d+)\]<\/p>|\[GALLERY:(\d+)\]/g, (match, index1, index2) => {
      const galleryIndex = parseInt(index1 || index2);
      if (galleryIndex < 0 || galleryIndex >= meta.gallery.length) return match;
      
      const section = meta.gallery[galleryIndex];
      return `<div class="gallery-wrapper">
  <h2 class="gallery-section-title">${section.title || 'Galleria'}</h2>
  <div class="gallery-grid">
    ${section.images.map((img, i) => {
      // Handle both formats: {url, alt} or just "url-string"
      const imageUrl = typeof img === 'string' ? img : img.url;
      // Generated placeholder alts ("Immagine di galleria") say nothing to a reader
      // or to a press office reading the page. Fall back to house + look number.
      const fallbackAlt = `${section.title || 'Galleria'} \u2014 look ${i + 1}`;
      const rawAlt = typeof img === 'string' ? '' : (img.alt || '');
      const imageAlt = (!rawAlt || /^immagine di galleria$/i.test(rawAlt.trim())) ? fallbackAlt : rawAlt;
      // Runway galleries run 45\u2013120 frames of ~900 KB masters. Eager on all of
      // them is 60\u2013100 MB on open, which is the difference between a press office
      // seeing the show and closing the tab. Two eager, the rest on demand.
      const eager = i < 2;
      return `<div class="gallery-image">
        <img 
          src="${imageUrl}" 
          alt="${imageAlt}" 
          loading="${eager ? 'eager' : 'lazy'}"
          decoding="async"
        >
      </div>`;
    }).join('')}
  </div>
</div>`;
    });
  }

  renderArticleHTML(meta, content, slug) {
    // Replace gallery and video tags BEFORE markdown processing to avoid escaping
    content = this.replaceVideoTags(content, meta);
    content = this.replaceGalleryTags(content, meta);
    
    // Render markdown after tag replacement
    let html = marked.parse(content || '');
    
    // Apply editorial styles
    html = this.applyDropCap(html);
    html = this.stylePullQuotes(html);
    html = this.wrapGalleries(html);
    html = this.styleGalleryImages(html);
    html = this.styleGoldAccents(html);

    // Category tags
    const categoryTags = Array.isArray(meta.categories) && meta.categories.length 
      ? `<div class="article-categories">${meta.categories.map(cat => 
          `<span class="category-tag">${this.localizeCategory(cat)}</span>`).join('')}</div>` 
      : '';

    // Hero shots, videos, and galleries are all controlled via [GALLERY:n] and [VIDEO:n] tags in content
    // No automatic injection - author controls exact placement
    // EXCEPTION: For "image" template, auto-inject cover as hero image
    let heroSection = '';
    if (meta.template === 'image' && meta.cover) {
      heroSection = `
    <div class="article-hero-image">
      <img src="${meta.cover}" alt="${meta.title}" class="cover-image" />
    </div>`;
    }
    const videoSection = '';
    const gallerySection = '';

    // Meta info
    const metaInfo = this.addMetaInfo(meta);

    // Designer links
    const designerLinks = this.renderDesignerLinks(meta.designerLinks);

    // Extract first paragraph for intro (before hero)
    let introText = '';
    let remainingContent = html;

    if (html.trim()) {
      const firstParagraphMatch = html.match(/(<p[^>]*>.*?<\/p>)/s);
      if (firstParagraphMatch) {
        introText = firstParagraphMatch[1];
        // Preserve content before the first paragraph (e.g., galleries, videos)
        const beforeIntro = html.substring(0, firstParagraphMatch.index);
        const afterIntro = html.substring(firstParagraphMatch.index + firstParagraphMatch[0].length);
        remainingContent = beforeIntro + afterIntro;
      }
    }

    return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="p:domain_verify" content="7921556c3b5e2ce6196ecf05a4ec14fc"/>
  <title>${meta.title}</title>
  <meta name="description" content="${meta.excerpt ? meta.excerpt.replace(/"/g, '&quot;').substring(0, 155) : ''}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://sguardissimi.com/articles/${slug}/">
  <meta property="og:title" content="${meta.title}">
  <meta property="og:description" content="${meta.excerpt ? meta.excerpt.replace(/"/g, '&quot;') : ''}">
  <meta property="og:image" content="${absUrl(meta.cover || (meta.hero_shots && meta.hero_shots[0] ? meta.hero_shots[0].url : ''))}">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="https://sguardissimi.com/articles/${slug}/">
  <meta name="twitter:title" content="${meta.title}">
  <meta name="twitter:description" content="${meta.excerpt ? meta.excerpt.replace(/"/g, '&quot;') : ''}">
  <meta name="twitter:image" content="${absUrl(meta.cover || (meta.hero_shots && meta.hero_shots[0] ? meta.hero_shots[0].url : ''))}">

  <!-- Pinterest (for when others share) -->
  <meta name="pinterest-rich-pin" content="true">
  <meta property="og:see_also" content="https://sguardissimi.com">

  <!-- Article metadata -->
  <meta property="article:published_time" content="${meta.date}">
  <meta property="article:author" content="${meta.author}">

  <link rel="stylesheet" href="/css/styles.css?v=${this.buildVersion}">
</head>
<body>
  <nav class="article-nav">
    <a href="/" class="back-home">← Sguardissimi</a>
  </nav>
  <article class="fashion-article ${meta.template}-template">
    <div class="article-header">
      <h1 class="article-title">${meta.title}</h1>
      ${metaInfo}
      ${categoryTags}
    </div>
    ${introText ? `<div class="article-intro">${introText}</div>` : ''}
    ${heroSection}
    ${videoSection}
    <div class="article-body">
      ${remainingContent}
    </div>
    ${designerLinks}
    ${gallerySection}
    
    <!-- Share Section -->
    <div class="article-share">
      <h3>Copia questo link</h3>
      <div class="share-buttons">
        <button class="share-btn" onclick="copyLink()" title="Copia link">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
          </svg>
          <span>Copia link</span>
        </button>
      </div>
      <div class="copy-notification" id="copyNotification">Link copiato.</div>
    </div>
  </article>

  <!-- Lightbox Modal -->
  <div class="lightbox" id="lightbox">
    <div class="lightbox-controls">
      <button class="lightbox-fullscreen" onclick="toggleFullscreen()" title="Schermo intero (F)">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
        </svg>
      </button>
      <button class="lightbox-close" onclick="closeLightbox()" title="Chiudi (Esc)">&times;</button>
    </div>
    <button class="lightbox-nav lightbox-prev" onclick="changeImage(-1)">&#8249;</button>
    <button class="lightbox-nav lightbox-next" onclick="changeImage(1)">&#8250;</button>
    <div class="lightbox-content">
      <img class="lightbox-image" id="lightbox-img" src="" alt="">
    </div>
    <div class="lightbox-counter" id="lightbox-counter"></div>
    <div class="lightbox-caption" id="lightbox-caption"></div>
    <div class="lightbox-thumbnails" id="lightbox-thumbnails"></div>
  </div>

  <script>
    let currentImageIndex = 0;
    let galleryImages = [];

    // Collect all gallery images
    document.addEventListener('DOMContentLoaded', function() {
      const images = document.querySelectorAll('.gallery-image img, .gallery-wrapper img');
      galleryImages = Array.from(images);
      
      galleryImages.forEach((img, index) => {
        img.parentElement.addEventListener('click', function() {
          openLightbox(index);
        });
      });
    });

    function renderThumbnails() {
      const thumbnailsContainer = document.getElementById('lightbox-thumbnails');
      thumbnailsContainer.innerHTML = galleryImages.map((img, index) => {
        const activeClass = index === currentImageIndex ? 'active' : '';
        return '<div class="lightbox-thumbnail ' + activeClass + '" onclick="jumpToImage(' + index + ')">' +
               '<img src="' + img.src + '" alt="' + img.alt + '">' +
               '</div>';
      }).join('');
      
      // Scroll active thumbnail into view
      setTimeout(() => {
        const activeThumbnail = thumbnailsContainer.querySelector('.lightbox-thumbnail.active');
        if (activeThumbnail) {
          activeThumbnail.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      }, 100);
    }

    function jumpToImage(index) {
      currentImageIndex = index;
      updateLightboxImage();
      renderThumbnails();
    }

    function updateLightboxImage() {
      const lightboxImg = document.getElementById('lightbox-img');
      const counter = document.getElementById('lightbox-counter');
      const caption = document.getElementById('lightbox-caption');
      
      lightboxImg.style.opacity = '0';
      
      setTimeout(() => {
        lightboxImg.src = galleryImages[currentImageIndex].src;
        lightboxImg.alt = galleryImages[currentImageIndex].alt;
        counter.textContent = (currentImageIndex + 1) + ' / ' + galleryImages.length;
        caption.textContent = galleryImages[currentImageIndex].alt || '';
        lightboxImg.style.opacity = '1';
      }, 150);
    }

    function openLightbox(index) {
      currentImageIndex = index;
      const lightbox = document.getElementById('lightbox');
      const lightboxImg = document.getElementById('lightbox-img');
      const counter = document.getElementById('lightbox-counter');
      
      lightboxImg.src = galleryImages[currentImageIndex].src;
      lightboxImg.alt = galleryImages[currentImageIndex].alt;
      counter.textContent = (currentImageIndex + 1) + ' / ' + galleryImages.length;
      
      renderThumbnails();
      
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      const lightbox = document.getElementById('lightbox');
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
    }

    function changeImage(direction) {
      currentImageIndex += direction;
      
      if (currentImageIndex >= galleryImages.length) {
        currentImageIndex = 0;
      } else if (currentImageIndex < 0) {
        currentImageIndex = galleryImages.length - 1;
      }
      
      updateLightboxImage();
      renderThumbnails();
    }

    // Fullscreen toggle
    function toggleFullscreen() {
      const lightbox = document.getElementById('lightbox');
      
      if (!document.fullscreenElement) {
        lightbox.requestFullscreen().catch(err => {
          console.log('Fullscreen error:', err);
        });
      } else {
        document.exitFullscreen();
      }
    }

    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
      const lightbox = document.getElementById('lightbox');
      if (!lightbox.classList.contains('active')) return;
      
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') changeImage(-1);
      if (e.key === 'ArrowRight') changeImage(1);
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    });

    // Close on background click
    document.getElementById('lightbox').addEventListener('click', function(e) {
      if (e.target === this) closeLightbox();
    });

    // Advanced Lazy Loading with Intersection Observer
    (function initLazyLoading() {
      // Only use IntersectionObserver if browser supports it
      if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const img = entry.target;
              
              // Load the image immediately without opacity effects
              if (img.dataset.src) {
                img.src = img.dataset.src;
              }
              
              img.onload = function() {
                img.classList.add('loaded');
              };
              
              // Stop observing this image
              observer.unobserve(img);
            }
          });
        }, {
          rootMargin: '50px 0px', // Start loading 50px before image enters viewport
          threshold: 0.01
        });

        // Observe all images in galleries
        const lazyImages = document.querySelectorAll('.gallery-image img, .hero-image img');
        lazyImages.forEach(img => {
          // Images load eagerly, just ensure they're visible
          if (!img.hasAttribute('data-src') && img.hasAttribute('src')) {
            // Image already has src, make sure it's visible when loaded
            if (img.complete) {
              img.style.opacity = '1';
            } else {
              img.onload = function() {
                img.style.opacity = '1';
              };
            }
          } else if (img.hasAttribute('data-src')) {
            imageObserver.observe(img);
          }
        });
      }
    })();

    // Share functionality
    function copyLink() {
      const url = window.location.href;
      navigator.clipboard.writeText(url).then(() => {
        const notification = document.getElementById('copyNotification');
        notification.classList.add('show');
        setTimeout(() => {
          notification.classList.remove('show');
        }, 2000);
      });
    }

    // Performance monitoring
    if (window.PerformanceObserver) {
      const perfObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'largest-contentful-paint') {
            const lcp = entry.renderTime || entry.loadTime;
            console.log('LCP:', lcp, 'ms');
          }
        }
      });
      
      try {
        perfObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        // Browser doesn't support LCP monitoring
      }
    }
  </script>
  <!-- WebMCP: AI Agent Tools -->
  <script>
    if (window.navigator && window.navigator.modelContext) {
      window.navigator.modelContext.provideContext({
        tools: [
          {
            name: "list_articles",
            description: "Returns a list of all fashion articles in the archive with their titles, slugs, and excerpts.",
            inputSchema: {
              type: "object",
              properties: {
                limit: { type: "number", description: "Maximum number of articles to return" },
                category: { type: "string", description: "Filter by category" }
              }
            },
            execute: async ({ limit, category }) => {
              const response = await fetch('/articles-metadata.json');
              let articles = await response.json();
              if (category) articles = articles.filter(a => a.categories.includes(category));
              if (limit) articles = articles.slice(0, limit);
              return { articles: articles.map(a => ({ title: a.title, slug: a.slug, excerpt: a.excerpt })) };
            }
          },
          {
            name: "get_article",
            description: "Returns the full content of a specific article by its slug.",
            inputSchema: {
              type: "object",
              properties: { slug: { type: "string", description: "The slug of the article to retrieve" } },
              required: ["slug"]
            },
            execute: async ({ slug }) => {
              const response = await fetch('/articles-metadata.json');
              const articles = await response.json();
              const article = articles.find(a => a.slug === slug);
              return article ? { article } : { error: "Article not found" };
            }
          }
        ]
      });
    }
  </script>
</body>
</html>`;
  }

  processArticles() {
    const files = this.readMarkdownFiles();
    console.log(`📝 Processing ${files.length} articles...`);
    
    for (const file of files) {
      const slug = path.basename(file, '.md');
      console.log(`\nProcessing: ${slug}`);
      
      try {
        const raw = fs.readFileSync(file, 'utf8');
        const { data: frontmatter, content } = matter(raw);
        
        // Check for malformed YAML - if content contains YAML-like structures, frontmatter likely closed early
        const yamlPatternInContent = /^[ ]{2,}- url:|^[ ]{2,}url:|^[ ]{2,}alt:|^gallery:|^videos:/m;
        if (yamlPatternInContent.test(content)) {
          throw new Error(`Malformed YAML frontmatter detected - content contains YAML structures. Check that frontmatter closing '---' is in the correct position.`);
        }
        
        // Detect content types and validate
        const hasGallery = this.validateGalleryContent(frontmatter, []);
        const hasVideo = this.validateVideoContent(frontmatter, raw, []);
        
        this.validateFrontmatter(frontmatter, file, raw);
        
        // Extract designer information
        const designerSlug = this.extractDesignerSlug(slug);
        const designerInfo = DESIGNER_LINKS[designerSlug] || null;
        
        const meta = {
          slug,
          title: frontmatter.title,
          excerpt: frontmatter.excerpt || '',
          cover: frontmatter.cover || '',
          template: frontmatter.template,
          hasGallery,
          hasVideo,
          author: frontmatter.author,
          categories: frontmatter.categories,
          date: frontmatter.date,
          word_count: frontmatter.word_count || 0,
          reading_time: frontmatter.reading_time || '',
          featured: !!frontmatter.featured,
          designer: designerSlug,
          designerLinks: designerInfo,
          body: content,
        };

        // Process gallery content if present
        if (hasGallery) {
          meta.photographer = frontmatter.photographer || '';
          meta.hero_shots = frontmatter.hero_shots || [];
          meta.gallery = frontmatter.gallery || [];
          
          // Normalize hero shots format
          meta.hero_shots = meta.hero_shots.map((shot, i) => {
            if (typeof shot === 'string') {
              return { url: shot, alt: `Immagine hero ${i + 1}` };
            }
            return shot;
          });
          
          // Normalize gallery sections
          meta.gallery = meta.gallery.map((section, i) => {
            if (!section.images) return section;
            section.images = section.images.map((img, j) => {
              if (typeof img === 'string') {
                return {
                  url: img,
                  alt: `${section.title || 'Gallery'} image ${j + 1}`
                };
              }
              return img;
            });
            return section;
          });
          
          // Auto-generate cover from first gallery image if no cover is set
          if (!meta.cover && meta.gallery.length > 0 && meta.gallery[0].images && meta.gallery[0].images.length > 0) {
            meta.cover = meta.gallery[0].images[0].url;
          }
        }

        // Process video content if present
        if (hasVideo) {
          console.log('DEBUG hasVideo true, frontmatter.video=', !!frontmatter.video, 'type=', typeof frontmatter.video);
          meta.video = frontmatter.video; // Support singular 'video' field
          meta.videos = frontmatter.videos || [];
          meta.video_url = frontmatter.video_url || '';
          
          // Extract video URLs from content if not in frontmatter
          const iframeMatches = content.match(/<iframe[^>]*src="([^"]+)"[^>]*>/g) || [];
          const videoMatches = content.match(/<video[^>]*src="([^"]+)"[^>]*>/g) || [];
          
          const embedUrls = [
            ...iframeMatches.map(m => m.match(/src="([^"]+)"/)[1]),
            ...videoMatches.map(m => m.match(/src="([^"]+)"/)[1])
          ];
          
          if (embedUrls.length > 0) {
            meta.embeddedVideos = embedUrls;
          }
        }
        
        this.validateContent(content, meta, file);
        this.collectArticleStats(meta);
        
        this.metadata.push(meta);
        
        const html = this.renderArticleHTML(meta, content, slug);
        const outDir = path.join(DIST_DIR, slug);
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
        
        this.buildReport.processedFiles.push(slug);
        console.log(`✓ ${slug}`);
        
      } catch (error) {
        this.buildReport.errors.push(`Error processing ${slug}: ${error.message}`);
        console.error(`× Error processing ${slug}: ${error.message}`);
      }
    }
  }

  writeMetadata() {
    fs.writeFileSync(METADATA_PATH, JSON.stringify(this.metadata, null, 2), 'utf8');
  }

  generateSitemap() {
    const urls = [
      {
        loc: 'https://sguardissimi.com/',
        priority: '1.0',
        changefreq: 'weekly'
      }
    ];

    // Add all article URLs
    this.metadata.forEach(article => {
      urls.push({
        loc: `https://sguardissimi.com/articles/${article.slug}/`,
        priority: article.featured ? '0.9' : '0.8',
        changefreq: 'monthly',
        lastmod: article.date
      });
    });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod || new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    fs.writeFileSync(path.join(DIST_DIR, '../sitemap.xml'), sitemap, 'utf8');
    console.log('✓ Sitemap generated with', urls.length, 'URLs');
  }

  printBuildReport() {
    console.log('\n📊 Build Report');
    console.log('=============');
    
    // Calculate articles with both types
    let articlesWithBoth = 0;
    Object.values(this.buildReport.articleStats).forEach(stats => {
      if (stats.hasGallery && stats.hasVideo) {
        articlesWithBoth++;
      }
    });
    
    console.log(`Total Articles: ${this.buildReport.totalArticles}`);
    console.log(`├─ With Galleries: ${this.buildReport.articlesWithGallery}`);
    console.log(`├─ With Videos: ${this.buildReport.articlesWithVideo}`);
    console.log(`└─ With Both: ${articlesWithBoth}`);
    
    console.log('\nTotal Media Assets:');
    console.log(`├─ Images: ${this.buildReport.totalImages}`);
    console.log(`└─ Videos: ${this.buildReport.totalVideos}`);

    if (this.buildReport.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.buildReport.warnings.forEach(w => console.log(`- ${w}`));
    }

    if (this.buildReport.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.buildReport.errors.forEach(e => console.log(`- ${e}`));
    }

    console.log('\n📝 Article Details:');
    Object.entries(this.buildReport.articleStats).forEach(([slug, stats]) => {
      console.log(`\n${slug}:`);
      console.log(`├─ Content Types: ${[
        stats.hasGallery ? 'Gallery' : '',
        stats.hasVideo ? 'Video' : '',
        stats.wordCount > 0 ? 'Written' : ''
      ].filter(Boolean).join(', ')}`);
      console.log(`├─ Word Count: ${stats.wordCount}`);
      
      if (stats.hasGallery) {
        console.log(`├─ Gallery Sections: ${stats.sections}`);
        console.log(`├─ Total Images: ${stats.imagesCount}`);
      }
      
      if (stats.hasVideo) {
        console.log(`└─ Total Videos: ${stats.videosCount}`);
      }
    });
  }

  run() {
    console.log('🚀 Starting build process...');
    
    try {
      this.processArticles();
      this.writeMetadata();
      this.generateSitemap();
      
      console.log('📁 Copying static assets...');
      fse.copySync(path.join(__dirname, '../index.html'), path.join(DIST_DIR, '../index.html'));
      fse.copySync(path.join(__dirname, '../css'), path.join(DIST_DIR, '../css'));
      if (fs.existsSync(path.join(__dirname, '../img'))) {
        fse.copySync(path.join(__dirname, '../img'), path.join(DIST_DIR, '../img'));
      }
      fse.copySync(path.join(__dirname, '../articles-metadata.json'), path.join(DIST_DIR, '../articles-metadata.json'));
      
      // Copy .well-known for agent discovery
      if (fs.existsSync(path.join(__dirname, '../.well-known'))) {
        fse.copySync(path.join(__dirname, '../.well-known'), path.join(DIST_DIR, '../.well-known'));
      }

      // Copy original markdown files for agents
      const articlesDistDir = path.join(DIST_DIR, '../articles-md');
      fs.mkdirSync(articlesDistDir, { recursive: true });
      const mdFiles = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.md'));
      mdFiles.forEach(f => {
        fs.copyFileSync(path.join(ARTICLES_DIR, f), path.join(articlesDistDir, f));
      });
      
      // Copy _redirects, robots.txt, and CNAME for Cloudflare Pages
      if (fs.existsSync(path.join(__dirname, '../_redirects'))) {
        fse.copySync(path.join(__dirname, '../_redirects'), path.join(DIST_DIR, '../_redirects'));
      }
      if (fs.existsSync(path.join(__dirname, '../robots.txt'))) {
        fse.copySync(path.join(__dirname, '../robots.txt'), path.join(DIST_DIR, '../robots.txt'));
      }
      if (fs.existsSync(path.join(__dirname, '../CNAME'))) {
        fse.copySync(path.join(__dirname, '../CNAME'), path.join(DIST_DIR, '../CNAME'));
      }
      
      this.buildReport.totalArticles = this.metadata.length;
      this.printBuildReport();
      
      console.log('\n✅ Build completed successfully!');
    } catch (error) {
      console.error('\n❌ Build failed:', error.message);
      this.buildReport.errors.push(error.message);
      this.printBuildReport();
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  new ArticleBuildSystem().run();
}

module.exports = ArticleBuildSystem;
