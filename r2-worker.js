// Cloudflare Worker for R2 API integration
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/r2-list') {
      try {
        const objects = await env.R2_BUCKET.list({});
        const files = objects.objects.map(obj => ({
          key: obj.key,
          url: `${env.R2_BUCKET.publicUrl}/${obj.key}`
        }));
        return new Response(JSON.stringify(files), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    return new Response('Not found', { status: 404 });
  }
};
