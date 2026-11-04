/* ============================================================
 *  project-page.js — Project page (Figma 774:287)
 *    • the 10-project list + filter set
 *    • one role line that tracks the hovered row, writing in and
 *      redacting through the shared SiteFX terminal primitive
 *    • a thumbnail frame that follows the pointer (damped), opens
 *      by height, and lerps its height to the media's aspect
 *  The data is a plain array for now — swapping it for a Sanity
 *  fetch later means touching PROJECTS/loadThumbs and nothing else.
 * ============================================================ */
(function () {
  var listEl = document.getElementById('proj-list');
  if (!listEl) return;

  var filterEl = document.getElementById('filter-list');
  var roleEl = document.getElementById('proj-role');
  var roleText = roleEl.querySelector('.role-text');
  var roleDots = roleEl.querySelector('.role-dots');
  var roleDesc = roleEl.querySelector('.role-desc');
  var thumbEl = document.getElementById('proj-thumb');
  var mediaEl = document.getElementById('thumb-media');
  var bodyEl = document.querySelector('.proj-body');

  /* ── Data ─────────────────────────────────────────────────────
     `tags` drive the filters; `role` is the line shown on hover.
     `sanity` names the CMS record a thumbnail is pulled from. */
  var PROJECTS = [
    {name: 'peak love',        role: 'identity, web design, development',  tags: ['identity', 'web design', 'development']},
    {name: 'choco colibri',    role: 'web design, development',            tags: ['web design', 'development']},
    {name: 'sycamore',         role: 'identity, motion, tooling',          tags: ['identity', 'motion', 'tooling'], sanity: 'Sycamore'}
    // Hidden until their media is in the CMS — restore a line to show it again.
    // {name: 'brunk',            role: 'identity',                           tags: ['identity']},
    // {name: 'absentia labs',    role: 'identity, web design, motion',       tags: ['identity', 'web design', 'motion']},
    // {name: 'presentations.ai', role: 'identity, motion, tooling',          tags: ['identity', 'motion', 'tooling']},
    // {name: 'memory.store',     role: 'art direction, design, development', tags: ['development']},
    // {name: 'hsbc',             role: 'identity, web design, tooling',      tags: ['identity', 'web design', 'tooling']},
    // {name: 'bounty hunters',   role: 'identity',                           tags: ['identity']},
    // {name: 'boulderbox cafe',  role: 'identity',                           tags: ['identity']}
  ];

  var FILTERS = ['identity', 'web design', 'motion', 'development', 'tooling'];
  var activeFilter = null;          // null = the 'none' state — everything shows
  var armedFilter = null;           // phone: the filter as it was at touch-down
  var filterTouch = false;          // phone: did this touch start on the filters?
  var TOUCH = document.documentElement.classList.contains('is-touch');

  /* ── Render ───────────────────────────────────────────────── */
  function splitChars(el, text) {
    el.innerHTML = String(text).split('').map(function (c) {
      var safe = c.replace(/[&<>]/g, function (s) {
        return ({'&': '&amp;', '<': '&lt;', '>': '&gt;'})[s];
      });
      return safe === ' ' ? ' ' : '<span class="char">' + safe + '</span>';
    }).join('');
    return el.querySelectorAll('.char');
  }

  PROJECTS.forEach(function (p, i) {
    var li = document.createElement('li');
    li.dataset.index = i;
    listEl.appendChild(li);
    splitChars(li, p.name);
    p.el = li;
  });

  FILTERS.forEach(function (tag) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    b.dataset.tag = tag;
    splitChars(b, tag);
    b.addEventListener('click', function (e) {
      e.stopPropagation();          // filtering shouldn't pop the menu either
      // Clicking the active filter again returns to the 'none' state. On a
      // phone the touch already applied it (below), so a tap only clears a
      // filter that was active before the finger came down.
      if (TOUCH) activeFilter = armedFilter === tag ? null : tag;
      else activeFilter = activeFilter === tag ? null : tag;
      applyFilter();
    });
    // Phone: a finger sliding across the filters applies each as it passes,
    // the way the list previews each row it passes.
    b.addEventListener('mouseover', function (e) {
      // Only a touch that began on the filters — a scrub from the list that
      // strays up across them must not re-filter on its way.
      if (!TOUCH || !e.fromTouch || !filterTouch || activeFilter === tag) return;
      activeFilter = tag;
      applyFilter();
    });
    filterEl.appendChild(b);
  });

  function applyFilter() {
    filterEl.querySelectorAll('button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.tag === activeFilter));
    });
    PROJECTS.forEach(function (p) {
      p.el.classList.toggle('is-dim',
        !!(activeFilter && p.tags.indexOf(activeFilter) === -1));
    });
  }

  /* ── The splicing ellipsis — runs only while a row is active ── */
  var dotStep = 0, dotTimer = null;
  function startDots() {
    if (dotTimer) return;
    dotStep = 0;
    dotTimer = setInterval(function () {
      dotStep = (dotStep + 1) % 4;
      roleDots.textContent = new Array(dotStep + 1).join('.');
    }, 380);
  }
  function stopDots() {
    if (dotTimer) { clearInterval(dotTimer); dotTimer = null; }
    roleDots.textContent = '';
  }


  /* ── Idle messages ──────────────────────────────────────────────
     With nothing hovered the role slot reads instead of sitting empty. The
     opening line swaps its last phrase in place — "public knowledge" redacts
     and "freelance" writes over it — then it works through the facts. */
  var IDLE = [
    {text: 'these are some of the projects i was fortunate to be a part of under ',
     swap: ['public knowledge', 'freelance']},
    {text: 'there are roughly 10^120 possible chess games, but only about 10^80 atoms in the observable universe. a simple board game has more possible outcomes than there are atoms in everything you can see.'},
    {text: 'when you touch a table, your atoms never make contact with its atoms. what you feel is the electromagnetic force pushing the electrons in your skin away from the electrons in the table.'},
    {text: 'every breath contains around 10^22 molecules. statistically, some of those molecules were once inhaled by julius caesar, cleopatra, dinosaurs, or shakespeare.'},
    {text: 'the great pyramid of giza is about 4,500 years old. some living bristlecone pine trees were already ancient when the first stone of the pyramid was laid.'},
    {text: 'your brain consumes about the same power as a dim light bulb. yet from those 20 watts emerge every memory, emotion, dream, language, and idea you have ever had.'},
    {text: 'much of your body is continuously replacing itself. the person you were years ago has literally been rebuilt from new atoms and new cells.'},
    {text: 'everything we have ever observed — stars, planets, galaxies, people — makes up only about 5% of the universe. the remaining 95% is invisible and still largely unexplained.'},
    {text: 'black holes are not eternal. over unimaginable timescales, they slowly lose energy through hawking radiation until they completely evaporate.'},
    {text: 'bananas naturally contain potassium-40, a radioactive isotope. they are perfectly safe — but technically, every banana emits radiation.'},
    {text: 'the carbon in your body, the oxygen you breathe, and the iron in your blood were forged inside stars that exploded billions of years before earth existed.'},
    {text: 'if the sun were the size of a tennis ball, the nearest star would be another tennis ball over 700 km away. space is not mostly stars — it is almost entirely emptiness.'},
    {text: 'neutron stars are so dense that a single teaspoon of their material would weigh billions of tons on earth. they are essentially giant atomic nuclei floating in space.'},
    {text: 'gravity literally bends time. clocks on mountains tick slightly faster than clocks at sea level, and gps satellites must correct for this every day.'},
    {text: 'a deck of 52 cards has about 8 x 10^67 possible orders. the exact sequence you get after a good shuffle has almost certainly never existed before in the history of the universe.'},
    {text: 'instead of relying solely on dna, octopuses can edit their rna while they are alive. it is one of the reasons they are considered among the most extraordinary animals on earth.'},
    {text: 'the big bang did not happen at one point in space — it happened everywhere at once. no matter where you stand in the universe, it looks like you are at the centre of the expansion.'},
    {text: 'gold is not made inside ordinary stars. most of it was forged when neutron stars collided in unimaginably violent explosions billions of years ago.'},
    {text: 'your body continuously emits tiny amounts of visible light due to chemical reactions. it is about a thousand times too faint for human eyes to notice.'},
    {text: 'the largest known living organism is not a whale or a tree — it is a fungus that spreads across nearly 9 square kilometres underground.'},
    {text: 'the universe is 13.8 billion years old, but stars will not shine forever. humanity exists during one of the few eras when the cosmos is bright with galaxies, stars, and the possibility of life.'}
  ];

  var idleAt = 0, idleTimer = null, idleToken = 0;

  function clearIdle() {
    idleToken++;
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  }

  function idleWrite(el, text, done) {
    var chars = splitChars(el, text);
    if (window.SiteFX && window.SiteFX.write) window.SiteFX.write(chars, done);
    else if (done) done();
  }
  function idleRedact(el, done) {
    var chars = el.querySelectorAll('.char');
    if (chars.length && window.SiteFX && window.SiteFX.redact) {
      window.SiteFX.redact(chars, function () { el.innerHTML = ''; if (done) done(); });
    } else { el.innerHTML = ''; if (done) done(); }
  }

  function runIdle() {
    if (current) return;                       // hovering wins
    var mine = ++idleToken;
    var msg = IDLE[idleAt % IDLE.length];
    idleAt++;
    roleEl.classList.add('is-idle');
    if (roleDesc) roleDesc.innerHTML = '';        // idle copy owns the slot alone
    roleText.innerHTML = '<span class="idle-a"></span><span class="idle-b"></span>';
    var a = roleText.querySelector('.idle-a');
    var b = roleText.querySelector('.idle-b');

    function hold(ms, next) {
      idleTimer = setTimeout(function () { if (mine === idleToken) next(); }, ms);
    }
    idleWrite(a, msg.text, function () {
      if (mine !== idleToken) return;
      if (!msg.swap) { hold(6500, function () { idleRedact(a, runIdle); }); return; }
      // Opening line: write the phrase, then swap it in place.
      idleWrite(b, msg.swap[0], function () {
        if (mine !== idleToken) return;
        hold(3200, function () {
          idleRedact(b, function () {
            if (mine !== idleToken) return;
            idleWrite(b, msg.swap[1], function () {
              if (mine !== idleToken) return;
              hold(4200, function () {
                idleRedact(b, function () { idleRedact(a, runIdle); });
              });
            });
          });
        });
      });
    });
  }

  function stopIdle() {
    clearIdle();
    roleEl.classList.remove('is-idle');
    roleText.innerHTML = '';
  }

  /* ── Role: writes in on hover, redacts on the way out ──────── */
  var roleToken = 0;
  function killRoleFx() {
    var chars = roleText.querySelectorAll('.char');
    if (chars.length && window.SiteFX && window.SiteFX.cancel) window.SiteFX.cancel(chars);
  }
  function showRole(p) {
    stopIdle();                         // a hovered role outranks the idle copy
    roleToken++;                        // invalidate any in-flight redact
    killRoleFx();                       // no tail of the last transition
    // The block stays pinned to the top of the list — it no longer tracks the
    // hovered row, so only its contents change.
    var chars = splitChars(roleText, p.role);
    if (roleDesc) {
      var d = (p.desc || '').trim();
      if (d) chars = [].slice.call(chars).concat([].slice.call(splitChars(roleDesc, d)));
      else roleDesc.innerHTML = '';
    }
    startDots();
    if (window.SiteCursor && SiteCursor.remeasure) SiteCursor.remeasure();
    if (window.SiteFX && window.SiteFX.write) window.SiteFX.write(chars);
  }
  function hideRole() {
    stopDots();
    var chars = [].slice.call(roleText.querySelectorAll('.char'));
    if (roleDesc) chars = chars.concat([].slice.call(roleDesc.querySelectorAll('.char')));
    if (!chars.length) {
      roleText.innerHTML = '';
      if (roleDesc) roleDesc.innerHTML = '';
      return;
    }
    var mine = ++roleToken;
    function clear() {
      if (mine !== roleToken) return;
      roleText.innerHTML = '';
      if (roleDesc) roleDesc.innerHTML = '';
    }
    if (window.SiteFX && window.SiteFX.redact) {
      // Only clear if no newer role has started in the meantime — otherwise a
      // late callback wipes the line that just wrote itself in.
      window.SiteFX.redact(chars, clear);
    } else {
      clear();
    }
  }

  /* ── Stage (v2) ────────────────────────────────────────────────
     The preview is no longer a 560px card drifting after the pointer — it
     is a settled stage that owns the whole space right of the list: the
     frame is as large as the space allows at the media's own aspect,
     centred, and it does not move with the pointer. While a row is active
     the stage walks through that project's media (STAGE_HOLD each), so the
     list previews the project, not just its thumbnail. */
  var STAGE_PAD = 56;
  var STAGE_HOLD = 3200;            // ms per media item while a row is held
  var thumbAspect = 16 / 9, thumbOpen = false;
  var cycleTimer = null, cycleIdx = 0, stageFor = null;
  var cache = {};                   // url → element, so revisits are instant

  // Phone: no space beside the list, so the stage is the band under it —
  // the field's box, which the CSS stacks below the panel. The finger sits
  // on the list while scrubbing, so the preview must never sit behind it.
  var fieldEl = document.getElementById('noise-stage');
  var TOUCH_PAD = 20;
  function stageBox(aspect) {
    if (TOUCH && fieldEl) {
      var fr = fieldEl.getBoundingClientRect();
      var tw = Math.max(120, fr.width - TOUCH_PAD * 2);
      var th = Math.max(90, fr.height - TOUCH_PAD * 2);
      var w0 = Math.min(tw, th * aspect), h0 = w0 / aspect;
      return {left: fr.left + (fr.width - w0) / 2, top: fr.top + (fr.height - h0) / 2,
        width: w0, height: h0};
    }
    var pr = (document.getElementById('proj-panel') || listEl).getBoundingClientRect();
    var L = pr.right + STAGE_PAD, R = window.innerWidth - STAGE_PAD;
    var T = STAGE_PAD, B = window.innerHeight - STAGE_PAD;
    var aw = Math.max(200, R - L), ah = Math.max(150, B - T);
    var w = Math.min(aw, ah * aspect), h = w / aspect;
    return {left: L + (aw - w) / 2, top: T + (ah - h) / 2, width: w, height: h};
  }
  function placeStage(open) {
    var b = stageBox(thumbAspect);
    thumbEl.style.left = Math.round(b.left) + 'px';
    thumbEl.style.top = Math.round(b.top + (open ? 0 : b.height / 2)) + 'px';
    thumbEl.style.width = Math.round(b.width) + 'px';
    thumbEl.style.height = (open ? Math.round(b.height) : 0) + 'px';
  }

  function mediaEl_(m) {
    if (cache[m.url]) return cache[m.url];
    var el;
    if (m.type === 'video') {
      el = document.createElement('video');
      el.muted = true; el.loop = true; el.playsInline = true;
      el.preload = 'auto';
      // The still paints at once (warmed by warmStage) while the video loads.
      if (m.poster) el.poster = m.poster;
      el.src = m.url;
    } else {
      el = document.createElement('img');
      el.alt = '';
      el.decoding = 'async';
      el.src = m.url;
    }
    el.className = 'stage-layer';
    cache[m.url] = el;
    return el;
  }
  function aspectOf(el, fallback) {
    if (el.tagName === 'VIDEO' && el.videoWidth) return el.videoWidth / el.videoHeight;
    if (el.tagName === 'IMG' && el.naturalWidth) return el.naturalWidth / el.naturalHeight;
    return fallback;
  }

  // Swap the visible layer: the new one fades in over the old, then the old
  // is detached. The frame eases to the new aspect via its CSS transition.
  function showMedia(p, i) {
    var list = p.media && p.media.length ? p.media : (p.thumb ? [p.thumb] : []);
    if (!list.length) return;
    var m = list[i % list.length];
    var el = mediaEl_(m);
    var prev = [].slice.call(mediaEl.children).filter(function (c) { return c !== el; });
    el.classList.remove('is-on');
    mediaEl.appendChild(el);
    var fit = function () {
      thumbAspect = aspectOf(el, m.aspect || 16 / 9);
      if (thumbOpen) placeStage(true);
    };
    if (el.tagName === 'VIDEO') {
      try { el.currentTime = 0; } catch (err) {}
      var pr = el.play(); if (pr) pr.catch(function () {});
      if (el.readyState >= 1) fit(); else el.addEventListener('loadedmetadata', fit, {once: true});
    } else if (el.complete) fit(); else el.addEventListener('load', fit, {once: true});
    requestAnimationFrame(function () { el.classList.add('is-on'); });
    setTimeout(function () {
      prev.forEach(function (c) {
        if (c.tagName === 'VIDEO') c.pause();
        if (c.parentNode === mediaEl && !c.classList.contains('is-on')) mediaEl.removeChild(c);
      });
    }, 460);
    prev.forEach(function (c) { c.classList.remove('is-on'); });
  }

  function openThumb(p) {
    if (opening) return;      // mid-exit the wash owns the thumb — freeze it
    if (!p || !(p.thumb || (p.media && p.media.length))) { closeThumb(); return; }
    clearInterval(cycleTimer);
    stageFor = p; cycleIdx = 0;
    if (p.media && p.media[0] && p.media[0].aspect) thumbAspect = p.media[0].aspect;
    showMedia(p, 0);
    if (!thumbOpen) { placeStage(false); void thumbEl.offsetWidth; }
    thumbOpen = true;
    thumbEl.classList.add('is-open');
    placeStage(true);
    if (p.media && p.media.length > 1) {
      cycleTimer = setInterval(function () {
        if (stageFor !== p) return;
        showMedia(p, ++cycleIdx);
      }, STAGE_HOLD);
    }
  }
  function closeThumb() {
    if (opening) return;      // mid-exit the wash owns the thumb — hold it open
    clearInterval(cycleTimer);
    stageFor = null;
    thumbOpen = false;
    thumbEl.classList.remove('is-open');
    placeStage(false);
    [].forEach.call(mediaEl.querySelectorAll('video'), function (v) { v.pause(); });
  }
  window.addEventListener('resize', function () { if (thumbOpen) placeStage(true); });

  // Kept for the hover wiring below, which reads the frame's height.
  function thumbHeight() { return thumbEl.offsetHeight; }

  /* ── Hover wiring ─────────────────────────────────────────── */
  var current = null;
  function enter(p) {
    if (current === p) return;
    if (current) current.el.classList.remove('is-active');
    hideRole();
    current = p;
    p.el.classList.add('is-active');
    listEl.classList.add('has-active');
    document.body.classList.add('is-reading');
    showRole(p);
    openThumb(p);
  }
  function leave() {
    if (!current) return;
    current.el.classList.remove('is-active');
    listEl.classList.remove('has-active');
    current = null;
    if (window.SiteCursor) window.SiteCursor.cta(false);
    document.body.classList.remove('is-reading');
    hideRole();
    closeThumb();
    idleTimer = setTimeout(runIdle, 700);    // back to the idle copy
  }

  /* The hit area is the whole body block (roles + list) with ~28px of air top
     and bottom; the row is picked by whichever is nearest on Y. That means the
     frame stays up while the pointer is anywhere in the block, including out
     over the role line. */
  var PAD = 28;

  /* ── Opening a project ─────────────────────────────────────────
     Both the row and the image open the interior. Capture phase + stop, so
     the click never reaches the crosshair module's document listener — that
     toggles the menu on ANY click, which is what was happening instead. */
  var opening = false;
  function open(p) {
    if (!p || !window.SiteExit || opening) return;
    opening = true;
    var href = 'project-detail-v2.html?id=' + encodeURIComponent(p.sanity || p.name);
    /* No special-casing here: SiteExit's standard media exit finds the
       thumbnail's wash layer on its own and plays cover → strip → rules,
       in that order, same as any other page. */
    window.SiteExit(href);
  }
  /* Phone: one tap can't both preview and open (the open would fire before
     the preview painted). So touching a row selects it and starts the
     preview; tapping the row that was ALREADY selected — or the preview
     itself — opens the project. `armed` is read at touch-down, before the
     crosshair's touch bridge moves the selection. */
  var armed = null;
  window.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch') {
      armed = current; armedFilter = activeFilter;
      filterTouch = !!(e.target.closest && e.target.closest('.proj-filters'));
    }
  }, true);
  document.addEventListener('click', function (e) {
    var row = e.target.closest ? e.target.closest('#proj-list li') : null;
    if (TOUCH && row && PROJECTS[+row.dataset.index] !== armed) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    var onImage = false;
    if (!row && thumbOpen) {
      var t = thumbEl.getBoundingClientRect();
      onImage = e.clientX >= t.left && e.clientX <= t.right &&
                e.clientY >= t.top && e.clientY <= t.bottom;
    }
    if (!row && !onImage) return;
    e.preventDefault();
    e.stopPropagation();
    open(row ? PROJECTS[+row.dataset.index] : (current || rowAt(e.clientY)));
  }, true);
  function rowAt(py) {
    var best = null, bestD = Infinity;
    PROJECTS.forEach(function (p) {
      var b = p.el.getBoundingClientRect();
      var d = Math.abs((b.top + b.bottom) / 2 - py);
      if (d < bestD) { bestD = d; best = p; }
    });
    return best;
  }
  var panelEl = document.getElementById('proj-panel');
  function overThumb(e) {
    if (!thumbOpen) return false;
    var t = thumbEl.getBoundingClientRect();
    return e.clientX >= t.left && e.clientX <= t.right &&
           e.clientY >= t.top && e.clientY <= t.bottom;
  }
  var hoverReady = !document.documentElement.classList.contains('preload');
  document.addEventListener('site:ready', function () { hoverReady = true; });
  // Failsafe: never leave the page permanently uninteractive if the reveal
  // event doesn't arrive for any reason.
  setTimeout(function () { hoverReady = true; }, 5000);
  document.addEventListener('mousemove', function (e) {
    if (!hoverReady) return;            // no hover states during the load-in
    var b = bodyEl.getBoundingClientRect();
    var inside = e.clientX >= b.left && e.clientX <= b.right &&
                 e.clientY >= b.top - PAD && e.clientY <= b.bottom + PAD;
    var onImage = overThumb(e);
    if (TOUCH) {
      // A lifted finger keeps its selection (so a second tap can open it),
      // but a finger that moves off the list — or onto the filters, which sit
      // inside the hit area's top air — lets it go. The preview itself holds.
      var onFilters = !!(e.target.closest && e.target.closest('.proj-filters'));
      if (onImage) return;
      if (!inside || onFilters) { leave(); return; }
    }
    if (inside) {
      enter(rowAt(e.clientY));
    } else if (thumbOpen && e.clientX > b.right) {
      // Anywhere right of the list — including the panel's right padding, which
      // the pointer must cross to reach the image — holds the frame open.
      // (Testing this by jumping straight to the image hides the gap; a real
      //  pointer travels through it.)
    } else {
      leave();
    }
    // The square becomes the "open project" button while over the image.
    if (window.SiteCursor) window.SiteCursor.cta(onImage);
  });

  /* ── Thumbnails from Sanity (sycamore is the only one so far) ── */
  function loadThumbs() {
    if (!window.SS || !SS.isConfigured || !SS.isConfigured()) return;
    SS.getProjects().then(function (rows) {
      (rows || []).forEach(function (row) {
        // Match by the explicit `sanity` title, else by name — 'peak love'
        // ↔ CMS title 'Peak Love' — so new CMS projects connect without code.
        var title = String(row.title || '').trim();
        var match = PROJECTS.filter(function (p) {
          return p.sanity === title || p.name === title.toLowerCase();
        })[0];
        if (match && !match.sanity) match.sanity = title;
        if (!match) return;
        // The write-up comes from the CMS Description field. Projects that
        // aren't in Sanity yet simply show their roles — the paragraph
        // collapses rather than showing placeholder copy.
        if (row.description) match.desc = String(row.description).trim();
        // v2: the stage walks the project's media, not just its thumbnail.
        match.media = [];
        [row.thumbnail].concat(row.content || []).forEach(function (m, k) {
          if (!m || m._type !== 'mediaItem') return;
          var d = m.mediaType === 'video' ? m.posterDims : m.imageDims;
          var item = m.mediaType === 'video' && m.videoUrl
            ? {type: 'video', url: m.videoUrl}
            : (m.imageUrl ? {type: 'image', url: SS.imageUrl(m.imageUrl, {width: 1600})} : null);
          if (!item) return;
          if (item.type === 'video' && m.posterUrl) item.poster = SS.imageUrl(m.posterUrl, {width: 1600});
          if (d && d.aspectRatio) item.aspect = d.aspectRatio;
          // the thumbnail is usually also the first content item — skip the repeat
          if (k > 0 && match.media[0] && match.media[0].url === item.url) return;
          match.media.push(item);
        });
        if (!row.thumbnail) return;
        var t = row.thumbnail;
        if (t.mediaType === 'video' && t.videoUrl) match.thumb = {type: 'video', url: t.videoUrl};
        else if (t.imageUrl) match.thumb = {type: 'image', url: SS.imageUrl(t.imageUrl, {width: 900})};
      });
      warmStage();
    }).catch(function () {});
  }

  /* Warm the stage: once the page has revealed, fetch each project's first
     preview still in the background, one at a time, so hovering (or scrubbing
     on a phone) paints at once instead of showing a blank stage. Stills, not
     video: phones won't download a video before it plays, but an image they
     always will — and the video element shows that still as its poster
     until its own frames arrive. */
  var warmed = false;
  function warmStage() {
    if (warmed) return;
    var go = function () {
      if (warmed) return;
      warmed = true;
      var queue = PROJECTS.filter(function (p) { return p.media && p.media.length; })
        .map(function (p) { var m = p.media[0]; return m.type === 'video' ? m.poster : m.url; })
        .filter(Boolean);
      (function next() {
        var url = queue.shift();
        if (!url) return;
        var img = new Image();
        img.onload = img.onerror = function () { setTimeout(next, 60); };
        img.src = url;
      })();
    };
    if (hoverReady) go();
    else document.addEventListener('site:ready', go, {once: true});
    setTimeout(go, 5000);
  }

  /* ── Load-in: rules trim first, then the copy writes itself in ──
     The copy must be hidden the moment it's built, NOT when the reveal fires —
     otherwise it paints visible, sits there through the rule trim, and then
     scrambles, which reads as the page loading twice. */
  function loadInEls() {
    var label = document.querySelector('.filters-label');
    if (label && !label.querySelector('.char')) splitChars(label, label.textContent);
    // Per-character spans — the same tokens the intro and role line use.
    return [].slice.call(document.querySelectorAll(
      '.filters-label .char, #filter-list .char, #proj-list .char'));
  }
  function writeIn() {
    var els = loadInEls();
    if (window.SiteFX && window.SiteFX.write) window.SiteFX.write(els);
    else els.forEach(function (el) { el.style.color = ''; });
  }

  /* Freeze the container widths: the write-in flips children to inline-block,
     which would otherwise re-measure these and shunt the list sideways. */
  function pinWidths() {
    [listEl, filterEl].forEach(function (el) {
      if (!el) return;
      el.style.width = '';
      el.style.width = Math.ceil(el.getBoundingClientRect().width) + 'px';
    });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(pinWidths);
  else pinWidths();
  pinWidths();
  var pinTimer;
  window.addEventListener('resize', function () {
    clearTimeout(pinTimer);
    pinTimer = setTimeout(pinWidths, 150);
  });

  applyFilter();
  loadThumbs();
  document.addEventListener('site:ready', function () {
    idleTimer = setTimeout(runIdle, 600);
  });
  setTimeout(function () { if (!current && !roleText.textContent) runIdle(); }, 6000);
  if (window.SiteFX && window.SiteFX.revealPending) {
    loadInEls().forEach(function (el) { el.style.color = 'transparent'; });
    document.addEventListener('site:reveal', writeIn, {once: true});
  } else {
    writeIn();
  }
})();
