/* ============================================================
 *  site.js — Shared behaviours across all pages
 *    1. Custom circular cursor
 *    2. Live clock helpers (window.SiteClock)
 *    3. Char-flip text interaction (elements with .text-fx)
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
     data-clock="datetime" → "10.09.25// 2:36 PM"  (footer style)
     data-clock="date"     → "Oct 9, 2025"
     data-clock="time"     → "2:36:45 PM"
──────────────────────────────────────────────────────────────── */
(function () {
  var nodes = document.querySelectorAll('[data-clock]');
  if (!nodes.length) return;

  var pad = function (n) { return n < 10 ? '0' + n : '' + n; };

  function render() {
    var now = new Date();
    nodes.forEach(function (el) {
      var mode = el.getAttribute('data-clock');
      if (mode === 'date') {
        el.textContent = now.toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric',
        });
      } else if (mode === 'time') {
        el.textContent = now.toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
        });
      } else {
        // datetime — "MM.DD.YY// H:MM AM/PM"
        var d = pad(now.getMonth() + 1) + '.' + pad(now.getDate()) + '.' +
          String(now.getFullYear()).slice(-2);
        var t = now.toLocaleTimeString('en-US', {
          hour: 'numeric', minute: '2-digit', hour12: true,
        });
        el.textContent = d + '// ' + t;
      }
    });
  }

  render();
  setInterval(render, 1000);
})();

/* ── 3. Char-flip text interaction ──────────────────────────────
   Applies to any element with class `.text-fx`. Wraps each character in a
   `.char` span (grouped into `.word` spans) and runs a mouse interaction
   with 5 click-cycled states:
     1 displacement + colour   (scatter & recolour chars near cursor)
     2 glyph scramble          (chars cycle through symbols)
     3 vertical flip           (chars mirror)
     4 wave to cursor          (a sine fills from the text start to the cursor's X)
     5 neon RGB drag           (text is black; dragging lights words red/green/
                                blue and brighter the faster you drag)
     6 hover spacing           (hovering a word eases its tracking open — only
                                a random subset of words react)
   States 4 and 5 are continuous (driven each frame by pointer position/speed);
   the rest are event-driven on hover. Exposes `window.SiteFX.apply(root)` so
   pages that inject `.text-fx` content async can wire it up after render.
──────────────────────────────────────────────────────────────── */
(function () {
  // Text-based animation (char-flip interaction + scramble) is home-only.
  // The home page is the one with the project list section.
  if (!document.querySelector('.projects')) return;

  var STATE_COUNT = 6;

  // Box-drawing / block glyphs (code-page-437) plus the basic symbols.
  var GLYPHS = ('!@#$%^&*+=/?><~' +
    '│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌' +
    '░▒▓█▄▌▐▀').split('');

  // Odometer set the scramble spins through (sequentially) before resolving to
  // the real character — used by both the load-in and the click-2 decode.
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

  var currentState = 1;
  var targets = [];
  var flippedChars = [];
  var returnTimeout;

  // Interaction is gated until the load-in scramble has finished. On a page
  // without the load-in (no preload) it's ready immediately.
  var ready = !document.documentElement.classList.contains('preload');
  function markReady() {
    ready = true;
    if (window.SiteFX) window.SiteFX.ready = true;
    document.dispatchEvent(new Event('site:ready'));
  }

  /* ── Pointer tracking (position + drag speed) ───────────────── */
  var pointer = {x: 0, y: 0, speed: 0, moved: 0, lastX: null, lastY: null, lastT: 0};
  document.addEventListener('mousemove', function (e) {
    var now = performance.now();
    if (pointer.lastX !== null) {
      var dx = e.clientX - pointer.lastX, dy = e.clientY - pointer.lastY;
      var dt = Math.max(1, now - pointer.lastT);
      var d = Math.sqrt(dx * dx + dy * dy);
      pointer.speed = d / dt;     // px per ms
      pointer.moved += d;
    }
    pointer.x = e.clientX; pointer.y = e.clientY;
    pointer.lastX = e.clientX; pointer.lastY = e.clientY; pointer.lastT = now;
  });

  /* ── Per-target geometry cache (char/word offsets) ──────────── */
  function measure(p) {
    p._chars = Array.prototype.slice.call(p.querySelectorAll('.char'));
    p._words = Array.prototype.slice.call(p.querySelectorAll('.word'));
    p._chars.forEach(function (c) {
      c._ox = c.offsetLeft + c.offsetWidth / 2;
      c._oyTop = c.offsetTop;
      c._oh = c.offsetHeight;
    });
  }
  function measureAll() { targets.forEach(measure); }

  var measureTimer;
  window.addEventListener('resize', function () {
    clearTimeout(measureTimer);
    measureTimer = setTimeout(measureAll, 150);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureAll);

  /* ── Reset every char/word to its resting state ─────────────── */
  function resetAll() {
    if (returnTimeout) clearTimeout(returnTimeout);
    targets.forEach(function (p) {
      (p._chars || []).forEach(function (c) {
        c.style.transform = ''; c.style.color = ''; c.style.fontFamily = '';
        c.style.fontSize = ''; c.style.display = ''; c.style.backgroundColor = '';
        c.style.borderRadius = ''; c.style.textShadow = '';
        c.style.width = ''; c.style.height = ''; c.style.overflow = '';
        c.style.transformOrigin = ''; c.style.whiteSpace = ''; c.style.textAlign = '';
        c.style.verticalAlign = ''; c.style.lineHeight = '';
        delete c.dataset.boxw; delete c.dataset.gunit;
        if (c._glyphInterval) {
          clearInterval(c._glyphInterval); c._glyphInterval = null;
          if (c.dataset.originalChar != null) c.textContent = c.dataset.originalChar;
        }
        delete c.dataset.active;
      });
      (p._words || []).forEach(function (w) {
        w.style.color = ''; w.style.textShadow = ''; w.style.letterSpacing = '';
        w.style.transition = '';
        if (w._spaceTimer) { clearTimeout(w._spaceTimer); w._spaceTimer = null; }
        delete w.dataset.spaceState;
      });
    });
    flippedChars = [];
    smoothSpeed = 0;
  }

  document.addEventListener('click', function () {
    if (!ready) return;
    resetAll();
    currentState = (currentState % STATE_COUNT) + 1;
    ensureTick();
  });

  /* ── State 4: wave that fills from the text start to the cursor X ─
     A travelling sine runs across every char left of the cursor; the leading
     edge is always the cursor's X, the start is the text block's left edge.
     All text targets react together (both intro paragraphs) whenever the
     cursor is anywhere within their combined vertical span, and the wave is
     mapped to a flowing grayscale gradient on the text colour. */
  function runWave(now) {
    var top = Infinity, bot = -Infinity;
    targets.forEach(function (p) {
      var r = p.getBoundingClientRect();
      if (r.top < top) top = r.top;
      if (r.bottom > bot) bot = r.bottom;
    });
    var active = pointer.y >= top - 80 && pointer.y <= bot + 80;

    targets.forEach(function (p) {
      if (!p._chars) return;
      var rect = p.getBoundingClientRect();
      var mouseX = pointer.x - rect.left;
      p._chars.forEach(function (c) {
        var amp = 0;
        if (active && c._ox <= mouseX) {
          amp = 22;
          var edgeDist = mouseX - c._ox;           // distance behind the leading edge
          if (edgeDist < 48) amp *= edgeDist / 48;  // soft front
        }
        if (amp > 0.3) {
          var s = Math.sin(now / 90 - c._ox / 28);  // faster travel
          c.style.transform = 'translateY(' + (amp * s).toFixed(2) + 'px)';
          var v = Math.floor(150 + 105 * ((s + 1) / 2)); // gradient mapped to the wave
          c.style.color = 'rgb(' + v + ',' + v + ',' + v + ')';
        } else {
          c.style.transform = '';
          c.style.color = '';
        }
      });
    });
  }

  /* ── State 5: neon RGB drag (continuous, speed-driven) ──────── */
  var smoothSpeed = 0, rgbCounter = 0;
  var NEON = [[230, 38, 36], [32, 125, 60], [25, 84, 149]]; // red, green, blue
  function runNeon() {
    smoothSpeed = smoothSpeed * 0.86 + pointer.speed * 0.14;
    pointer.speed *= 0.55;                 // decays toward 0 when idle
    rgbCounter += pointer.moved * 0.012;   // colours travel between words as you drag
    pointer.moved = 0;
    var bright = Math.min(1, smoothSpeed / 2.0);
    targets.forEach(function (p) {
      if (!p._words) return;
      p._words.forEach(function (w, i) {
        var col = NEON[(i + Math.floor(rgbCounter)) % 3];
        var f = 0.04 + 0.96 * bright;
        w.style.color = 'rgb(' + ((col[0] * f) | 0) + ',' + ((col[1] * f) | 0) + ',' + ((col[2] * f) | 0) + ')';
        if (bright > 0.03) {
          var b1 = (3 + 14 * bright).toFixed(1), b2 = (6 + 30 * bright).toFixed(1);
          w.style.textShadow =
            '0 0 ' + b1 + 'px rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (0.7 * bright).toFixed(2) + '),' +
            '0 0 ' + b2 + 'px rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + (0.45 * bright).toFixed(2) + ')';
        } else {
          w.style.textShadow = 'none';
        }
      });
    });
  }

  // Only run the per-frame loop while a continuous state (wave/neon) is active;
  // otherwise it idles instead of burning a rAF every frame.
  var ticking = false;
  function tick(now) {
    if (currentState === 4) runWave(now);
    else if (currentState === 5) runNeon();
    else { ticking = false; return; }
    requestAnimationFrame(tick);
  }
  function ensureTick() {
    if (!ticking) { ticking = true; requestAnimationFrame(tick); }
  }

  /* ── State 6: hover spacing (event-driven, random words) ────── */
  function scheduleSpaceReset(w) {
    if (w._spaceTimer) clearTimeout(w._spaceTimer);
    w._spaceTimer = setTimeout(function () {
      w.style.letterSpacing = '';
      setTimeout(function () { w.style.transition = ''; delete w.dataset.spaceState; }, 650);
    }, 600);
  }
  function handleSpacing(p, e) {
    if (!p._words) return;
    p._words.forEach(function (w) {
      var r = w.getBoundingClientRect();
      var inside = e.clientX >= r.left - 6 && e.clientX <= r.right + 6 &&
        e.clientY >= r.top - 6 && e.clientY <= r.bottom + 6;
      if (!inside) return;
      if (w.dataset.spaceState === 'on') { scheduleSpaceReset(w); return; }
      if (w.dataset.spaceState === 'skip') return;
      if (Math.random() < 0.55) {
        w.dataset.spaceState = 'on';
        w.style.transition = 'letter-spacing 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
        w.style.letterSpacing = (10 + Math.random() * 18).toFixed(0) + 'px';
        scheduleSpaceReset(w);
      } else {
        w.dataset.spaceState = 'skip';
        setTimeout(function () { if (w.dataset.spaceState === 'skip') delete w.dataset.spaceState; }, 450);
      }
    });
  }

  /* ── Event-driven states (1, 2, 3, 6) ───────────────────────── */
  function wrapElement(paragraph) {
    if (paragraph.dataset.fx === 'on') return;
    paragraph.dataset.fx = 'on';

    var original = paragraph.innerHTML;
    var parts = original.split(/<br\s*\/?>/gi);
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
            // Wrap the link's letters too so it joins the scramble/effects,
            // while keeping the <a> (href, underline) intact.
            var a = node.cloneNode(false);
            a.innerHTML = wrapTextNodes(node.textContent);
            nodes.push(a.outerHTML);
          }
        });
        result.push(nodes.join(''));
      } else {
        var temp2 = document.createElement('div');
        temp2.innerHTML = part;
        var text = temp2.textContent || temp2.innerText || '';
        result.push(wrapTextNodes(text));
      }
      if (index < parts.length - 1) result.push('<br>');
    });
    paragraph.innerHTML = result.join('');
    paragraph.style.position = paragraph.style.position || 'relative';

    targets.push(paragraph);
    measure(paragraph);

    paragraph.addEventListener('mousemove', function (e) {
      if (!ready) return;                                   // gated until load-in done
      if (currentState === 4 || currentState === 5) return; // continuous states
      if (currentState === 6) { handleSpacing(paragraph, e); return; }

      var rect = paragraph.getBoundingClientRect();
      var mouseX = e.clientX - rect.left;
      var mouseY = e.clientY - rect.top;
      var radius = 100;

      var charsInRadius = [];
      paragraph.querySelectorAll('.char').forEach(function (char) {
        if (char.dataset.active === 'true') return;
        var cr = char.getBoundingClientRect();
        var charX = cr.left + cr.width / 2 - rect.left;
        var charY = cr.top + cr.height / 2 - rect.top;
        var dx = (charX - mouseX) / (radius / 2);
        var dy = (charY - mouseY) / (radius / 2);
        var distance = dx * dx + dy * dy;
        if (distance <= 1) charsInRadius.push({element: char, distance: distance});
      });
      charsInRadius.sort(function (a, b) { return a.distance - b.distance; });

      var colors = ['rgb(25, 84, 149)', 'rgb(32, 125, 60)', 'rgb(230, 38, 36)'];

      charsInRadius.forEach(function (charData, index) {
        charData.element.dataset.active = 'true';
        setTimeout(function () {
          var el = charData.element;
          if (currentState === 2) { decodeChar(el); return; }  // self-resolving sequence
          if (currentState === 1) {
            var rx = (Math.random() - 0.5) * 80, ry = (Math.random() - 0.5) * 80;
            el.style.transform = 'translate(' + rx + 'px,' + ry + 'px)';
            el.style.color = colors[Math.floor(Math.random() * colors.length)];
          } else if (currentState === 3) {
            el.style.transform = 'scaleY(-1)';
            el.style.display = 'inline-block';
            el.style.color = 'white';
          }
          flippedChars.push(el);
        }, index * (currentState === 2 ? 26 : 10));
      });

      if (returnTimeout) clearTimeout(returnTimeout);
      returnTimeout = setTimeout(function () {
        flippedChars.forEach(function (char, index) {
          setTimeout(function () {
            char.style.transform = ''; char.style.color = '';
            char.style.fontFamily = ''; char.style.fontSize = ''; char.style.display = '';
            char.style.width = ''; char.style.height = ''; char.style.overflow = '';
            char.style.transformOrigin = ''; char.style.whiteSpace = ''; char.style.textAlign = '';
            char.style.verticalAlign = ''; char.style.lineHeight = '';
            delete char.dataset.boxw; delete char.dataset.gunit;
            if (char._glyphInterval) {
              clearInterval(char._glyphInterval); char._glyphInterval = null;
              char.textContent = char.dataset.originalChar;
            }
            delete char.dataset.active;
          }, index * 15);
        });
        flippedChars = [];
      }, 50);
    });
  }

  function initTextFx(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('.text-fx').forEach(wrapElement);
    if (root && root.classList && root.classList.contains('text-fx')) {
      wrapElement(root);
    }
  }

  /* Glyph-scramble helpers shared by the load-in and the click state.
     A position's box is frozen to its real width, then each glyph string is
     horizontally scaled (scaleX) to fill that exact width — so the surrounding
     tracking never shifts AND there are no gaps from a too-small glyph. */
  function repeatGlyph(g, n) { return new Array(n + 1).join(g); }

  function lockBox(el) {
    var w = el.offsetWidth, h = el.offsetHeight;
    el.style.width = w + 'px';                 // freeze the box (both axes) so the
    el.style.height = h + 'px';                // scramble glyph can't resize the cell
    el.style.display = 'inline-block';         // and shift the layout
    el.style.textAlign = 'center';
    el.style.overflow = 'hidden';
    el.style.whiteSpace = 'nowrap';
    el.style.verticalAlign = 'top';            // overflow:hidden inline-block else
    el.style.lineHeight = h + 'px';            // moves the baseline → grows the line
  }
  function applyGlyph(el, str, size) {
    el.style.fontFamily = 'monospace';
    el.style.fontSize = size || '0.55em';   // small centred glyph by default; full size on request
    el.textContent = str;
  }
  function unlockBox(el, real) {
    el.style.fontFamily = ''; el.style.fontSize = ''; el.style.width = '';
    el.style.height = ''; el.style.display = ''; el.style.textAlign = '';
    el.style.overflow = ''; el.style.whiteSpace = '';
    el.style.verticalAlign = ''; el.style.lineHeight = '';
    if (real != null) el.textContent = real;
  }

  /* Click state 2 — each char flickers fast through special symbols, ends on a
     few block glyphs, then snaps back to the real letter. Staggered across the
     chars near the cursor (set in the caller). */
  var DECODE_SIMPLE = '!@#$%&*+=/?<>~^|0123456789'.split('');
  var DECODE_BLOCK = '░▒▓█▄▌▐▀'.split('');
  function decodeChar(el) {
    el.dataset.originalChar = el.textContent;
    lockBox(el);
    el.style.color = 'white';
    // Simple glyphs sit at letter height at 1em; block glyphs fill the whole em,
    // so shrink only those so their height matches the letters too.
    var step = 0, FAST = 16, BLOCK = 5;
    var iv = setInterval(function () {
      if (step < FAST) {
        applyGlyph(el, DECODE_SIMPLE[Math.floor(Math.random() * DECODE_SIMPLE.length)], '1em');
      } else if (step < FAST + BLOCK) {
        applyGlyph(el, DECODE_BLOCK[Math.floor(Math.random() * DECODE_BLOCK.length)], '0.72em');
      } else {
        clearInterval(iv); el._glyphInterval = null;
        unlockBox(el, el.dataset.originalChar);
        el.style.color = '';
        delete el.dataset.active; delete el.dataset.originalChar;
        return;
      }
      step++;
    }, 35);                                    // very fast flicker
    el._glyphInterval = iv;
  }

  /* Page/scroll load-in — the same odometer decode: every position spins
     sequentially through A-Z0-9 (from its own random start) then resolves to the
     real character, staggered top→bottom in an eased cascade. Per-letter `.char`
     tokens (the intro) render as a tight monospace cell; multi-char tokens
     (chrome labels, list cells) use the locked fill so containers never reflow.
     Time-based clock so it always finishes in ~real time. */
  function scrambleIn(els, onDone) {
    var toks = [];
    var minY = Infinity, maxY = -Infinity;
    Array.prototype.forEach.call(els, function (el) {
      var real = el.textContent;
      if (!real || !real.trim()) return;            // skip empty nodes (e.g. status dot)
      var top = el.getBoundingClientRect().top;
      if (top < minY) minY = top; if (top > maxY) maxY = top;
      var tight = el.classList.contains('char');
      if (!tight) lockBox(el);
      el.style.color = 'transparent';
      toks.push({el: el, real: real, cy: top, tight: tight});
    });
    if (!toks.length) { if (onDone) onDone(); return; }

    var span = Math.max(1, maxY - minY);
    var MAX_STAGGER = 26;                    // steps of delay between top and bottom
    var SPIN = 16;                           // odometer steps each position spins
    toks.forEach(function (t) {
      var f = (t.cy - minY) / span;          // 0 = top, 1 = bottom
      var e = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2; // easeInOutCubic
      t.start = Math.round(e * MAX_STAGGER + Math.random() * 6); // + scatter
      t.si = Math.floor(Math.random() * SCRAMBLE_SET.length);    // spin start
    });

    var t0 = performance.now();
    var iv = setInterval(function () {
      var step = Math.floor((performance.now() - t0) / 60);
      var active = false;
      toks.forEach(function (t) {
        if (t.done) return;
        var local = step - t.start;
        if (local < 0) { active = true; return; }    // not started yet → stays hidden
        if (local < SPIN) {
          var glyph = SCRAMBLE_SET[(t.si + local) % SCRAMBLE_SET.length];
          t.el.style.color = '';
          if (t.tight) {
            t.el.style.fontFamily = 'monospace';
            t.el.style.fontSize = '0.88em';
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

  /* Hide `els` now and scramble them in the first time `trigger` scrolls into
     view (used for the project list section). Fires once. */
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
    // First view: header + intro (the project list scrambles on scroll instead).
    var sel = ['.brand', '.main-nav a', '.status span', '.intro .text-fx .char',
      '.footer-socials a'];
    // markReady fires (unlocking interaction + the noise field) when it finishes.
    scrambleIn(document.querySelectorAll(sel.join(',')), markReady);
    // Reveal the now text-hidden sections (the chars/labels are transparent).
    document.querySelectorAll('.intro').forEach(function (el) { el.style.opacity = '1'; });
    document.documentElement.classList.remove('preload');
  }

  window.SiteFX = {apply: initTextFx, scrambleIn: scrambleIn, scrambleOnScroll: scrambleOnScroll, ready: ready};
  initTextFx(document);
  runLoadIn();
})();

/* ── 4. Ambient noise field ─────────────────────────────────────
   A faint, always-running canvas of numbers/symbols whose brightness and
   glyph are driven by a flowing sine-noise field. Sits behind the content,
   in a grey very close to the background, as a light data-texture. */
(function () {
  if (!document.body) return;
  var canvas = document.createElement('canvas');
  canvas.className = 'noise-field';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var GLYPHS = '0123456789+-<>=/.,:;*'.split('');
  var CELL = 24;
  var cols = 0, rows = 0;

  function resize() {
    // dpr 1 — it's a faint background texture, retina sharpness isn't needed
    // and 1x quarters the per-frame pixel/text work.
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.font = '15px monospace';
    ctx.textBaseline = 'top';
    cols = Math.ceil(window.innerWidth / CELL);
    rows = Math.ceil(window.innerHeight / CELL);
    fieldBuf = new Float32Array(cols * rows);
  }
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 150); });
  resize();

  // drag = raw drag energy (only a very fast, sustained drag builds it up);
  // lit = eased display value. overTarget/overSmooth = cursor over text (→ grey).
  // lastActivity drives the idle surfacing (only after ~1 min of no interaction).
  var drag = 0, lit = 0, overTarget = 0, overSmooth = 0, lastX = null, lastY = null, lastT = 0;
  var lastActivity = performance.now();
  var TEXT_SEL = '.intro, .site-header, .projects, .site-footer';
  document.addEventListener('mousemove', function (e) {
    var now = performance.now();
    lastActivity = now;
    overTarget = (e.target && e.target.closest && e.target.closest(TEXT_SEL)) ? 1 : 0;
    if (lastX !== null && !overTarget) {
      var d = Math.sqrt((e.clientX - lastX) * (e.clientX - lastX) + (e.clientY - lastY) * (e.clientY - lastY));
      var dt = Math.max(1, now - lastT);
      var speed = d / dt;                             // px/ms
      // Only a *very* fast drag adds energy, and it accumulates — so colour
      // only appears after dragging fast for a bit, not on a quick flick.
      if (speed > 1.8) drag = Math.min(1, drag + (speed - 1.8) * 0.04);
    }
    lastX = e.clientX; lastY = e.clientY; lastT = now;
  });
  window.addEventListener('scroll', function () { lastActivity = performance.now(); }, {passive: true});

  // Duo-tone pairs the colour eases toward (solid, in clusters). Two colours
  // at a time; the pair only advances once a session has faded back to grey.
  var DUOS = [
    [[255, 255, 255], [240, 225, 40]],  // white / yellow
    [[255, 110, 0], [140, 0, 210]],     // halloween orange / halloween purple
    [[165, 235, 240], [150, 90, 45]],   // pale cyan / brown
    [[170, 255, 40], [25, 120, 45]],    // lime green / dark green
  ];
  var pairIndex = 0, colored = false;

  // Flow field — the coordinates are domain-warped (bent by a second set of
  // slow sines) before sampling, so the iso-lines curve and swirl and the crests
  // break into multiple flowing blobs instead of one big region.
  function field(x, y, t) {
    var wx = x + 8 * Math.sin(y * 0.08 + t * 0.16);
    var wy = y + 8 * Math.sin(x * 0.07 - t * 0.13);
    return (
      Math.sin(wx * 0.17 + t * 0.10) +
      Math.sin(wy * 0.19 - t * 0.09) +
      Math.sin((wx - wy) * 0.13 + t * 0.12)
    ) / 3;
  }

  // Field that carves the screen into solid colour clusters (A vs B) — tuned so
  // several clusters of each colour are visible at once.
  function clusterField(x, y, t) {
    return Math.sin(x * 0.15 + t * 0.18) +
      Math.sin(y * 0.17 - t * 0.13) +
      Math.sin((x + y) * 0.1 + t * 0.22);
  }

  // ── Procedural word field ──────────────────────────────────────────────
  // A 3-letter word is drawn to a tiny bitmap, then sampled across the grid
  // through a Perlin domain-warp (anomalous expand/contract). A persistence
  // buffer smears the moving shape into a full-screen field, which is dithered
  // into two alternating ASCII ramps. The word's letters scramble to the next
  // word every few seconds.
  var RAMP_A = ' .·•-+=:;*ABC0123!*'.split('');   // checkerboard dither — ramp A
  var RAMP_B = ' ·-•~+:*abcXYZ*'.split('');        // ramp B

  // value-noise (Perlin-ish), returns ~0..1
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

  // word bitmap (offscreen) + sampler — sized tight to the word so its aspect
  // ratio is preserved when mapped to the screen (otherwise letters get squished).
  var WB_W = 41, WB_H = 24, WB_FONT = 'bold 20px monospace';
  var wbCanvas = document.createElement('canvas');
  var wbCtx = wbCanvas.getContext('2d');
  var wbData = new Float32Array(WB_W * WB_H);
  function renderWord(w) {
    wbCtx.font = WB_FONT;
    WB_W = Math.ceil(wbCtx.measureText(w).width) + 4;
    wbCanvas.width = WB_W; wbCanvas.height = WB_H;   // resize clears the context
    wbCtx.font = WB_FONT;
    wbCtx.fillStyle = '#000'; wbCtx.fillRect(0, 0, WB_W, WB_H);
    wbCtx.fillStyle = '#fff';
    wbCtx.textAlign = 'center'; wbCtx.textBaseline = 'middle';
    wbCtx.fillText(w, WB_W / 2, WB_H / 2 + 1);
    var img = wbCtx.getImageData(0, 0, WB_W, WB_H).data;
    wbData = new Float32Array(WB_W * WB_H);
    for (var i = 0; i < wbData.length; i++) wbData[i] = img[i * 4] > 100 ? 1 : 0;  // solid
  }
  function wbGet(px, py) {
    return (px < 0 || px >= WB_W || py < 0 || py >= WB_H) ? 0 : wbData[px + py * WB_W];
  }
  function sampleWord(u, v) {                         // bilinear → smooth dither edges
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return 0;
    var x = u * WB_W - 0.5, y = v * WB_H - 0.5;
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var a = wbGet(xi, yi) + (wbGet(xi + 1, yi) - wbGet(xi, yi)) * xf;
    var b = wbGet(xi, yi + 1) + (wbGet(xi + 1, yi + 1) - wbGet(xi, yi + 1)) * xf;
    return a + (b - a) * yf;
  }

  // word list + letter scramble
  var WORDS = ['ert', 'dfg', 'cvb', 'sun', 'sky', 'art', 'box', 'fox', 'cat', 'dog',
    'run', 'fly', 'joy', 'raw', 'mix', 'web', 'dev', 'new', 'pix', 'bit', 'rad', 'lab',
    'one', 'two', 'log', 'map', 'ray', 'hue', 'dot', 'wave'];
  var ALPHA = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var curIdx = [5, 18, 20], tgtIdx = [5, 18, 20], stg = [0, 0, 0], wordPtr = 0;
  function pickWord(w) { for (var i = 0; i < 3; i++) { tgtIdx[i] = Math.max(0, ALPHA.indexOf((w[i] || ' ').toUpperCase())); stg[i] = i * 5; } }
  function stepWord() {
    var ch = false;
    for (var i = 0; i < 3; i++) {
      if (stg[i] > 0) { stg[i]--; continue; }
      if (curIdx[i] !== tgtIdx[i]) { curIdx[i] = (curIdx[i] + 1) % ALPHA.length; ch = true; }
    }
    if (ch) renderWord(ALPHA[curIdx[0]] + ALPHA[curIdx[1]] + ALPHA[curIdx[2]]);
  }
  renderWord('ERT');

  var fieldBuf, frameN = 0;          // persistence buffer (smears the warped word)

  var last = 0, startTime = 0;
  function draw(now) {
    requestAnimationFrame(draw);
    if (now - last < 66) return;             // ~15fps — it's a calm background
    last = now;
    // Ease the whole field in when it first starts (after the load-in).
    var introFade = Math.min(1, (now - startTime) / 2500);
    introFade = introFade * introFade * (3 - 2 * introFade);   // smoothstep
    drag *= 0.97;                            // decays unless you keep fast-dragging
    lit += (drag - lit) * 0.03;              // slow lerp grey<->colour, in AND out
    overSmooth += (overTarget - overSmooth) * 0.03;  // slow grey<->colour over text
    var t = now / 1000;
    // Idle surfacing: only after ~1 minute of no interaction, then ramps in over
    // ~8s. Any mouse move/scroll resets the timer, so it stays grey during use.
    var idleFactor = Math.max(0, Math.min(1, (now - lastActivity - 60000) / 8000));
    var idle = (Math.sin(t * 0.5) + Math.sin(t * 0.23)) * 0.25 + 0.5;  // 0..1
    var energy = Math.min(1, lit + idle * idleFactor * 0.6) * (1 - overSmooth);
    var waveAmt = energy;
    var thresh = 0.44 - energy * 0.18;       // denser as energy rises
    var k = energy;
    // Advance to the next pair only once a colour session has faded back to grey,
    // so the two active colours never change while colour is visible.
    if (energy > 0.15) colored = true;
    else if (energy < 0.03 && colored) { pairIndex = (pairIndex + 1) % DUOS.length; colored = false; }
    var A = DUOS[pairIndex][0], B = DUOS[pairIndex][1];
    var bw = 1 + waveAmt * 0.5 * Math.sin(t * 1.8);  // gentle global brightness pulse

    // word scramble timing: pick a new word periodically, step letters toward it
    frameN++;
    if (frameN % 90 === 0) { pickWord(WORDS[wordPtr]); wordPtr = (wordPtr + 1) % WORDS.length; }
    if (frameN % 2 === 0) stepWord();

    // Map the grid onto the word bitmap (word ~fills the screen), domain-warp the
    // sample coords with Perlin noise (anomalous expand/contract), and keep a
    // decaying persistence so the moving shape smears into a full field.
    var s = now * 0.0005;
    // The domain-warp amplitude breathes over ~16s between calm (the word is
    // legible) and heavy distortion (it voxelises/expands). The pow() bias makes
    // it dwell longer in the calm/legible state before each distortion swell.
    var pulse = Math.pow(Math.sin(now * 0.0004) * 0.5 + 0.5, 1.5);  // 0 calm → 1 distorted
    var warpX = 0.03 + 0.42 * pulse, warpY = 0.06 + 0.9 * pulse;
    // Big word (~92% width) at its real aspect, with a long persistence trail so
    // it flows out and voxelises across the canvas as the warp swells.
    var wW = window.innerWidth * 0.92, wH = wW * (WB_H / WB_W);
    var ox = (window.innerWidth - wW) / 2, oy = (window.innerHeight - wH) / 2;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (var c = 0; c < cols; c++) {
      for (var r = 0; r < rows; r++) {
        var u = (c * CELL - ox) / wW;
        var v = (r * CELL - oy) / wH;
        var dx = u + warpX * (pnoise(u * 2.5 + s, v * 2.5) - 0.5);
        var dy = v + warpY * (pnoise(u * 2.5, v * 2.5 + s) - 0.5);
        var gIdx = c + r * cols;
        var val = sampleWord(dx, dy);
        if (val < fieldBuf[gIdx] * 0.93) val = fieldBuf[gIdx] * 0.93;  // long persistence trail
        fieldBuf[gIdx] = val;
        if (val < 0.04) continue;
        var ramp = ((c + r) & 1) ? RAMP_A : RAMP_B;
        var ch = ramp[Math.min(ramp.length - 1, (val * ramp.length) | 0)];
        if (ch === ' ') continue;
        var grey = 110 + val * 75;
        var col = clusterField(c, r, t) > 0 ? A : B;
        ctx.fillStyle = 'rgb(' +
          Math.max(0, Math.min(255, Math.round((grey * (1 - k) + col[0] * k) * bw * introFade))) + ',' +
          Math.max(0, Math.min(255, Math.round((grey * (1 - k) + col[1] * k) * bw * introFade))) + ',' +
          Math.max(0, Math.min(255, Math.round((grey * (1 - k) + col[2] * k) * bw * introFade))) + ')';
        ctx.fillText(ch, c * CELL, r * CELL);
      }
    }
  }

  // Start the field only after the home load-in scramble finishes; on pages
  // without a load-in (no SiteFX) start immediately.
  function start() { startTime = performance.now(); requestAnimationFrame(draw); }
  if (window.SiteFX && !window.SiteFX.ready) {
    document.addEventListener('site:ready', start, {once: true});
  } else {
    start();
  }
})();
