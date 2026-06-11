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

  // Restricted glyph set used by the page load-in scramble.
  var LOAD_GLYPHS = '░▒▓█%#?/'.split('');

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
          if (currentState === 1) {
            var rx = (Math.random() - 0.5) * 80, ry = (Math.random() - 0.5) * 80;
            charData.element.style.transform = 'translate(' + rx + 'px,' + ry + 'px)';
            charData.element.style.color = colors[Math.floor(Math.random() * colors.length)];
          } else if (currentState === 2) {
            charData.element.dataset.originalChar = charData.element.textContent;
            lockBox(charData.element);
            charData.element.style.color = 'white';
            applyGlyph(charData.element, GLYPHS[Math.floor(Math.random() * GLYPHS.length)], '1em');
            charData.element._glyphInterval = setInterval(function () {
              applyGlyph(charData.element, GLYPHS[Math.floor(Math.random() * GLYPHS.length)], '1em');
            }, 130);
          } else if (currentState === 3) {
            charData.element.style.transform = 'scaleY(-1)';
            charData.element.style.display = 'inline-block';
            charData.element.style.color = 'white';
          }
          flippedChars.push(charData.element);
        }, index * (currentState === 2 ? 32 : 10));
      });

      if (returnTimeout) clearTimeout(returnTimeout);
      returnTimeout = setTimeout(function () {
        flippedChars.forEach(function (char, index) {
          setTimeout(function () {
            char.style.transform = ''; char.style.color = '';
            char.style.fontFamily = ''; char.style.fontSize = ''; char.style.display = '';
            char.style.width = ''; char.style.height = ''; char.style.overflow = '';
            char.style.transformOrigin = ''; char.style.whiteSpace = ''; char.style.textAlign = '';
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

  /* ── Page load-in: scramble every text element in from the border ──
     Each element is hidden, then revealed with a short glyph scramble. The
     delay is proportional to the element's distance from the nearest viewport
     edge, so the reveal collapses inward from the border toward the centre.
     Uses the restricted LOAD_GLYPHS set. */
  /* Glyph-scramble helpers shared by the load-in and the click state.
     A position's box is frozen to its real width, then each glyph string is
     horizontally scaled (scaleX) to fill that exact width — so the surrounding
     tracking never shifts AND there are no gaps from a too-small glyph. */
  function repeatGlyph(g, n) { return new Array(n + 1).join(g); }

  function lockBox(el) {
    var w = el.offsetWidth, h = el.offsetHeight;
    el.style.width = w + 'px';                 // freeze the box (both axes) so the
    el.style.height = h + 'px';                // smaller scramble glyph can't shrink
    el.style.display = 'inline-block';         // the cell and shift the layout
    el.style.textAlign = 'center';
    el.style.overflow = 'hidden';
    el.style.whiteSpace = 'nowrap';
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
    if (real != null) el.textContent = real;
  }

  /* One shared glyph sequence drives every position (same chars, in order,
     twice); only the start is offset — a downward eased cascade with a small
     rain scatter. Per-letter `.char` tokens (the intro) render as a TIGHT
     monospace cell for the matrix-rain look; multi-char tokens (chrome labels,
     project-list cells) use the locked + small-centred fill so their containers
     never reflow. Time-based clock so it always finishes in ~real time. */
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
    var SCRAMBLE = LOAD_GLYPHS.length * 2;   // steps each position scrambles before locking
    toks.forEach(function (t) {
      var f = (t.cy - minY) / span;          // 0 = top, 1 = bottom
      var e = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2; // easeInOutCubic
      t.start = Math.round(e * MAX_STAGGER + Math.random() * 6); // + rain scatter
    });

    var t0 = performance.now();
    var iv = setInterval(function () {
      var step = Math.floor((performance.now() - t0) / 60);
      var active = false;
      toks.forEach(function (t) {
        if (t.done) return;
        var local = step - t.start;
        if (local < 0) { active = true; return; }    // not started yet → stays hidden
        var glyph = LOAD_GLYPHS[local % LOAD_GLYPHS.length];
        if (local < SCRAMBLE) {
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
  var CELL = 15;
  var cols = 0, rows = 0;

  function resize() {
    // dpr 1 — it's a faint background texture, retina sharpness isn't needed
    // and 1x quarters the per-frame pixel/text work.
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.font = '11px monospace';
    ctx.textBaseline = 'top';
    cols = Math.ceil(window.innerWidth / CELL);
    rows = Math.ceil(window.innerHeight / CELL);
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

  // Neon duo-tone pairs the colour eases toward (solid, in clusters). Cycles.
  var DUOS = [
    [[255, 110, 0], [140, 0, 210]],   // halloween: orange / purple
    [[255, 30, 120], [255, 130, 0]],  // hot pink / orange
    [[170, 255, 40], [225, 180, 30]], // lime green / yellow-mustard
    [[0, 225, 255], [255, 120, 0]],   // cyan / orange
    [[40, 110, 255], [235, 220, 30]], // electric blue / yellow
    [[255, 45, 45], [0, 220, 180]],   // red / teal
    [[255, 200, 0], [120, 0, 220]],   // gold / violet
    [[0, 235, 150], [255, 60, 90]],   // mint / coral-red
  ];

  // Flowing field — moving sines, slow time + mixed spatial frequencies so the
  // crests read as distributed patches rather than fast-sweeping bands.
  function field(x, y, t) {
    return (
      Math.sin(x * 0.09 + t * 0.13) +
      Math.sin(y * 0.11 - t * 0.10) +
      Math.sin((x + y) * 0.05 + t * 0.09) +
      Math.sin((x - y) * 0.08 - t * 0.07)
    ) * 0.25;
  }

  // Field that carves the screen into solid colour clusters (A vs B) — tuned so
  // several clusters of each colour are visible at once.
  function clusterField(x, y, t) {
    return Math.sin(x * 0.15 + t * 0.18) +
      Math.sin(y * 0.17 - t * 0.13) +
      Math.sin((x + y) * 0.1 + t * 0.22);
  }

  var last = 0;
  function draw(now) {
    requestAnimationFrame(draw);
    if (now - last < 66) return;             // ~15fps — it's a calm background
    last = now;
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
    // Smoothly lerp the duo-tone between consecutive pairs over the cycle.
    var ci = t / 9, i0 = Math.floor(ci) % DUOS.length, i1 = (i0 + 1) % DUOS.length;
    var cf = ci - Math.floor(ci); cf = cf * cf * (3 - 2 * cf);         // smoothstep
    var A0 = DUOS[i0][0], A1 = DUOS[i1][0], B0 = DUOS[i0][1], B1 = DUOS[i1][1];
    var pA0 = A0[0] + (A1[0] - A0[0]) * cf, pA1 = A0[1] + (A1[1] - A0[1]) * cf, pA2 = A0[2] + (A1[2] - A0[2]) * cf;
    var pB0 = B0[0] + (B1[0] - B0[0]) * cf, pB1 = B0[1] + (B1[1] - B0[1]) * cf, pB2 = B0[2] + (B1[2] - B0[2]) * cf;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (var c = 0; c < cols; c++) {
      for (var r = 0; r < rows; r++) {
        var n = field(c, r, t);
        if (n < thresh) continue;
        var b = (n - thresh) / (1 - thresh);          // 0..1 within a crest
        var grey = 20 + b * 36;
        // Travelling brightness wave — bigger/more prominent as energy rises.
        var bw = 1 + waveAmt * 0.9 * Math.sin(t * 2.4 - (c + r) * 0.33);
        var organic = (n + 1) * 4 + t * 2;
        var wave = t * 8 - (c + r) * 0.4;
        var gi = Math.floor(organic * (1 - waveAmt) + wave * waveAmt) % GLYPHS.length;
        if (gi < 0) gi += GLYPHS.length;
        // Colour: lerp grey → the SOLID duo-tone for this cell's cluster.
        var useA = clusterField(c, r, t) > 0;
        var cR = useA ? pA0 : pB0, cG = useA ? pA1 : pB1, cB = useA ? pA2 : pB2;
        ctx.fillStyle = 'rgb(' +
          Math.max(0, Math.min(255, Math.round((grey * (1 - k) + cR * k) * bw))) + ',' +
          Math.max(0, Math.min(255, Math.round((grey * (1 - k) + cG * k) * bw))) + ',' +
          Math.max(0, Math.min(255, Math.round((grey * (1 - k) + cB * k) * bw))) + ')';
        ctx.fillText(GLYPHS[gi], c * CELL, r * CELL);
      }
    }
  }

  // Start the field only after the home load-in scramble finishes; on pages
  // without a load-in (no SiteFX) start immediately.
  function start() { requestAnimationFrame(draw); }
  if (window.SiteFX && !window.SiteFX.ready) {
    document.addEventListener('site:ready', start, {once: true});
  } else {
    start();
  }
})();
