# Slider Bit — working notes

## Working preference
Don't create planning/summary docs (e.g. `plan.md`-style write-ups) before or after doing work in this project. Just implement the change directly in the actual files. `plan.md` already exists as a living reference for architecture/roadmap — update it only if the request specifically changes architecture, not as a routine step.

## Project shape
- Slider Bit does NOT host images — you bring your own (already uploaded to Webflow, or a CMS Collection List). The dashboard only configures behavior/layout options; embeds carry a small config JSON, never image data.
- `index.html` — the Slider Bit configurator (tweak options against a placeholder-slide live preview, copy embed code, optionally save/load a config by ID).
- `sliderbit.js` / `sliderbit.css` — the embeddable slider engine (`window.SliderBit`, `.slider-bit` BEM classes, `--sb-*` CSS vars). Operates on whatever real slide markup is already in the DOM.
- `netlify/functions/slider-save.mjs` + `slider-get.mjs` — Netlify Functions backend (Netlify Blobs store named `sliders`) for the *optional* saved-config-by-ID feature (`data-sliderbit-config-id`) — config/theme only, no images, no requirement to use it at all.
- Hosted on Netlify, deployed from GitHub (`dilshanwelikala-hub/slider-bit`).
- `plan.md` — architecture/roadmap reference, update only on real architecture changes.
