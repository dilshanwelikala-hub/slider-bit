# Slider Bit — working notes

## Working preference
Don't create planning/summary docs (e.g. `plan.md`-style write-ups) before or after doing work in this project. Just implement the change directly in the actual files. `plan.md` already exists as a living reference for architecture/roadmap — update it only if the request specifically changes architecture, not as a routine step.

## Project shape
- Slider Bit does NOT host images — you bring your own (already uploaded to Webflow, or a CMS Collection List). The dashboard only configures behavior/layout options; embeds carry a small config JSON, never image data.
- `index.html` — a 4-stage wizard (Choose a style from 4 fully-populated demo carousels → Customize controls-only → Preview the real render → Export embed code / save-load).
- `sliderbit.js` / `sliderbit.css` — the embeddable slider engine (`window.SliderBit`, `.slider-bit` BEM classes, `--sb-*` CSS vars). Operates on whatever real slide markup is already in the DOM.
- `api/sliders/index.js` (POST) + `api/sliders/[id].js` (GET) — Vercel Functions backend (Vercel Blob store) for the *optional* saved-config-by-ID feature (`data-sliderbit-config-id`) — config/theme only, no images, no requirement to use it at all.
- Hosted on **Vercel**, deployed from GitHub (`dilshanwelikala-hub/slider-bit`). `netlify.toml` and `netlify/functions/*.mjs` are legacy/unused leftovers from before the Netlify→Vercel migration (Netlify's free-tier credit system started blocking deploys) — harmless to ignore, not part of the current deploy path.
- `plan.md` — architecture/roadmap reference, update only on real architecture changes.
