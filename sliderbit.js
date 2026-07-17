/*!
 * Slider Bit v1.1.0
 * Lightweight, dependency-free slider/carousel for Webflow (or any site) embeds.
 * Feature set inspired by Splide.js v4 (splidejs.com). MIT-style, do whatever you want with it.
 *
 * Usage:
 *   <div class="slider-bit" data-sliderbit-config='{"perPage":1,"arrows":true}'>
 *     <div class="slider-bit__track">
 *       <div class="slider-bit__slide"><img src="a.jpg" alt=""></div>
 *       <div class="slider-bit__slide"><img src="b.jpg" alt=""></div>
 *     </div>
 *   </div>
 *   <link rel="stylesheet" href="sliderbit.css">
 *   <script src="sliderbit.js" defer></script>
 *
 * Auto-initializes every element with class "slider-bit" on DOMContentLoaded.
 * Reads options from the data-sliderbit-config JSON attribute (all optional).
 *
 * Thumbnail/nav sync (declarative):
 *   <div class="slider-bit" id="main" data-sliderbit-config='{"loop":true}'>...</div>
 *   <div class="slider-bit" data-sliderbit-sync="#main" data-sliderbit-nav
 *        data-sliderbit-config='{"perPage":5,"pagination":false,"arrows":false}'>...</div>
 *   The second slider becomes a clickable, highlighted thumbnail strip for the first.
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    type: 'slide',          // 'slide' | 'fade'
    direction: 'ltr',        // 'ltr' | 'rtl' | 'vertical'
    perPage: 1,
    perMove: null,           // null = move by perPage (page-based); set a number to override
    gap: '1rem',
    padding: '0',            // outer container inset (frame around the whole slider)
    peek: 0,                 // track-edge inset so neighboring slides peek in (number/string = both sides,
                              // or { start, end }) -- combine with perPage:1 + focus:'center' for a centered
                              // carousel look
    focus: false,            // false | 'center' -- centers the active slide when perPage > 1
    height: '',              // e.g. '400px'; if empty, aspect ratio is used
    aspectRatio: '16/9',
    loop: true,              // seamless infinite loop (real DOM clones) for type:'slide'; modulo wrap for fade
    autoplay: false,
    interval: 4000,
    pauseOnHover: true,
    speed: 500,
    easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    arrows: true,
    pagination: true,
    drag: true,
    dragFree: false,         // free momentum scroll without snapping to a slide boundary
    flickPower: 600,         // higher = a flick travels further
    flickMaxPages: 1,        // caps how many "pages" (perPage slides) a single flick can jump
    wheel: false,            // enable mouse-wheel / trackpad navigation
    wheelMinThreshold: 40,   // ignore wheel deltas smaller than this (avoids accidental triggers)
    wheelSleep: 700,         // ms to ignore further wheel input after triggering a move
    keyboard: true,
    lazyLoad: true,
    startIndex: 0,
    breakpoints: {},         // { 768: { perPage: 1 }, 1024: { perPage: 3 } }
    continuous: false        // true = seamless auto-scrolling marquee (no discrete pages/steps);
                              // "interval" is repurposed as ms-per-slide of constant travel speed
  };

  var instanceId = 0;
  var FOCUSABLE_SELECTOR = 'a[href], button, input, select, textarea, [tabindex]';

  function SliderBit(el, userOptions) {
    if (!el) return;
    if (el.__sliderBitInstance) return el.__sliderBitInstance;

    this.el = el;
    this.id = 'sb-' + (++instanceId);
    var attrConfig = {};
    try {
      var raw = el.getAttribute('data-sliderbit-config');
      if (raw) attrConfig = JSON.parse(raw);
    } catch (e) {
      console.warn('SliderBit: could not parse data-sliderbit-config JSON on', el, e);
    }

    this.baseOptions = Object.assign({}, DEFAULTS, attrConfig, userOptions || {});
    this.options = Object.assign({}, this.baseOptions);
    this.track = el.querySelector('.slider-bit__track');
    this.slides = this.track ? Array.prototype.slice.call(this.track.children) : [];
    this.isFade = this.options.type === 'fade';
    this.isVertical = this.options.direction === 'vertical';
    this.isRTL = this.options.direction === 'rtl';
    // "continuous" is a seamless, always-auto-scrolling marquee mode -- an
    // entirely different rendering path from the discrete page-by-page
    // engine below (see _startContinuous). Not supported for fade.
    this.isContinuous = !!this.options.continuous && !this.isFade;
    this._autoplayTimer = null;
    this._dragging = false;
    this._locked = false;
    this._pendingMove = null;
    this.cloneCount = 0;
    this.realCount = this.slides.length;
    this._changeCallbacks = [];

    if (!this.track || this.slides.length === 0) {
      console.warn('SliderBit: no .slider-bit__track / .slider-bit__slide found in', el);
      return;
    }

    el.__sliderBitInstance = this;
    this._build();
    this._applyResponsive();
    this._bindEvents();
    this._render(false);
    if (this.isContinuous) {
      this._startContinuous();
    } else if (this.options.autoplay) {
      this.play();
    }
  }

  // -------------------------------------------------------------------
  // Build / clones
  // -------------------------------------------------------------------

  SliderBit.prototype._build = function () {
    var el = this.el;
    el.classList.add('slider-bit');
    if (this.isVertical) el.classList.add('slider-bit--vertical');
    if (this.isRTL) el.classList.add('slider-bit--rtl');
    el.setAttribute('role', 'region');
    el.setAttribute('aria-roledescription', 'carousel');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');

    this.track.classList.add('slider-bit__track');
    if (this.isFade) this.track.classList.add('slider-bit__track--fade');
    if (this.isContinuous) this.track.classList.add('slider-bit__track--marquee');
    if (this.options.drag) this.track.classList.add('slider-bit__track--draggable');

    this._buildClones();

    this.slides.forEach(function (slide, i) {
      slide.classList.add('slider-bit__slide');
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'slide');
      var realI = typeof slide.__sbRealIndex === 'number' ? slide.__sbRealIndex : i;
      var total = this.cloneCount ? this.realCount : this.slides.length;
      slide.setAttribute('aria-label', (realI + 1) + ' of ' + total);
      var img = slide.querySelector('img');
      if (img && this.options.lazyLoad && !img.hasAttribute('loading')) {
        img.setAttribute('loading', 'lazy');
      }
    }, this);

    // Live region for screen readers
    this.liveRegion = document.createElement('div');
    this.liveRegion.className = 'slider-bit__live';
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    el.appendChild(this.liveRegion);

    // Optional "1 — 6"-style progress counter: purely opt-in -- if the
    // author's own markup includes an element with this attribute anywhere
    // inside the slider, we keep its text in sync with the current real
    // slide on every change. No such element, no effect at all.
    this.counterEl = el.querySelector('[data-sliderbit-counter]');
    if (this.counterEl) {
      var self_counter = this;
      var updateCounter = function (realIndex) {
        var total = self_counter.cloneCount ? self_counter.realCount : self_counter.slides.length;
        self_counter.counterEl.textContent = pad2(realIndex + 1) + ' — ' + pad2(total);
      };
      this._onChange(updateCounter);
      updateCounter(this._realIndex());
    }

    // Arrows -- not meaningful for a continuous marquee (no discrete pages to step through)
    if (this.options.arrows && this.slides.length > 1 && !this.isContinuous) {
      this.prevBtn = this._createArrow('prev', '‹');
      this.nextBtn = this._createArrow('next', '›');
      el.appendChild(this.prevBtn);
      el.appendChild(this.nextBtn);
    }

    // Pagination -- same reasoning as arrows above
    if (this.options.pagination && this.slides.length > 1 && !this.isContinuous) {
      this.pagination = document.createElement('div');
      this.pagination.className = 'slider-bit__pagination';
      this.pagination.setAttribute('role', 'tablist');
      el.appendChild(this.pagination);
      this._buildPagination();
    }

    // Height / aspect ratio
    if (this.options.height) {
      el.style.setProperty('--sb-height', this.options.height);
    } else if (this.options.aspectRatio) {
      el.style.setProperty('--sb-aspect-ratio', this.options.aspectRatio);
    }
    el.style.setProperty('--sb-speed', this.options.speed + 'ms');
    el.style.setProperty('--sb-easing', this.options.easing);
    el.style.setProperty('--sb-gap', this._toCss(this.options.gap));
    el.style.setProperty('--sb-padding', this._toCss(this.options.padding));

    var peek = this._resolvePeek();
    el.style.setProperty('--sb-peek-start', this._toCss(peek.start));
    el.style.setProperty('--sb-peek-end', this._toCss(peek.end));
  };

  SliderBit.prototype._resolvePeek = function () {
    var peek = this.options.peek;
    if (peek && typeof peek === 'object') {
      return { start: peek.start || 0, end: peek.end || 0 };
    }
    return { start: peek || 0, end: peek || 0 };
  };

  /**
   * Generates real DOM clones at both ends of the track so that, combined with
   * a transitionend snap-back, dragging or paging past the last slide continues
   * seamlessly into the first (and vice versa) instead of visually rewinding.
   * Only used for type:'slide' -- fade loops via simple index wrap, no clones needed.
   */
  SliderBit.prototype._buildClones = function () {
    var opts = this.options;

    if (this.isContinuous) {
      // A continuous marquee doesn't page through an index -- it just keeps
      // translating the track at a constant speed. The simplest way to make
      // that seamless regardless of content length is the standard marquee
      // trick: duplicate the real slides exactly ONCE so the track holds two
      // back-to-back identical copies, then loop the translate distance at
      // precisely half the track's total width. At that halfway point the
      // second (duplicate) copy is pixel-identical to where the first copy
      // started, so the loop restart is invisible -- no snap-back, no pause,
      // no visible "jump" the way the discrete clone-buffer below has.
      var real = this.slides.slice();
      real.forEach(function (node, i) { node.__sbRealIndex = i; });
      var track = this.track;
      var dupes = real.map(function (node) { return cloneNode(node, -1); });
      dupes.forEach(function (c) { track.appendChild(c); });
      this.cloneCount = 0;
      this.realCount = real.length;
      this.slides = real.concat(dupes);
      this.index = 0;
      return;
    }

    var eligible = opts.loop && opts.type !== 'fade' && this.slides.length > 1;

    if (!eligible) {
      this.cloneCount = 0;
      this.slides.forEach(function (s, i) { s.__sbRealIndex = i; });
      this.index = opts.startIndex || 0;
      return;
    }

    var per = opts.perPage || 1;
    var count = Math.min(this.slides.length, Math.max(per * 2, 2));
    var real = this.slides.slice();
    real.forEach(function (node, i) { node.__sbRealIndex = i; });

    var headSrc = real.slice(real.length - count);
    var headStartIndex = real.length - count;
    var tailSrc = real.slice(0, count);

    var head = headSrc.map(function (node, i) { return cloneNode(node, headStartIndex + i); });
    var tail = tailSrc.map(function (node, i) { return cloneNode(node, i); });

    var track = this.track;
    var firstReal = real[0];
    head.forEach(function (c) { track.insertBefore(c, firstReal); });
    tail.forEach(function (c) { track.appendChild(c); });

    this.cloneCount = count;
    this.realCount = real.length;
    this.slides = head.concat(real, tail);
    this.index = count + (opts.startIndex || 0);

    function cloneNode(node, realIdx) {
      var clone = node.cloneNode(true);
      clone.classList.add('slider-bit__slide--clone');
      clone.setAttribute('aria-hidden', 'true');
      clone.removeAttribute('id');
      clone.__sbRealIndex = realIdx;
      return clone;
    }
  };

  SliderBit.prototype._perMove = function () {
    return this.options.perMove != null ? this.options.perMove : (this.options.perPage || 1);
  };

  SliderBit.prototype._toCss = function (v) {
    if (typeof v === 'number') return v + 'px';
    return v;
  };

  SliderBit.prototype._createArrow = function (dir, label) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slider-bit__arrow slider-bit__arrow--' + dir;
    btn.setAttribute('aria-label', dir === 'prev' ? 'Previous slide' : 'Next slide');
    btn.innerHTML = '<span aria-hidden="true">' + label + '</span>';
    var self = this;
    btn.addEventListener('click', function () {
      dir === 'prev' ? self.prev() : self.next();
    });
    return btn;
  };

  SliderBit.prototype._buildPagination = function () {
    if (!this.pagination) return;
    this.pagination.innerHTML = '';
    var pages = this._pageCount();
    var self = this;
    for (var i = 0; i < pages; i++) {
      (function (i) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'slider-bit__dot';
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        dot.addEventListener('click', function () { self.goTo(i * self._perMove()); });
        self.pagination.appendChild(dot);
      })(i);
    }
  };

  SliderBit.prototype._pageCount = function () {
    var per = this._perMove();
    var count = this.cloneCount ? this.realCount : this.slides.length;
    return Math.max(1, Math.ceil(count / per));
  };

  SliderBit.prototype._applyResponsive = function () {
    var bp = this.options.breakpoints;
    if (!bp || Object.keys(bp).length === 0) return;
    var self = this;
    var widths = Object.keys(bp).map(Number).sort(function (a, b) { return a - b; });

    function apply() {
      var w = global.innerWidth;
      var merged = Object.assign({}, self.baseOptions);
      widths.forEach(function (bw) {
        if (w <= bw) merged = Object.assign(merged, bp[bw]);
      });
      var perPageChanged = merged.perPage !== self.options.perPage;
      self.options = merged;
      self.isFade = self.options.type === 'fade';
      if (perPageChanged) {
        self._buildPagination();
      }
      self._render(false);
    }
    apply();
    global.addEventListener('resize', debounce(apply, 150));
  };

  function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      clearTimeout(t);
      var args = arguments;
      t = setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }

  // -------------------------------------------------------------------
  // Events: keyboard, autoplay hover, drag, wheel
  // -------------------------------------------------------------------

  SliderBit.prototype._bindEvents = function () {
    var self = this;

    // Discrete keyboard paging and wheel-to-page don't have an obvious
    // "correct" behavior against a freeform continuous scroll, so both are
    // simply not wired up in that mode (matches most real marquee sites,
    // which don't support arrow-key paging either).
    if (this.options.keyboard && !this.isContinuous) {
      this.el.addEventListener('keydown', function (e) {
        var forwardKey = self.isVertical ? 'ArrowDown' : (self.isRTL ? 'ArrowLeft' : 'ArrowRight');
        var backwardKey = self.isVertical ? 'ArrowUp' : (self.isRTL ? 'ArrowRight' : 'ArrowLeft');
        if (e.key === forwardKey) self.next();
        if (e.key === backwardKey) self.prev();
      });
    }

    if (this.options.pauseOnHover && (this.options.autoplay || this.isContinuous)) {
      this.el.addEventListener('mouseenter', function () { self.pause(); });
      this.el.addEventListener('mouseleave', function () { self.play(); });
    }

    if (this.isContinuous) {
      if (this.options.drag) this._bindContinuousDrag();
    } else {
      if (this.options.drag) this._bindDrag();
      if (this.options.wheel) this._bindWheel();
    }

    global.addEventListener('resize', debounce(function () {
      self._render(false);
      if (self.isContinuous && self._marqueeMeasure) self._marqueeMeasure();
    }, 150));
  };

  SliderBit.prototype._bindWheel = function () {
    var self = this;
    var locked = false;
    this.el.addEventListener('wheel', function (e) {
      var delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < (self.options.wheelMinThreshold || 40)) return;
      e.preventDefault();
      if (locked) return;
      if (delta > 0) self.next(); else self.prev();
      locked = true;
      setTimeout(function () { locked = false; }, self.options.wheelSleep || 700);
    }, { passive: false });
  };

  /**
   * Drag with live pixel-accurate follow + velocity-based "flick" on release
   * (a fast short swipe can jump multiple slides, matching native app carousels).
   */
  SliderBit.prototype._bindDrag = function () {
    var self = this;
    var startX = 0, startY = 0, lastAxis = 0, lastTime = 0, velocity = 0;
    var dragging = false, committed = false;
    var trackSizePx = 0;
    var startIndex = 0;
    var track = this.track;

    function axisOf(e) {
      var p = e.touches ? e.touches[0] : e;
      return self.isVertical ? p.clientY : p.clientX;
    }
    function crossAxisOf(e) {
      var p = e.touches ? e.touches[0] : e;
      return self.isVertical ? p.clientX : p.clientY;
    }
    function trackRectSize() {
      var r = track.getBoundingClientRect();
      return (self.isVertical ? r.height : r.width) || 1;
    }

    function pointerDown(e) {
      if (dragging) return;
      var p = e.touches ? e.touches[0] : e;
      startX = p.clientX;
      startY = p.clientY;
      lastAxis = axisOf(e);
      lastTime = Date.now();
      velocity = 0;
      dragging = true;
      committed = false;
      startIndex = self.index;
      trackSizePx = trackRectSize();
    }

    function pointerMove(e) {
      if (!dragging) return;
      var axis = axisOf(e);
      var cross = crossAxisOf(e);
      var mainDelta = axis - (self.isVertical ? startY : startX);
      var crossDelta = cross - (self.isVertical ? startX : startY);

      if (!committed) {
        if (Math.abs(mainDelta) < 5 && Math.abs(crossDelta) < 5) return;
        if (Math.abs(mainDelta) <= Math.abs(crossDelta)) {
          dragging = false; // this is a scroll gesture on the cross axis, let the browser handle it
          return;
        }
        committed = true;
        self._dragging = true;
        // A real drag gesture always takes priority over any pending loop
        // snap-back -- cancel it now so the eventual release move isn't
        // silently ignored by the _locked guard in _moveTo.
        self._cancelSnapBack();
        track.classList.add('slider-bit__track--dragging');
      }

      if (e.cancelable) e.preventDefault();

      var now = Date.now();
      var dt = now - lastTime;
      if (dt > 0) velocity = (axis - lastAxis) / dt;
      lastAxis = axis;
      lastTime = now;

      var per = self.options.perPage || 1;
      var deltaIdx = (mainDelta / trackSizePx) * per;
      var rawIndex = self.isRTL ? startIndex + deltaIdx : startIndex - deltaIdx;
      self._applyTransform(rawIndex, false);
    }

    function pointerUp() {
      if (!dragging) return;
      dragging = false;

      if (!committed) return;
      committed = false;
      self._dragging = false;
      track.classList.remove('slider-bit__track--dragging');

      var per = self.options.perPage || 1;
      var perMove = self._perMove();
      var idxVelocity = (velocity / trackSizePx) * per; // "slide widths" per ms
      var flickPower = self.options.flickPower || 600;
      var flickDeltaIdx = idxVelocity * (flickPower / 100);
      if (self.isRTL) flickDeltaIdx = -flickDeltaIdx;

      // Current raw (fractional) index from the live drag-follow transform.
      var currentTransformIndex = self._lastAppliedIndex != null ? self._lastAppliedIndex : self.index;
      var targetRaw = currentTransformIndex + flickDeltaIdx;

      var maxJump = (self.options.flickMaxPages || 1) * per;
      if (self.cloneCount) maxJump = Math.min(maxJump, self.cloneCount);
      targetRaw = Math.max(startIndex - maxJump, Math.min(startIndex + maxJump, targetRaw));

      var target;
      if (self.options.dragFree) {
        target = targetRaw;
      } else {
        target = Math.round(targetRaw / perMove) * perMove;
      }

      self._moveTo(target, true);
    }

    track.addEventListener('mousedown', pointerDown);
    global.addEventListener('mousemove', pointerMove);
    global.addEventListener('mouseup', pointerUp);
    track.addEventListener('touchstart', pointerDown, { passive: true });
    track.addEventListener('touchmove', pointerMove, { passive: false });
    track.addEventListener('touchend', pointerUp);
  };

  /**
   * Drag handling for continuous (marquee) mode. Unlike _bindDrag above,
   * there's no discrete slide index to reason about -- dragging just reads
   * and writes the same `_marqueeOffset` pixel value that the animation
   * ticker (_startContinuous) advances on its own, so a grab-and-release
   * always continues smoothly from wherever the user left it.
   */
  SliderBit.prototype._bindContinuousDrag = function () {
    var self = this;
    var track = this.track;
    var startPointer = 0, startOffset = 0, dragging = false;

    function axisVal(e) {
      var p = e.touches ? e.touches[0] : e;
      return self.isVertical ? p.clientY : p.clientX;
    }
    function wrap(v) {
      var loop = self._marqueeLoopPx;
      if (!loop) return v;
      while (v <= -loop) v += loop;
      while (v > 0) v -= loop;
      return v;
    }

    function down(e) {
      if (dragging) return;
      dragging = true;
      self._marqueeDragging = true;
      startPointer = axisVal(e);
      startOffset = self._marqueeOffset || 0;
      track.classList.add('slider-bit__track--dragging');
    }
    function move(e) {
      if (!dragging) return;
      if (e.cancelable) e.preventDefault();
      var delta = axisVal(e) - startPointer;
      self._marqueeOffset = wrap(startOffset + delta);
    }
    function up() {
      if (!dragging) return;
      dragging = false;
      self._marqueeDragging = false;
      track.classList.remove('slider-bit__track--dragging');
    }

    track.addEventListener('mousedown', down);
    global.addEventListener('mousemove', move);
    global.addEventListener('mouseup', up);
    track.addEventListener('touchstart', down, { passive: true });
    track.addEventListener('touchmove', move, { passive: false });
    track.addEventListener('touchend', up);
  };

  /**
   * Drives the seamless continuous marquee: a requestAnimationFrame loop
   * that advances `_marqueeOffset` at a constant px/ms speed (derived from
   * `interval`, repurposed here as "ms to travel one slide's width") and
   * writes it straight to the track's transform every frame. Wrapping at
   * `_marqueeLoopPx` (half the track's total width, i.e. exactly one real
   * loop -- see _buildClones) is what makes the restart invisible: past
   * that point the duplicated content is pixel-identical to where playback
   * started. Pausing (hover or drag) just stops advancing the offset; the
   * transform write still happens every frame so a drag can move it freely.
   */
  SliderBit.prototype._startContinuous = function () {
    if (!this.isContinuous) return;
    var self = this;
    var reduceMotion = typeof global.matchMedia === 'function' &&
      global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._marqueeOffset = 0;
    this._marqueeRunning = !reduceMotion; // still draggable, just doesn't auto-scroll on its own
    this._marqueeDragging = false;
    this._marqueeLastTime = null;
    this._marqueeLoopPx = 0;

    function measure() {
      // The track holds exactly two back-to-back copies of the real slides
      // (see _buildClones), so half its scrollWidth is the width of one loop.
      self._marqueeLoopPx = (self.isVertical ? self.track.scrollHeight : self.track.scrollWidth) / 2 || 1;
    }
    this._marqueeMeasure = measure;
    global.requestAnimationFrame(measure);

    function tick(now) {
      if (self._destroyed) return;
      if (self._marqueeLastTime == null) self._marqueeLastTime = now;
      var dt = now - self._marqueeLastTime;
      self._marqueeLastTime = now;

      if (self._marqueeRunning && !self._marqueeDragging && self._marqueeLoopPx > 0) {
        var durationMs = Math.max(4000, (self.options.interval || 1800) * self.realCount);
        var speed = self._marqueeLoopPx / durationMs; // px per ms
        var dir = self.isRTL ? 1 : -1;
        var offset = self._marqueeOffset + dir * speed * dt;
        var loop = self._marqueeLoopPx;
        while (offset <= -loop) offset += loop;
        while (offset > 0) offset -= loop;
        self._marqueeOffset = offset;
      }

      var axis = self.isVertical ? 'Y' : 'X';
      self.track.style.transform = 'translate' + axis + '(' + self._marqueeOffset + 'px)';
      self._marqueeRaf = global.requestAnimationFrame(tick);
    }
    this._marqueeRaf = global.requestAnimationFrame(tick);
  };

  // -------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------

  SliderBit.prototype.next = function () {
    this._moveTo(this.index + this._perMove(), true);
  };

  SliderBit.prototype.prev = function () {
    this._moveTo(this.index - this._perMove(), true);
  };

  /**
   * Public navigation API. `target` is always a REAL slide index (0-based,
   * ignoring clones) -- this is what pagination dots, sync partners, and
   * external callers use.
   */
  SliderBit.prototype.goTo = function (target) {
    if (!this.cloneCount) {
      var len = this.slides.length;
      var resolved;
      if (this.options.loop) {
        resolved = ((target % len) + len) % len;
      } else {
        resolved = Math.max(0, Math.min(target, len - (this.options.perPage || 1)));
      }
      this._moveTo(resolved, true);
      return;
    }

    // Pick whichever cycle (previous/current/next lap through the real slides)
    // lands closest to where we are now, so e.g. paging from the last page back
    // to page 0 continues forward through the clones instead of reversing.
    var base = this.cloneCount + target;
    var candidates = [base - this.realCount, base, base + this.realCount];
    var best = candidates[0];
    var self = this;
    candidates.forEach(function (c) {
      if (Math.abs(c - self.index) < Math.abs(best - self.index)) best = c;
    });
    this._moveTo(best, true);
  };

  /**
   * Internal mover: `target` is an index in "extended" (clone-inclusive) space
   * when clones exist, otherwise a plain slide index.
   *
   * On a looping slider, the clone buffer only extends a couple of slides past
   * the real range (see _buildClones), so rapid repeated calls -- mashing an
   * arrow button, holding an arrow key (which key-repeats far faster than the
   * transition can settle), or overlapping autoplay ticks with a short custom
   * interval -- can walk `index` past the last real clone in the DOM before the
   * previous move has snapped back. That leaves the track transformed to a
   * position with no matching slide: a visible glitch, not a seamless loop.
   * `_locked` blocks new loop-moves until the in-flight one has settled, the
   * same way most carousel libraries (e.g. Splide's `waitForTransition`) do.
   *
   * Rather than silently dropping a move that arrives mid-lock, we remember
   * only the most recent requested target as `_pendingMove` and replay it the
   * instant the snap-back settles (see _snapBack). That way a held arrow key
   * (or overlapping autoplay ticks) keeps advancing one safe step per
   * settle cycle instead of appearing to stall until the key is released.
   */
  SliderBit.prototype._moveTo = function (target, animate) {
    if (animate && this.cloneCount && this._locked) {
      this._pendingMove = target;
      return;
    }

    if (!this.cloneCount) {
      if (this.options.loop) {
        var len = this.slides.length;
        target = ((target % len) + len) % len;
      } else {
        target = Math.max(0, Math.min(target, this.slides.length - (this.options.perPage || 1)));
      }
    }

    this.index = target;
    this._render(animate);
    this._announce();
    this._fireChange();

    if (animate && this.cloneCount) this._armSnapBack();
  };

  // Internal-only: clears the pending timer/listener and unlocks, but leaves
  // _pendingMove untouched. Used by _armSnapBack (re-arming for the next
  // cycle) and by the settle callbacks in _armSnapBack below -- those must
  // NOT wipe out a just-queued move before _snapBack gets a chance to read
  // and replay it (that was a real bug: calling the old _cancelSnapBack from
  // the settle path nulled _pendingMove one line before _snapBack read it,
  // silently dropping every queued move and defeating the whole point of
  // queuing in the first place).
  SliderBit.prototype._clearSnapTimer = function () {
    clearTimeout(this._snapTimer);
    if (this._snapListener) {
      this.track.removeEventListener('transitionend', this._snapListener);
      this._snapListener = null;
    }
    this._locked = false;
  };

  // Public-ish: fully cancels an in-flight loop snap-back AND discards any
  // queued programmatic step. This is the drag gesture's entry point -- a
  // drag always overrides a queued move (see pointerMove above), so it's the
  // only caller that should also null out _pendingMove.
  SliderBit.prototype._cancelSnapBack = function () {
    this._clearSnapTimer();
    this._pendingMove = null;
  };

  SliderBit.prototype._armSnapBack = function () {
    var self = this;
    this._clearSnapTimer();
    this._locked = true;

    this._snapListener = function (e) {
      if (e.target !== self.track) return;
      self._clearSnapTimer();
      self._snapBack();
    };
    this.track.addEventListener('transitionend', this._snapListener);

    this._snapTimer = setTimeout(function () {
      self._clearSnapTimer();
      self._snapBack();
    }, (this.options.speed || 500) + 80);
  };

  SliderBit.prototype._snapBack = function () {
    if (!this.cloneCount) return;
    this._locked = false;
    var real = this._realIndex();
    var normalized = this.cloneCount + real;
    if (normalized !== this.index) {
      this.index = normalized;
      this._render(false);
    }
    // Replay whatever move (if any) arrived while we were locked, now that
    // it's safe -- this is what lets a held arrow key keep advancing instead
    // of going silent until the key is released and pressed again.
    if (this._pendingMove != null) {
      var pending = this._pendingMove;
      this._pendingMove = null;
      this._moveTo(pending, true);
    }
  };

  SliderBit.prototype._realIndex = function () {
    if (!this.cloneCount) return this.index;
    var r = (this.index - this.cloneCount) % this.realCount;
    return r < 0 ? r + this.realCount : r;
  };

  SliderBit.prototype._slideRealIndex = function (slide) {
    return typeof slide.__sbRealIndex === 'number' ? slide.__sbRealIndex : this.slides.indexOf(slide);
  };

  SliderBit.prototype._announce = function () {
    if (this.liveRegion) {
      var realIdx = this._realIndex();
      var count = this.cloneCount ? this.realCount : this.slides.length;
      this.liveRegion.textContent = 'Slide ' + (realIdx + 1) + ' of ' + count;
    }
  };

  SliderBit.prototype._onChange = function (cb) {
    this._changeCallbacks.push(cb);
  };

  SliderBit.prototype._fireChange = function () {
    var real = this._realIndex();
    this._changeCallbacks.forEach(function (cb) { cb(real); });
  };

  // -------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------

  SliderBit.prototype._offsetForIndex = function (idx) {
    var per = this.options.perPage || 1;
    var offset = idx * (100 / per);
    if (this.options.focus === 'center' && per > 1) {
      offset -= (100 - (100 / per)) / 2;
    }
    return offset;
  };

  SliderBit.prototype._applyTransform = function (idx, animate) {
    this._lastAppliedIndex = idx;
    var offset = this._offsetForIndex(idx);
    var signed = this.isVertical ? -offset : (this.isRTL ? offset : -offset);
    this.track.style.transition = animate ? 'transform var(--sb-speed) var(--sb-easing)' : 'none';
    this.track.style.transform = this.isVertical
      ? 'translateY(' + signed + '%)'
      : 'translateX(' + signed + '%)';
  };

  SliderBit.prototype._render = function (animate) {
    var per = this.options.perPage || 1;

    if (this.isContinuous) {
      // Still size the slides responsively via flex-basis, but positioning
      // is owned entirely by the requestAnimationFrame ticker in
      // _startContinuous -- no discrete index, pagination, or arrows apply.
      var contSlideSize = 100 / per;
      this.slides.forEach(function (slide) {
        slide.style.flex = '0 0 calc(' + contSlideSize + '% - (var(--sb-gap) * ' + (per - 1) + ' / ' + per + '))';
      });
      return;
    }

    if (this.isFade) {
      this.slides.forEach(function (slide, i) {
        // Includes transform alongside opacity so fade-mode presets that layer on
        // a custom transform via extraCss (stacked cards, 3D spin transitions, etc.)
        // animate smoothly instead of snapping instantly between positions.
        slide.style.transition = animate ? 'opacity var(--sb-speed) var(--sb-easing), transform var(--sb-speed) var(--sb-easing)' : 'none';
        slide.style.opacity = i === this.index ? '1' : '0';
        slide.style.zIndex = i === this.index ? '1' : '0';
      }, this);
    } else {
      var slideSize = 100 / per;
      this.slides.forEach(function (slide) {
        slide.style.flex = '0 0 calc(' + slideSize + '% - (var(--sb-gap) * ' + (per - 1) + ' / ' + per + '))';
      });
      this._applyTransform(this.index, animate);
    }

    if (this.pagination) {
      var realIdx = this._realIndex();
      var activePage = Math.floor(realIdx / this._perMove());
      Array.prototype.forEach.call(this.pagination.children, function (dot, i) {
        dot.classList.toggle('is-active', i === activePage);
        dot.setAttribute('aria-selected', i === activePage ? 'true' : 'false');
      });
    }

    if (this.prevBtn) this.prevBtn.disabled = !this.options.loop && this.index <= 0;
    if (this.nextBtn) this.nextBtn.disabled = !this.options.loop && this.index >= this.slides.length - per;

    // Purely additive, opt-in styling hooks: mark the primary-focus slide
    // and its immediate DOM neighbors so authors (or Slider Bit's own preset
    // CSS) can build "dim the neighbors" / coverflow-style 3D-tilt looks
    // without any engine changes beyond these three class names. No default
    // CSS targets them, so plain sliders are visually unaffected.
    this.slides.forEach(function (slide, i) {
      slide.classList.toggle('slider-bit__slide--current', i === this.index);
      slide.classList.toggle('slider-bit__slide--prev', i === this.index - 1);
      slide.classList.toggle('slider-bit__slide--next', i === this.index + 1);
    }, this);

    this._updateA11y();
  };

  /**
   * Keeps only the currently-visible slide(s) reachable by Tab / exposed to
   * screen readers -- otherwise a link/button inside an offscreen (or cloned)
   * slide would still be focusable in normal DOM order.
   */
  SliderBit.prototype._updateA11y = function () {
    var per = this.options.perPage || 1;
    var start = this.index;
    var end = this.index + per - 1;

    this.slides.forEach(function (slide, i) {
      var visible = i >= start && i <= end;
      slide.setAttribute('aria-hidden', visible && !slide.classList.contains('slider-bit__slide--clone') ? 'false' : 'true');

      var focusables = slide.querySelectorAll(FOCUSABLE_SELECTOR);
      Array.prototype.forEach.call(focusables, function (node) {
        if (!visible) {
          if (!node.hasAttribute('data-sb-prev-tabindex')) {
            node.setAttribute('data-sb-prev-tabindex', node.getAttribute('tabindex') || '');
          }
          node.setAttribute('tabindex', '-1');
        } else if (node.hasAttribute('data-sb-prev-tabindex')) {
          var prev = node.getAttribute('data-sb-prev-tabindex');
          if (prev) node.setAttribute('tabindex', prev); else node.removeAttribute('tabindex');
          node.removeAttribute('data-sb-prev-tabindex');
        }
      });
    });
  };

  SliderBit.prototype.play = function () {
    if (this.isContinuous) { this._marqueeRunning = true; return; }
    var self = this;
    this.pause();
    this._autoplayTimer = setInterval(function () { self.next(); }, this.options.interval || 4000);
  };

  SliderBit.prototype.pause = function () {
    if (this.isContinuous) { this._marqueeRunning = false; return; }
    if (this._autoplayTimer) {
      clearInterval(this._autoplayTimer);
      this._autoplayTimer = null;
    }
  };

  SliderBit.prototype.destroy = function () {
    this.pause();
    clearTimeout(this._snapTimer);
    this._destroyed = true;
    if (this._marqueeRaf) global.cancelAnimationFrame(this._marqueeRaf);
    delete this.el.__sliderBitInstance;
  };

  // -------------------------------------------------------------------
  // Sync: link two sliders (e.g. a main gallery + a thumbnail nav strip)
  // -------------------------------------------------------------------

  /**
   * Bidirectionally syncs this slider with another. If opts.nav is true, this
   * slider's slides become clickable/keyboard-activatable thumbnails that jump
   * `other` to the clicked slide, and highlight (`is-active` class) to track
   * whichever real slide `other` currently shows.
   */
  SliderBit.prototype.sync = function (other, opts) {
    opts = opts || {};
    var self = this;

    self._onChange(function (realIndex) {
      if (other._syncing) return;
      self._syncing = true;
      other.goTo(realIndex);
      self._syncing = false;
    });
    other._onChange(function (realIndex) {
      if (self._syncing) return;
      other._syncing = true;
      self.goTo(realIndex);
      other._syncing = false;
    });

    if (opts.nav) {
      self.el.classList.add('slider-bit--nav');

      var highlight = function (realIndex) {
        self.slides.forEach(function (slide) {
          slide.classList.toggle('is-active', self._slideRealIndex(slide) === realIndex);
        });
      };

      self.slides.forEach(function (slide) {
        if (slide.classList.contains('slider-bit__slide--clone')) return;
        slide.setAttribute('tabindex', '0');
        slide.setAttribute('role', 'button');
        var activate = function () { other.goTo(self._slideRealIndex(slide)); };
        slide.addEventListener('click', activate);
        slide.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            activate();
          }
        });
      });

      other._onChange(highlight);
      highlight(other._realIndex());
    }
  };

  // -------------------------------------------------------------------
  // Config-only remote hydration: Slider Bit never hosts your images — you
  // build your own slide markup (hand-authored in Webflow's Designer, or a
  // CMS Collection List with our BEM classes added to it) using your own
  // images. `data-sliderbit-config-id` is just an optional convenience for
  // NOT having to paste the same options JSON on every page: it fetches a
  // small saved { config, theme } blob from the Slider Bit API and applies
  // it to a container that already has its own real track/slides, then
  // instantiates normally against that existing DOM (nothing is rebuilt).
  //
  //   <div class="slider-bit" data-sliderbit-config-id="abc123">
  //     <div class="slider-bit__track">
  //       <div class="slider-bit__slide"><img src="your-own-image.jpg" alt=""></div>
  //       ...
  //     </div>
  //   </div>
  //   <link rel="stylesheet" href="https://your-site.netlify.app/sliderbit.css">
  //   <script src="https://your-site.netlify.app/sliderbit.js" defer></script>
  //
  // Most embeds don't need this at all — just put the options directly in
  // data-sliderbit-config='{"loop":true,...}' on the container and skip the
  // network round-trip entirely.
  // -------------------------------------------------------------------

  var __scriptEl = (typeof document !== 'undefined') ? document.currentScript : null;
  var API_BASE = '';
  if (__scriptEl && __scriptEl.src) {
    try { API_BASE = new URL(__scriptEl.src).origin; } catch (e) { API_BASE = ''; }
  }

  // Declarative sync/nav wiring, e.g.:
  //   <div class="slider-bit" data-sliderbit-sync="#main" data-sliderbit-nav>...</div>
  // Called once per instance as soon as it exists -- immediately for plain
  // inline sliders, or after the fetch() resolves for config-id sliders --
  // so it works regardless of which path (or order) built the two sliders.
  function tryWireSync(inst, scope) {
    var sel = inst.el.getAttribute('data-sliderbit-sync');
    if (!sel || inst._synced) return;
    scope = scope || document;
    var otherEl = scope.querySelector(sel) || document.querySelector(sel);
    var other = otherEl && otherEl.__sliderBitInstance;
    if (other && other !== inst && !other._synced) {
      inst._synced = true;
      other._synced = true;
      inst.sync(other, { nav: inst.el.hasAttribute('data-sliderbit-nav') });
    }
  }

  function hydrateRemoteConfig(el, id, scope) {
    var track = el.querySelector('.slider-bit__track');
    if (!track || track.children.length === 0) {
      console.warn('SliderBit: data-sliderbit-config-id="' + id + '" needs its own .slider-bit__track with real slide markup already in the DOM (Slider Bit does not host images) — skipping', el);
      return;
    }
    var apiBase = el.getAttribute('data-sliderbit-api') || API_BASE;
    if (!apiBase) {
      console.warn('SliderBit: no API base available (script must be loaded via <script src="..."> from your hosted domain, or set data-sliderbit-api on the container) — cannot load saved config', id);
      new SliderBit(el); // still build the slider off local markup with whatever defaults/inline config it already has
      if (el.__sliderBitInstance) tryWireSync(el.__sliderBitInstance, scope);
      return;
    }
    return fetch(apiBase + '/api/sliders/' + encodeURIComponent(id))
      .then(function (res) {
        if (!res.ok) throw new Error('failed to load config "' + id + '" (HTTP ' + res.status + ')');
        return res.json();
      })
      .then(function (data) {
        el.setAttribute('data-sliderbit-config', JSON.stringify(data.config || {}));
        if (data.theme) {
          if (data.theme.arrowColor) el.style.setProperty('--sb-arrow-color', data.theme.arrowColor);
          if (data.theme.dotColorActive) el.style.setProperty('--sb-dot-color-active', data.theme.dotColorActive);
          if (data.theme.radius != null) el.style.setProperty('--sb-radius', data.theme.radius + 'px');
        }
        new SliderBit(el);
      })
      .catch(function (err) {
        console.warn('SliderBit:', err.message || err, '— building with local/default options instead');
        new SliderBit(el);
      })
      .then(function () {
        if (el.__sliderBitInstance) tryWireSync(el.__sliderBitInstance, scope);
      });
  }

  function initAll(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('.slider-bit');
    var built = [];

    Array.prototype.forEach.call(nodes, function (el) {
      var configId = el.getAttribute('data-sliderbit-config-id');
      if (configId) {
        hydrateRemoteConfig(el, configId, scope);
        if (el.__sliderBitInstance) built.push(el.__sliderBitInstance);
      } else {
        built.push(new SliderBit(el));
      }
    });

    built.forEach(function (inst) { tryWireSync(inst, scope); });

    return built;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initAll(); });
  } else {
    initAll();
  }

  global.SliderBit = SliderBit;
  global.SliderBit.initAll = initAll;
})(typeof window !== 'undefined' ? window : this);
