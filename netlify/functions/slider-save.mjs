// Slider Bit — save a reusable slider CONFIG (options + theme only) to Netlify
// Blobs. Images are never sent here — Slider Bit doesn't host images; you use
// your own images/markup (e.g. already uploaded to Webflow) and this just
// lets you save/share a set of slider options under a short ID so you don't
// have to re-paste the JSON config on every page that uses it.
// POST /api/sliders
// Body: { id?: string, config: object, theme?: object }
// Response: { id: string }

import { getStore } from '@netlify/blobs';

export const config = {
  path: '/api/sliders',
};

const MAX_BODY_BYTES = 64 * 1024; // config+theme JSON is tiny; 64KB is generous headroom

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function genId() {
  const rand = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36).slice(-4);
  return rand + time;
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed, use POST' }, 405);
  }

  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ error: 'Payload too large for a config (images are not stored here).' }, 413);
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body || typeof body !== 'object' || !body.config || typeof body.config !== 'object') {
    return json({ error: 'Expected { config: object, theme?: object }' }, 400);
  }

  const theme = (body.theme && typeof body.theme === 'object') ? body.theme : null;

  // Basic ID validation if the client wants to update an existing saved config.
  let id = genId();
  if (typeof body.id === 'string' && /^[a-z0-9]{4,32}$/i.test(body.id)) {
    id = body.id;
  }

  const store = getStore('sliders');
  await store.setJSON(id, {
    config: body.config,
    theme: theme,
    updatedAt: new Date().toISOString(),
  });

  return json({ id });
};
