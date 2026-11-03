/* ============================================================
 *  test-page.js — test.fun experiment grid (Figma 1010:696)
 *    • every media item of every experiment is its own tile,
 *      shuffled on each load
 *    • justified rows at a FIXED height: a tile's width follows its
 *      aspect, and each full row is flexed to span exactly
 *      margin-to-margin (the last row sits left, at natural width)
 *    • greyscale at rest; hovering a tile lights every tile of its
 *      group — the experiment, or its whole series once it has one
 *    • clicking does nothing yet — reserved for the interaction pass
 * ============================================================ */
(function () {
  var gridEl = document.getElementById('tf-grid');
  if (!gridEl) return;

  var ROW_H = 66;                 // Figma's 55px rows, scaled 1.2×
  var GAP = 1;                    // dia.studio: 1px between tiles
  // Aspect clamps: a 9:16 portrait at 66px is ~37px wide and a panorama
  // would run a whole row — both read as noise in a wall of thumbnails.
  var MIN_AR = 0.45, MAX_AR = 3.2;

  var tiles = [];                 // {el, media, group, aspect}
  var groups = {};                // group key → [tile]

  /* ── Data ──────────────────────────────────────────────────── */
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // The grouping key: the series when there is one, else the experiment.
  function groupOf(exp) {
    return exp.series && exp.series._id ? 's:' + exp.series._id : 'e:' + exp._id;
  }

  function build(experiments) {
    var list = [];
    (experiments || []).forEach(function (exp) {
      var g = groupOf(exp);
      (exp.media || []).forEach(function (m) {
        if (!m || m._type !== 'mediaItem') return;
        list.push({exp: exp, m: m, group: g});
      });
    });
    shuffle(list);

    list.forEach(function (item) {
      var m = item.m;
      var el = document.createElement('div');
      el.className = 'tf-tile';
      el.dataset.group = item.group;
      if (item.exp.title) el.setAttribute('aria-label', item.exp.title);

      var t = {el: el, group: item.group, aspect: 16 / 9, media: null,
        video: null, videoSrc: null};
      var dims = m.imageDims;
      if (dims && dims.aspectRatio) t.aspect = dims.aspectRatio;

      if (m.mediaType === 'video' && m.videoUrl) {
        var v = document.createElement('video');
        v.muted = true; v.loop = true; v.playsInline = true;
        t.video = v;
        if (m.posterUrl) {
          /* Poster-first. At rest a video tile is a paused greyscale frame,
             so its poster still (the frame at 0.1s of this same WebM) looks
             identical — and it's all the preloader waits for. The video
             itself is layered on top, invisible until it's actually playing,
             and only fetched once the grid is up (loadVideos). */
          var pd = m.posterDims;
          if (pd && pd.aspectRatio) t.aspect = pd.aspectRatio;
          var ps = document.createElement('img');
          ps.alt = m.alt || '';
          ps.decoding = 'async';
          track(ps, 'load');
          ps.src = window.SS ? SS.imageUrl(m.posterUrl, {width: 420}) : m.posterUrl;
          t.media = ps;
          v.preload = 'none';
          v.classList.add('tf-video');
          t.videoSrc = m.videoUrl;
          v.addEventListener('playing', function () {
            if (el.classList.contains('is-lit')) el.classList.add('is-playing');
          });
        } else {
          // No poster yet (a new upload in Studio before add-posters.mjs has
          // run): fall back to the video itself as the still.
          v.preload = 'auto';
          v.addEventListener('loadedmetadata', function () {
            if (v.videoWidth && v.videoHeight) t.aspect = v.videoWidth / v.videoHeight;
          });
          track(v, 'loadeddata');
          // #t= makes the browser paint a first frame instead of black.
          v.src = m.videoUrl + '#t=0.1';
          t.media = v;
        }
      } else if (m.imageUrl) {
        var img = document.createElement('img');
        img.alt = m.alt || '';
        // Eager, not lazy — a lazy image below the fold never loads, and the
        // preloader would wait on it forever.
        img.decoding = 'async';
        track(img, 'load');
        // Tiles are ~66–210px wide; 420 covers them at 2× density.
        img.src = window.SS ? SS.imageUrl(m.imageUrl, {width: 420}) : m.imageUrl;
        t.media = img;
      } else if (m.placeholder) {
        // Local-dev stand-in (see placeholders() below) — a flat swatch.
        var sw = document.createElement('span');
        sw.className = 'tf-swatch';
        sw.style.background = m.placeholder;
        t.media = sw;
      }
      if (!t.media) return;
      t.media.classList.add('tf-media');
      el.appendChild(t.media);
      if (t.video && t.video !== t.media) {
        t.video.classList.add('tf-media');
        el.appendChild(t.video);            // layered over the poster
      }

      tiles.push(t);
      (groups[t.group] = groups[t.group] || []).push(t);
    });
    // Tiles are in the DOM (so their media loads) but the grid stays hidden
    // behind the loader until every asset has settled.
    layout();
    whenLoaded(function () {
      layout();                     // video aspects have landed by now
      hideLoader();
      reveal();
      setTimeout(loadVideos, 400);  // once the grid is up, not before
    });
  }

  /* Background-load the poster-backed videos after reveal, so a hover
     plays straight away. A hover that lands first fetches its own. */
  function ensureSrc(t) {
    if (!t.videoSrc) return;
    t.video.preload = 'auto';
    t.video.src = t.videoSrc;
    t.videoSrc = null;
  }
  function loadVideos() {
    tiles.forEach(function (t) { if (t.videoSrc) ensureSrc(t); });
  }

  /* ── Preloader: nothing shows until every asset has loaded ─────
     Each image counts on `load`, each video on `loadeddata` (first frame
     painted). A file that fails counts as settled too — a broken asset
     must not hold the whole page hostage — and a 25s ceiling guards
     against a request that simply never answers. */
  var pending = 0, settled = 0, total = 0, allDone = null, finished = false;
  var loaderEl = document.getElementById('tf-loader');
  var countEl = loaderEl && loaderEl.querySelector('.tf-loader-count');

  function track(el, evt) {
    pending++; total++;
    var done = false;
    function settle() {
      if (done) return;
      done = true;
      settled++;
      paintProgress();
      if (--pending === 0 && allDone) finish();
    }
    el.addEventListener(evt, settle, {once: true});
    el.addEventListener('error', settle, {once: true});
  }
  function paintProgress() {
    if (!countEl) return;
    var pct = total ? Math.round((settled / total) * 100) : 100;
    countEl.textContent = (pct < 10 ? '0' : '') + pct + '%';
  }
  function finish() {
    if (finished) return;
    finished = true;
    var cb = allDone; allDone = null;
    if (cb) cb();
  }
  function whenLoaded(cb) {
    allDone = cb;
    paintProgress();
    if (pending === 0) { finish(); return; }
    setTimeout(finish, 25000);
  }
  function hideLoader() {
    if (!loaderEl) return;
    loaderEl.classList.add('is-done');
    setTimeout(function () { loaderEl.remove(); }, 700);
  }

  /* ── Layout: justified rows, fixed height ───────────────────────
     Walk the tiles, filling a row at natural width (ROW_H × aspect). When
     the next tile would overflow, finish the row either without it
     (stretch) or with it (squeeze) — whichever needs the smaller change.
     Height never moves; only widths flex, and media is object-fit: cover,
     so a flexed tile crops slightly rather than distorting. */
  function natural(t) {
    var ar = t.aspect < MIN_AR ? MIN_AR : t.aspect > MAX_AR ? MAX_AR : t.aspect;
    return ROW_H * ar;
  }

  // Walk the tiles into rows at the current ROW_H.
  function pack(W) {
    var rows = [], row = [], sum = 0;

    for (var i = 0; i < tiles.length; i++) {
      var t = tiles[i], w = natural(t);
      if (row.length && sum + w + GAP * row.length > W) {
        var sWithout = (W - GAP * (row.length - 1)) / sum;
        var sWith = (W - GAP * row.length) / (sum + w);
        if (Math.abs(Math.log(sWith)) < Math.abs(Math.log(sWithout))) {
          row.push(t); rows.push({tiles: row, full: true});
          row = []; sum = 0;
          continue;
        }
        rows.push({tiles: row, full: true});
        row = []; sum = 0;
      }
      row.push(t); sum += w;
    }
    if (row.length) rows.push({tiles: row, full: false});
    return rows;
  }

  /* Phone: nothing scrolls, so the row height is solved for the screen —
     the tallest rows whose packed wall still fits the stage. Taller rows
     mean fewer tiles per row, so the wall's height rises with ROW_H and a
     bisection finds the edge. */
  var TOUCH = document.documentElement.classList.contains('is-touch');
  function fitRowHeight(W) {
    var cs = getComputedStyle(gridEl.parentNode);
    var H = gridEl.parentNode.clientHeight -
      parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    var lo = 24, hi = 240;
    for (var k = 0; k < 18; k++) {
      ROW_H = (lo + hi) / 2;
      var n = pack(W).length;
      if (n * ROW_H + (n - 1) * GAP <= H) lo = ROW_H; else hi = ROW_H;
    }
    ROW_H = Math.floor(lo);
    // Rounding down can tip a row over; step back until the wall fits.
    for (var n2 = pack(W).length; ROW_H > 24 && n2 * ROW_H + (n2 - 1) * GAP > H;
      n2 = pack(W).length) ROW_H--;
    gridEl.style.setProperty('--tf-row', ROW_H + 'px');
  }

  function layout() {
    var W = gridEl.clientWidth;
    if (!W || !tiles.length) return;
    if (TOUCH) fitRowHeight(W);
    var rows = pack(W);

    // Rebuild the row containers; tiles (and their media) are moved, never
    // recreated, so nothing reloads on resize.
    var frag = document.createDocumentFragment();
    rows.forEach(function (r) {
      var rowEl = document.createElement('div');
      rowEl.className = 'tf-row';
      var nat = r.tiles.map(natural);
      var total = nat.reduce(function (a, b) { return a + b; }, 0);
      var space = W - GAP * (r.tiles.length - 1);
      var scale = r.full ? space / total : 1;
      // Whole pixels, with the rounding remainder handed to the last tile, so
      // a full row lands on the right margin exactly.
      var used = 0;
      r.tiles.forEach(function (t, k) {
        var w = k === r.tiles.length - 1 && r.full
          ? space - used
          : Math.round(nat[k] * scale);
        used += w;
        t.el.style.width = w + 'px';
        rowEl.appendChild(t.el);
      });
      frag.appendChild(rowEl);
    });
    gridEl.textContent = '';
    gridEl.appendChild(frag);
  }

  var lt;
  function scheduleLayout() { clearTimeout(lt); lt = setTimeout(layout, 60); }
  window.addEventListener('resize', scheduleLayout);

  /* ── Entrance: tiles arrive in a random order over ~0.6s ────── */
  function reveal() {
    tiles.forEach(function (t) {
      t.el.style.transitionDelay = Math.round(Math.random() * 600) + 'ms';
    });
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { gridEl.classList.add('is-in'); });
    });
  }

  /* ── Hover: light the group, leave everything else grey ──────── */
  var litGroup = null;
  function light(g) {
    if (g === litGroup) return;
    if (litGroup && groups[litGroup]) {
      groups[litGroup].forEach(function (t) {
        t.el.classList.remove('is-lit', 'is-playing');
        if (t.video) {
          // Back to the rest state, not frozen mid-loop: stop, rewind, and
          // let the poster (or the first frame) show again.
          t.video.pause();
          try { t.video.currentTime = 0; } catch (err) { /* not loaded yet */ }
        }
      });
    }
    litGroup = g;
    if (g && groups[g]) {
      groups[g].forEach(function (t) {
        t.el.classList.add('is-lit');
        if (t.video) {
          ensureSrc(t);
          var p = t.video.play(); if (p) p.catch(function () {});
        }
      });
    }
  }
  // Only a tile changes the lit group — crossing a 1px gap lands on the row,
  // which is ignored, so the highlight never flickers between neighbours.
  gridEl.addEventListener('mouseover', function (e) {
    var tile = e.target.closest ? e.target.closest('.tf-tile') : null;
    if (tile) light(tile.dataset.group);
  });
  gridEl.addEventListener('mouseleave', function () { light(null); });
  // Phone: touching a tile lights its group (via the touch bridge) — the tap
  // that does it must not also open the menu.
  if (TOUCH) {
    gridEl.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.tf-tile')) e.stopPropagation();
    });
  }

  /* ── Local-dev placeholders ─────────────────────────────────────
     The CMS has no experiments yet. On localhost only, fill the grid with
     flat colour swatches of mixed aspect so the layout and the hover can be
     judged. They never render on the live site — an empty CMS shows an
     empty grid there. */
  function placeholders() {
    var hues = ['#e5462b', '#f2b134', '#3a7bd5', '#2fa36b', '#b24592', '#6c5ce7',
      '#ef8354', '#00a8a8', '#d63031', '#8e9a2f', '#e84393', '#0984e3'];
    var ars = [16 / 9, 16 / 9, 16 / 9, 3 / 2, 1, 4 / 5, 9 / 16, 21 / 9];
    var out = [];
    for (var i = 0; i < 44; i++) {
      var n = 1 + ((Math.random() * 6) | 0);
      var col = hues[i % hues.length];
      var media = [];
      for (var k = 0; k < n; k++) {
        var ar = ars[(Math.random() * ars.length) | 0];
        media.push({_type: 'mediaItem', placeholder: col,
          imageDims: {aspectRatio: ar}});
      }
      out.push({_id: 'ph-' + i, title: 'placeholder ' + (i + 1), media: media});
    }
    return out;
  }
  var isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

  // Every path ends in build(), even an empty one — build() is what clears the
  // preloader, so a failed or empty fetch must still reach it.
  if (window.SS && SS.isConfigured && SS.isConfigured()) {
    SS.getExperiments().then(function (rows) {
      if ((!rows || !rows.length) && isLocal) rows = placeholders();
      build(rows);
    }).catch(function () {
      build(isLocal ? placeholders() : []);
    });
  } else {
    build(isLocal ? placeholders() : []);
  }
})();
