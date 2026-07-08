// Slider Bit — save a slider's config + images to Netlify Blobs.
// POST /api/sliders
// Body: { id?: string, config: object, images: [{ src, alt }] }
// Response: { id: string }

import { getStore } from '@netlify/blobs';

export const config = {
  path: '/api/sliders',
};

const MAX_BODY_BYTES = 8 * 1024 * 1024; // 8MB safety cap for a handful of base64 images

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
    return json({ error: 'Payload too large. Try fewer or smaller images.' }, 413);
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body || typeof body !== 'object' || !body.config || !Array.isArray(body.images)) {
    return json({ error: 'Expected { config: object, images: array }' }, 400);
  }

  const theme = (body.theme && typeof body.theme === 'object') ? body.theme : null;

  if (body.images.length === 0) {
    return json({ error: 'Add at least one image before publishing' }, 400);
  }

  // Basic ID validation if the client wants to update an existing slider
  let id = genId();
  if (typeof body.id === 'string' && /^[a-z0-9]{4,32}$/i.test(body.id)) {
    id = body.id;
  }

  const store = getStore('sliders');
  await store.setJSON(id, {
    config: body.config,
    images: body.images,
    theme: theme,
    updatedAt: new Date().toISOString(),
  });

  return json({ id });
};
