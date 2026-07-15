// Slider Bit — fetch a saved slider CONFIG (options + theme, no images) by ID.
// GET /api/sliders/:id
// Response: { config: object, theme: object|null, updatedAt: string }
//
// Images are never part of this payload — Slider Bit doesn't host images.
// This just lets an embed reference a small set of saved options by ID
// instead of inlining the config JSON directly on every page.
//
// Called cross-origin from whatever site embeds the slider (e.g. a Webflow
// site), so it needs permissive CORS.

import { list } from '@vercel/blob';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed, use GET' });
    return;
  }

  // Vercel's [id].js file-based routing populates req.query.id from the URL segment.
  const id = req.query.id;
  if (!id) {
    res.status(400).json({ error: 'Missing id parameter' });
    return;
  }

  const pathname = `sliders/${id}.json`;
  const { blobs } = await list({ prefix: pathname, limit: 1 });
  const match = blobs.find(function (b) { return b.pathname === pathname; });

  if (!match) {
    res.status(404).json({ error: 'No slider found for id "' + id + '"' });
    return;
  }

  const upstream = await fetch(match.url);
  if (!upstream.ok) {
    res.status(502).json({ error: 'Could not read saved config' });
    return;
  }
  const data = await upstream.json();

  // Short cache: cuts repeat-load cost without going stale for long after an edit.
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.status(200).json(data);
}
