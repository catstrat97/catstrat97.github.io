/* ============================================================
 *  site.js — Shared behaviours (grey/black, IBM Plex Sans Condensed)
 *    1. Legacy dot cursor (older pages only)
 *    2. Live clock (window [data-clock], incl. two-line "stamp")
 *    3. Cipher text interaction (.text-fx) + the page load-in scramble
 *    4. Procedural noise field (domain-warp word) — greys at rest, vivid
 *       colour PAIRS under the cursor; shuffles in on a staggered grid.
 *    5. Crosshair cursor + click menu (Figma 711:76 / :79 / :82)
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
  // Recurring updates rewrite the clock's spans, which would clobber the
  // load-in cipher mid-scramble — so wait for the reveal to finish rather
  // than guessing a delay (the load-in got slower and outran the old 4.5s).
  var ticking = false;
  function startTicking() {
    if (ticking) return;
    ticking = true;
    render();
    setInterval(render, 15000);
  }
  if (document.documentElement.classList.contains('preload')) {
    document.addEventListener('site:ready', startTicking, {once: true});
    setTimeout(startTicking, 15000);            // failsafe if the reveal never fires
  } else {
    startTicking();
  }
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
  // Runs wherever there's decodable copy — or a project list, which needs
  // SiteFX for its scroll-in scramble (and needs the preload gate cleared).
  // .tf-stage: test.fun has no text-FX copy, but it still needs SiteExit (the
  // standard page exit) and SiteFX.wash — without it, menu links skipped the
  // exit entirely and jumped straight to the next page.
  if (!document.querySelector('.text-fx, .projects, .proj-panel, .pv-panel, .tf-stage')) return;

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
  var revealPending = false;      // true between load and the text reveal
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

  /* Cell-locking so a wide/odd glyph can't resize the cell and reflow text.
     The element is switched to inline-block BEFORE measuring: a block-level
     token (a list row, say) reports its container's full width, which would
     let the scramble run far past where the real word ends. Shrink-to-fit
     gives the true text width, so the write never bleeds beyond it. */
  function lockBox(el) {
    // Measure shrink-to-fit, but keep block-level tokens BLOCK when rendering:
    // flipping a stack of rows to inline-block makes them flow side by side and
    // spill out of their column. Block + an explicit width gives the same cell
    // lock while each row keeps its own line.
    var d = getComputedStyle(el).display;
    var wasBlock = d === 'block' || d === 'list-item' || d === 'flex';
    el.style.display = 'inline-block';
    // Fractional, not offsetWidth: rounding every glyph to a whole pixel
    // changes a line's total width, and at small sizes (10px on a phone)
    // that is enough to re-break the paragraph mid-hover.
    var rb = el.getBoundingClientRect(), w = rb.width, h = rb.height;
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.display = wasBlock ? 'block' : 'inline-block';
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

  /* Click ON the copy → run a full staggered decode sweep over that block.
     Scoped to the text itself because a click anywhere else is now the menu
     gesture (block 5) — sweeping the whole page on every menu open was noise. */
  document.addEventListener('click', function (e) {
    if (!ready) return;
    var host = e.target && e.target.closest ? e.target.closest('.text-fx') : null;
    if (!host) return;
    (host._chars || []).forEach(function (c, i) {
      if (c.dataset.active === 'true') return;
      c.dataset.active = 'true';
      setTimeout(function () { decodeChar(c); }, i * 9);
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

  /* Reveal `els` the first time `trigger` scrolls into view (the list). The
     project page arrives exactly like the home page: its rules trim in first,
     then the copy ciphers in with the same staggered shuffle. */
  function trimInLines(container, then) {
    // The rows render after the fetch, so their hairlines are already drawn.
    // Snap them to zero with transitions OFF, commit that, re-enable, and only
    // then release — otherwise they animate OUT and straight back IN.
    container.classList.add('no-anim', 'lines-hidden');
    container.offsetHeight;                       // commit scaleX(0), untweened
    container.classList.remove('no-anim');
    container.offsetHeight;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        container.classList.remove('lines-hidden');
        setTimeout(then, RULE_TIME);
      });
    });
  }

  function scrambleOnScroll(trigger, els) {
    if (!trigger || !els || !els.length) return;
    var list = Array.prototype.filter.call(els, function (e) {
      return e.textContent && e.textContent.trim();
    });
    list.forEach(function (e) { e.style.color = 'transparent'; });
    var run = function () { trimInLines(trigger, function () { revealAll(list); }); };
    // Already on screen (e.g. the list IS the page) → play straight away
    // rather than waiting for a scroll that will never happen.
    var box = trigger.getBoundingClientRect();
    if (box.top < window.innerHeight && box.bottom > 0) { run(); return; }
    if (!('IntersectionObserver' in window)) { run(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); run(); }
    }, {rootMargin: '0px 0px -8% 0px'});
    io.observe(trigger);
  }

  /* ── Line-by-line reveal ────────────────────────────────────────
     The load-in uses the SAME cipher as hover (box glyphs → blocks →
     resolve) rather than an odometer, and works a line at a time: a line
     finishes decoding before the next one starts, so the reveal reads as
     deliberate rather than random static. */
  var CIPHER_TICK = 60;      // ms per glyph frame
  var CIPHER_BOX = 4;        // box-drawing frames
  var CIPHER_BLOCK = 2;      // block frames before resolving
  /* Stagger envelope, GSAP-ish: the block's chars are spread across ONE eased
     duration rather than a flat per-char step, so short strings snap and long
     blocks still feel unhurried. Jitter is tiny — just enough to break the
     mechanical edge without reading as noise. */
  var REVEAL_PER_CHAR = 13;  // ms per char, used to size the envelope
  var REVEAL_MIN = 700;      // shortest envelope (a few words)
  var REVEAL_MAX = 2600;     // longest envelope (a full page of copy)
  var REVEAL_JITTER = 16;    // ms of slop
  var RULE_TIME = 1750;      // ms the rules take to trim in before the copy

  /* ── THE standard for every write/redact on the site ──────────────
     Text always animates PER CHARACTER. Anything handed to write()/redact()
     that isn't already split is split here first, so the whole-token path
     (one repeated glyph smeared across a word) can't be reached by accident —
     it reads completely differently and must not appear anywhere. */
  function splitInto(el, text) {
    el.innerHTML = String(text).split('').map(function (c) {
      // Spaces stay as plain text: wrapping in a span with &nbsp; makes them
      // non-breaking, so wrapped copy turns into one long overflowing line.
      if (c === ' ') return ' ';
      var safe = c.replace(/[&<>]/g, function (m) {
        return ({'&': '&amp;', '<': '&lt;', '>': '&gt;'})[m];
      });
      return '<span class="char">' + safe + '</span>';
    }).join('');
  }
  function toChars(els) {
    var out = [];
    Array.prototype.forEach.call(els, function (el) {
      if (!el) return;
      if (el.classList && el.classList.contains('char')) { out.push(el); return; }
      var found = el.querySelectorAll ? el.querySelectorAll('.char') : [];
      if (found.length) { el.style.color = ''; out.push.apply(out, found); return; }
      var txt = el.textContent;
      if (!txt || !txt.trim()) return;
      splitInto(el, txt);
      // Hiding moves to the characters — if the parent kept an inline
      // transparent from the caller, the new spans would inherit it and the
      // text would never come back.
      el.style.color = '';
      out.push.apply(out, el.querySelectorAll('.char'));
    });
    return out;
  }

  /* easeInOutCubic — the stagger accelerates through the middle and settles. */
  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  /* `scale` shrinks the sweep without touching its shape — used where a
     transition has to be quick (the interior's collapse toggle) but should
     still read as the same sweep. Omitted everywhere else, so page load,
     exit and hover are unchanged. */
  function staggerDelay(i, n, scale) {
    var span = Math.max(REVEAL_MIN, Math.min(REVEAL_MAX, n * REVEAL_PER_CHAR));
    var f = n < 2 ? 0 : i / (n - 1);
    return (easeInOut(f) * span + Math.random() * REVEAL_JITTER) * (scale || 1);
  }

  function cipherToken(t, done) {
    var el = t.el;
    if (!t.tight) lockBox(el);
    var step = 0;
    var iv;
    function frame() {
      var g;
      if (step < CIPHER_BOX) {
        g = DECODE_BOX[step % DECODE_BOX.length];
        if (t.tight) { el.style.fontFamily = MONO; el.style.fontSize = '1em'; el.textContent = g; }
        else applyGlyph(el, repeatGlyph(g, t.real.length));
      } else if (step < CIPHER_BOX + CIPHER_BLOCK) {
        g = DECODE_BLOCK[(step - CIPHER_BOX) % DECODE_BLOCK.length];
        if (t.tight) { el.style.fontFamily = MONO; el.style.fontSize = '0.8em'; el.textContent = g; }
        else applyGlyph(el, repeatGlyph(g, t.real.length));
      } else {
        clearInterval(iv);
        if (t.tight) { el.style.fontFamily = ''; el.style.fontSize = ''; el.textContent = t.real; }
        else unlockBox(el, t.real);
        done();
        return;
      }
      step++;
    }
    frame();                    // first glyph now — never show the real text
    el.style.color = '';        // only reveal once a glyph is already in place
    iv = setInterval(frame, CIPHER_TICK);
    t.el._glyphInterval = iv;
  }

  /* Group tokens into visual lines by their Y (tolerance absorbs sub-pixel
     baseline drift), ordered top→bottom then left→right. */
  function toLines(els, hide) {
    var toks = [];
    Array.prototype.forEach.call(els, function (el) {
      var real = el.textContent;
      if (!real || !real.trim()) return;
      var b = el.getBoundingClientRect();
      if (hide) el.style.color = 'transparent';
      toks.push({el: el, real: real, top: b.top, left: b.left,
        tight: el.classList.contains('char')});
    });
    toks.sort(function (a, b) { return (a.top - b.top) || (a.left - b.left); });
    var lines = [];
    for (var i = 0; i < toks.length; i++) {
      var last = lines[lines.length - 1];
      if (last && Math.abs(toks[i].top - last[0].top) <= 6) last.push(toks[i]);
      else lines.push([toks[i]]);
    }
    return lines;
  }

  /* The whole block reveals AT ONCE with a slight stagger — the same ripple
     the hover cipher gives, just seeded by reading order instead of by
     distance from the cursor. (Line-by-line read too rigid.) */
  function revealAll(els, onDone) {
    els = toChars(els);
    var toks = [];
    Array.prototype.forEach.call(els, function (el) {
      var real = el.textContent;
      if (!real || !real.trim()) return;
      var b = el.getBoundingClientRect();
      el.style.color = 'transparent';
      toks.push({el: el, real: real, top: b.top, left: b.left,
        tight: el.classList.contains('char')});
    });
    if (!toks.length) { if (onDone) onDone(); return; }
    toks.sort(function (a, b) { return (a.top - b.top) || (a.left - b.left); });
    var left = toks.length, n = toks.length;
    toks.forEach(function (t, i) {
      t.el._fxTimer = setTimeout(function () {
        cipherToken(t, function () { if (--left === 0 && onDone) onDone(); });
      }, staggerDelay(i, n));
    });
  }

  function cipherOut(t, done, tick) {
    var el = t.el;
    var step = 0;
    var iv;
    function frame() {
      if (step < CIPHER_BOX) {
        var g = DECODE_BOX[step % DECODE_BOX.length];
        if (t.tight) { el.style.fontFamily = MONO; el.style.fontSize = '1em'; el.textContent = g; }
        else applyGlyph(el, repeatGlyph(g, t.real.length));
      } else {
        clearInterval(iv);
        if (t.tight) { el.style.fontFamily = ''; el.style.fontSize = ''; el.textContent = t.real; }
        else unlockBox(el, t.real);
        el.style.color = 'transparent';
        done();
        return;
      }
      step++;
    }
    frame();                    // first glyph immediately — no bare-text frame
    iv = setInterval(frame, tick || CIPHER_TICK);
    t.el._glyphInterval = iv;
  }

  /* Kill any pending/running transition on these elements so a new write or
     redact can't collide with the tail of the last one. */
  function cancelFx(els) {
    Array.prototype.forEach.call(els, function (el) {
      if (el._fxTimer) { clearTimeout(el._fxTimer); el._fxTimer = null; }
      if (el._glyphInterval) { clearInterval(el._glyphInterval); el._glyphInterval = null; }
    });
  }

  /* Strip a block back out, reverse reading order — the mirror of revealAll. */
  function redactAll(els, onDone, opts) {
    opts = opts || {};
    els = toChars(els);
    var toks = [];
    Array.prototype.forEach.call(els, function (el) {
      var real = el.textContent;
      if (!real || !real.trim()) return;
      var b = el.getBoundingClientRect();
      toks.push({el: el, real: real, top: b.top, left: b.left,
        tight: el.classList.contains('char')});
    });
    if (!toks.length) { if (onDone) onDone(); return; }
    toks.sort(function (a, b) { return (b.top - a.top) || (b.left - a.left); });
    var left = toks.length, n = toks.length;
    toks.forEach(function (t, i) {
      t.el._fxTimer = setTimeout(function () {
        cipherOut(t, function () { if (--left === 0 && onDone) onDone(); }, opts.tick);
      }, staggerDelay(i, n, opts.scale));
    });
  }

  var LOAD_SEL = ['.brand', '.main-nav a', '.status span', '.intro .char',
    '.rail-socials a', '.rail-clock span', '.rail-coords span'];

  /* Everything the exit should strip, on any page. LOAD_SEL stays home-only
     because the project page runs its own write-in. */
  var EXIT_SEL = LOAD_SEL.concat(['.filters-label .char', '.filter-list .char',
    '.proj-list .char', '.proj-role .char',
    '#pv-title .char', '#pv-desc .char', '.pv-roles-label .char',
    '#pv-roles .char', '#pv-link .char']);

  /* ── Exit: delete bottom-up, retract the rules, then leave ─────── */
  var exiting = false;
  function playExit(href) {
    if (exiting) return;
    exiting = true;
    var lines = toLines(document.querySelectorAll(EXIT_SEL.join(',')), false);
    var last = 0;
    // Bottom line first, and within each line the characters vanish
    // right-to-left — it reads like the copy is being backspaced away.
    for (var i = lines.length - 1, n = 0; i >= 0; i--, n++) {
      var line = lines[i];
      for (var j = line.length - 1, k = 0; j >= 0; j--, k++) {
        var at = n * 70 + k * 5;
        if (at > last) last = at;
        (function (el, delay) {
          setTimeout(function () { el.style.visibility = 'hidden'; }, delay);
        })(line[j].el, at);
      }
    }
    // Close the menu — only the bare cursor mark should survive the exit. The
    // cursor folds it back into the diamond; without that, drop it outright.
    if (window.SiteCursor && window.SiteCursor.close) {
      window.SiteCursor.close();
    } else {
      var menu = document.getElementById('cursor-menu');
      var ch = document.getElementById('crosshair');
      if (menu) { menu.classList.remove('is-open', 'is-shown'); menu.setAttribute('aria-hidden', 'true'); }
      if (ch) ch.classList.remove('is-open');
    }

    /* ── Standard media exit ───────────────────────────────────────
       ANY visible media carrying a wash layer (a pre.pv-scramble child)
       leaves through the same transition on every navigation — projects →
       interior, interior → home, wherever. While the copy backspaces the
       media is covered by the wash; the cover strips to nothing; and only
       once the page holds no media do the rules retract. Image first, then
       the boundaries. Pages never sequence this themselves — this being the
       only implementation is what makes it the standard. */
    var media = [];
    Array.prototype.forEach.call(
      document.querySelectorAll('pre.pv-scramble'), function (p) {
        var el = p.parentElement;
        if (!el || !el.offsetWidth || !el.offsetHeight) return;
        el.classList.add('is-washing');
        el.classList.remove('is-settled');
        p.classList.add('is-washing');
        media.push({el: el, pre: p});
      });
    var covers = media.length;
    var stripped = media.length === 0;
    var backDone = false, retracted = false;
    media.forEach(function (m) {
      wash(m.el, m.pre, 'out', function () {
        Array.prototype.forEach.call(m.el.querySelectorAll('img, video'),
          function (mm) { mm.style.visibility = 'hidden'; });
        if (--covers > 0) return;
        var left = media.length;
        media.forEach(function (m2) {
          wash(m2.el, m2.pre, 'in', function () {
            // The box's boundary leaves the moment ITS media has stripped
            // (.is-washed in the stylesheet) — an empty frame never lingers
            // while the copy finishes backspacing.
            m2.el.classList.add('is-washed');
            if (--left === 0) { stripped = true; retract(); }
          });
        });
      });
    });

    // Once the copy is gone AND the media has fully left, every rule
    // retracts (and the field fades) — the page goes fully blank before we
    // leave, so the next page can draw itself in from nothing.
    var EXIT_RETRACT = 700;
    function retract() {
      if (!backDone || !stripped || retracted) return;
      retracted = true;
      document.documentElement.classList.add('is-exiting');
      setTimeout(function () {
        window.location.href = href;
      }, EXIT_RETRACT + 120);
    }
    setTimeout(function () { backDone = true; retract(); }, last + 90);
    // Watchdog: if any wash callback is lost, the exit must still complete —
    // a page that never navigates because a cover stalled is far worse than
    // a cover that leaves with the fade.
    setTimeout(function () { stripped = true; backDone = true; retract(); },
      last + 90 + 2600);
  }
  window.SiteExit = playExit;

  function runLoadIn() {
    if (!document.documentElement.classList.contains('preload')) { markReady(); return; }
    var els = document.querySelectorAll(LOAD_SEL.join(','));
    // Hide the copy immediately, then let the rules draw themselves in first
    // (CSS, ~1.3s) before any text decodes — the page arrives in two beats.
    Array.prototype.forEach.call(els, function (el) { el.style.color = 'transparent'; });
    var ch = document.getElementById('crosshair');
    if (ch) ch.classList.add('is-intro');
    revealPending = true;
    if (window.SiteFX) window.SiteFX.revealPending = true;

    // The rules start at scaleY(0) under .preload. The browser needs to PAINT
    // that start state before we drop the class, otherwise there's nothing to
    // transition from and the lines just appear. Flush layout, then wait two
    // frames so the "from" value is committed.
    document.documentElement.offsetHeight;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.documentElement.classList.remove('preload');
        setTimeout(function () {
          // The cipher renders each character in monospace, which is wider than
          // the condensed face — so any container sized to its content grows
          // while writing. Pin those before the write so nothing resizes.
          document.querySelectorAll('.col-rail').forEach(function (el) {
            el.style.width = Math.ceil(el.getBoundingClientRect().width) + 'px';
          });
          if (ch) ch.classList.remove('is-intro');  // back to snappy trims
          // The field shuffles in alongside the copy, so the animation is
          // there from the second beat, not after the whole reveal.
          if (window.SiteFX) window.SiteFX.revealPending = false;
          document.dispatchEvent(new Event('site:reveal'));
          revealAll(els, markReady);
        }, RULE_TIME);
      });
    });
  }

  /* ── Media wash ────────────────────────────────────────────────
     An ASCII field sized to an element, used to cover media while it
     changes: 'out' builds the wash up until the media is fully hidden,
     'in' thins it back out. It is the write/redact pair for pictures —
     an interior frame changing layout and a thumbnail leaving the page
     both route through here, so they speak the same language. */
  /* Dense → sparse, same language as the field's INK_RAMP — no narrow line
     glyphs, they read as structure rather than tone. */
  var WASH_SET = '█▓▒░•=-~·,.'.split('');
  var WASH_MS = 45;                             // churn frame
  var WASH_SWEEP = 380;                         // default fill / strip sweep
  function wash(el, pre, dir, onDone, sweepMs) {
    var done = onDone || function () {};
    if (!el || !pre) { done(); return; }
    var b = el.getBoundingClientRect();
    var cols = Math.ceil(b.width / 7.9);        // ~13px IBM Plex Mono cell
    var rows = Math.ceil(b.height / 13.7);
    if (cols < 1 || rows < 1) { done(); return; }
    clearInterval(pre._washIv);
    var SWEEP = sweepMs || WASH_SWEEP;

    /* The rolling-wave pacing (specified, exact — applied per CELL):
       · each cell churns for the second half of the sweep's span: cell i of
         n starts at (i/(n−1))·(SWEEP/2) in reading order and churns for
         SWEEP/2, so the stagger spread equals the per-cell duration — the
         first cell locks exactly as the last one starts. One continuous
         wave, no gap, no tail.
       · per-cell progress p = clamp01((u − (i/(n−1))·0.5) / 0.5), eased with
         easeInOutCubic; the eased value is the PROBABILITY the cell has
         settled this frame — churn is fast early, slowing into place.
       · settled means blank for 'in' (the image shows through) and a dense
         live glyph for 'out' (the cover); the churn glyph's weight rides the
         ease, so a settling cell thins toward · , . and a covering cell
         thickens toward █.
       · alpha cover — the pre's own background rides overall progress, so
         media dissolves under the glyphs / emerges through them, no pop. */
    var n = rows * cols;
    var last = WASH_SET.length - 1;
    var t0 = performance.now();
    var fired = false;
    pre._washIv = setInterval(function () {
      var u = Math.min(1, (performance.now() - t0) / SWEEP);
      // A held cover tracks its element: the slideshow toggle RESIZES frames
      // underneath the wash, and a grid measured once would keep covering the
      // old shape — leaving the new area bare while it churns.
      if (fired && dir === 'out') {
        var nb = el.getBoundingClientRect();
        if (nb.width && nb.height &&
            (Math.abs(nb.width - b.width) > 1 || Math.abs(nb.height - b.height) > 1)) {
          b = nb;
          cols = Math.ceil(b.width / 7.9);
          rows = Math.ceil(b.height / 13.7);
          n = rows * cols;
        }
      }
      pre.style.backgroundColor =
        'rgba(1,1,1,' + (dir === 'out' ? u : 1 - u).toFixed(3) + ')';
      var out = [];
      for (var r = 0; r < rows; r++) {
        var line = '';
        for (var c = 0; c < cols; c++) {
          var i = r * cols + c;
          var p = (u - (n > 1 ? i / (n - 1) : 0) * 0.5) / 0.5;
          if (p <= 0) { line += dir === 'out' ? ' ' : coverGlyph(); continue; }
          var eased = p >= 1 ? 1 : easeInOut(p);
          if (dir === 'in') {
            line += Math.random() < eased ? ' ' : coverGlyph();
          } else {
            line += Math.random() < eased ? coverGlyph() : glyphAt(eased, dir);
          }
        }
        out.push(line);
      }
      pre.textContent = out.join('\n');
      if (u >= 1 && !fired) {
        fired = true;
        // 'out' keeps churning after it lands — it is a cover, and whatever
        // it hides is still changing underneath. The matching 'in' clears it.
        if (dir === 'in') {
          clearInterval(pre._washIv);
          pre.textContent = '';
          pre.style.backgroundColor = 'rgba(1,1,1,0)';
        }
        done();
      }
    }, WASH_MS);
    /* The settled cover is DARK: mostly-sparse glyphs over the black backing,
       redrawn every frame — the same texture the noise field rests in. A
       covered frame reads as a black box alive with ASCII, never as a wall
       of solid light blocks (that read as a pale slab that never left). */
    function coverGlyph() {
      return WASH_SET[2 + ((Math.random() * (last - 1)) | 0)];
    }
    // Churn weight: eased 0 → the far end of the ramp for the direction,
    // eased 1 → its settled end. Only the wave's crest reaches █ — a cell
    // passes through dense on its way to settling into the dark cover.
    function glyphAt(eased, d) {
      var lvl = d === 'in' ? eased : 1 - eased;    // 0 = dense … 1 = sparse
      var idx = (lvl * last + (Math.random() * 2 - 1) * 1.4) | 0;
      return WASH_SET[idx < 0 ? 0 : idx > last ? last : idx];
    }
  }

  /* write() / redact() are THE text-transition primitive — page load, page
     exit, role hover and filter changes all route through the same pair so
     the terminal feel is identical everywhere. */
  window.SiteFX = {apply: initTextFx, scrambleIn: scrambleIn, scrambleOnScroll: scrambleOnScroll,
    write: revealAll, redact: redactAll, cancel: cancelFx,
    wash: wash, washTime: WASH_SWEEP,
    chars: toChars, split: splitInto, ruleTime: RULE_TIME,
    ready: ready, revealPending: false};
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
  var stage = document.getElementById('noise-stage');
  if (!stage) return;
  // data-region → the field fills that element instead of the whole viewport.
  // data-shape="flower" → sample a flower silhouette instead of a word.
  var REGION = stage.hasAttribute('data-region');
  var SHAPE = stage.getAttribute('data-shape') || '';
  var CUBE = SHAPE === 'cube';

  var canvas = document.createElement('canvas');
  canvas.className = 'noise-field' + (REGION ? ' is-region' : '');
  canvas.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  /* The field RESTS in greys only (matching the page's #cecece hairlines) —
     that restraint is what lets the interaction colours pop. Movement lerps
     away from these two toward one of the PAIRS below. */
  var BASE_STROKE = [206, 206, 206];   // #cecece — the resting stroke grey
  var BASE_FILL = [112, 112, 112];     // dimmer interior grey (stroke ≠ fill)

  /* Interaction colour PAIRS — [fill, stroke]. Deliberately clashing, popping
     combinations; the pair guarantees stroke and fill are never the same hue.
     The cycle walks this ring while the cursor is engaged. */
  var PAIRS = [
    [[0, 168, 168], [156, 78, 16]],      // teal / brown
    [[255, 122, 0], [230, 38, 36]],      // orange / red
    [[255, 0, 128], [57, 255, 20]],      // magenta / neon green
    [[25, 84, 149], [255, 190, 0]],      // blue / amber
    [[124, 58, 237], [255, 225, 53]],    // violet / yellow
    [[0, 229, 255], [255, 61, 127]],     // cyan / hot pink
    [[3, 254, 151], [86, 86, 86]],       // mint / graphite (the original pair)
    [[236, 236, 236], [200, 30, 30]]     // white / red
  ];
  /* The field only — the copy stays on IBM Plex Mono. Departure Mono is a
     bitmap-derived face: its glyphs are built from square pixels on a coarse
     grid, so the ramp steps read as distinct weights at 15px instead of
     smearing into each other the way a smooth mono does. */
  var MONO = "'Departure Mono', 'IBM Plex Mono', monospace";
  /* Departure Mono is drawn on a 550-unit em = an 11px pixel grid, so it is
     pixel-crisp at 11 and 22 and antialiased anywhere else. 16 is the middle
     that buys the density: advance is 350/550 em, so cells land at 10×19 and
     the grid roughly doubles (≈3.5k cells → ≈7.3k). 22 would be crisper but
     no denser than the old 20px square; 11 is crisp AND dense but ~15k cells,
     which is more fillText per frame than this loop can afford. */
  var FONT_PX = 16;
  /* Phone: the word is stacked (see renderWord) and set at Departure Mono's
     native 11px — crisp, and ~2× the cells across each letter. A phone's
     grid is small enough that the extra cells cost little. */
  var TOUCH_FIELD = !!(window.matchMedia &&
    matchMedia('(hover: none) and (pointer: coarse)').matches);
  if (TOUCH_FIELD) FONT_PX = 11;
  var CELL_RATIO = 1.85;               // cell height as a multiple of advance width
  var WARP_FREQ = 0.85;                // noise cycles across the word — see the draw loop
  var CELL_W = 10, CELL_H = 18;        // measured from the face in resize()

  /* ── Adaptive resolution ─────────────────────────────────────────
     Rasterising ~7k glyphs per frame at devicePixelRatio is the heaviest
     thing the site does — measured at 39fps on a 5×-throttled CPU at dpr 2,
     while everything else held 70+. So the backing store is a ladder: it
     starts at the device's ratio and steps DOWN only when frames sag for a
     sustained stretch (~2s), stepping back up only after a long run of
     headroom. Machines that keep up never see a step; weak machines get
     slightly softer glyphs instead of jank. Grid, glyphs and motion are
     identical at every rung — only the raster resolution moves. */
  var DPR_STEPS = (function () {
    var max = Math.min(window.devicePixelRatio || 1, 3);
    return [1, 1.5, 2, 3].filter(function (s) { return s <= max; })
      .concat(max % 0.5 ? [max] : []);
  })();
  if (!DPR_STEPS.length) DPR_STEPS = [1];
  var dprIdx = DPR_STEPS.length - 1;
  var emaFrame = 16, slowRun = 0, fastRun = 0;
  function governDpr(dt) {
    if (dt > 0 && dt < 250) emaFrame += (dt - emaFrame) * 0.1;
    if (emaFrame > 21 && dprIdx > 0) {            // sustained under ~48fps
      if (++slowRun > 90) { dprIdx--; resize(); slowRun = 0; fastRun = 0; }
    } else slowRun = 0;
    if (emaFrame < 13 && dprIdx < DPR_STEPS.length - 1) {
      if (++fastRun > 900) { dprIdx++; resize(); fastRun = 0; }
    } else fastRun = 0;
  }
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
  var mouseX = 0, mouseY = 0, hasPointer = false, canvasLeft = 0, canvasTop = 0;
  document.addEventListener('mousemove', function (e) {
    interact = 1; mouseX = e.clientX; mouseY = e.clientY; hasPointer = true;
  });

  /* ── Framing behaviour ──────────────────────────────────────────
     Every few seconds the field picks a new "instance": fill the screen,
     settle large in the centre, or drift somewhere at a smaller scale.
     Scale and anchor are eased so it glides between them. The anchor is a
     0..1 fraction of the LEFTOVER space, and the scale is capped to what
     fits both axes — so the word can never bleed off the window. */
  var frScale = 0.82, frX = 0.5, frY = 0.5;      // eased, current
  var tgScale = 0.82, tgX = 0.5, tgY = 0.5;      // targets
  var nextBehaviour = 0;
  function pickBehaviour(now) {
    // The field should own the viewport. The old drift case bottomed out at
    // 0.40 — small enough that the word read as a detail rather than the page,
    // so the floor is up at 0.66 and the two large behaviours are weighted up.
    var r = Math.random();
    if (r < 0.42) {                               // fill the whole screen
      tgScale = 1; tgX = 0.5; tgY = 0.5;
    } else if (r < 0.76) {                        // settle big, centred
      tgScale = 0.80 + Math.random() * 0.14; tgX = 0.5; tgY = 0.5;
    } else {                                      // drift — still large
      tgScale = 0.66 + Math.random() * 0.20;
      tgX = Math.random(); tgY = Math.random();
    }
    nextBehaviour = now + 4500 + Math.random() * 4500;
  }

  function resize() {
    var box = REGION ? stage.getBoundingClientRect() : null;
    SW = Math.max(1, box ? box.width : window.innerWidth);
    SH = Math.max(1, box ? box.height : window.innerHeight);
    if (box) {
      canvasLeft = box.left; canvasTop = box.top;
      canvas.style.left = box.left + 'px';
      canvas.style.top = box.top + 'px';
    }
    // Size the backing store at the ADAPTIVE pixel ratio (see the governor at
    // the top of draw()) so the ASCII glyphs rasterise crisply on Retina,
    // instead of being upscaled from a 1x canvas (which looked blurry). All
    // drawing stays in CSS pixels — the context transform maps them to
    // physical pixels.
    var dpr = DPR_STEPS[dprIdx];
    canvas.width = Math.round(SW * dpr);
    canvas.height = Math.round(SH * dpr);
    canvas.style.width = SW + 'px';
    canvas.style.height = SH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = FONT_PX + 'px ' + MONO;
    ctx.textBaseline = 'top';
    // Cell size comes from the face's own advance width rather than a fixed
    // 20px square. A 15px glyph in a 20px cell left half the row as gap, which
    // is what made the field read as a sparse dot grid instead of as text.
    CELL_W = Math.max(4, Math.round(ctx.measureText('█').width));
    CELL_H = Math.max(6, Math.round(CELL_W * CELL_RATIO));
    cols = Math.ceil(SW / CELL_W);
    rows = Math.ceil(SH / CELL_H);
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
  // ctx.font is only assigned in resize(), so if Departure Mono lands after
  // boot the canvas would keep drawing the fallback. Re-run it once it's in.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { resize(); });

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

  /* Glyph sets. GLITCH_SET = the glitch-burst glyphs; BLOCK_SET = the solid
     blocks the field ciphers through at the deep colour stage; DIGITS = what
     the interior ciphers into when the cursor moves. */
  /* INK_RAMP is ordered dense → sparse, and a cell's glyph is its ink LEVEL,
     not its position. Two things follow from that, and both were wrong before:
     neighbouring cells land on neighbouring glyphs, so the letterform stays
     legible instead of dissolving into a blob; and a cell whose value is
     decaying visibly steps down the ramp — •, -, ·, ',', '.', gone — which is
     what makes the trail read. The narrow verticals and corners are out: at
     20px they carry almost no ink but draw the eye like structure. */
  var INK_RAMP = '█▓▒░•─=-~·,.'.split('');
  var RAMP_SHIMMER = 0.10;             // wave jitter, small enough to keep the gradient
  var TRAIL_DECAY = 0.985;             // per frame at 60fps — ≈1.5s tail
  var GLITCH_SET = '█▓▒░•='.split('');
  var BLOCK_SET = '█▓▒░'.split('');
  var DIGITS = '0123456789'.split('');
  // What the grid churns through during the staggered shuffle-in on load.
  var SHUFFLE_SET = '█▓▒░•=-·,.0123456789'.split('');
  // What the interior idles on — sequenced by the wave, not a single dot.
  var REST_DOTS = '+-.'.split('');

  /* Looping colour cycle over the PAIRS ring. The field rests in grey; once the
     cursor engages, a free-running phase walks the ring (faster the longer you
     hover) and keeps interpolating, so the colours never settle. Fill and stroke
     are read from the SAME pair, which is what keeps them a designed contrast
     rather than two points on one gradient. */
  var _fill = [0, 0, 0], _stroke = [0, 0, 0];
  function pairLoop(t) {
    t -= Math.floor(t);                       // wrap to 0..1
    var n = PAIRS.length, s = t * n;
    var i = Math.floor(s) % n, j = (i + 1) % n, f = s - Math.floor(s);
    var a = PAIRS[i], b = PAIRS[j];
    for (var k = 0; k < 3; k++) {
      _fill[k] = a[0][k] + (b[0][k] - a[0][k]) * f;
      _stroke[k] = a[1][k] + (b[1][k] - a[1][k]) * f;
    }
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
  /* Portrait phone: one letter per line, so the word's shape matches the
     tall screen instead of shrinking to a thin strip across its width. */
  var WB_LINE = 104;
  function renderWord(w) {
    if (TOUCH_FIELD && window.innerHeight > window.innerWidth) {
      var letters = String(w).split('');
      wbCtx.font = WB_FONT;
      var mw = 0;
      letters.forEach(function (l) { mw = Math.max(mw, wbCtx.measureText(l).width); });
      WB_W = Math.ceil(mw) + 16;
      WB_H = letters.length * WB_LINE + 16;
      wbCanvas.width = WB_W; wbCanvas.height = WB_H;
      wbCtx.font = WB_FONT;
      wbCtx.fillStyle = '#000'; wbCtx.fillRect(0, 0, WB_W, WB_H);
      wbCtx.fillStyle = '#fff';
      wbCtx.textAlign = 'center'; wbCtx.textBaseline = 'middle';
      letters.forEach(function (l, i) {
        wbCtx.fillText(l, WB_W / 2, 8 + WB_LINE * (i + 0.5) + 1);
      });
      buildField();
      return;
    }
    WB_H = 120;
    wbCtx.font = WB_FONT;
    WB_W = Math.ceil(wbCtx.measureText(w).width) + 16;
    wbCanvas.width = WB_W; wbCanvas.height = WB_H;
    wbCtx.font = WB_FONT;
    wbCtx.fillStyle = '#000'; wbCtx.fillRect(0, 0, WB_W, WB_H);
    wbCtx.fillStyle = '#fff';
    wbCtx.textAlign = 'center'; wbCtx.textBaseline = 'middle';
    wbCtx.fillText(w, WB_W / 2, WB_H / 2 + 1);
    buildField();
  }

  /* Blur whatever is on the offscreen canvas into the soft distance field the
     grid samples. Shared by the word and the flower. */
  function buildField() {
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
  /* ── Wireframe cube (data-shape="cube") ─────────────────────────
     A rotating box projected to 2D; each cell shades by its distance to the
     nearest projected edge, ramped through a density set. Cells that fall
     outside the ramp draw a faint grid instead of nothing, so the field has a
     floor texture. Duotone: the grid takes one colour and the edges the other
     — grey at rest, lerping into the active PAIR as the pointer engages. */
  var DENSITY = ' -=+abcdX'.split('');

  var L = 0.6;
  /* 16 vertices of a tesseract — every combination of ±L on four axes — and the
     32 edges joining vertices that differ on exactly one axis. Scaling the w
     extent to 0 collapses the two cubes onto each other and the 8 joining edges
     to nothing, so the SAME vertex set renders as a plain cube. The morph is
     then one number rather than two shapes to blend between. */
  var TESS_V = [], TESS_E = [];
  for (var tv = 0; tv < 16; tv++) {
    TESS_V.push([tv & 1 ? L : -L, tv & 2 ? L : -L, tv & 4 ? L : -L, tv & 8 ? L : -L]);
  }
  for (var ta = 0; ta < 16; ta++) {
    for (var tb = ta + 1; tb < 16; tb++) {
      var xo = ta ^ tb;
      if ((xo & (xo - 1)) === 0) TESS_E.push([ta, tb]);   // differ in one bit
    }
  }
  var proj = [];
  for (var pi = 0; pi < 16; pi++) proj.push([0, 0]);
  // Live edges, rebuilt once a frame: collapsed and duplicate edges are culled
  // so the per-cell loop never pays for them.
  var liveE = [], liveN = 0;
  for (var le = 0; le < 32; le++) liveE.push([null, null]);
  var cubeMorph = 0;                    // 0 = cube, 1 = hypercube

  function projectCube(now) {
    var t = now * 0.01;
    /* Morph clock: hold as a cube, transit, hold as a hypercube, transit back.
       ~48s round trip, with both ends held long enough that each shape reads
       as itself before it becomes the other. */
    var raw = Math.sin(now * 0.00013) * 0.5 + 0.5;
    var mw = raw < 0.28 ? 0 : raw > 0.72 ? 1 : (raw - 0.28) / 0.44;
    cubeMorph = mw * mw * (3 - 2 * mw);
    var mws = cubeMorph;

    var rx = t * 0.11, ry = t * 0.13, rz = -t * 0.15;
    // Perspective distance breathes, so the cube scales as it turns.
    // Shallower far distance than the original so it never shrinks away.
    var zOff = -2.4 + (Math.sin(t * 0.12) * 0.5 + 0.5) * -1.7;     // -2.4 → -4.1
    var cx = Math.cos(rx), sx = Math.sin(rx);
    var cy = Math.cos(ry), sy = Math.sin(ry);
    var cz = Math.cos(rz), sz = Math.sin(rz);
    // The 4D planes only mean anything once w has extent, so they ride the
    // morph — this is the turn that reads as "inside out".
    var rxw = t * 0.09 * mws, ryw = t * 0.07 * mws;
    var cxw = Math.cos(rxw), sxw = Math.sin(rxw);
    var cyw = Math.cos(ryw), syw = Math.sin(ryw);

    for (var i = 0; i < 16; i++) {
      var v = TESS_V[i];
      var x = v[0], y = v[1], z = v[2], w = v[3] * mws, ty, tz, tx, tw;
      tx = x * cxw - w * sxw; tw = x * sxw + w * cxw; x = tx; w = tw;   // rotXW
      ty = y * cyw - w * syw; tw = y * syw + w * cyw; y = ty; w = tw;   // rotYW
      var k4 = 2.2 / (2.8 - w);                                        // 4D → 3D
      x *= k4; y *= k4; z *= k4;
      ty = y * cx - z * sx; tz = y * sx + z * cx; y = ty; z = tz;      // rotX
      tx = x * cy + z * sy; tz = -x * sy + z * cy; x = tx; z = tz;     // rotY
      tx = x * cz - y * sz; ty = x * sz + y * cz; x = tx; y = ty;      // rotZ
      var k = 2 / (z - zOff);                                         // perspective
      proj[i][0] = x * k; proj[i][1] = y * k;
    }

    /* At full collapse the two cubes sit exactly on top of each other, so 12 of
       the edges are drawn twice and 8 have zero length. Keep only the w=-L cube
       there; otherwise cull whatever has collapsed. */
    var flat = mws < 0.002;
    liveN = 0;
    for (var e = 0; e < TESS_E.length; e++) {
      var ea = TESS_E[e][0], eb = TESS_E[e][1];
      if (flat && ((ea & 8) || (eb & 8))) continue;
      var a = proj[ea], b = proj[eb];
      var ex = b[0] - a[0], ey = b[1] - a[1];
      if (ex * ex + ey * ey < 1e-7) continue;
      liveE[liveN][0] = a; liveE[liveN][1] = b; liveN++;
    }
  }

  /* Squared distance — the per-cell loop takes the min over up to 32 edges
     and only needs ONE sqrt at the end (min of squares = square of the min),
     instead of one per edge. Identical numbers, ~30 fewer sqrt per cell. */
  function sdSegmentSq(px, py, a, b) {
    var pax = px - a[0], pay = py - a[1];
    var bax = b[0] - a[0], bay = b[1] - a[1];
    var len = bax * bax + bay * bay;
    var h = len > 0 ? (pax * bax + pay * bay) / len : 0;
    h = h < 0 ? 0 : (h > 1 ? 1 : h);
    var dx = pax - bax * h, dy = pay - bay * h;
    return dx * dx + dy * dy;
  }

  function drawCube(now, amount, bw, introT, introing) {
    projectCube(now);
    // Pointer drives line weight and ramp falloff — the two knobs the original
    // exposes. Mapped across the WHOLE viewport, not the canvas, so the cube
    // still responds while the cursor is confined to the panel; centred until
    // the pointer has moved (otherwise both clamp to their thinnest setting
    // and nothing crosses the density threshold).
    var px = hasPointer ? Math.min(1, Math.max(0, mouseX / window.innerWidth)) : 0.5;
    var py = hasPointer ? Math.min(1, Math.max(0, mouseY / window.innerHeight)) : 0.5;
    // Narrower ranges than the original: at this grid pitch its thinnest
    // settings fall below the density threshold entirely and nothing resolves.
    var thickness = 0.022 + px * 0.070;
    var expMul = -46 + py * 34;
    // Cells are no longer square (≈10×19), so normalising both axes by the same
    // cell COUNT stretched the cube vertically. Normalise in pixels instead.
    var mPx = Math.min(cols * CELL_W, rows * CELL_H);
    /* The morph is covered by the same warp the word field uses, peaking
       halfway and zero at both ends — the shape smears through the change and
       settles crisp as either solid. WARP_FREQ keeps it under one cycle across
       the shape, so it shears rather than melts. */
    var mwarp = cubeMorph * (1 - cubeMorph) * 4;
    var cwAmp = 0.26 * mwarp;
    var warping = cwAmp > 0.001;
    var ns = now * 0.0004;

    // Same wave/burst clocks the main field runs on, recomputed here so this
    // function stays self-contained (it can't see draw()'s locals).
    var restT = now * 0.0026, hoverT = now * 0.018, colorT = now * 0.0012;
    var pf = cyclePhase - Math.floor(cyclePhase);
    var bd = (pf - 0.5) / 0.08;
    var blockBump = (bd > -1 && bd < 1) ? (1 - bd * bd) * amount : 0;

    for (var c = 0; c < cols; c++) {
      for (var r = 0; r < rows; r++) {
        var gIdx = c + r * cols;
        var hsh = hashBuf[gIdx];
        if (introing) {
          var revAt = hsh * 0.5 + (c / cols) * 0.28 + (r / rows) * 0.22;
          if (introT < revAt) continue;
          if (introT < revAt + 0.16) {
            ctx.fillStyle = rgbCss(BASE_STROKE[0] * 0.6, BASE_STROKE[1] * 0.6, BASE_STROKE[2] * 0.6);
            ctx.fillText(SHUFFLE_SET[(Math.random() * SHUFFLE_SET.length) | 0],
              c * CELL_W, r * CELL_H);
            continue;
          }
        }
        var sx2 = 2 * ((c - cols / 2 + 0.5) * CELL_W) / mPx;
        var sy2 = 2 * ((r - rows / 2 + 0.5) * CELL_H) / mPx;
        if (warping) {
          var wx = sx2 + cwAmp * (pnoise(sx2 * WARP_FREQ + ns, sy2 * WARP_FREQ) - 0.5);
          sy2 = sy2 + cwAmp * (pnoise(sx2 * WARP_FREQ, sy2 * WARP_FREQ + ns) - 0.5);
          sx2 = wx;
        }
        var dsq = 1e10;
        for (var e = 0; e < liveN; e++) {
          var dd = sdSegmentSq(sx2, sy2, liveE[e][0], liveE[e][1]);
          if (dd < dsq) dsq = dd;
        }
        var d = Math.sqrt(dsq) - thickness;
        var idx = Math.floor(Math.exp(expMul * Math.abs(d)) * DENSITY.length);
        if (idx <= 0) continue;                      // nothing behind the cube
        if (idx > DENSITY.length - 1) idx = DENSITY.length - 1;

        // ── Glyph: the density ramp is the base, but the same sequencing the
        // field uses rides on top — a calm wave at rest, glitch bursts, and the
        // block-cipher moment as the colour cycle crosses over.
        var curve = Math.sin(colorT + c * 0.5 + r * 0.3) * 0.5 + 0.5;
        var wave = Math.sin(restT + c * 0.5 + r * 0.32) * 0.5 + 0.5;
        var inGlitch = glitchT > 0 && Math.abs(hsh - (1 - glitchT)) < 0.12;
        var inBlock = blockBump > 0 && hsh < blockBump;
        var ch;
        if (inBlock) {
          ch = BLOCK_SET[Math.min(BLOCK_SET.length - 1, (curve * BLOCK_SET.length) | 0)];
        } else if (inGlitch) {
          var gf = Math.sin(hoverT + c + r) * 0.5 + 0.5;
          ch = GLITCH_SET[Math.min(GLITCH_SET.length - 1, (gf * GLITCH_SET.length) | 0)];
        } else if (idx >= DENSITY.length - 3 && wave > 0.62) {
          // The brightest band shimmers through the dense end of the ramp
          // instead of sitting on one character, so the edges stay alive.
          ch = INK_RAMP[Math.min(3, (wave * 4) | 0)];
        } else {
          ch = DENSITY[idx];
        }
        if (ch === ' ') continue;

        // ── Duotone, per cell: the hash fans cells across the pair ring while
        // `spread` is up (mixed mode), exactly like the field.
        var cellPh = hsh * 0.30 * spread + (curve - 0.5) * 0.05;
        // At rest the pair colour is multiplied by amount ≈ 0, so its ring
        // interpolation is pure waste — skip it (sub-quantisation error only).
        if (amount > 0.002) pairLoop(cyclePhase + cellPh);
        var lit = 0.4 + 0.6 * (idx / (DENSITY.length - 1));
        var rr = (BASE_STROKE[0] + (_stroke[0] - BASE_STROKE[0]) * amount) * lit;
        var gg = (BASE_STROKE[1] + (_stroke[1] - BASE_STROKE[1]) * amount) * lit;
        var bb = (BASE_STROKE[2] + (_stroke[2] - BASE_STROKE[2]) * amount) * lit;
        ctx.fillStyle = rgbCss(rr * bw, gg * bw, bb * bw);
        ctx.fillText(ch, c * CELL_W, r * CELL_H);
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

  /* Word list + deterministic odometer scramble (sequencer-like, not random).
     The list is deliberately long so the field rarely repeats itself, and the
     page opens on a RANDOM word — every visit starts somewhere different. */
  var WORDS = [
    'art', 'sun', 'sky', 'box', 'fox', 'run', 'fly', 'raw', 'mix', 'web',
    'dev', 'new', 'pix', 'bit', 'lab', 'map', 'ray', 'hue', 'dot', 'sys',
    'gen', 'ink', 'arc', 'ash', 'bay', 'bug', 'cut', 'cue', 'dye', 'ear',
    'ebb', 'eye', 'fog', 'gap', 'gum', 'hex', 'hum', 'ice', 'jam', 'key',
    'kin', 'log', 'low', 'lux', 'net', 'nod', 'oak', 'orb', 'owl', 'pin',
    'ply', 'pop', 'qua', 'rig', 'rim', 'rot', 'sap', 'saw', 'sea', 'set',
    'six', 'ski', 'sub', 'tab', 'tan', 'ten', 'tin', 'top', 'two', 'urn',
    'vex', 'vow', 'wax', 'wig', 'won', 'yes', 'zap', 'zen', 'zip', 'air',
    'bud', 'cog', 'din', 'elm', 'fin', 'gel', 'hip', 'inn', 'jet', 'kit'
  ];
  var ALPHA = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var wordPtr = Math.floor(Math.random() * WORDS.length);
  var START = WORDS[wordPtr].toUpperCase();
  function idxOf(ch) { return Math.max(0, ALPHA.indexOf(ch)); }
  var curIdx = [idxOf(START[0]), idxOf(START[1]), idxOf(START[2])];
  var tgtIdx = curIdx.slice(), stg = [0, 0, 0];
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
  if (!CUBE) {
    renderWord(START);
    wordPtr = (wordPtr + 1) % WORDS.length;   // next odometer target
  }
  resize();

  function clamp(x) { return Math.max(0, Math.min(255, Math.round(x))); }
  /* fillStyle strings, cached by packed 24-bit colour. The draw loops built
     thousands of throwaway 'rgb(…)' strings per frame — identical output,
     needless GC pressure. Cleared if it ever grows past a few thousand
     entries (a long colour cycle can touch a lot of the gamut). */
  var cssCache = Object.create(null), cssCount = 0;
  function rgbCss(r, g, b) {
    var key = (clamp(r) << 16) | (clamp(g) << 8) | clamp(b);
    var s = cssCache[key];
    if (!s) {
      if (++cssCount > 4096) { cssCache = Object.create(null); cssCount = 1; }
      s = cssCache[key] =
        'rgb(' + (key >> 16) + ',' + ((key >> 8) & 255) + ',' + (key & 255) + ')';
    }
    return s;
  }

  var frameN = 0, last = 0, startTime = 0;
  function draw(now) {
    requestAnimationFrame(draw);
    if (now - last < 15) return;             // ~60fps — smooth
    governDpr(now - last);
    last = now;
    // Intro: a staggered GRID SHUFFLE, not a fade. Each cell waits its turn
    // (per-cell hash + a diagonal sweep), churns through random glyphs for a
    // beat, then settles. Latest reveal is 1.0 + a 0.16 churn, so the whole
    // thing is done by 1.2 — after which the per-cell branch is skipped.
    var introT = (now - startTime) / 2600;
    var introing = introT < 1.2;

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
    // Colour cycle: a free-running phase that walks the PAIRS
    // ring and loops forever. It only advances while the cursor is engaged
    // (sustained hover = faster walk via heat); it resets when re-engaging from
    // idle so the journey restarts at green each time.
    var engaged = energy > 0.25;
    if (engaged && !wasEngaged) {
      cyclePhase = Math.random();                   // start on a random pair
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
    if (CUBE) {
      ctx.clearRect(0, 0, SW, SH);
      var ce = energy * energy * (3 - 2 * energy);   // smoothstep, as below
      drawCube(now, ce, 1 + 0.10 * Math.sin(now / 1000 * 1.8), introT, introing);
      return;
    }
    if (frameN % 360 === 0) { pickWord(WORDS[wordPtr]); wordPtr = (wordPtr + 1) % WORDS.length; }
    if (frameN % 8 === 0) stepWord();

    // Domain-warp amplitude breathes over ~16s between calm and distorted.
    var s = now * 0.0005;
    var pulse = Math.pow(Math.sin(now * 0.0004) * 0.5 + 0.5, 1.5);
    // Heavily biased toward y: pulling type vertically reads as a stretch,
    // pushing it equally on both axes reads as a swirl.
    var warpX = 0.02 + 0.16 * pulse, warpY = 0.08 + 0.92 * pulse;
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

    // Framing: ease toward the current behaviour's scale/anchor. maxW is the
    // widest the word can be and still fit BOTH axes, and the anchor spans only
    // the leftover space — together they guarantee it never bleeds out.
    if (now > nextBehaviour) pickBehaviour(now);
    frScale += (tgScale - frScale) * 0.010;
    frX += (tgX - frX) * 0.010;
    frY += (tgY - frY) * 0.010;
    var aspect = WB_W / WB_H;
    var maxW = Math.min(SW, SH * aspect);
    var wW = maxW * frScale, wH = wW / aspect;
    // Phone: the stacked word fills the screen on both axes — the letters
    // widen to the full width rather than standing as a thin column.
    if (TOUCH_FIELD && WB_H > WB_W) { wW = SW * frScale; wH = SH * frScale; }
    var ox = (SW - wW) * frX, oy = (SH - wH) * frY;
    // Reach bound for the cull below: pnoise ∈ [0,1), so the warp displaces a
    // cell by strictly less than ±warp/2 per axis.
    var hx = warpX * 0.5, hy = warpY * 0.5;
    ctx.clearRect(0, 0, SW, SH);
    for (var c = 0; c < cols; c++) {
      for (var r = 0; r < rows; r++) {
        var u = (c * CELL_W - ox) / wW;
        var v = (r * CELL_H - oy) / wH;
        var gIdx = c + r * cols;
        var vf;
        if (u < -hx || u >= 1 + hx || v < -hy || v >= 1 + hy) {
          /* Beyond the word's reach the sample is provably 0 (sampleArr is 0
             outside the bitmap), so both pnoise calls and the bilinear sample
             are skipped — typically a third or more of the grid. Only the
             trail decays here, which is exactly what the full path computes. */
          vf = fieldBuf[gIdx] * TRAIL_DECAY;
        } else {
          /* WARP_FREQ decides whether this reads as stretched type or as a
             lava lamp. At 2.5 the displacement field completed a couple of
             cycles ACROSS a single letter, so one stroke got pushed one way
             and the stroke beside it the other — straight edges bowed and the
             counters (the holes in o, e, a) pinched shut and went round.
             Below ~1 the field is near-linear over a letter, so the letter
             shears and stretches as a unit and keeps its typographic edges. */
          var dx = u + warpX * (pnoise(u * WARP_FREQ + s, v * WARP_FREQ) - 0.5);
          var dy = v + warpY * (pnoise(u * WARP_FREQ, v * WARP_FREQ + s) - 0.5);
          vf = sampleArr(wbFill, dx, dy);
          // Persistence trail: instant attack, slow decay — the sequencer
          // envelope the copy uses, applied per cell. At 0.92 the tail was
          // gone in ~0.3s, which is why the offset read as shallow.
          if (vf < fieldBuf[gIdx] * TRAIL_DECAY) vf = fieldBuf[gIdx] * TRAIL_DECAY;
        }
        fieldBuf[gIdx] = vf;
        if (vf < INK_T) continue;
        var isCore = vf > CORE_T;            // interior (dots) vs stroke band

        var lit = 0.32 + 0.68 * vf;
        var ch, rr, gg, bb;

        // Per-cell hash (precomputed, static) + flowing curve drive the
        // staggered cipher reveal and give every cell its own colour-stage
        // offset (organic, not uniform).
        var hsh = hashBuf[gIdx];

        // ── Grid shuffle-in ──────────────────────────────────────────
        // Each cell has its own reveal moment (hash + a diagonal sweep):
        // before it the cell is empty, for a beat after it churns random
        // glyphs, then it settles into the field. Skipped once the intro
        // is over so it costs nothing at steady state.
        if (introing) {
          var revAt = hsh * 0.5 + (c / cols) * 0.28 + (r / rows) * 0.22;
          if (introT < revAt) continue;
          if (introT < revAt + 0.16) {
            var sl = (0.30 + 0.70 * vf) * bw;
            ctx.fillStyle = rgbCss(BASE_STROKE[0] * sl, BASE_STROKE[1] * sl, BASE_STROKE[2] * sl);
            ctx.fillText(SHUFFLE_SET[(Math.random() * SHUFFLE_SET.length) | 0],
              c * CELL_W, r * CELL_H);
            continue;
          }
        }

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
            var dw = Math.sin(restT * 1.6 + c * 0.9 + r * 0.6) * 0.5 + 0.5;
            ch = REST_DOTS[Math.min(REST_DOTS.length - 1, (dw * REST_DOTS.length) | 0)];
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
            // FILL takes the pair's fill colour, lerped out of the base grey
            // by `amount` — so it's grey at rest and vivid under the cursor.
            // Skipped at rest: ×amount ≈ 0 makes it pure waste there.
            if (amount > 0.002) pairLoop(cyclePhase + cellPh);
            var fb2 = 0.45 + 0.55 * prog;           // ease brightness in by reveal
            rr = (BASE_FILL[0] + (_fill[0] - BASE_FILL[0]) * amount) * lit * fb2;
            gg = (BASE_FILL[1] + (_fill[1] - BASE_FILL[1]) * amount) * lit * fb2;
            bb = (BASE_FILL[2] + (_fill[2] - BASE_FILL[2]) * amount) * lit * fb2;
          }
        } else {
          // STROKE (band): box-drawing wave; colour rides the looping ring one
          // stage ahead of the fill. Block/glitch swap glyphs only.
          var gj = Math.sin(hoverT * 1.3 + c * 0.7 + r * 0.5) * 0.5 + 0.5;
          // Ink level drives the glyph; the old sine only shimmers it now, by
          // less than one ramp step, so the gradient survives the texture.
          var band = (vf - INK_T) / Math.max(0.001, 1 - INK_T);
          var wp = Math.sin(restT + c * 0.5 + r * 0.32) * 0.5 + 0.5;
          var lvl = band + (wp - 0.5) * RAMP_SHIMMER;
          lvl = lvl < 0 ? 0 : lvl > 1 ? 1 : lvl;
          ch = inBlock
            ? BLOCK_SET[Math.min(BLOCK_SET.length - 1, ((1 - curve) * BLOCK_SET.length) | 0)]
            : inGlitch
              ? GLITCH_SET[Math.min(GLITCH_SET.length - 1, (gj * GLITCH_SET.length) | 0)]
              : INK_RAMP[Math.min(INK_RAMP.length - 1, ((1 - lvl) * INK_RAMP.length) | 0)];
          // STROKE takes the SAME pair's stroke colour — a designed contrast
          // against the fill, never the same hue. Grey at rest (and the ring
          // interpolation is skipped there — ×amount ≈ 0).
          if (amount > 0.002) pairLoop(cyclePhase + cellPh);
          rr = (BASE_STROKE[0] + (_stroke[0] - BASE_STROKE[0]) * amount) * lit;
          gg = (BASE_STROKE[1] + (_stroke[1] - BASE_STROKE[1]) * amount) * lit;
          bb = (BASE_STROKE[2] + (_stroke[2] - BASE_STROKE[2]) * amount) * lit;
        }
        var f = bw;
        ctx.fillStyle = rgbCss(rr * f, gg * f, bb * f);
        ctx.fillText(ch, c * CELL_W, r * CELL_H);
      }
    }
  }

  function start() { resize(); startTime = performance.now(); requestAnimationFrame(draw); }
  if (window.SiteFX && window.SiteFX.revealPending) {
    // Second beat of the load-in: rules first, then the field + copy together.
    document.addEventListener('site:reveal', start, {once: true});
  } else if (window.SiteFX && !window.SiteFX.ready) {
    document.addEventListener('site:ready', start, {once: true});
  } else {
    start();
  }
})();

/* ── 5. Crosshair cursor + click menu (Figma 711:76 / :79 / :82) ─
   Two hairlines track the pointer on ONE axis each — the vertical rule only
   moves on X, the horizontal only on Y — meeting at a 16px square mark.
     • on load   → both rules trim in from the mark (CSS transition off
                   .preload, so it plays with the column rules)
     • over text → the rules trim back out, leaving just the square, so they
                   never cut through the copy
     • on click  → the square rotates to a 45° diamond and the menu opens at
                   the pointer (flipping to stay on-screen near the edges)
   Position eases toward the pointer via GSAP quickTo (see Follow below);
   the trim scale and the click rotation are CSS transitions.
──────────────────────────────────────────────────────────────── */
(function () {
  var root = document.getElementById('crosshair');
  var menu = document.getElementById('cursor-menu');
  if (!root) return;

  var vLine = root.querySelector('.ch-v');
  var hLine = root.querySelector('.ch-h');
  var mark = root.querySelector('.ch-mark');
  var cta = root.querySelector('.ch-cta');
  if (!vLine || !hLine || !mark) return;

  // Carry the pointer across navigations; only fall back to centre on a genuine
  // first visit, so moving between pages doesn't snap the cursor to the middle.
  var x = window.innerWidth / 2, y = window.innerHeight / 2;
  try {
    var saved = sessionStorage.getItem('fx:pointer');
    if (saved) {
      var pt = JSON.parse(saved);
      if (pt && isFinite(pt.x) && isFinite(pt.y)) { x = pt.x; y = pt.y; }
    }
  } catch (err) { /* private mode — centre is fine */ }
  var open = false;
  window.addEventListener('pagehide', function () {
    try { sessionStorage.setItem('fx:pointer', JSON.stringify({x: x, y: y})); } catch (e) {}
  });

  /* On the project page the pointer only exists inside the panel (Figma
     774:304 clips the horizontal rule at the panel's right edge). */
  var frame = document.querySelector('.proj-panel');
  var frameRect = null;
  function inFrame(px, py) {
    if (!frameRect) return true;
    return px >= frameRect.left && px <= frameRect.right &&
           py >= frameRect.top && py <= frameRect.bottom;
  }

  /* Columns whose copy the rules must not cross. Rects are cached and
     refreshed on resize — cheap, and mousemove stays allocation-free. */
  var textCols = [], rects = [];
  function cacheRects() {
    // .proj-role is the projects page's copy block. Without it `rects` was
    // empty on that page, so the rules never trimmed and drew straight through
    // the write-up.
    textCols = Array.prototype.slice.call(
      document.querySelectorAll('.col-intro, .col-rail, .proj-role'));
    rects = textCols.map(function (el) { return el.getBoundingClientRect(); });
    if (frame) {
      frameRect = frame.getBoundingClientRect();
      // Clip the horizontal rule so it can never cross into the open space.
      hLine.style.width = Math.round(frameRect.right) + 'px';
    }
  }
  function overText(px, py) {
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (px >= r.left && px <= r.right && py >= r.top && py <= r.bottom) return true;
    }
    return false;
  }

  /* ── Follow ──────────────────────────────────────────────────────
     x/y is the TRUE pointer — hit-testing, the text trim and the menu all
     use it, so precision never lags. pos is where the crosshair is DRAWN:
     GSAP's quickTo eases it toward the pointer (FOLLOW seconds, power3.out),
     which is what gives the cursor weight instead of a rigid 1:1 snap. It
     is kept short on purpose — the system cursor is hidden, so this IS the
     cursor, and a long lag would make pointing feel loose.
     No GSAP (CDN blocked) → pos just mirrors the pointer, as before. */
  var FOLLOW = 0.16;
  var pos = {x: x, y: y};
  var drawnX = NaN, drawnY = NaN;
  var qx = null, qy = null;
  if (window.gsap && gsap.quickTo) {
    qx = gsap.quickTo(pos, 'x', {duration: FOLLOW, ease: 'power3.out'});
    qy = gsap.quickTo(pos, 'y', {duration: FOLLOW, ease: 'power3.out'});
    gsap.ticker.add(place);                 // one write per frame, max
  }

  function place() {
    // Sub-pixel is fine for the hairlines' position; skip the write entirely
    // when nothing moved, so an idle cursor costs no style work.
    var px = Math.round(pos.x * 10) / 10, py = Math.round(pos.y * 10) / 10;
    if (px === drawnX && py === drawnY) return;
    drawnX = px; drawnY = py;
    vLine.style.left = px + 'px';
    hLine.style.top = py + 'px';
    mark.style.left = px + 'px';
    mark.style.top = py + 'px';
    if (cta) { cta.style.left = px + 'px'; cta.style.top = py + 'px'; }
    // Retract toward the mark: the scale origin is the drawn point itself.
    vLine.style.transformOrigin = '0px ' + py + 'px';
    hLine.style.transformOrigin = px + 'px 0px';
  }

  document.addEventListener('mousemove', function (e) {
    x = e.clientX; y = e.clientY;
    if (qx) { qx(x); qy(y); }
    else { pos.x = x; pos.y = y; place(); }
    // Off-frame → the whole cursor disappears; inside → trim only over copy.
    var here = inFrame(x, y);
    root.classList.toggle('is-off', !here);      // lines only — the mark stays
    root.classList.toggle('is-trimmed', here && overText(x, y));
  });

  /* Press squash — the mark sinks in while the button is held and springs
     back past full size on release (CSS: .is-pressed + the scale ease). The
     release also fires on blur / leaving the window, so a press that ends
     outside the page can never leave the mark stuck small. */
  function release() { root.classList.remove('is-pressed'); }
  document.addEventListener('mousedown', function (e) {
    if (e.button === 0) root.classList.add('is-pressed');
  });
  document.addEventListener('mouseup', release);
  window.addEventListener('blur', release);
  document.documentElement.addEventListener('mouseleave', release);

  /* ── Touch ──────────────────────────────────────────────────────
     On a phone the finger IS the pointer: touching places the crosshair,
     dragging moves it, and the press squash follows the finger down and up.
     Every hover state on the site (noise field, copy decode, the projects
     preview, test.fun's groups) listens for mouse events, which a drag never
     fires — so each touch move is re-dispatched as a mousemove at the touch
     point (plus a mouseover when the element under the finger changes).
     The events carry `fromTouch` so a page can tell a finger from a mouse.
     Mouse input never reaches this path. */
  var TOUCH = !!(window.matchMedia &&
    matchMedia('(hover: none) and (pointer: coarse)').matches);
  var under = null;
  function touchAt(e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;
    var init = {bubbles: true, cancelable: true, view: window,
      clientX: e.clientX, clientY: e.clientY};
    if (el !== under) {
      under = el;
      var ov = new MouseEvent('mouseover', init); ov.fromTouch = true;
      el.dispatchEvent(ov);
    }
    var mv = new MouseEvent('mousemove', init); mv.fromTouch = true;
    el.dispatchEvent(mv);
  }
  if (TOUCH) {
    document.documentElement.classList.add('is-touch');
    document.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch' || !e.isPrimary) return;
      root.classList.add('is-pressed');
      touchAt(e);
    });
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch' && e.isPrimary) touchAt(e);
    });
    document.addEventListener('pointerup', function (e) {
      if (e.pointerType === 'touch') release();
    });
    document.addEventListener('pointercancel', release);
    // Nothing on the site scrolls on a phone — a drag only moves the
    // crosshair, so the page must never rubber-band or pan under it.
    document.addEventListener('touchmove', function (e) {
      if (e.cancelable) e.preventDefault();
    }, {passive: false});
    // The phone gets the v2 project list (the stage preview below the list).
    if (menu) {
      [].forEach.call(menu.querySelectorAll('a[href="projects.html"]'),
        function (a) { a.setAttribute('href', 'projects-v2.html'); });
    }
  }

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(cacheRects, 150);
  });

  /* Where the menu sits — Figma 774:276 offsets it +11 / −20 from the mark,
     flipping near the edges. Must be called with the menu displayed (it
     measures itself), which openMenu guarantees. */
  function positionMenu() {
    if (!menu) return;
    menu.style.left = '0px'; menu.style.top = '0px';   // measure unclamped
    var mw = menu.offsetWidth, mh = menu.offsetHeight;
    var pad = 8;
    var mx = x + 11, my = y - 20;
    if (mx + mw > window.innerWidth - pad) mx = x - 16 - mw;
    if (my + mh > window.innerHeight - pad) my = window.innerHeight - pad - mh;
    if (my < pad) my = pad;
    if (mx < pad) mx = pad;
    menu.style.left = mx + 'px';
    menu.style.top = my + 'px';
  }

  /* ── Diamond ⇄ menu morph ──────────────────────────────────────
     Click: a stand-in box takes the diamond's exact place (size includes a
     mid-press squash), turns to 0°, stretches into the menu's rectangle and
     drops its outline; the links fade in inside it, then the real mark
     re-springs at the pointer so there's a cursor to pick a page with.
     Close: the reverse — the menu folds back down into the diamond at the
     pointer. No GSAP → the menu simply appears/disappears, as before. */
  var morph = document.createElement('div');
  morph.className = 'ch-morph';
  morph.setAttribute('aria-hidden', 'true');
  document.body.appendChild(morph);
  var OUTLINE = getComputedStyle(mark).borderTopColor || 'rgb(185, 185, 185)';
  var CLEAR = OUTLINE.replace(/^rgba?\(([^)]+)\).*$/, function (_, c) {
    return 'rgba(' + c.split(',').slice(0, 3).join(',') + ', 0)';
  });
  var MARK = 16;
  var morphTl = null;
  // The menu's face is only requested the first time the menu is shown, so a
  // first open measured the wider fallback and the box overshot the real menu
  // (85px vs 79px). Load it up front so openMenu measures the final shape.
  var firstLink = menu && menu.querySelector('a');
  if (firstLink && document.fonts && document.fonts.load) {
    var fcs = getComputedStyle(firstLink);
    document.fonts.load(fcs.fontWeight + ' ' + fcs.fontSize + ' ' + fcs.fontFamily)
      .catch(function () {});
  }

  function finishMorph(spawn) {
    gsap.set(morph, {display: 'none'});
    if (spawn) {
      // Mark back from zero with the release spring (CSS scale transition).
      root.classList.add('is-spawn');
      root.classList.remove('is-morphing');
      void mark.offsetWidth;
      root.classList.remove('is-spawn');
    } else {
      root.classList.remove('is-morphing');
    }
    morphTl = null;
  }

  function openMenu() {
    open = true;
    root.classList.add('is-open');
    if (!menu) return;
    menu.setAttribute('aria-hidden', 'false');
    menu.classList.add('is-open');               // displayed, still transparent
    positionMenu();
    if (!window.gsap) { menu.classList.add('is-shown'); return; }

    var r = menu.getBoundingClientRect();
    var s = MARK * (parseFloat(getComputedStyle(mark).scale) || 1);
    if (morphTl) morphTl.kill();
    root.classList.add('is-morphing');
    gsap.set(morph, {display: 'block', left: pos.x - s / 2, top: pos.y - s / 2,
      width: s, height: s, rotation: 45, borderColor: OUTLINE});
    morphTl = gsap.timeline({onComplete: function () { finishMorph(true); }})
      .to(morph, {rotation: 0, duration: 0.2, ease: 'power2.out'}, 0)
      .to(morph, {left: r.left, top: r.top, width: r.width, height: r.height,
        duration: 0.34, ease: 'power3.inOut'}, 0.06)
      .to(morph, {borderColor: CLEAR, duration: 0.12, ease: 'none'}, 0.3)
      .add(function () { menu.classList.add('is-shown'); }, 0.3)
      .to({}, {duration: 0.14});                  // hold until the links are in
  }

  function closeMenu(done) {
    if (!open) { if (done) done(); return; }
    open = false;
    root.classList.remove('is-open');
    if (!menu) { if (done) done(); return; }
    menu.setAttribute('aria-hidden', 'true');
    if (!window.gsap) {
      menu.classList.remove('is-open', 'is-shown');
      if (done) done();
      return;
    }
    var r = menu.getBoundingClientRect();
    if (morphTl) morphTl.kill();
    root.classList.add('is-morphing');
    gsap.set(morph, {display: 'block', left: r.left, top: r.top,
      width: r.width, height: r.height, rotation: 0, borderColor: CLEAR});
    menu.classList.remove('is-open', 'is-shown');
    morphTl = gsap.timeline({onComplete: function () {
      finishMorph(false);
      if (done) done();
    }})
      .to(morph, {borderColor: OUTLINE, duration: 0.1, ease: 'none'}, 0)
      // Function values: land wherever the drawn cursor is NOW, not where the
      // click happened — the pointer may have moved while the menu was open.
      .to(morph, {left: function () { return pos.x - MARK / 2; },
        top: function () { return pos.y - MARK / 2; },
        width: MARK, height: MARK, duration: 0.3, ease: 'power3.inOut'}, 0)
      .to(morph, {rotation: 45, duration: 0.22, ease: 'power2.inOut'}, 0.1);
  }

  document.addEventListener('click', function (e) {
    // Menu links play the exit transition (copy deletes bottom-up, rules
    // retract) before the next page loads — closeMenu is its first beat.
    if (menu && menu.contains(e.target)) {
      var a = e.target.closest ? e.target.closest('a') : null;
      var href = a && a.getAttribute('href');
      if (a && href && !a.target && /\.html($|[?#])/.test(href) && window.SiteExit) {
        e.preventDefault();
        window.SiteExit(href);
      }
      return;
    }
    if (open) closeMenu(); else openMenu();
    root.classList.toggle('is-trimmed', overText(x, y));
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !open) return;
    closeMenu();
    root.classList.remove('is-trimmed');
  });

  /* Pages can morph the mark into a labelled button (e.g. over a thumbnail). */
  window.SiteCursor = {
    cta: function (on) { root.classList.toggle('is-cta', !!on); },
    // The projects page's copy block changes height as the write-up writes in
    // and out, so its cached rect has to be refreshed when that happens.
    remeasure: cacheRects,
    // The page exit folds the menu back into the diamond first.
    close: closeMenu
  };

  cacheRects();
  place();
  if (frame && !inFrame(x, y)) root.classList.add('is-off');
  // Re-measure once webfonts land (they change the column text metrics).
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(cacheRects);
})();

/* ── 6. Rail polish ─────────────────────────────────────────────
   • the trailing "..." on each social splices like a terminal prompt
   • the date/time block aligns to the top of the intro's second
     paragraph, measured at runtime so it survives copy edits
────────────────────────────────────────────────────────────────── */
(function () {
  var rail = document.querySelector('.col-rail');
  var intro = document.querySelector('.intro');
  if (!rail) return;

  /* Splice the trailing dots. Visibility (not display) so the cell keeps its
     width — the rail is width-pinned and must not reflow. */
  function startDots() {
    var groups = [];
    rail.querySelectorAll('.rail-socials a').forEach(function (a) {
      var chars = Array.prototype.slice.call(a.querySelectorAll('.char'));
      var tail = [];
      for (var i = chars.length - 1; i >= 0 && chars[i].textContent === '.'; i--) tail.unshift(chars[i]);
      if (tail.length) groups.push(tail);
    });
    if (!groups.length) return;
    var step = 0;
    setInterval(function () {
      step = (step + 1) % (groups[0].length + 1);
      groups.forEach(function (tail) {
        tail.forEach(function (d, i) { d.style.visibility = i < step ? '' : 'hidden'; });
      });
    }, 380);
  }

  /* Drop the clock so its top sits on the intro's second paragraph. The blank
     line between paragraphs shows up as a larger-than-normal gap between
     consecutive line tops, which is what we look for. */
  function alignClock() {
    var clock = rail.querySelector('.rail-clock');
    if (!clock || !intro) return;
    // Stacked (phone / narrow window): the rail sits under the field, so
    // there is no paragraph beside it to line up with.
    if (window.matchMedia && matchMedia('(max-width: 860px)').matches) {
      clock.style.marginTop = '';
      return;
    }
    var chars = Array.prototype.slice.call(intro.querySelectorAll('.char'));
    if (!chars.length) return;
    var tops = [];
    chars.forEach(function (c) {
      var t = Math.round(c.getBoundingClientRect().top);
      if (tops.indexOf(t) === -1) tops.push(t);
    });
    tops.sort(function (a, b) { return a - b; });
    var lh = parseFloat(getComputedStyle(intro).lineHeight) || 20;
    var target = null;
    for (var i = 1; i < tops.length; i++) {
      if (tops[i] - tops[i - 1] > lh * 1.5) { target = tops[i]; break; }
    }
    if (target == null) return;
    clock.style.marginTop = '0px';
    var delta = target - clock.getBoundingClientRect().top;
    clock.style.marginTop = Math.round(delta) + 'px';
  }

  function run() { startDots(); alignClock(); }
  if (window.SiteFX && !window.SiteFX.ready) {
    document.addEventListener('site:ready', run, {once: true});
  } else {
    run();
  }
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt); rt = setTimeout(alignClock, 150);
  });
})();
