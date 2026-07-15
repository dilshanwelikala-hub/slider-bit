// Slider Bit — save a reusable slider CONFIG (options + theme only) to Vercel
// Blob storage. Images are never sent here — Slider Bit doesn't host images;
// you use your own images/markup (e.g. already uploaded to Webflow) and this
// just lets you save/share a set of slider options under a short ID so you
// don't have to re-paste the JSON config on every page that uses it.
// POST /api/sliders
// Body: { id?: string, config: object, theme?: object }
// Response: { id: string }

import { put } from '@vercel/blob';

const MAX_BODY_BYTES = 64 * 1024; // config+theme JSON is tiny; 64KB is generous headroom

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function genId() {
  const rand = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36).slice(-4);
  return rand + time;
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed, use POST' });
    return;
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > MAX_BODY_BYTES) {
    res.status(413).json({ error: 'Payload too large for a config (images are not stored here).' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }

  if (!body || typeof body !== 'object' || !body.config || typeof body.config !== 'object') {
    res.status(400).json({ error: 'Expected { config: object, theme?: object }' });
    return;
  }

  const theme = (body.theme && typeof body.theme === 'object') ? body.theme : null;

  // Basic ID validation if the client wants to update an existing saved config.
  let id = genId();
  if (typeof body.id === 'string' && /^[a-z0-9]{4,32}$/i.test(body.id)) {
    id = body.id;
  }

  const payload = {
    config: body.config,
    theme: theme,
    updatedAt: new Date().toISOString(),
  };
  const payloadStr = JSON.stringify(payload);
  if (payloadStr.length > MAX_BODY_BYTES) {
    res.status(413).json({ error: 'Payload too large for a config (images are not stored here).' });
    return;
  }

  await put(`sliders/${id}.json`, payloadStr, {
    access: 'public',
    contentType: 'application/json',
    allowOverwrite: true, // reusing an id (updating a saved config) should replace it, not fail
  });

  res.status(200).json({ id });
}
