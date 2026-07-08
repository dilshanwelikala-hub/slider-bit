// Slider Bit — fetch a published slider's config + images by ID.
// GET /api/sliders/:id  (redirected to this function by netlify.toml, id passed as a path segment)
// Response: { config: object, images: [{ src, alt }], updatedAt: string }
//
// This is called cross-origin from whatever site embeds the slider (e.g. a
// Webflow site), so it needs permissive CORS.

import { getStore } from '@netlify/blobs';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}

function json(body, status, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(), ...(extraHeaders || {}) },
  });
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed, use GET' }, 405);
  }

  const url = new URL(req.url);

  // Netlify's :splat redirect placeholder doesn't reliably survive as a query
  // string value when redirecting to a function, so netlify.toml passes it as
  // a path segment instead (/.netlify/functions/slider-get/<id>). We read it
  // from there, falling back to ?id=... for direct/manual calls.
  let id = url.searchParams.get('id');
  if (!id) {
    const match = url.pathname.match(/\/slider-get\/(.+)$/);
    if (match) id = decodeURIComponent(match[1]);
  }

  if (!id) {
    return json({ error: 'Missing id parameter' }, 400);
  }

  const store = getStore('sliders');
  const data = await store.get(id, { type: 'json', consistency: 'strong' });

  if (!data) {
    return json({ error: 'No slider found for id "' + id + '"' }, 404);
  }

  // Short cache: cuts repeat-load cost without going stale for long after an edit.
  return json(data, 200, { 'Cache-Control': 'public, max-age=60' });
};
