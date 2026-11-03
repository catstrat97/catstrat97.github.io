/* ============================================================
 *  project-detail.js — Project interior (Figma 778:708)
 *    • the media stack: frames open by height, staggered; a few
 *      scramble in behind an ASCII wash before settling
 *    • copy writes in through the shared SiteFX primitive, after
 *      the panel rule has drawn — same choreography as every page
 * ============================================================ */
(function () {
  var mediaEl = document.getElementById('pv-media');
  if (!mediaEl) return;

  var MEDIA_W = 894;
  var PANEL_W = 352;                              // Figma 778:713
  // v2 opens in the wide view (the <html> already carries .is-collapsed).
  var collapsed = true;                           // slideshow mode (Figma 778:771)

  /* Collapse choreography, in the order the transition reads:
     text redacts → rule retracts → the glyph lerps to the collapsed bar →
     rule draws back in. The frames wash out under it and back in after.
     This is a toggle, not a page load — it runs at roughly a third of the
     load-in's pace, and the redact is scaled down to match rather than
     using the full 2.6s sweep a page of copy would otherwise get. */
  var REDACT_FAST = {scale: 0.18, tick: 30};      // ≈ 590ms, not ≈ 2840ms
  var INTRO_WASH = 1500;                          // load-in strip — the specified 1.5s
  var RULE_OUT = 380;                             // matches the CSS retract
  var GLYPH_LERP = 420;
  var RULE_IN = 520;

  /* Frames come from the CMS. Aspect decides the shape: near-square art is
     inset to 502px (Figma 778:751/753), anything wider runs the full column
     (778:752). Videos report their aspect once metadata lands. */
  var FRAMES = [];

  function qs(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }

  /* Both layouts size from the same pair of numbers: the width a frame takes
     in the vertical stack (894, or 502 when it's near-square), and its aspect.
     Stacked, that width is the answer. In slideshow mode the frame is capped
     to the band height instead (Figma 778:773 — an 828px band inside 908, so
     a 9:16 portrait lands at 465.7×828) and the width follows from the aspect. */
  var BAND_PAD = 40;                              // Figma: y=40 top and bottom

  function bandHeight() {
    return Math.max(180, window.innerHeight - BAND_PAD * 2);
  }
  /* Phone: the info panel sits on top, so the band starts under it
     (--pv-top) and the frame fits that band, leaving a sliver of each
     neighbour showing either side so the swipe reads as a strip. */
  var TOUCH = document.documentElement.classList.contains('is-touch');
  var panelEl = document.getElementById('pv-panel');
  function setBandTop() {
    if (TOUCH && panelEl) document.documentElement.style.setProperty('--pv-top',
      Math.ceil(panelEl.getBoundingClientRect().height) + 'px');
  }
  function frameMetrics(f) {
    if (TOUCH) {
      // Vertical strip: full width less the gutters, height from the aspect.
      var tw = window.innerWidth - 40;
      return {w: Math.round(tw), h: Math.round(tw / f.aspect)};
    }
    var wStack = Math.min(f.square ? 502 : MEDIA_W,
      Math.max(160, window.innerWidth - PANEL_W - 48));
    if (!collapsed) return {w: wStack, h: Math.round(wStack / f.aspect)};
    // Slideshow: the focused frame should OWN the screen — fill the band
    // height, capped only at 82% of the band's width. (Portraits are already
    // height-bound; this mainly lets wide and square media grow.)
    var bw = Math.max(320, (window.innerWidth - 71.105) * 0.82);
    var h = Math.min(bandHeight(), bw / f.aspect);
    return {w: Math.round(h * f.aspect), h: Math.round(h)};
  }
  function sizeFrame(f) {
    if (!f.el) return;
    var m = frameMetrics(f);
    f.el.style.width = m.w + 'px';
    if (f.el.classList.contains('is-in')) f.el.style.height = m.h + 'px';
    if (TOUCH) loopKick();
  }

  /* The frame wash — the same texture the noise field uses, so frames arrive
     in the same language as the type. Lives in site.js now because the
     projects page washes its thumbnail out through the identical primitive. */
  function scrambleIn(el, pre, done, sweep) {
    if (window.SiteFX && SiteFX.wash) SiteFX.wash(el, pre, 'in', done, sweep);
    else done();
  }
  function scrambleOut(el, pre, done, sweep) {
    if (window.SiteFX && SiteFX.wash) SiteFX.wash(el, pre, 'out', done, sweep);
    else done();
  }

  function build() {
    mediaEl.innerHTML = '';
    FRAMES.forEach(function (f, i) {
      var el = document.createElement('div');
      el.className = 'pv-frame' + (f.square ? ' is-square' : '');
      if (f.media) {
        var m;
        if (f.media.type === 'video') {
          m = document.createElement('video');
          m.muted = true; m.loop = true; m.playsInline = true; m.autoplay = !collapsed;
          m.addEventListener('loadedmetadata', function () {
            if (m.videoWidth && m.videoHeight) {
              f.aspect = m.videoWidth / m.videoHeight;
              f.square = f.aspect < 1.3;
              el.classList.toggle('is-square', f.square);
              sizeFrame(f);
            }
          });
          m.src = f.media.url;
        } else {
          m = document.createElement('img');
          m.alt = '';
          m.src = f.media.url;
        }
        el.appendChild(m);
      }
      /* Every frame carries a wash layer — the collapse transition washes all
         of them. `f.scramble` still decides which arrive scrambled on load;
         those start under a full cover (the wash decays it), the rest start
         settled with the wash already cleared. */
      var pre = document.createElement('pre');
      pre.className = 'pv-scramble';
      if (f.scramble) pre.style.backgroundColor = 'rgb(1,1,1)';
      el.appendChild(pre);
      if (!f.scramble) el.classList.add('is-settled');
      mediaEl.appendChild(el);
      f.el = el; f.pre = pre;
    });
  }

  /* ── Populate from the CMS ─────────────────────────────────── */
  function textFromBlocks(body) {
    if (!body) return '';
    if (typeof body === 'string') return body;
    // Portable Text → plain string.
    return [].concat(body).map(function (b) {
      if (typeof b === 'string') return b;
      return (b && b.children ? b.children.map(function (c) { return c.text || ''; }).join('') : '');
    }).join(' ').trim();
  }

  function applyProject(row) {
    if (!row) return;
    document.title = row.title + ' — Sharang Sharma';
    var t = document.getElementById('pv-title');
    if (t) t.textContent = row.client || row.title;

    var content = [].concat(row.content || []);
    // Prefer the dedicated Description field; fall back to the first inline
    // text block for projects authored before that field existed.
    var desc = (row.description || '').trim();
    content.forEach(function (b) {
      if (b && b._type === 'textBlock' && !desc) desc = textFromBlocks(b.body);
    });
    // Every field comes from the CMS once a project loads — the static
    // markup is Sycamore's, so anything left unset is cleared, not inherited.
    var d = document.getElementById('pv-desc');
    if (d) d.textContent = desc;
    var lk = document.getElementById('pv-link');
    if (lk) {
      if (row.link) { lk.href = row.link; lk.hidden = false; }
      else lk.hidden = true;
    }

    var roles = (row.role || '').split(',').map(function (r) { return r.trim(); })
      .filter(Boolean);
    var rl = document.getElementById('pv-roles');
    if (rl) {
      rl.innerHTML = '';
      roles.forEach(function (r) {
        var sp = document.createElement('span');
        sp.textContent = r;
        rl.appendChild(sp);
      });
    }

    FRAMES = [];
    content.forEach(function (b, i) {
      if (!b || b._type !== 'mediaItem') return;
      var url = b.mediaType === 'video' ? b.videoUrl
        : (b.imageUrl ? SS.imageUrl(b.imageUrl, {width: 1400}) : null);
      if (!url) return;
      var ar = b.imageDims && b.imageDims.aspectRatio ? b.imageDims.aspectRatio : 1;
      FRAMES.push({
        aspect: ar,
        square: ar < 1.3,
        scramble: i % 2 === 0,          // every other frame arrives scrambled
        media: {type: b.mediaType === 'video' ? 'video' : 'image', url: url}
      });
    });
  }

  /* Intro timers are tracked so a toggle can cancel them: a pending intro
     strip firing MID-collapse would strip the cover the toggle just built,
     exposing the media while the layout changes underneath it. */
  var introTimers = [];
  function openFrames() {
    FRAMES.forEach(function (f, i) {
      introTimers.push(setTimeout(function () {
        f.el.classList.add('is-in');
        sizeFrame(f);
        if (f.scramble) {
          // Wait for the height to land, then strip the cover slowly — the
          // load-in is an arrival, not a toggle, so it takes its time
          // (INTRO_WASH) where the collapse wash uses the quick default.
          introTimers.push(setTimeout(function () {
            scrambleIn(f.el, f.pre, function () { f.el.classList.add('is-settled'); },
              INTRO_WASH);
          }, 380));
        }
      }, i * 220));
    });
  }

  function relayout() {
    setBandTop();
    FRAMES.forEach(sizeFrame);
  }
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt); rt = setTimeout(relayout, 150);
  });

  /* ── Copy: hidden at build, written in on the reveal beat ──── */
  function copyEls() {
    return [document.getElementById('pv-title'),
      document.getElementById('pv-desc'),
      document.querySelector('.pv-roles-label'),
      document.querySelector('.pv-link-label')]
      .concat([].slice.call(document.querySelectorAll('#pv-roles span')))
      .filter(Boolean);
  }

  /* The two SVGs (header mark 778:716, link arrow 778:728) sit beside the
     written spans, so the write never touches them — left alone they were on
     screen from first paint, ahead of the type. Fade them in once the last
     character has landed. */
  function glyphEls() {
    return [].slice.call(document.querySelectorAll('.pv-glyph, .pv-arrow'));
  }
  function showGlyphs() {
    glyphEls().forEach(function (el) { el.classList.add('is-in'); });
  }

  function start() {
    if (window.SiteFX && window.SiteFX.write) window.SiteFX.write(copyEls(), showGlyphs);
    else showGlyphs();
    // Failsafe: never leave the glyphs permanently hidden if the write's
    // completion callback doesn't arrive.
    setTimeout(showGlyphs, 6000);
    openFrames();
    if (TOUCH) {
      if (capTitle) capTitle.textContent = (document.getElementById('pv-title') || {}).textContent || '';
      loopKick();
    } else if (collapsed) startBrowsing();
  }

  /* ── Collapse → slideshow (Figma 778:771) ──────────────────────
     The sidebar folds to a 71px bar holding nothing but its own toggle, and
     the stack turns on its side. The beats, in order:

       1. the copy redacts, and every frame washes out under ASCII
       2. the rule draws up
       3. the panel resizes behind the blank, and the glyph lerps across
       4. the rule draws back in, and the frames wash in to the new layout

     Steps 1 and 2 overlap the wash deliberately — the frames are already
     covered by the time the rule moves, so the relayout is never seen. */
  var root = document.documentElement;
  var busy = false;

  /* The toggle's frame exit — the SAME animation frames play when leaving the
     page: cover builds over the media, strips to nothing, and the frame
     closes. The stage is completely EMPTY before anything else moves. */
  function exitFrames(done) {
    var live = FRAMES.filter(function (f) { return f.el && f.pre; });
    if (!live.length) { done(); return; }
    var left = live.length;
    live.forEach(function (f) {
      f.el.classList.remove('is-settled');
      f.el.classList.add('is-washing');           // media dissolves under the cover
      scrambleOut(f.el, f.pre, function () {
        scrambleIn(f.el, f.pre, function () {     // strip over hidden media → blank
          f.el.classList.remove('is-in');         // frame closes — stage empties
          if (--left === 0) done();
        });
      });
    });
  }

  /* The arrival — identical to the page load-in: frames reset to their
     pre-open state, then openFrames plays the staggered height-open with the
     alternating scramble reveal, at the new layout's sizes. */
  function arriveFrames() {
    FRAMES.forEach(function (f) {
      if (!f.el) return;
      f.el.classList.remove('is-washing', 'is-washed', 'is-settled');
      f.el.style.transform = '';              // clear any browse tuck/scale
      if (f.pre) {
        f.pre.textContent = '';
        f.pre.style.backgroundColor = f.scramble ? 'rgb(1,1,1)' : '';
      }
      if (!f.scramble) f.el.classList.add('is-settled');
    });
    openFrames();
  }

  function setCollapsed(next) {
    if (busy || next === collapsed) return;
    busy = true;

    // A toggle during the load-in: pending intro strips would tear the cover
    // this sequence is about to build, and in-flight write ciphers on the
    // copy would fight the redact. Cancel both up front.
    introTimers.forEach(clearTimeout);
    introTimers = [];
    var copy = copyEls();
    if (window.SiteFX && SiteFX.cancel && SiteFX.chars) SiteFX.cancel(SiteFX.chars(copy));

    /* 1 — the copy redacts while every frame plays its EXIT: cover → strip →
       close. The stage must be COMPLETELY EMPTY before anything else moves —
       nothing is held under a cover through the change. */
    var blanked = false, redacted = false;
    function ready() { if (blanked && redacted) step2(); }
    exitFrames(function () { blanked = true; ready(); });
    if (window.SiteFX && SiteFX.redact) {
      SiteFX.redact(copy, function () { redacted = true; ready(); }, REDACT_FAST);
    } else {
      redacted = true;
    }
    // Watchdog: no lost callback may ever stall the sequence mid-blank.
    setTimeout(function () { blanked = true; redacted = true; step2(); }, 2000);

    var stepped2 = false;
    function step2() {
      if (stepped2) return;
      stepped2 = true;
      // 2 — the stage is blank; the rule draws up. `is-toggling` holds the
      // toggle's own rule timings for the whole sequence, so the 1750ms
      // load-in draw is left alone.
      root.classList.add('is-toggling');
      root.offsetHeight;                    // paint the start state first
      root.classList.add('is-ruling');
      setTimeout(step3, RULE_OUT);
    }
    function step3() {
      // 3 — the layout swaps while the stage is empty; the glyph lerps to
      // its new seat.
      collapsed = next;
      root.classList.toggle('is-collapsed', collapsed);
      // The toggle itself stays lit through the whole move — it is the thing
      // being lerped. The link arrow follows its label back in, at step 4.
      if (toggleEl) toggleEl.classList.add('is-in');
      var arrow = document.querySelector('.pv-arrow');
      if (arrow) arrow.classList.remove('is-in');
      relayout();
      if (collapsed) startBrowsing(); else { stopBrowsing(); window.scrollTo(0, 0); }
      setTimeout(step4, GLYPH_LERP);
    }
    function step4() {
      // 4 — the rule draws back in, and the new layout's frames ARRIVE the
      // way they do on page load: staggered height-open, scramble reveal.
      root.classList.remove('is-ruling');
      arriveFrames();
      if (!collapsed && window.SiteFX && SiteFX.write) SiteFX.write(copy, showGlyphs);
      setTimeout(function () {
        root.classList.remove('is-toggling');
        busy = false;
      }, RULE_IN);
    }
  }

  // The glyph is the toggle — in the collapsed bar it is the only thing left.
  var toggleEl = document.querySelector('.pv-glyph');
  if (toggleEl) {
    toggleEl.setAttribute('role', 'button');
    toggleEl.setAttribute('tabindex', '0');
    toggleEl.setAttribute('aria-label', 'toggle slideshow');
    toggleEl.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();        // the crosshair module toggles on any click
      setCollapsed(!collapsed);
    }, true);
    toggleEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed(!collapsed); }
    });
  }

  /* ── Browse (v2): one gesture = one project ─────────────────────
     v1 lerped toward a target every wheel tick moved, then snapped 170ms
     after the wheel went quiet — so trackpad momentum (which keeps firing
     for ~1s) and the snap pulled against each other, and the neighbour
     tuck changed the spacing as you went. Here navigation is discrete:
       · a wheel/trackpad gesture steps exactly one frame, and its momentum
         tail is swallowed (a fresh flick or a held mouse wheel still steps)
       · ← / → keys, clicking a side frame, and drag/swipe step too
       · the strip eases to centre the frame (GSAP, expo.out) — nothing
         else moves the scroll position, so there is nothing to fight
       · the focused frame is full size and plays; the rest sit back at
         SIDE_SCALE / SIDE_DIM and are paused
     The stacked view scrolls the page natively, untouched. */
  var idx = 0;
  var SIDE_SCALE = 0.86, SIDE_DIM = 0.3;
  // Phone: neighbours shrink less, or the sliver either side leaves the screen.
  if (TOUCH) SIDE_SCALE = 0.94;
  var STEP_EASE = 'expo.out', STEP_DUR = 0.95;
  var capTitle = document.getElementById('pv-cap-title');
  var capCount = document.getElementById('pv-cap-count');
  var progBar = document.getElementById('pv-progress-bar');
  var hasGsap = !!(window.gsap && gsap.to);

  function bandHalf() { return mediaEl.getBoundingClientRect().width / 2; }
  function centreScroll(el) { return el.offsetLeft + el.offsetWidth / 2 - bandHalf(); }
  function clampScroll(x) {
    var max = Math.max(0, mediaEl.scrollWidth - bandHalf() * 2);
    return Math.max(0, Math.min(max, x));
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function paint(instant) {
    FRAMES.forEach(function (f, k) {
      if (!f.el) return;
      var on = k === idx;
      f.el.classList.toggle('is-focus', on);
      var to = {scale: on ? 1 : SIDE_SCALE, opacity: on ? 1 : SIDE_DIM};
      if (hasGsap) gsap.to(f.el, Object.assign(to, {duration: instant ? 0 : 0.7,
        ease: 'power3.out', overwrite: 'auto'}));
      else { f.el.style.transform = 'scale(' + to.scale + ')'; f.el.style.opacity = to.opacity; }
      var v = f.el.querySelector('video');
      if (v) { if (on) { var p = v.play(); if (p) p.catch(function () {}); } else v.pause(); }
    });
    var n = FRAMES.length;
    if (capCount) capCount.textContent = pad2(idx + 1) + ' / ' + pad2(n);
    if (progBar) progBar.style.transform = 'scaleX(' + (n ? (idx + 1) / n : 0) + ')';
  }

  function go(n, instant) {
    if (!collapsed || !FRAMES.length) return;
    idx = Math.max(0, Math.min(FRAMES.length - 1, n));
    var el = FRAMES[idx].el;
    if (!el) return;
    var x = clampScroll(centreScroll(el));
    if (hasGsap) gsap.to(mediaEl, {scrollLeft: x, duration: instant ? 0 : STEP_DUR,
      ease: STEP_EASE, overwrite: true});
    else mediaEl.scrollLeft = x;
    paint(instant);
  }

  function startBrowsing() {
    if (capTitle) capTitle.textContent = (document.getElementById('pv-title') || {}).textContent || '';
    // Centre the first frame once it has a size — the arrival staggers in.
    var tries = 0;
    (function seed() {
      if (FRAMES[0] && FRAMES[0].el && FRAMES[0].el.offsetWidth) go(0, true);
      else if (++tries < 30) setTimeout(seed, 100);
    })();
  }
  function stopBrowsing() {
    // Back to the stacked view: no focus styling, every video plays.
    FRAMES.forEach(function (f) {
      if (!f.el) return;
      if (hasGsap) gsap.set(f.el, {clearProps: 'transform,opacity'});
      else { f.el.style.transform = ''; f.el.style.opacity = ''; }
      f.el.classList.remove('is-focus');
      var v = f.el.querySelector('video');
      if (v) { var p = v.play(); if (p) p.catch(function () {}); }
    });
  }

  /* Wheel / trackpad. A gesture steps once, then locks; the lock lifts when
     the stream goes quiet (WHEEL_IDLE), when a NEW flick spikes out of the
     decaying momentum tail, or after WHEEL_REPEAT of continuous input — so
     a mouse wheel held spinning walks frames at a steady, readable pace. */
  var WHEEL_TRIGGER = 28, WHEEL_IDLE = 170, WHEEL_REPEAT = 520;
  var acc = 0, locked = false, lastAbs = 0, lastStep = 0, lastT = 0, idleT;
  mediaEl.addEventListener('wheel', function (e) {
    if (!collapsed || TOUCH) return;
    e.preventDefault();
    var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (e.deltaMode === 1) d *= 33;                   // lines → px
    var abs = Math.abs(d), now = performance.now();
    clearTimeout(idleT);
    idleT = setTimeout(function () { locked = false; acc = 0; lastAbs = 0; }, WHEEL_IDLE);
    if (locked) {
      var spike = abs > 12 && abs > lastAbs * 1.8 && now - lastStep > 260;
      // Repeat only for a held MOUSE wheel: identical notches with a gap
      // between them. Trackpad momentum streams ~every 16ms with a delta that
      // changes every event, so its tail can never trigger a repeat.
      var notch = abs >= 40 && Math.abs(abs - lastAbs) < 0.5 && now - lastT > 30;
      if (spike || (notch && now - lastStep > WHEEL_REPEAT)) { locked = false; acc = 0; }
    }
    lastAbs = abs; lastT = now;
    if (locked) return;
    acc += d;
    if (Math.abs(acc) >= WHEEL_TRIGGER) {
      go(idx + (acc > 0 ? 1 : -1));
      locked = true; acc = 0; lastStep = now;
    }
  }, {passive: false});

  document.addEventListener('keydown', function (e) {
    if (!collapsed || busy) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); go(idx + 1); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); go(idx - 1); }
  });

  // Drag / swipe — pointer events cover mouse, pen and touch. A short press
  // without travel is a click: on a side frame it focuses that frame.
  var drag = null;
  mediaEl.addEventListener('pointerdown', function (e) {
    if (!collapsed || TOUCH || e.button !== 0) return;
    drag = {x: e.clientX, y: e.clientY, from: mediaEl.scrollLeft, moved: false};
    if (hasGsap) gsap.killTweensOf(mediaEl);
  });
  window.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x;
    if (Math.abs(dx) > 6) drag.moved = true;
    if (drag.moved) mediaEl.scrollLeft = drag.from - dx;   // follow the hand
  });
  window.addEventListener('pointerup', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, d = drag;
    drag = null;
    if (d.moved) {
      swallowNext = true;
      go(Math.abs(dx) > 60 ? idx + (dx < 0 ? 1 : -1) : idx);
      return;
    }
    var hit = e.target.closest ? e.target.closest('.pv-frame') : null;
    if (!hit) return;
    var k = FRAMES.findIndex(function (f) { return f.el === hit; });
    if (k >= 0 && k !== idx) go(k);
  });

  // Clicks on a frame (or the click that ends a drag) belong to the
  // slideshow, not to the crosshair's menu — capture phase, so they never
  // reach its document-level click listener.
  var swallowNext = false;
  window.addEventListener('pointerdown', function () { swallowNext = false; }, true);
  mediaEl.addEventListener('click', function (e) {
    if (!collapsed) return;
    var onFrame = e.target.closest && e.target.closest('.pv-frame');
    if (onFrame || swallowNext) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  window.addEventListener('resize', function () {
    if (TOUCH) setTimeout(loopKick, 220);
    else if (collapsed) setTimeout(function () { go(idx, true); }, 220);   // after relayout
  });

  /* ── Phone: vertical loop ──────────────────────────────────────
     Under the info panel the frames run as one vertical strip that scrolls
     forever — drag it (a flick carries momentum) and the first frame follows
     the last. It is driven here, not by native scrolling: the page itself
     never scrolls on a phone, and a native scroller can't wrap without
     stalling iOS momentum. Every tick each frame is placed at its offset in
     the strip minus the scroll, modulo the strip's length. Only frames on
     screen play. A strip shorter than the screen doesn't wrap (it would
     show the same frame twice) — it just clamps. */
  var LOOP_GAP = 12, LOOP_FRICTION = 0.95;
  var loopY = 0, loopV = 0, loopDrag = null, loopRaf = 0;
  function loopKick() {
    if (TOUCH && !loopRaf) loopRaf = requestAnimationFrame(loopTick);
  }
  function loopTick() {
    loopRaf = 0;
    if (!loopDrag && loopV) {
      loopY += loopV;
      loopV *= LOOP_FRICTION;
      if (Math.abs(loopV) < 0.05) loopV = 0;
    }
    var items = [], total = 0, maxH = 0;
    FRAMES.forEach(function (f) {
      if (!f.el) return;
      var m = frameMetrics(f);
      items.push({f: f, y: total, w: m.w, h: m.h});
      total += m.h + LOOP_GAP;
      maxH = Math.max(maxH, m.h);
    });
    var H = mediaEl.clientHeight, W = window.innerWidth;
    var wrap = total > H + maxH;
    if (!wrap) {
      var max = Math.max(0, total - LOOP_GAP - H);
      if (loopY < 0 || loopY > max) { loopY = Math.max(0, Math.min(max, loopY)); loopV = 0; }
    }
    var centre = -1;
    items.forEach(function (it, k) {
      var y = it.y - loopY;
      if (wrap) {
        y = ((y % total) + total) % total;
        if (y > H) y -= total;
      }
      it.f.el.style.transform = 'translate3d(' + Math.round((W - it.w) / 2) + 'px,' +
        Math.round(y * 10) / 10 + 'px,0)';
      var v = it.f.el.querySelector('video');
      var seen = y < H && y + it.h > 0;
      if (v) {
        if (seen && v.paused) { var p = v.play(); if (p) p.catch(function () {}); }
        else if (!seen && !v.paused) v.pause();
      }
      if (y <= H / 2 && y + it.h + LOOP_GAP > H / 2) centre = k;
    });
    var n = FRAMES.length;
    if (centre >= 0) {
      if (capCount) capCount.textContent = pad2(centre + 1) + ' / ' + pad2(n);
      if (progBar) progBar.style.transform = 'scaleX(' + (centre + 1) / n + ')';
    }
    if (loopDrag || loopV) loopRaf = requestAnimationFrame(loopTick);
  }
  if (TOUCH) {
    mediaEl.addEventListener('pointerdown', function (e) {
      loopV = 0;
      loopDrag = {y: e.clientY, from: loopY, lastY: e.clientY, lastT: performance.now(), v: 0};
      loopKick();
    });
    window.addEventListener('pointermove', function (e) {
      if (!loopDrag) return;
      var now = performance.now(), dt = Math.max(1, now - loopDrag.lastT);
      // Velocity in px per 60fps frame, smoothed so one jittery sample
      // can't decide the flick.
      var v = -(e.clientY - loopDrag.lastY) / dt * 16.67;
      loopDrag.v = loopDrag.v * 0.6 + v * 0.4;
      loopDrag.lastY = e.clientY; loopDrag.lastT = now;
      loopY = loopDrag.from - (e.clientY - loopDrag.y);
    });
    var loopEnd = function () {
      if (!loopDrag) return;
      // A finger held still before lifting is a stop, not a flick.
      loopV = performance.now() - loopDrag.lastT > 80 ? 0 : loopDrag.v;
      loopDrag = null;
      loopKick();
    };
    window.addEventListener('pointerup', loopEnd);
    window.addEventListener('pointercancel', loopEnd);
  }

  function boot() {
    setBandTop();
    if (TOUCH && document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
    build();
    if (window.SiteFX && window.SiteFX.revealPending) {
      copyEls().forEach(function (el) { el.style.color = 'transparent'; });
      document.addEventListener('site:reveal', start, {once: true});
    } else {
      start();
    }
  }

  var wanted = qs('id');
  if (wanted && window.SS && SS.isConfigured && SS.isConfigured()) {
    SS.getProjects().then(function (rows) {
      var key = wanted.toLowerCase().replace(/[-_]+/g, ' ');
      var row = (rows || []).filter(function (r) {
        return String(r.title || '').toLowerCase() === key;
      })[0];
      applyProject(row);
      boot();
    }).catch(boot);
  } else {
    boot();                          // static fallback — the markup as authored
  }
})();
