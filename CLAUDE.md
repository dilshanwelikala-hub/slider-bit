# Slider Bit — working notes

## Working preference
Don't create planning/summary docs (e.g. `plan.md`-style write-ups) before or after doing work in this project. Just implement the change directly in the actual files. `plan.md` already exists as a living reference for architecture/roadmap — update it only if the request specifically changes architecture, not as a routine step.

## Project shape
- `index.html` — the Slider Bit dashboard (upload images, configure, publish, get embed code).
- `sliderbit.js` / `sliderbit.css` — the embeddable slider engine (`window.SliderBit`, `.slider-bit` BEM classes, `--sb-*` CSS vars).
- `netlify/functions/slider-save.mjs` + `slider-get.mjs` — Netlify Functions backend (Netlify Blobs store named `sliders`) so published embeds are just `data-sliderbit-id` + 2 links, regardless of image count.
- Hosted on Netlify, deployed from GitHub (`dilshanwelikala-hub/slider-bit`).
- `plan.md` — architecture/roadmap reference, update only on real architecture changes.
