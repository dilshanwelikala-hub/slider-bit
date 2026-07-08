# Slider Bit — Plan

## Concept
A hosted dashboard where a user uploads images, configures a slider (à la Splide.js), and gets a small embed snippet to paste into Webflow's Embed element. The slider renders using a shared JS/CSS engine hosted on a CDN, so updates to the engine improve every embed at once.

## What's built

### Frontend
- `sliderbit.js` — dependency-free carousel engine. Supports arrows, dots, autoplay, loop, perPage, gap, slide/fade transitions, drag & swipe, keyboard nav, responsive breakpoints, lazy-loaded images, pause-on-hover, ARIA live region. Reads config from a `data-sliderbit-config` JSON attribute, **or** (new) hydrates itself remotely from a `data-sliderbit-id`.
- `sliderbit.css` — matching styles, themed via `--sb-*` CSS variables (arrow color/size, dot color/size, radius, transition speed).
- `index.html` — the Slider Bit builder UI. Upload images, reorder them, tweak every option with live preview, then publish and copy a ready-to-paste embed block. Includes a "load an existing slider by ID" flow for coming back to edit something already published.

### Backend (done — Netlify Functions + Netlify Blobs)
This solves the original "embed gets huge with more images" problem. Each slider's config, theme, and images are now saved server-side under a short ID; the embed just references that ID instead of carrying everything inline.

- `netlify/functions/slider-save.mjs` — `POST /api/sliders` — saves `{ config, theme, images }`, returns `{ id }`. Reusing an `id` in the payload updates that slider in place (so re-publishing after edits doesn't create a new one).
- `netlify/functions/slider-get.mjs` — `GET /api/sliders/:id` — returns the saved `{ config, theme, images, updatedAt }`, with permissive CORS since this gets called from whatever third-party site (e.g. a Webflow site) embeds the slider.
- `netlify.toml` — routes the friendly `/api/sliders` paths to those functions, and tells Netlify to publish the site root with functions in `netlify/functions`.
- `package.json` — declares `@netlify/blobs` as a dependency so Netlify installs it for the functions bundler.
- Storage: a single site-wide Netlify Blobs store named `sliders`, keyed by slider ID. No database to manage.

### The embed, now
Once published, the Webflow embed is just:
```html
<div class="slider-bit" data-sliderbit-id="abc123"></div>
<link rel="stylesheet" href="https://YOUR-SITE.netlify.app/sliderbit.css">
<script src="https://YOUR-SITE.netlify.app/sliderbit.js" defer></script>
```
Word count no longer grows with image count — `sliderbit.js` fetches the real config + images from `/api/sliders/abc123` at page load and builds the slide markup itself. Editing the slider later in the dashboard and re-publishing updates that same ID everywhere it's embedded, with no re-pasting.

The dashboard still offers a **self-contained** embed as a fallback/toggle (fully inline, no hosting dependency) for cases where you want something that works completely offline or the publish API isn't reachable (e.g. testing the dashboard as a local file before it's deployed).

## Deploying (or re-deploying with the new backend)
This adds new files (`netlify.toml`, `package.json`, `netlify/functions/`) and changes existing ones (`sliderbit.js`, `index.html`) on top of whatever was already pushed. From the project folder:
```
git add -A
git commit -m "Add Netlify Functions backend for hosted embeds"
git push
```
Netlify will pick up the push, install `@netlify/blobs` (because of `package.json`), bundle the two functions, and redeploy the static site — all automatically, no dashboard changes needed on Netlify's side beyond the initial GitHub connection.

**Good to verify after deploying:**
- Open the deployed `index.html`, add an image, click "Get Embed Code" — it should show "Publishing…" then a 3-line hosted embed (not the local-file fallback message).
- `GET https://YOUR-SITE.netlify.app/api/sliders/<the-id-you-got>` in a browser should return JSON with your config/images.
- Paste the embed into an actual Webflow Embed element on a test page and confirm it renders and pages through correctly.

## Remaining nice-to-haves
- **Real image hosting.** Images are still stored as base64 inside the JSON blob (fine for a handful of images; large ones bloat the blob and every `/api/sliders/:id` fetch). Moving to object storage (Netlify Blobs' binary storage, S3, Cloudflare Images) with separate URLs per image, plus resizing, is the next step for Lighthouse-friendly performance at scale.
- **Auth.** Right now anyone with a slider ID can overwrite it (no ownership check) since there's no login. Fine for a single-user prototype; add auth + a user_id check before this is multi-tenant.
- **Templates/presets** (product carousel, testimonial slider, logo strip).
- **Per-slide captions/links/buttons.**
- **Analytics** (impressions, clicks) per slider.
- **A Webflow App** (via Webflow's Designer/Data APIs) instead of a manual embed, so the Slider Bit element can be dropped in visually.

## Naming reference
- Product: **Slider Bit**
- Global JS object: `window.SliderBit`
- Required container class: `slider-bit`
- BEM elements: `slider-bit__track`, `slider-bit__slide`, `slider-bit__arrow`, `slider-bit__pagination`, `slider-bit__dot`, `slider-bit__live`
- Modifiers: `slider-bit--vertical`, `slider-bit__track--fade`, `slider-bit__track--dragging`
- Config attribute (self-contained embed): `data-sliderbit-config`
- Remote ID attribute (hosted embed): `data-sliderbit-id`
- Optional API override: `data-sliderbit-api` (defaults to the origin the script itself was loaded from)
- CSS custom properties: `--sb-*` (e.g. `--sb-gap`, `--sb-arrow-color`, `--sb-radius`)
- API: `POST /api/sliders` (save/update), `GET /api/sliders/:id` (fetch)
