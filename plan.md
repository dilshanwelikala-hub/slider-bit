# Slider Bit — Plan

## Concept
A dashboard where you configure a slider (à la Splide.js) and get a small embed snippet to paste into Webflow's Embed element. Slider Bit does **not** host your images — you bring your own (already uploaded to Webflow, or a CMS Collection List); Slider Bit just supplies the JS/CSS behavior layer on top of whatever slide markup you already have. This keeps the product's job narrow (behavior, not asset management) and means the embed never grows with image count, since images were never part of it.

## What's built

### Frontend
- `sliderbit.js` — dependency-free carousel engine. Supports arrows, dots, autoplay, seamless clone-based infinite loop, perPage, gap/peek/padding, slide/fade transitions, momentum flick-drag (with optional free-scroll) & swipe, mouse-wheel nav, keyboard nav (with tab-scoped a11y so only visible slides are reachable), RTL + vertical direction, center-focus layout, responsive breakpoints, lazy-loaded images, pause-on-hover, ARIA live region, and a `sync()` method for linking a slider to a thumbnail/nav strip. It operates on whatever real DOM is already there — a hand-authored `.slider-bit__track` full of `.slider-bit__slide` divs, or a Webflow CMS Collection List with those same classes added to it. Reads config from a `data-sliderbit-config` JSON attribute, **or** optionally fetches just `{config, theme}` (never images) from a saved config via `data-sliderbit-config-id`. Nav/thumbnail pairs can also be wired declaratively via `data-sliderbit-sync` + `data-sliderbit-nav`. Feature set brought to rough parity with Splide.js v4 (loop/drag/wheel, sync, RTL/center-focus/a11y).
- `sliderbit.css` — matching styles, themed via `--sb-*` CSS variables (arrow color/size, dot color/size, radius, transition speed).
- `index.html` — the Slider Bit configurator UI. Tweak every option against a live preview built from placeholder slides (no upload needed), then copy a ready-to-paste embed block containing the options JSON, links to the hosted engine, and an example slide block to replace with your own images or a CMS Collection List. Optionally save the current settings under a short ID ("Save config for reuse") so multiple pages can share them, and load a saved config back into the controls later.

### Backend (Netlify Functions + Netlify Blobs) — config only, no images
This is an optional convenience, not a requirement: most embeds never call it at all, since the config JSON is small enough to inline directly. It exists purely so the same settings can be reused across pages/sites without re-pasting JSON each time.

- `netlify/functions/slider-save.mjs` — `POST /api/sliders` — saves `{ config, theme }` (no images, ever), returns `{ id }`. Reusing an `id` in the payload updates that saved config in place. Payload cap is tiny (64KB) since there's no image data to allow for.
- `netlify/functions/slider-get.mjs` — `GET /api/sliders/:id` — returns the saved `{ config, theme, updatedAt }`, with permissive CORS since this gets called from whatever third-party site (e.g. a Webflow site) embeds the slider.
- `netlify.toml` — tells Netlify to publish the site root with functions in `netlify/functions`. Both functions declare their own path routing (`/api/sliders`, `/api/sliders/:id`) via Netlify Functions v2, so no redirect rules are needed.
- `package.json` — declares `@netlify/blobs` as a dependency so Netlify installs it for the functions bundler.
- Storage: a single site-wide Netlify Blobs store named `sliders`, keyed by config ID. No database to manage.

### The embed
Default (recommended) embed — everything needed, no network call required to generate or use it:
```html
<!-- Slider Bit embed — paste into a Webflow Embed element -->
<div class="slider-bit" data-sliderbit-config='{"loop":true,"perPage":1,...}'>
  <div class="slider-bit__track">
    <!-- Replace this example with your own slides: one .slider-bit__slide per image -->
    <div class="slider-bit__slide"><img src="https://YOUR-SITE.webflow.io/path/to/image-1.jpg" alt=""></div>
    <div class="slider-bit__slide"><img src="https://YOUR-SITE.webflow.io/path/to/image-2.jpg" alt=""></div>
    <!-- ...add as many slides as you need... -->

    <!-- OR, for a CMS-driven slider: skip hand-authored slides above and instead
         add "slider-bit__track" to a Webflow Collection List element, and
         "slider-bit__slide" to its Collection Item template. -->
  </div>
</div>
<link rel="stylesheet" href="https://YOUR-SITE.netlify.app/sliderbit.css">
<script src="https://YOUR-SITE.netlify.app/sliderbit.js" defer></script>
```
A **self-contained** toggle inlines the engine JS/CSS directly instead of linking to the hosted files (no dependency on the Netlify domain being reachable at all).

If you save the config for reuse, the `data-sliderbit-config='{...}'` attribute is replaced with `data-sliderbit-config-id="abc123"` instead — the engine fetches just the options/theme from `/api/sliders/abc123` at page load and applies them to whatever slide markup is already there (still never touching images).

## Deploying
```
git add -A
git commit -m "..."
git push
```
Netlify picks up the push, installs `@netlify/blobs` (because of `package.json`), bundles the two functions, and redeploys the static site automatically.

**Good to verify after deploying:**
- Open the deployed `index.html`, adjust some settings, click "Get Embed Code" — the snippet should appear instantly (no publish/loading step) since it's just inlined JSON.
- Click "Save config for reuse" — should return a short ID and swap the snippet to the `data-sliderbit-config-id` variant.
- `GET https://YOUR-SITE.netlify.app/api/sliders/<that-id>` in a browser should return JSON with `{config, theme, updatedAt}` and no images field.
- Paste an embed (with real Webflow image URLs in place of the example slide) into an actual Webflow Embed element on a test page and confirm it renders and pages through correctly.

## Remaining nice-to-haves
- **CMS Collection List starter snippet.** Right now the "point slider-bit__track at a Collection List" guidance is a comment in the embed code; a short in-dashboard walkthrough (screenshots or a copyable class-naming checklist) would make this path more discoverable.
- **Auth on saved configs.** Right now anyone with a config ID can overwrite it (no ownership check) since there's no login. Fine for a single-user prototype; add auth + a user_id check before this is multi-tenant.
- **Templates/presets** (product carousel, testimonial slider, logo strip) as one-click starting configs.
- **Analytics** (impressions, clicks) per embed.
- **A Webflow App** (via Webflow's Designer/Data APIs) instead of a manual embed, so the Slider Bit element (and its CMS binding) can be set up visually instead of via pasted code.

## Naming reference
- Product: **Slider Bit**
- Global JS object: `window.SliderBit`
- Required container class: `slider-bit`
- BEM elements: `slider-bit__track`, `slider-bit__slide`, `slider-bit__arrow`, `slider-bit__pagination`, `slider-bit__dot`, `slider-bit__live`
- Modifiers: `slider-bit--vertical`, `slider-bit--rtl`, `slider-bit--nav`, `slider-bit__track--fade`, `slider-bit__track--draggable`, `slider-bit__track--dragging`, `slider-bit__slide--clone`, `.is-active` (dots and nav thumbnails)
- Config attribute (inline, default): `data-sliderbit-config='{...}'`
- Saved-config ID attribute (optional, requires the slide markup already be present): `data-sliderbit-config-id="abc123"`
- Optional API override: `data-sliderbit-api` (defaults to the origin the script itself was loaded from)
- Nav/thumbnail sync attributes: `data-sliderbit-sync="#otherSliderSelector"` + `data-sliderbit-nav` on the thumbnail slider
- Engine options: `type`, `direction` (`ltr`/`rtl`/`vertical`), `perPage`, `perMove`, `gap`, `padding`, `peek` (number or `{start,end}`), `focus` (`'center'`), `loop`, `autoplay`/`interval`/`pauseOnHover`, `speed`/`easing`, `arrows`, `pagination`, `drag`/`dragFree`/`flickPower`/`flickMaxPages`, `wheel`/`wheelMinThreshold`/`wheelSleep`, `keyboard`, `lazyLoad`, `startIndex`, `breakpoints`
- CSS custom properties: `--sb-*` (e.g. `--sb-gap`, `--sb-peek-start`/`--sb-peek-end`, `--sb-arrow-color`, `--sb-radius`)
- API (config only, no images): `POST /api/sliders` (save/update), `GET /api/sliders/:id` (fetch)
