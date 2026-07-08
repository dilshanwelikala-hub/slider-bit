/*!
 * Slider Bit v1.0.0
 * Lightweight, dependency-free slider/carousel for Webflow (or any site) embeds.
 * Inspired by Splide.js feature set. MIT-style, do whatever you want with it.
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
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    type: 'slide',        // 'slide' | 'fade'
    direction: 'ltr',      // 'ltr' | 'vertical'
    perPage: 1,
    perMove: null,         // null = move by perPage (page-based); set a number to override
    gap: '1rem',
    padding: '0',
    height: '',            // e.g. '400px'; if empty, aspect ratio is used
    aspectRatio: '16/9',
    loop: true,
    autoplay: false,
    interval: 4000,
    pauseOnHover: true,
    speed: 500,
    easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    arrows: true,
    pagination: true,
    drag: true,
    keyboard: true,
    lazyLoad: true,
    startIndex: 0,
    breakpoints: {}        // { 768: { perPage: 1 }, 1024: { perPage: 3 } }
  };

  var instanceId = 0;

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
    this.index = this.options.startIndex || 0;
    this.isFade = this.options.type === 'fade';
    this.isVertical = this.options.direction === 'vertical';
    this._autoplayTimer = null;
    this._dragging = false;

    if (!this.track || this.slides.length === 0) {
      console.warn('SliderBit: no .slider-bit__track / .slider-bit__slide found in', el);
      return;
    }

    el.__sliderBitInstance = this;
    this._build();
    this._applyResponsive();
    this._bindEvents();
    this._render(false);
    if (this.options.autoplay) this.play();
  }

  SliderBit.prototype._build = function () {
    var el = this.el;
    el.classList.add('slider-bit');
    if (this.isVertical) el.classList.add('slider-bit--vertical');
    el.setAttribute('role', 'region');
    el.setAttribute('aria-roledescription', 'carousel');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');

    this.track.classList.add('slider-bit__track');
    if (this.isFade) this.track.classList.add('slider-bit__track--fade');

    this.slides.forEach(function (slide, i) {
      slide.classList.add('slider-bit__slide');
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'slide');
      slide.setAttribute('aria-label', (i + 1) + ' of ' + this.slides.length);
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

    // Arrows
    if (this.options.arrows && this.slides.length > 1) {
      this.prevBtn = this._createArrow('prev', '‹');
      this.nextBtn = this._createArrow('next', '›');
      el.appendChild(this.prevBtn);
      el.appendChild(this.nextBtn);
    }

    // Pagination
    if (this.options.pagination && this.slides.length > 1) {
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
    return Math.max(1, Math.ceil(this.slides.length / per));
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

  function debounce(fn, wait) {
    var t;
    return function () {
      clearTimeout(t);
      var args = arguments;
      t = setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }

  SliderBit.prototype._bindEvents = function () {
    var self = this;

    if (this.options.keyboard) {
      this.el.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') self.next();
        if (e.key === 'ArrowLeft') self.prev();
      });
    }

    if (this.options.pauseOnHover && this.options.autoplay) {
      this.el.addEventListener('mouseenter', function () { self.pause(); });
      this.el.addEventListener('mouseleave', function () { self.play(); });
    }

    if (this.options.drag) {
      this._bindDrag();
    }

    global.addEventListener('resize', debounce(function () { self._render(false); }, 150));
  };

  SliderBit.prototype._bindDrag = function () {
    var self = this;
    var startX = 0, startY = 0, deltaX = 0, deltaY = 0, dragging = false;
    var track = this.track;

    function pointerDown(e) {
      dragging = true;
      self._dragging = true;
      var p = e.touches ? e.touches[0] : e;
      startX = p.clientX;
      startY = p.clientY;
      deltaX = 0; deltaY = 0;
      track.classList.add('slider-bit__track--dragging');
    }
    function pointerMove(e) {
      if (!dragging) return;
      var p = e.touches ? e.touches[0] : e;
      deltaX = p.clientX - startX;
      deltaY = p.clientY - startY;
      if (Math.abs(deltaX) > Math.abs(deltaY) && e.cancelable) e.preventDefault();
    }
    function pointerUp() {
      if (!dragging) return;
      dragging = false;
      self._dragging = false;
      track.classList.remove('slider-bit__track--dragging');
      var threshold = 40;
      var delta = self.isVertical ? deltaY : deltaX;
      if (delta > threshold) self.prev();
      else if (delta < -threshold) self.next();
      else self._render(false);
    }

    track.addEventListener('mousedown', pointerDown);
    global.addEventListener('mousemove', pointerMove);
    global.addEventListener('mouseup', pointerUp);
    track.addEventListener('touchstart', pointerDown, { passive: true });
    track.addEventListener('touchmove', pointerMove, { passive: false });
    track.addEventListener('touchend', pointerUp);
  };

  SliderBit.prototype.next = function () {
    this.goTo(this.index + this._perMove());
  };

  SliderBit.prototype.prev = function () {
    this.goTo(this.index - this._perMove());
  };

  SliderBit.prototype.goTo = function (i) {
    var len = this.slides.length;
    if (this.options.loop) {
      this.index = ((i % len) + len) % len;
    } else {
      this.index = Math.max(0, Math.min(i, len - (this.options.perPage || 1)));
    }
    this._render(true);
    this._announce();
  };

  SliderBit.prototype._announce = function () {
    if (this.liveRegion) {
      this.liveRegion.textContent = 'Slide ' + (this.index + 1) + ' of ' + this.slides.length;
    }
  };

  SliderBit.prototype._render = function (animate) {
    var per = this.options.perPage || 1;
    var track = this.track;

    if (this.isFade) {
      this.slides.forEach(function (slide, i) {
        slide.style.transition = animate ? 'opacity var(--sb-speed) var(--sb-easing)' : 'none';
        slide.style.opacity = i === this.index ? '1' : '0';
        slide.style.zIndex = i === this.index ? '1' : '0';
      }, this);
    } else {
      var slideSize = 100 / per;
      this.slides.forEach(function (slide) {
        slide.style.flex = '0 0 calc(' + slideSize + '% - (var(--sb-gap) * ' + (per - 1) + ' / ' + per + '))';
      });
      var offset = this.index * (100 / per);
      track.style.transition = animate ? 'transform var(--sb-speed) var(--sb-easing)' : 'none';
      track.style.transform = this.isVertical
        ? 'translateY(-' + offset + '%)'
        : 'translateX(-' + offset + '%)';
    }

    if (this.pagination) {
      var activePage = Math.floor(this.index / this._perMove());
      Array.prototype.forEach.call(this.pagination.children, function (dot, i) {
        dot.classList.toggle('is-active', i === activePage);
        dot.setAttribute('aria-selected', i === activePage ? 'true' : 'false');
      });
    }

    if (this.prevBtn) this.prevBtn.disabled = !this.options.loop && this.index <= 0;
    if (this.nextBtn) this.nextBtn.disabled = !this.options.loop && this.index >= this.slides.length - per;
  };

  SliderBit.prototype.play = function () {
    var self = this;
    this.pause();
    this._autoplayTimer = setInterval(function () { self.next(); }, this.options.interval || 4000);
  };

  SliderBit.prototype.pause = function () {
    if (this._autoplayTimer) {
      clearInterval(this._autoplayTimer);
      this._autoplayTimer = null;
    }
  };

  SliderBit.prototype.destroy = function () {
    this.pause();
    delete this.el.__sliderBitInstance;
  };

  function initAll(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('.slider-bit');
    Array.prototype.forEach.call(nodes, function (el) { new SliderBit(el); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initAll(); });
  } else {
    initAll();
  }

  global.SliderBit = SliderBit;
  global.SliderBit.initAll = initAll;
})(typeof window !== 'undefined' ? window : this);
