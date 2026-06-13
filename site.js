/* ============================================================
 *  site.js — Shared behaviours (alt green/mono design)
 *    1. Custom circular cursor
 *    2. Live clock (window [data-clock], incl. two-line "stamp")
 *    3. Cipher text interaction (.text-fx) — the ONLY click effect
 *    4. Procedural noise field (domain-warp word), locked to page green,
 *       mounted into the hero #noise-stage as a framed monitor.
 *  Each block is self-contained and no-ops if its targets are absent.
 * ============================================================ */

/* ── 1. Custom circular cursor ──────────────────────────────── */
(function () {
  var cursor = document.getElementById('cursor');
  if (!cursor) return;
  document.addEventListener('mousemove', function (e) {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });
})();

/* ── 2. Live clock ──────────────────────────────────────────────
   Drives any [data-clock] element. The format attribute decides output:
     data-clock="stamp"    → "10.09.25 / 2:36 PM"  (two lines, rail style)
     data-clock="datetime" → "10.09.25// 2:36 PM"
     data-clock="date"     → "Oct 9, 2025"
     data-clock="time"     → "2:36:45 PM"
──────────────────────────────────────────────────────────────── */
(function () {
  var nodes = document.querySelectorAll('[data-clock]');
  if (!nodes.length) return;

  var pad = function (n) { return n < 10 ? '0' + n : '' + n; };

  function render() {
    var now = new Date();
    var dateStr = pad(now.getMonth() + 1) + '.' + pad(now.getDate()) + '.' +
      String(now.getFullYear()).slice(-2);
    var timeStr = now.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
    nodes.forEach(function (el) {
      var mode = el.getAttribute('data-clock');
      if (mode === 'stamp') {
        // Per-line spans so each line gets its own legibility box and can
        // cipher in independently on load (without losing the line break).
        el.innerHTML = '<span>' + dateStr + '</span><br><span>' + timeStr + '</span>';
      } else if (mode === 'date') {
        el.textContent = now.toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric',
        });
      } else if (mode === 'time') {
        el.textContent = now.toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
        });
      } else {
        el.textContent = dateStr + '// ' + timeStr;
      }
    });
  }

  render();
  // Defer recurring updates so the load-in cipher (which targets the clock
  // spans) can finish without being clobbered mid-scramble.
  setTimeout(function () { render(); setInterval(render, 15000); }, 4500);
})();

/* ── 3. Cipher text interaction ─────────────────────────────────
   Applies to any `.text-fx` element (the intro on the home page). Wraps each
   character in a `.char` span and runs a single "cipher" effect:
     • hover  → characters near the cursor flicker through box-drawing glyphs
                and resolve back to the real letter
     • click  → the whole block runs a staggered cipher sweep
   Because the type is IBM Plex Mono and the scramble glyphs are full-cell
   box characters, every cell stays perfectly boxed & aligned (no reflow).
   Exposes window.SiteFX for async-rendered content + the list load-in.
──────────────────────────────────────────────────────────────── */
(function () {
  // Text interaction is home-only (the page with the project list).
  if (!document.querySelector('.projects')) return;

  var MONO = "'IBM Plex Mono', ui-monospace, monospace";

  // The cipher cycles these SEQUENTIALLY (not at random) so every character
  // moves in sync and the decode reads as one controlled sweep, not noise.
  // Phase 1: box-drawing glyphs · Phase 2: solid blocks · then resolve.
  var DECODE_BOX = '─│┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬'.split('');
  var DECODE_BLOCK = '░▒▓█'.split('');

  // Odometer set the load-in spins through before resolving to the real char.
  var SCRAMBLE_SET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');

  function wrapTextNodes(text) {
    var tokens = text.split(/(\s+)/);
    return tokens.map(function (token) {
      if (/^\s+$/.test(token)) return token;
      var chars = Array.from(token).map(function (ch) {
        var safeCh = ch.replace(/[&<>]/g, function (s) {
          return ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[s]);
        });
        return '<span class="char">' + safeCh + '</span>';
      }).join('');
      return '<span class="word">' + chars + '</span>';
    }).join('');
  }

  var targets = [];
  var returnTimeout;

  // Interaction is gated until the load-in scramble has finished.
  var ready = !document.documentElement.classList.contains('preload');
  function markReady() {
    ready = true;
    if (window.SiteFX) window.SiteFX.ready = true;
    document.dispatchEvent(new Event('site:ready'));
  }

  /* ── Geometry / reset helpers ───────────────────────────────── */
  function measure(p) {
    p._chars = Array.prototype.slice.call(p.querySelectorAll('.char'));
  }
  function measureAll() { targets.forEach(measure); }
  var measureTimer;
  window.addEventListener('resize', function () {
    clearTimeout(measureTimer);
    measureTimer = setTimeout(measureAll, 150);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureAll);

  /* Cell-locking so a wide/odd glyph can't resize the cell and reflow text. */
  function lockBox(el) {
    var w = el.offsetWidth, h = el.offsetHeight;
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.display = 'inline-block';
    el.style.textAlign = 'center';
    el.style.overflow = 'hidden';
    el.style.whiteSpace = 'nowrap';
    el.style.verticalAlign = 'top';
    el.style.lineHeight = h + 'px';
  }
  function applyGlyph(el, str, size) {
    el.style.fontFamily = MONO;
    if (size) el.style.fontSize = size;
    el.textContent = str;
  }
  function unlockBox(el, real) {
    el.style.fontFamily = ''; el.style.fontSize = ''; el.style.width = '';
    el.style.height = ''; el.style.display = ''; el.style.textAlign = '';
    el.style.overflow = ''; el.style.whiteSpace = '';
    el.style.verticalAlign = ''; el.style.lineHeight = '';
    if (real != null) el.textContent = real;
  }
  function repeatGlyph(g, n) { return new Array(n + 1).join(g); }

  function clearChar(c) {
    if (c._glyphInterval) {
      clearInterval(c._glyphInterval); c._glyphInterval = null;
      if (c.dataset.originalChar != null) c.textContent = c.dataset.originalChar;
    }
    unlockBox(c, c.dataset.originalChar != null ? c.dataset.originalChar : null);
    c.style.color = '';
    delete c.dataset.active; delete c.dataset.originalChar;
  }
  function resetAll() {
    if (returnTimeout) clearTimeout(returnTimeout);
    targets.forEach(function (p) {
      (p._chars || []).forEach(clearChar);
    });
  }

  /* ── The cipher: flick a char through box → block glyphs, then resolve ──
     The glyph sets are stepped through IN ORDER (step % len), so a run of
     characters decodes in lock-step — a clean travelling wave rather than
     random static. Callers set dataset.active before scheduling. */
  function decodeChar(el) {
    el.dataset.originalChar = el.textContent;
    lockBox(el);
    var step = 0, BOX = 12, BLOCK = 4;
    var iv = setInterval(function () {
      if (step < BOX) {
        applyGlyph(el, DECODE_BOX[step % DECODE_BOX.length], '1em');
      } else if (step < BOX + BLOCK) {
        applyGlyph(el, DECODE_BLOCK[(step - BOX) % DECODE_BLOCK.length], '0.8em');
      } else {
        clearInterval(iv); el._glyphInterval = null;
        unlockBox(el, el.dataset.originalChar);
        el.style.color = '';
        delete el.dataset.active; delete el.dataset.originalChar;
        return;
      }
      step++;
    }, 35);
    el._glyphInterval = iv;
  }

  /* Hover → decode the characters within a tight radius of the cursor,
     staggered by distance so the effect trails out from the pointer. The
     elliptical (radius/2) test keeps the hit area small and controlled. */
  function onMove(paragraph, e) {
    if (!ready) return;
    var rect = paragraph.getBoundingClientRect();
    var mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
    var radius = 100;
    var hits = [];
    (paragraph._chars || []).forEach(function (char) {
      if (char.dataset.active === 'true') return;
      var cr = char.getBoundingClientRect();
      var cx = cr.left + cr.width / 2 - rect.left;
      var cy = cr.top + cr.height / 2 - rect.top;
      var dx = (cx - mouseX) / (radius / 2);
      var dy = (cy - mouseY) / (radius / 2);
      var d = dx * dx + dy * dy;
      if (d <= 1) hits.push({el: char, d: d});
    });
    hits.sort(function (a, b) { return a.d - b.d; });
    hits.forEach(function (h, i) {
      h.el.dataset.active = 'true';
      setTimeout(function () { decodeChar(h.el); }, i * 14);
    });
  }

  /* Click → run a full staggered decode sweep over the whole block. */
  document.addEventListener('click', function () {
    if (!ready) return;
    targets.forEach(function (p) {
      (p._chars || []).forEach(function (c, i) {
        if (c.dataset.active === 'true') return;
        c.dataset.active = 'true';
        setTimeout(function () { decodeChar(c); }, i * 9);
      });
    });
  });

  /* ── Wrap `.text-fx` elements into word/char spans ──────────── */
  function wrapElement(paragraph) {
    if (paragraph.dataset.fx === 'on') return;
    paragraph.dataset.fx = 'on';

    var parts = paragraph.innerHTML.split(/<br\s*\/?>/gi);
    var result = [];
    parts.forEach(function (part, index) {
      if (part.includes('<a ')) {
        var temp = document.createElement('div');
        temp.innerHTML = part;
        var nodes = [];
        temp.childNodes.forEach(function (node) {
          if (node.nodeType === 3) {
            nodes.push(wrapTextNodes(node.textContent));
          } else if (node.nodeType === 1 && node.tagName === 'A') {
            var a = node.cloneNode(false);
            a.innerHTML = wrapTextNodes(node.textContent);
            nodes.push(a.outerHTML);
          }
        });
        result.push(nodes.join(''));
      } else {
        var temp2 = document.createElement('div');
        temp2.innerHTML = part;
        result.push(wrapTextNodes(temp2.textContent || ''));
      }
      if (index < parts.length - 1) result.push('<br>');
    });
    paragraph.innerHTML = result.join('');
    paragraph.style.position = paragraph.style.position || 'relative';

    targets.push(paragraph);
    measure(paragraph);
    paragraph.addEventListener('mousemove', function (e) { onMove(paragraph, e); });
  }

  function initTextFx(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('.text-fx').forEach(wrapElement);
    if (root && root.classList && root.classList.contains('text-fx')) wrapElement(root);
  }

  /* ── Load-in: odometer scramble that decodes the page in ───────
     Every position spins through A-Z0-9 then resolves, staggered top→bottom.
     `.char` tokens render as a tight monospace cell; multi-char tokens use the
     locked fill so containers never reflow. Time-based so it finishes on time. */
  function scrambleIn(els, onDone) {
    var toks = [];
    var minY = Infinity, maxY = -Infinity;
    Array.prototype.forEach.call(els, function (el) {
      var real = el.textContent;
      if (!real || !real.trim()) return;
      var top = el.getBoundingClientRect().top;
      if (top < minY) minY = top; if (top > maxY) maxY = top;
      var tight = el.classList.contains('char');
      if (!tight) lockBox(el);
      el.style.color = 'transparent';
      toks.push({el: el, real: real, cy: top, tight: tight});
    });
    if (!toks.length) { if (onDone) onDone(); return; }

    var span = Math.max(1, maxY - minY);
    var MAX_STAGGER = 26, SPIN = 16;
    toks.forEach(function (t) {
      var f = (t.cy - minY) / span;
      var e = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;
      t.start = Math.round(e * MAX_STAGGER + Math.random() * 6);
      t.si = Math.floor(Math.random() * SCRAMBLE_SET.length);
    });

    var t0 = performance.now();
    var iv = setInterval(function () {
      var step = Math.floor((performance.now() - t0) / 60);
      var active = false;
      toks.forEach(function (t) {
        if (t.done) return;
        var local = step - t.start;
        if (local < 0) { active = true; return; }
        if (local < SPIN) {
          var glyph = SCRAMBLE_SET[(t.si + local) % SCRAMBLE_SET.length];
          t.el.style.color = '';
          if (t.tight) {
            t.el.style.fontFamily = MONO;
            t.el.style.fontSize = '0.9em';
            t.el.textContent = glyph;
          } else {
            applyGlyph(t.el, repeatGlyph(glyph, t.real.length));
          }
          active = true;
        } else {
          t.el.style.color = '';
          if (t.tight) {
            t.el.style.fontFamily = ''; t.el.style.fontSize = ''; t.el.textContent = t.real;
          } else {
            unlockBox(t.el, t.real);
          }
          t.done = true;
        }
      });
      if (!active) { clearInterval(iv); if (onDone) onDone(); }
    }, 30);
  }

  /* Scramble `els` in the first time `trigger` scrolls into view (the list). */
  function scrambleOnScroll(trigger, els) {
    if (!trigger || !els || !els.length) return;
    var list = Array.prototype.filter.call(els, function (e) {
      return e.textContent && e.textContent.trim();
    });
    list.forEach(function (e) { e.style.color = 'transparent'; });
    if (!('IntersectionObserver' in window)) { scrambleIn(list); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); scrambleIn(list); }
    }, {rootMargin: '0px 0px -8% 0px'});
    io.observe(trigger);
  }

  function runLoadIn() {
    if (!document.documentElement.classList.contains('preload')) { markReady(); return; }
    var sel = ['.brand', '.main-nav a', '.status span', '.intro .char',
      '.rail-socials a', '.rail-clock span', '.rail-coords span'];
    scrambleIn(document.querySelectorAll(sel.join(',')), markReady);
    document.documentElement.classList.remove('preload');
  }

  window.SiteFX = {apply: initTextFx, scrambleIn: scrambleIn, scrambleOnScroll: scrambleOnScroll, ready: ready};
  initTextFx(document);
  runLoadIn();
})();

/* ── 4. Procedural noise field (full-page domain-warp word) ──────
   A 3-letter word is drawn to a bitmap and sampled across a FULL-VIEWPORT
   grid through a Perlin domain-warp. The bitmap is split into a thick stroke
   band (the eroded core subtracted from the fill) and an interior core:
     • at rest  → the stroke cells run a parametric glyph wave (a calm
                  box-drawing "sequencer"); the interior is just IBM Plex
                  Mono dots (·); only the stroke animates.
     • on hover → every letter cell rapidly switches through block/box glyphs
                  (░▒▓ ─│┌) driven by a faster wave.
   The word itself steps to the next word with a deterministic odometer.
   Mounted as a fixed page background (home only); all glyphs are IBM Plex Mono.
──────────────────────────────────────────────────────────────── */
(function () {
  // Home only — gate on the hero's noise stage, but render across the page.
  if (!document.getElementById('noise-stage')) return;

  var canvas = document.createElement('canvas');
  canvas.className = 'noise-field';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var GREEN = [3, 254, 151];         // mint / spring — the RESTING green
  // Extra green hues used as interaction STATES in the colour cycle (like the
  // amber/grey/white states), not as a resting effect.
  var NEON = [57, 255, 20];          // neon green   — interaction state
  var LIME = [173, 255, 47];         // lime green   — interaction state
  var EMERALD = [0, 230, 138];       // emerald      — interaction state
  var GREY = [150, 150, 150];        // movement accent (mid stages)
  var AMBER = [255, 174, 44];        // #FFAE2C — yellow accent
  var WHITE = [236, 236, 236];       // deepest stage accent
  var MONO = "'IBM Plex Mono', monospace";
  var CELL = 20;
  var SW = 0, SH = 0, cols = 0, rows = 0;
  var fieldBuf, hashBuf;

  // Interaction energy: cursor movement anywhere lifts `energy` toward 1 (drives
  // the colour lerp + cipher reveal); it relaxes back to 0 (calm/rest) when the
  // pointer goes idle. `glitchT` is a rare, self-decaying glitch BURST that
  // occasionally fires while moving — a one-off cipher sweep, not a held state.
  var interact = 0, energy = 0, glitchT = 0, heat = 0;
  var cyclePhase = 0, wasEngaged = false;
  // `spread` selects the interaction look: ~0 = solid/uniform 2-colour (clean
  // stroke vs fill), ~1 = mixed-hue scatter (cells fan across the cycle). A new
  // mode is rolled (50/50) on each engagement and can flip during a long hover.
  var spread = 0, spreadTarget = 0;
  document.addEventListener('mousemove', function () { interact = 1; });

  function resize() {
    SW = Math.max(1, window.innerWidth);
    SH = Math.max(1, window.innerHeight);
    canvas.width = SW;
    canvas.height = SH;
    canvas.style.width = SW + 'px';
    canvas.style.height = SH + 'px';
    ctx.font = '15px ' + MONO;
    ctx.textBaseline = 'top';
    cols = Math.ceil(SW / CELL);
    rows = Math.ceil(SH / CELL);
    fieldBuf = new Float32Array(cols * rows);
    // Static per-cell hash (depends only on c,r) — precomputed so the draw loop
    // doesn't run a Math.sin per cell every frame.
    hashBuf = new Float32Array(cols * rows);
    for (var hc = 0; hc < cols; hc++) {
      for (var hr = 0; hr < rows; hr++) {
        var h = Math.sin(hc * 12.9898 + hr * 78.233) * 43758.5453;
        hashBuf[hc + hr * cols] = h - Math.floor(h);
      }
    }
  }
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 150); });

  /* value-noise (Perlin-ish), ~0..1 */
  var pnoise = (function () {
    var grad = new Array(256), perm = new Array(512);
    for (var a = 0; a < 256; a++) { grad[a] = Math.random(); perm[a] = a; }
    for (var b = 255; b > 0; b--) { var j = (Math.random() * (b + 1)) | 0, s = perm[b]; perm[b] = perm[j]; perm[j] = s; }
    for (var c2 = 0; c2 < 256; c2++) perm[c2 + 256] = perm[c2];
    function sm(t) { return t * t * (3 - 2 * t); }
    return function (x, y) {
      var xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
      var xf = x - Math.floor(x), yf = y - Math.floor(y);
      var aa = grad[(perm[perm[xi] + yi]) & 255], ba = grad[(perm[perm[xi + 1] + yi]) & 255];
      var ab = grad[(perm[perm[xi] + yi + 1]) & 255], bb = grad[(perm[perm[xi + 1] + yi + 1]) & 255];
      var u = sm(xf), v = sm(yf), tp = aa + (ba - aa) * u, bt = ab + (bb - ab) * u;
      return tp + (bt - tp) * v;
    };
  })();

  /* Glyph sets. REST_STROKE = the calm wave the stroke runs at rest (box-drawing
     plus a few numbers, dots & dashes for texture); GLITCH_SET = the glitch-burst
     glyphs; BLOCK_SET = the solid blocks the field ciphers through at the deep
     colour stage; DIGITS = what the interior ciphers into when the cursor moves. */
  var REST_STROKE = '─│┌┐└┘├┤┼┴┬═║·.-–—=017'.split('');
  var GLITCH_SET = '░▒▓─│┌'.split('');
  var BLOCK_SET = '█▓▒░'.split('');
  var DIGITS = '0123456789'.split('');

  /* Looping colour cycle of interaction STATES: mint → neon → lime → emerald →
     amber → grey → white → mint … The field rests at solid GREEN; once the
     cursor engages a free-running phase walks this ring (faster the longer you
     hover), so the letters cipher through the green hues first, then the amber/
     grey/white accents, and loop. The stroke is read one state AHEAD of the
     fill, so the two are always a distinct step apart. */
  var CYCLE = [GREEN, NEON, LIME, EMERALD, AMBER, GREY, WHITE];
  var STROKE_LEAD = 1 / CYCLE.length;       // one state ahead, in phase units
  var _col = [0, 0, 0];
  function gradLoop(t) {
    t -= Math.floor(t);                       // wrap to 0..1
    var n = CYCLE.length, s = t * n;
    var i = Math.floor(s) % n, j = (i + 1) % n, f = s - Math.floor(s);
    var a = CYCLE[i], b = CYCLE[j];
    _col[0] = a[0] + (b[0] - a[0]) * f;
    _col[1] = a[1] + (b[1] - a[1]) * f;
    _col[2] = a[2] + (b[2] - a[2]) * f;
    return _col;
  }

  /* Word bitmap (offscreen), high-res. wbFill is a BLURRED soft field of the
     solid letterform: a smooth interior-distance ramp (0 outside → 1 deep
     inside). Thresholding it gives a thick stroke band (mid values) wrapping a
     dotted interior (high values), reliably sampleable on the screen grid. */
  var WB_W = 1, WB_H = 120, WB_FONT = '900 98px ' + MONO;
  var BLUR_PX = 6;                         // soft-field radius → stroke band width
  var INK_T = 0.14;                        // below → empty
  var CORE_T = 0.62;                       // above → interior (dots); between → stroke
  var wbCanvas = document.createElement('canvas');
  var wbCtx = wbCanvas.getContext('2d', {willReadFrequently: true});
  var wbFill = new Float32Array(1);
  function renderWord(w) {
    wbCtx.font = WB_FONT;
    WB_W = Math.ceil(wbCtx.measureText(w).width) + 16;
    wbCanvas.width = WB_W; wbCanvas.height = WB_H;
    wbCtx.font = WB_FONT;
    wbCtx.fillStyle = '#000'; wbCtx.fillRect(0, 0, WB_W, WB_H);
    wbCtx.fillStyle = '#fff';
    wbCtx.textAlign = 'center'; wbCtx.textBaseline = 'middle';
    wbCtx.fillText(w, WB_W / 2, WB_H / 2 + 1);
    var img = wbCtx.getImageData(0, 0, WB_W, WB_H).data;
    var bin = new Float32Array(WB_W * WB_H);
    for (var i = 0; i < bin.length; i++) bin[i] = img[i * 4] > 100 ? 1 : 0;
    // Separable box blur (two passes) → smooth interior-distance ramp.
    var tmp = new Float32Array(WB_W * WB_H);
    var R = BLUR_PX, norm = 1 / (2 * R + 1);
    for (var y = 0; y < WB_H; y++) {
      for (var x = 0; x < WB_W; x++) {
        var acc = 0;
        for (var k = -R; k <= R; k++) { var px = Math.min(WB_W - 1, Math.max(0, x + k)); acc += bin[px + y * WB_W]; }
        tmp[x + y * WB_W] = acc * norm;
      }
    }
    wbFill = new Float32Array(WB_W * WB_H);
    for (var x2 = 0; x2 < WB_W; x2++) {
      for (var y2 = 0; y2 < WB_H; y2++) {
        var acc2 = 0;
        for (var k2 = -R; k2 <= R; k2++) { var py = Math.min(WB_H - 1, Math.max(0, y2 + k2)); acc2 += tmp[x2 + py * WB_W]; }
        wbFill[x2 + y2 * WB_W] = acc2 * norm;
      }
    }
  }
  function sampleArr(arr, u, v) {
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return 0;
    var x = u * WB_W - 0.5, y = v * WB_H - 0.5;
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    function g(px, py) { return (px < 0 || px >= WB_W || py < 0 || py >= WB_H) ? 0 : arr[px + py * WB_W]; }
    var a = g(xi, yi) + (g(xi + 1, yi) - g(xi, yi)) * xf;
    var b = g(xi, yi + 1) + (g(xi + 1, yi + 1) - g(xi, yi + 1)) * xf;
    return a + (b - a) * yf;
  }

  /* Word list + deterministic odometer scramble (sequencer-like, not random). */
  var WORDS = ['art', 'sun', 'sky', 'box', 'fox', 'run', 'fly', 'raw', 'mix', 'web',
    'dev', 'new', 'pix', 'bit', 'lab', 'map', 'ray', 'hue', 'dot', 'sys', 'gen', 'ink'];
  var ALPHA = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var curIdx = [1, 18, 20], tgtIdx = [1, 18, 20], stg = [0, 0, 0], wordPtr = 0;
  function pickWord(w) {
    for (var i = 0; i < 3; i++) {
      tgtIdx[i] = Math.max(0, ALPHA.indexOf((w[i] || ' ').toUpperCase()));
      stg[i] = i * 5;
    }
  }
  function stepWord() {
    var ch = false;
    for (var i = 0; i < 3; i++) {
      if (stg[i] > 0) { stg[i]--; continue; }
      if (curIdx[i] !== tgtIdx[i]) { curIdx[i] = (curIdx[i] + 1) % ALPHA.length; ch = true; }
    }
    if (ch) renderWord(ALPHA[curIdx[0]] + ALPHA[curIdx[1]] + ALPHA[curIdx[2]]);
  }
  renderWord('ART');
  resize();

  function clamp(x) { return Math.max(0, Math.min(255, Math.round(x))); }

  var frameN = 0, last = 0, startTime = 0;
  function draw(now) {
    requestAnimationFrame(draw);
    if (now - last < 15) return;             // ~60fps — smooth
    last = now;
    var introFade = Math.min(1, (now - startTime) / 2500);
    introFade = introFade * introFade * (3 - 2 * introFade);

    // Ease the interaction energy (cursor active → 1, idle → 0). Constants are
    // tuned for ~60fps so the motion feels the same as the old 15fps timing,
    // just smoother (≈ quarter of the old per-frame step).
    interact *= 0.974;
    energy += (interact - energy) * 0.032;
    // `heat` builds slowly while the cursor keeps moving (sustained hover →
    // deeper colour stages) and bleeds off when idle.
    var hTarget = energy > 0.35 ? 1 : 0;
    heat += (hTarget - heat) * (hTarget > heat ? 0.0015 : 0.005);
    // Rare glitch burst: while the cursor is moving, occasionally kick off a
    // self-decaying cipher sweep (≈ once every several seconds of movement).
    if (energy > 0.2 && glitchT <= 0 && Math.random() < 0.0025) glitchT = 1;
    glitchT = glitchT > 0 ? glitchT - 0.011 : 0;
    // Colour cycle: a free-running phase that walks the GREEN→AMBER→GREY→WHITE
    // ring and loops forever. It only advances while the cursor is engaged
    // (sustained hover = faster walk via heat); it resets when re-engaging from
    // idle so the journey restarts at green each time.
    var engaged = energy > 0.25;
    if (engaged && !wasEngaged) {
      cyclePhase = 0;
      spreadTarget = Math.random() < 0.5 ? 1 : 0;   // 50/50 solid vs mixed
    }
    wasEngaged = engaged;
    if (engaged) {
      cyclePhase += 0.0015 + 0.003 * heat;
      if (Math.random() < 0.004) spreadTarget = spreadTarget > 0.5 ? 0 : 1; // ~once/4s
    }
    spread += (spreadTarget - spread) * 0.05;        // ease between the two looks

    // word scramble timing (intervals scaled ×4 for 60fps → same wall-clock pace)
    frameN++;
    if (frameN % 360 === 0) { pickWord(WORDS[wordPtr]); wordPtr = (wordPtr + 1) % WORDS.length; }
    if (frameN % 8 === 0) stepWord();

    // Domain-warp amplitude breathes over ~16s between calm and distorted.
    var s = now * 0.0005;
    var pulse = Math.pow(Math.sin(now * 0.0004) * 0.5 + 0.5, 1.5);
    var warpX = 0.03 + 0.30 * pulse, warpY = 0.06 + 0.62 * pulse;
    var bw = 1 + 0.20 * Math.sin(now / 1000 * 1.8);

    // Parametric wave phases — a slow diagonal sweep at rest, a fast one on
    // hover. Indexing glyphs by the wave (not at random) reads like a sequencer.
    var restT = now * 0.0026, hoverT = now * 0.018, colorT = now * 0.0012;
    var e = energy * energy * (3 - 2 * energy);   // smoothstep interaction amount
    // `amount` = how far the colours pull away from green (0 at rest → 1 deep
    // hover). The hue itself is driven by the looping cyclePhase, not a clamped
    // progress, so it never freezes on grey/white — it keeps interpolating.
    var amount = e;
    // Block-cipher moment blooms each time the cycle crosses the grey stage.
    var pf = cyclePhase - Math.floor(cyclePhase);
    var bd = (pf - 0.5) / 0.08;
    var blockBump = (bd > -1 && bd < 1) ? (1 - bd * bd) * amount : 0;

    var wW = SW * 0.92, wH = wW * (WB_H / WB_W);
    var ox = (SW - wW) / 2, oy = (SH - wH) / 2;
    ctx.clearRect(0, 0, SW, SH);
    for (var c = 0; c < cols; c++) {
      for (var r = 0; r < rows; r++) {
        var u = (c * CELL - ox) / wW;
        var v = (r * CELL - oy) / wH;
        var dx = u + warpX * (pnoise(u * 2.5 + s, v * 2.5) - 0.5);
        var dy = v + warpY * (pnoise(u * 2.5, v * 2.5 + s) - 0.5);
        var gIdx = c + r * cols;
        var vf = sampleArr(wbFill, dx, dy);
        if (vf < fieldBuf[gIdx] * 0.92) vf = fieldBuf[gIdx] * 0.92;  // persistence trail
        fieldBuf[gIdx] = vf;
        if (vf < INK_T) continue;
        var isCore = vf > CORE_T;            // interior (dots) vs stroke band

        var lit = 0.32 + 0.68 * vf;
        var ch, rr, gg, bb, col;

        // Per-cell hash (precomputed, static) + flowing curve drive the
        // staggered cipher reveal and give every cell its own colour-stage
        // offset (organic, not uniform).
        var hsh = hashBuf[gIdx];
        var curve = Math.sin(colorT + c * 0.5 + r * 0.3) * 0.5 + 0.5;
        var prog = energy * 1.7 - hsh * 0.7;
        if (prog < 0) prog = 0; else if (prog > 1) prog = 1;
        // Per-cell phase offset. The hash term (the mixed-hue fan-out) is scaled
        // by `spread`, so in solid mode (~0) every cell shares the cycle phase
        // for a clean 2-colour look, and in mixed mode (~1) they scatter across
        // the states. A tiny flowing jitter remains in both for subtle life. At
        // rest (amount 0) none of this shows; everything stays solid green.
        var cellPh = hsh * 0.30 * spread + (curve - 0.5) * 0.05;

        // Glitch burst = thin hash band that sweeps as the pulse decays. Block
        // moment = field-wide cipher into solid blocks as the cycle crosses grey
        // stage. Both are coloured by the gradient (never flat grey).
        var inGlitch = glitchT > 0 && Math.abs(hsh - (1 - glitchT)) < 0.12;
        var inBlock = blockBump > 0 && hsh < blockBump;

        if (isCore) {
          // INTERIOR (fill): rest = dim dots; movement ciphers into digits whose
          // colour rides the looping ring (green → amber → grey → white …).
          if (prog < 0.12 && !inGlitch && !inBlock) {
            ch = '·';
            var grey = (0.10 + 0.16 * vf) * 255;
            rr = grey * 0.7; gg = grey; bb = grey * 0.85;
          } else {
            var gf = Math.sin(hoverT + c + r) * 0.5 + 0.5;
            ch = inBlock
              ? BLOCK_SET[Math.min(BLOCK_SET.length - 1, (curve * BLOCK_SET.length) | 0)]
              : inGlitch
                ? GLITCH_SET[Math.min(GLITCH_SET.length - 1, (gf * GLITCH_SET.length) | 0)]
                : (prog < 0.85 ? DIGITS[(frameN + c * 2 + r * 3) % 10]
                               : DIGITS[(c * 7 + r * 13 + wordPtr) % 10]);
            // FILL rides the cycle; blended out from solid GREEN by `amount`.
            col = gradLoop(cyclePhase + cellPh);
            var fb2 = 0.45 + 0.55 * prog;           // ease brightness in by reveal
            rr = (GREEN[0] + (col[0] - GREEN[0]) * amount) * lit * fb2;
            gg = (GREEN[1] + (col[1] - GREEN[1]) * amount) * lit * fb2;
            bb = (GREEN[2] + (col[2] - GREEN[2]) * amount) * lit * fb2;
          }
        } else {
          // STROKE (band): box-drawing wave; colour rides the looping ring one
          // stage ahead of the fill. Block/glitch swap glyphs only.
          var gj = Math.sin(hoverT * 1.3 + c * 0.7 + r * 0.5) * 0.5 + 0.5;
          var wp = Math.sin(restT + c * 0.5 + r * 0.32) * 0.5 + 0.5;
          ch = inBlock
            ? BLOCK_SET[Math.min(BLOCK_SET.length - 1, ((1 - curve) * BLOCK_SET.length) | 0)]
            : inGlitch
              ? GLITCH_SET[Math.min(GLITCH_SET.length - 1, (gj * GLITCH_SET.length) | 0)]
              : REST_STROKE[Math.min(REST_STROKE.length - 1, (wp * REST_STROKE.length) | 0)];
          // STROKE rides the cycle one state AHEAD of the fill, so the band and
          // the interior are never the same colour; blended from solid GREEN.
          col = gradLoop(cyclePhase + STROKE_LEAD + cellPh);
          rr = (GREEN[0] + (col[0] - GREEN[0]) * amount) * lit;
          gg = (GREEN[1] + (col[1] - GREEN[1]) * amount) * lit;
          bb = (GREEN[2] + (col[2] - GREEN[2]) * amount) * lit;
        }
        var f = bw * introFade;
        ctx.fillStyle = 'rgb(' + clamp(rr * f) + ',' + clamp(gg * f) + ',' + clamp(bb * f) + ')';
        ctx.fillText(ch, c * CELL, r * CELL);
      }
    }
  }

  function start() { resize(); startTime = performance.now(); requestAnimationFrame(draw); }
  if (window.SiteFX && !window.SiteFX.ready) {
    document.addEventListener('site:ready', start, {once: true});
  } else {
    start();
  }
})();
