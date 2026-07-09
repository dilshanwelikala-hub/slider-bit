// Slider Bit — fetch a saved slider CONFIG (options + theme, no images) by ID.
// GET /api/sliders/:id
// Response: { config: object, theme: object|null, updatedAt: string }
//
// Images are never part of this payload — Slider Bit doesn't host images.
// This just lets an embed reference a small set of saved options by ID
// instead of inlining the config JSON directly on every page.
//
// This is called cross-origin from whatever site embeds the slider (e.g. a
// Webflow site), so it needs permissive CORS.
//
// Uses Netlify Functions v2's declarative path routing (URLPattern syntax)
// instead of a netlify.toml redirect + :splat — the redirect+splat approach
// doesn't reliably pass values through as query params to functions, but a
// function-level `path` pattern gives us the id directly via context.params.

import { getStore } from '@netlify/blobs';

export const config = {
  path: '/api/sliders/:id',
};

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

export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed, use GET' }, 405);
  }

  // context.params.id comes from the ":id" segment in the `path` config above.
  // Also accept ?id=... as a fallback in case this is ever called without the
  // path param populated (e.g. certain local-dev setups).
  let id = context && context.params ? context.params.id : null;
  if (!id) {
    const url = new URL(req.url);
    id = url.searchParams.get('id');
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
