import { handleCanary } from './canary.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const accept = request.headers.get('Accept') || '';

    // Canary honeypot: handles only /media/<token>.jpg and the secret log
    // endpoint; returns null for everything else so the site is untouched.
    const canary = await handleCanary(request, env, ctx, url);
    if (canary) return canary;

    // Handle Markdown for Agents
    if (accept.includes('text/markdown')) {
      // Check if it's an article page
      const articleMatch = url.pathname.match(/^\/articles\/([^\/]+)\/?$/);
      if (articleMatch) {
        const slug = articleMatch[1];
        // The build system copies original markdown to /articles-md/
        const mdPath = `/articles-md/${slug}.md`;
        const mdResponse = await env.ASSETS.fetch(new URL(mdPath, url.origin));
        
        if (mdResponse.ok) {
          const response = new Response(mdResponse.body, mdResponse);
          response.headers.set('Content-Type', 'text/markdown; charset=utf-8');
          // Add Link header to the markdown response as well
          response.headers.set('Link', '</.well-known/api-catalog>; rel="api-catalog"');
          return response;
        }
      }
    }

    // Default: serve from assets
    const response = await env.ASSETS.fetch(request);
    
    // We only want to modify HTML responses or successful asset fetches
    if (!response.ok || !response.headers.get('Content-Type')?.includes('text/html')) {
      return response;
    }

    const newResponse = new Response(response.body, response);

    // Add Link headers for discovery (RFC 8288)
    const links = [
      '</.well-known/api-catalog>; rel="api-catalog"',
      '</.well-known/agent-skills/index.json>; rel="agent-skills"',
      '</.well-known/mcp/server-card.json>; rel="mcp-server-card"'
    ];
    
    // Point to documentation if it exists
    links.push('</docs/CONTENT_GUIDE.md>; rel="service-doc"');
    
    newResponse.headers.set('Link', links.join(', '));

    // Security headers (parity with the rest of the MDRN network)
    newResponse.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    newResponse.headers.set('X-Content-Type-Options', 'nosniff');
    newResponse.headers.set('X-Frame-Options', 'DENY');
    newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    newResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    newResponse.headers.set('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "media-src 'self' https://video.sguardissimi.com",
      "connect-src 'self' https://static.cloudflareinsights.com",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join('; '));

    return newResponse;
  }
};
