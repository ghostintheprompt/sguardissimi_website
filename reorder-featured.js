const fs = require('fs');
const path = require('path');

// Priority articles to move to front
const prioritySlugs = [
  'elie-saab-paris-autumn-winter-2019-2025-06-14',
  'stella-mccartney-2025-07-06',
  'moschino-milan-spring-summer-2019-2025-06-17',
  'tory-burch-and-shiseido-2025-01-20'
];

const metadataPath = path.join(__dirname, 'articles-metadata.json');

// Read current metadata
const articles = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

// Separate priority articles from rest
const priorityArticles = [];
const otherArticles = [];

articles.forEach(article => {
  if (prioritySlugs.includes(article.slug)) {
    priorityArticles.push(article);
  } else {
    otherArticles.push(article);
  }
});

// Sort priority articles in the order specified
priorityArticles.sort((a, b) => {
  return prioritySlugs.indexOf(a.slug) - prioritySlugs.indexOf(b.slug);
});

// Combine: priority first, then the rest
const reorderedArticles = [...priorityArticles, ...otherArticles];

// Write back
fs.writeFileSync(metadataPath, JSON.stringify(reorderedArticles, null, 2));

console.log(`✅ Reordered articles - ${priorityArticles.length} priority articles moved to front`);
console.log('Priority order:');
priorityArticles.forEach((article, idx) => {
  console.log(`  ${idx + 1}. ${article.title}`);
});
