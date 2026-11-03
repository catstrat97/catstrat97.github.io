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
  var collapsed = false;                          // slideshow mode (Figma 778:771)

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
  function frameMetrics(f) {
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
          m.muted = true; m.loop = true; m.playsInline = true; m.autoplay = true;
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
      if (collapsed) startBrowsing(); else window.scrollTo(0, 0);
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

  /* ── Slideshow browsing — scroll to explore ──────────────────────
     The strip scrolls with damped inertia; the frame nearest the centre is
     the focus — full size — while its neighbours scale down and tuck toward
     the edges. Aspect-agnostic: sizes come from frameMetrics, this layer
     only transforms. When the wheel goes quiet it snaps the nearest frame
     to dead centre. A vertical wheel drives it — the page itself doesn't
     scroll in this mode. */
  var scrollCur = 0, scrollTgt = 0, snapTimer;
  var TUCK_SCALE = 0.34;              // how much a neighbour shrinks by the edge
  var TUCK_PUSH = 90;                 // px a neighbour is pushed outward
  function liveEls() {
    return FRAMES.filter(function (f) {
      return f.el && f.el.classList.contains('is-in');
    }).map(function (f) { return f.el; });
  }
  // Measured, not clientWidth — with the 50vw paddings on a fixed band,
  // clientWidth reports the viewport and centred frames land 35px off.
  function bandHalf() {
    return mediaEl.getBoundingClientRect().width / 2;
  }
  function centreScroll(el, half) {
    return el.offsetLeft + el.offsetWidth / 2 - (half || bandHalf());
  }
  function clampScroll(x) {
    var max = Math.max(0, mediaEl.scrollWidth - bandHalf() * 2);
    return Math.max(0, Math.min(max, x));
  }
  function snapToNearest() {
    var els = liveEls();
    if (!els.length) return;
    var best = els[0], bd = Infinity;
    els.forEach(function (el) {
      var d = Math.abs(centreScroll(el) - scrollTgt);
      if (d < bd) { bd = d; best = el; }
    });
    scrollTgt = clampScroll(centreScroll(best));
  }
  /* One ticker drives BOTH strips. Collapsed: damped horizontal scroll with
     centre focus. Expanded: the same focus/tuck, vertical, riding the page's
     own scroll. Geometry uses offsetLeft/Top (layout space), never rects —
     rects include the transforms being applied, which feeds back. */
  function tuckTransform(d, axis) {
    var a = Math.abs(d) * 2.2;
    if (a > 1) a = 1;
    var e = a * a * (3 - 2 * a);                // smoothstep falloff
    return 'translate' + axis + '(' + (Math.sign(d) * TUCK_PUSH * e).toFixed(1) +
      'px) scale(' + (1 - TUCK_SCALE * e).toFixed(3) + ')';
  }
  function browseTick() {
    requestAnimationFrame(browseTick);
    if (collapsed) {
      scrollCur += (scrollTgt - scrollCur) * 0.14;
      mediaEl.scrollLeft = scrollCur;
      var half = bandHalf();
      var mid = scrollCur + half;
      liveEls().forEach(function (el) {
        var d = (el.offsetLeft + el.offsetWidth / 2 - mid) / (half * 2);
        el.style.transform = tuckTransform(d, 'X');
      });
    } else {
      // Vertical: distance of each frame's centre from the viewport's,
      // in layout space (media top + offsetTop, immune to the transforms).
      var base = mediaEl.getBoundingClientRect().top;
      var vMid = window.innerHeight / 2;
      liveEls().forEach(function (el) {
        var d = (base + el.offsetTop + el.offsetHeight / 2 - vMid) /
          window.innerHeight;
        el.style.transform = tuckTransform(d, 'Y');
      });
    }
  }
  function startBrowsing() {
    // Focus the first frame once it has a size — the arrival staggers in.
    var tries = 0;
    (function seed() {
      var els = liveEls();
      if (els.length) {
        scrollTgt = scrollCur = clampScroll(centreScroll(els[0]));
        mediaEl.scrollLeft = scrollCur;
      } else if (++tries < 20) setTimeout(seed, 120);
    })();
  }
  requestAnimationFrame(browseTick);        // one loop, alive for the page
  mediaEl.addEventListener('wheel', function (e) {
    if (!collapsed) return;
    var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (!d) return;
    e.preventDefault();
    scrollTgt = clampScroll(scrollTgt + d);
    clearTimeout(snapTimer);
    snapTimer = setTimeout(snapToNearest, 170);
  }, {passive: false});

  function boot() {
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
