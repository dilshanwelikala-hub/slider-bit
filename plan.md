# Slider Bit — Plan

## Concept
A dashboard where you configure a slider (à la Splide.js) and get a small embed snippet to paste into Webflow's Embed element. Slider Bit does **not** host your images — you bring your own (already uploaded to Webflow, or a CMS Collection List); Slider Bit just supplies the JS/CSS behavior layer on top of whatever slide markup you already have. This keeps the product's job narrow (behavior, not asset management) and means the embed never grows with image count, since images were never part of it.

## What's built

### Frontend
- `sliderbit.js` — dependency-free carousel engine. Supports arrows, dots, autoplay, seamless clone-based infinite loop, perPage, gap/peek/padding, slide/fade transitions, momentum flick-drag (with optional free-scroll) & swipe, mouse-wheel nav, keyboard nav (with tab-scoped a11y so only visible slides are reachable), RTL + vertical direction, center-focus layout, responsive breakpoints, lazy-loaded images, pause-on-hover, ARIA live region, a `sync()` method for linking a slider to a thumbnail/nav strip, and a `continuous` mode for a genuinely seamless auto-scrolling marquee (a separate rendering path: duplicate-once clone strategy + a `requestAnimationFrame` ticker that writes the track's transform every frame, rather than the discrete page-by-page index/transition system used everywhere else — `interval` is repurposed under `continuous` as "ms to travel one slide's width," and dragging reads/writes the same offset the ticker advances, so a grab-and-release always continues smoothly from wherever it was let go). It operates on whatever real DOM is already there — a hand-authored `.slider-bit__track` full of `.slider-bit__slide` divs, or a Webflow CMS Collection List with those same classes added to it. Reads config from a `data-sliderbit-config` JSON attribute, **or** optionally fetches just `{config, theme}` (never images) from a saved config via `data-sliderbit-config-id`. Nav/thumbnail pairs can also be wired declaratively via `data-sliderbit-sync` + `data-sliderbit-nav`. Feature set brought to rough parity with Splide.js v4 (loop/drag/wheel, sync, RTL/center-focus/a11y). Two purely-additive, opt-in styling hooks on top of that: every render tags the DOM with `slider-bit__slide--current`/`--prev`/`--next` (no default CSS effect — lets author/preset CSS build dim-neighbors or 3D-tilt "coverflow" looks without engine changes), and any element with `[data-sliderbit-counter]` inside a slider automatically gets its text kept in sync as `"01 — 06"`-style current/total progress.
- `sliderbit.css` — matching styles, themed via `--sb-*` CSS variables (arrow color/size, dot color/size, radius, transition speed). `.slider-bit__slide` now also carries a `transition` on `transform`/`opacity` so the `--current`/`--prev`/`--next` hooks above animate smoothly when styled.
- `index.html` — the Slider Bit app, restructured as a **4-stage wizard** (see "Wizard flow" below) instead of a single all-in-one screen: pick a carousel style from 4 fully-populated live demos, customize it, preview the real result, then grab the embed code. Optionally save the current settings under a short ID ("Save config for reuse", now living in the Export stage) so multiple pages can share them, and load a saved config back into the controls later.

### Wizard flow
The dashboard is now a linear 4-step wizard (a stepper at the top shows progress; later steps stay disabled until reached, and are re-enabled/re-labeled "done" once passed). Stage 1 cards are stacked vertically, one on top of the other (not a grid), each capped at a readable max width and centered:

1. **Choose** — 5 real, fully working carousels are shown one after another, each built from bundled sample content (never the user's own — this content exists only to demo the style in-app and is never included in exported embed code, which still ships the usual "replace with your own slides" comment block):
   - **Poster Reel** — one big image at a time + a synced thumbnail filmstrip below it and a "01 — 06" progress counter, inspired by movie-poster-style galleries (`swiper-tricks.webflow.io`).
   - **Centered Spotlight** — `focus:'center'` + `peek`, with neighboring slides dimmed/scaled down via the new `--current`/`--prev`/`--next` hooks, full-bleed (`swipeflow.webflow.io`).
   - **Hero Statement** — one full-width slide with a bold uppercase headline overlaid, minimal chrome (`refokus-slider-generator.webflow.io`).
   - **Tilt Showcase** — center-focus plus a subtle `rotateY` 3D tilt on the immediate neighbor slides (via the same `--prev`/`--next` classes), approximating a scroll-driven 3D coverflow (`3d-carousel-scroll.webflow.io`) using the existing drag/arrow engine rather than a page-scroll-hijacking rewrite.
   - **Auto-Scroll Reel** — a row of compact cards (`perPage:4`, `aspectRatio:'3/1'`) that scrolls with genuinely seamless, gapless continuous motion (`continuous:true`) and can be grabbed and dragged anytime, replicating `auto-replicating-draggable-carousel.webflow.io`. Card content is a CSS-drawn colored initial badge + title + one-line description (invented placeholder tool names, not real brand logos) — no bundled images at all, which fits the bring-your-own-images model even better than the photo-based types.
   Selecting one seeds the Customize stage with that type's base config/theme.
2. **Customize** — the same Layout/Behavior/Style controls as before (including peek/padding/mobile-breakpoint), but deliberately with **no live preview on this screen** — just the settings. The aspect-ratio dropdown includes a `3:1 (wide row)` option so the Auto-Scroll Reel's proportions survive a trip through this stage.
3. **Preview** — the first point the user sees the real, customized carousel rendered, using the chosen type's bundled demo content, with a Desktop/Tablet/Mobile frame-width toggle.
4. **Export** — the former "Get Embed Code" modal, now a normal stage: the embed textarea (hosted or self-contained), copy button, and the save/load-a-saved-config panel.

Each of the 5 types carries an optional `extraCss(uid)` (dim-neighbors / 3D-tilt / caption-overlay / light-card-background rules, scoped to that instance's id) that gets inlined into the exported embed's `<style>` block automatically, so what was previewed is what ships — on top of the normal per-instance `--sb-*` theme variables.

### Hosting
Deployed on **Vercel** (GitHub-linked, auto-deploys on push), not Netlify. Originally hosted on Netlify; migrated after Netlify's free-tier credit system started blocking production deploys with a "run out of credits" banner even when the account's own usage page showed credits available (a widely-reported bug on Netlify's free plan, not an actual limit hit) — rather than wait on that, hosting moved to Vercel. `netlify.toml` and `netlify/functions/*.mjs` are left in the repo as legacy/unused — harmless, but no longer part of the deploy path — since Vercel only looks at `api/` for functions and serves everything else in the repo root as static files (no build step needed; Framework Preset should be set to "Other" with an empty Build Command).

### Backend (Vercel Functions + Vercel Blob) — config only, no images
This is an optional convenience, not a requirement: most embeds never call it at all, since the config JSON is small enough to inline directly. It exists purely so the same settings can be reused across pages/sites without re-pasting JSON each time.

- `api/sliders/index.js` — `POST /api/sliders` — saves `{ config, theme }` (no images, ever) as a JSON blob at `sliders/{id}.json`, returns `{ id }`. Reusing an `id` in the payload overwrites that saved config in place (`allowOverwrite: true`). Payload cap is tiny (64KB) since there's no image data to allow for.
- `api/sliders/[id].js` — `GET /api/sliders/:id` — looks up `sliders/{id}.json` via `list({prefix})`, fetches it, and returns `{ config, theme, updatedAt }`, with permissive CORS since this gets called from whatever third-party site (e.g. a Webflow site) embeds the slider.
- `package.json` — declares `@vercel/blob` as a dependency (plus `"type": "module"` and `"engines": {"node": "20.x"}` so Vercel's Node runtime matches what `@vercel/blob` requires). `@netlify/blobs` is left in as an unused legacy dependency.
- Storage: a single Vercel Blob store (public access), keyed by `sliders/{id}.json`. No database to manage. **Requires a one-time manual step in the Vercel dashboard**: create a Blob store under the project's Storage tab and connect it — this auto-injects the `BLOB_READ_WRITE_TOKEN` env var the functions need. Without that connection, `/api/sliders` calls will fail.
- Note: saved configs from the old Netlify Blobs store do **not** carry over — this is a different storage backend. Not a concern for anyone who never used "Save config for reuse," since every embed still works by inlining the config JSON directly.

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
A **self-contained** toggle inlines the engine JS/CSS directly instead of linking to the hosted files (no dependency on the Netlify domain being reachable at all) — this inlined copy includes its own auto-init bootstrap (the same `initAll`/`tryWireSync`/`DOMContentLoaded` logic `sliderbit.js` runs at the bottom of the file), so a pasted self-contained embed builds its slider(s) on its own instead of depending on a separately-loaded script to do it.

The **Thumbnail-Nav Gallery** preset emits *two* `.slider-bit` blocks instead of one: the main gallery, and a second block with `data-sliderbit-sync="#mainId" data-sliderbit-nav` pointing at it — the engine wires them together automatically via its existing sync feature, no extra JS needed in the embed.

If you save the config for reuse, the `data-sliderbit-config='{...}'` attribute is replaced with `data-sliderbit-config-id="abc123"` instead — the engine fetches just the options/theme from `/api/sliders/abc123` at page load and applies them to whatever slide markup is already there (still never touching images).

## Deploying
```
git add -A
git commit -m "..."
git push
```
Vercel (GitHub-linked) picks up the push, installs `@vercel/blob` (because of `package.json`), and redeploys the static site + `api/` functions automatically. One-time setup per Vercel project: Storage tab → create a Blob store → connect it to this project (this is what injects `BLOB_READ_WRITE_TOKEN`); without it, `/api/sliders` calls will fail even though the static dashboard still works fine.

**Good to verify after deploying:**
- Open the deployed `index.html`, go through the wizard, and check the Export stage — the embed snippet should appear instantly (no publish/loading step) since it's just inlined JSON.
- Click "Save config for reuse" — should return a short ID and swap the snippet to the `data-sliderbit-config-id` variant.
- `GET https://YOUR-SITE.vercel.app/api/sliders/<that-id>` in a browser should return JSON with `{config, theme, updatedAt}` and no images field.
- Paste an embed (with real Webflow image URLs in place of the example slide) into an actual Webflow Embed element on a test page and confirm it renders and pages through correctly.

## Remaining nice-to-haves
- **CMS Collection List starter snippet.** Right now the "point slider-bit__track at a Collection List" guidance is a comment in the embed code; a short in-dashboard walkthrough (screenshots or a copyable class-naming checklist) would make this path more discoverable.
- **Auth on saved configs.** Right now anyone with a config ID can overwrite it (no ownership check) since there's no login. Fine for a single-user prototype; add auth + a user_id check before this is multi-tenant.
- **Saved-config support for the Thumbnail-Nav preset's companion strip.** "Save config for reuse" only persists the main slider's config/theme (the backend stores a single `{config,theme}` pair); the thumbnail strip's config is always inlined. Worth revisiting if that preset gets its own share-by-ID flow.
- **Analytics** (impressions, clicks) per embed.
- **A Webflow App** (via Webflow's Designer/Data APIs) instead of a manual embed, so the Slider Bit element (and its CMS binding) can be set up visually instead of via pasted code.

## Naming reference
- Product: **Slider Bit**
- Global JS object: `window.SliderBit`
- Required container class: `slider-bit`
- BEM elements: `slider-bit__track`, `slider-bit__slide`, `slider-bit__arrow`, `slider-bit__pagination`, `slider-bit__dot`, `slider-bit__live`
- Modifiers: `slider-bit--vertical`, `slider-bit--rtl`, `slider-bit--nav`, `slider-bit__track--fade`, `slider-bit__track--marquee` (continuous mode), `slider-bit__track--draggable`, `slider-bit__track--dragging`, `slider-bit__slide--clone`, `slider-bit__slide--current`/`--prev`/`--next` (opt-in styling hooks, no default CSS effect), `.is-active` (dots and nav thumbnails)
- Optional progress-counter element: any element with `data-sliderbit-counter` inside the slider gets its text kept in sync as `"01 — 06"` (current — total)
- Config attribute (inline, default): `data-sliderbit-config='{...}'`
- Saved-config ID attribute (optional, requires the slide markup already be present): `data-sliderbit-config-id="abc123"`
- Optional API override: `data-sliderbit-api` (defaults to the origin the script itself was loaded from)
- Nav/thumbnail sync attributes: `data-sliderbit-sync="#otherSliderSelector"` + `data-sliderbit-nav` on the thumbnail slider
- Engine options: `type`, `direction` (`ltr`/`rtl`/`vertical`), `perPage`, `perMove`, `gap`, `padding`, `peek` (number or `{start,end}`), `focus` (`'center'`), `loop`, `continuous` (seamless auto-scroll marquee mode — see above; repurposes `interval` as ms-per-slide travel speed and bypasses `perMove`/`speed`/`dragFree`/pagination/arrows/keyboard entirely), `autoplay`/`interval`/`pauseOnHover`, `speed`/`easing`, `arrows`, `pagination`, `drag`/`dragFree`/`flickPower`/`flickMaxPages`, `wheel`/`wheelMinThreshold`/`wheelSleep`, `keyboard`, `lazyLoad`, `startIndex`, `breakpoints`
- CSS custom properties: `--sb-*` (e.g. `--sb-gap`, `--sb-peek-start`/`--sb-peek-end`, `--sb-arrow-color`, `--sb-radius`)
- API (config only, no images): `POST /api/sliders` (save/update), `GET /api/sliders/:id` (fetch)
