# Slider Bit — Plan

## Concept
A hosted dashboard where a user uploads images, configures a slider (à la Splide.js), and gets a small embed snippet to paste into Webflow's Embed element. The slider renders using a shared JS/CSS engine hosted on a CDN, so updates to the engine improve every embed at once.

## Prototype (built in this session)
Three files, no backend required:

- `sliderbit.js` — dependency-free carousel engine. Reads config from a `data-sliderbit-config` JSON attribute on a container div (class `slider-bit`). Supports arrows, dots, autoplay, loop, perPage, gap, slide/fade transitions, drag & swipe, keyboard nav, responsive breakpoints, lazy-loaded images, pause-on-hover, ARIA live region.
- `sliderbit.css` — matching styles, themed via CSS variables (arrow color/size, dot color/size, radius, transition speed), all under the `--sb-*` custom property namespace.
- `index.html` — the Slider Bit builder UI. Upload images (drag/drop, stored as base64 for this prototype), reorder them, tweak every option with live preview, then copy a ready-to-paste embed block.

This works today: open `index.html`, build a slider, paste the generated code into a Webflow Embed element, done. Images are inlined as base64 so nothing needs external hosting yet.

## Path to a real product

**1. Split "engine" from "content."**
Keep `sliderbit.js`/`sliderbit.css` on a CDN (Cloudflare Pages, jsDelivr via GitHub, or S3+CloudFront) at a stable versioned URL, e.g. `https://cdn.sliderbit.app/v1/sliderbit.min.js`. Every embed just references that URL — ship a bugfix once, every live slider on every customer's site gets it without them touching Webflow again.

**2. Give each slider an ID, not inline config.**
Instead of baking full config + base64 images into the Webflow embed (fine for a demo, bad for real sites — bloats page weight and can't be edited without re-pasting code), the dashboard should save each slider's config + image URLs to a backend, assign it a `sliderbit-id`, and the embed becomes:
```html
<div class="slider-bit" data-sliderbit-id="abc123"></div>
<link rel="stylesheet" href="https://cdn.sliderbit.app/v1/sliderbit.min.css">
<script src="https://cdn.sliderbit.app/v1/sliderbit.min.js" defer></script>
```
The script fetches `abc123`'s config from your API at page load. Editing the slider later in the dashboard updates the live site instantly — no re-embedding.

**3. Real image hosting.**
Uploads go to object storage (S3/R2/Cloudflare Images) instead of base64. Serve resized/optimized variants and lazy-load — critical for Lighthouse scores, which is one of Splide's selling points.

**4. Minimal backend.**
- Auth (so each user's sliders are private)
- Postgres table: `sliders(id, user_id, config_json, images[], created_at)`
- REST endpoint the embed script calls: `GET /api/sliders/:id`
- Dashboard CRUD UI (can evolve from `index.html`)

**5. Nice-to-haves once the core loop works**
- Templates/presets (product carousel, testimonial slider, logo strip)
- Per-slide captions/links/buttons
- Analytics (impressions, clicks) per slider
- Team/workspace accounts, usage-based pricing tiers
- A Webflow App (via Webflow's Designer/Data APIs) instead of a manual embed, so the Slider Bit element can be dropped in visually

## Suggested build order after this prototype
1. Stand up the CDN-hosted engine + minimal API with the `sliderbit-id` model.
2. Add auth + persistent storage, port the dashboard UI to talk to the API instead of `localStorage`/base64.
3. Add image optimization pipeline.
4. Layer on templates, analytics, billing.

## Naming reference
- Product: **Slider Bit**
- Global JS object: `window.SliderBit`
- Required container class: `slider-bit`
- BEM elements: `slider-bit__track`, `slider-bit__slide`, `slider-bit__arrow`, `slider-bit__pagination`, `slider-bit__dot`, `slider-bit__live`
- Modifiers: `slider-bit--vertical`, `slider-bit__track--fade`, `slider-bit__track--dragging`
- Config attribute: `data-sliderbit-config` (prototype) / `data-sliderbit-id` (future backend-driven version)
- CSS custom properties: `--sb-*` (e.g. `--sb-gap`, `--sb-arrow-color`, `--sb-radius`)
