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
      // Clicking the active filter again returns to the 'none' state.
      activeFilter = activeFilter === tag ? null : tag;
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

  /* ── Thumbnail: damped follow + height-in + aspect lerp ────── */
  var THUMB_W = 560;                // scaled up from the Figma 444px box
  var DAMP_Y = 0.24;                // share of the pointer's vertical offset
  var DAMP_X = 0.05;                // a much lighter sideways drift
  var thumbAspect = 16 / 9;
  var curY = 0, tgtY = 0, thumbOpen = false;

  // Width is locked (Figma), so height alone carries the aspect: 16:9 → 250px,
  // 1:1 → 444px, 4:5 → 555px. It eases via the CSS height transition.
  function thumbHeight() { return Math.round(THUMB_W / thumbAspect); }

  function setThumbMedia(p) {
    mediaEl.innerHTML = '';
    thumbAspect = 16 / 9;
    if (!p || !p.thumb) return;
    var onMeta = function (w, h) {
      if (!w || !h) return;
      thumbAspect = w / h;
      if (thumbOpen) thumbEl.style.height = thumbHeight() + 'px';
    };
    if (p.thumb.type === 'video') {
      var v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
      v.addEventListener('loadedmetadata', function () { onMeta(v.videoWidth, v.videoHeight); });
      v.src = p.thumb.url;
      mediaEl.appendChild(v);
      var pr = v.play(); if (pr) pr.catch(function () {});
    } else {
      var img = document.createElement('img');
      img.alt = '';
      img.addEventListener('load', function () { onMeta(img.naturalWidth, img.naturalHeight); });
      img.src = p.thumb.url;
      mediaEl.appendChild(img);
    }
  }

  function openThumb(p) {
    if (opening) return;      // mid-exit the wash owns the thumb — freeze it
    // No media → no frame. Nine of the ten projects have no CMS thumbnail
    // yet, and an empty bordered box tracking the cursor reads as a bug —
    // on hover AND through the exit.
    if (!p || !p.thumb) { closeThumb(); return; }
    setThumbMedia(p);
    thumbOpen = true;
    thumbEl.classList.add('is-open');
    thumbEl.style.height = thumbHeight() + 'px';
  }
  function closeThumb() {
    if (opening) return;      // mid-exit the wash owns the thumb — hold it open
    thumbOpen = false;
    thumbEl.classList.remove('is-open');
    thumbEl.style.height = '0px';
  }

  /* The frame sits centred in the space right of the panel and drifts with the
     pointer — but only takes a fraction of its offset, so hovering the last row
     nudges it down instead of dragging it to the floor. */
  var curX = 0, tgtX = 0;
  document.addEventListener('mousemove', function (e) {
    var box = listEl.getBoundingClientRect();
    var midY = box.top + box.height / 2;
    var h = thumbOpen ? thumbHeight() : 0;
    var centred = (window.innerHeight - h) / 2;          // resting Y
    var want = centred + (e.clientY - midY) * DAMP_Y;
    tgtY = Math.max(16, Math.min(window.innerHeight - 16 - h, want));
    tgtX = (e.clientX - window.innerWidth / 2) * DAMP_X;
  });

  (function follow() {
    requestAnimationFrame(follow);
    curY += (tgtY - curY) * 0.08;
    curX += (tgtX - curX) * 0.08;
    thumbEl.style.transform =
      'translate(' + curX.toFixed(1) + 'px,' + curY.toFixed(1) + 'px)';
  })();

  /* ── Hover wiring ─────────────────────────────────────────── */
  var current = null;
  function enter(p) {
    if (current === p) return;
    if (current) current.el.classList.remove('is-active');
    hideRole();
    current = p;
    p.el.classList.add('is-active');
    document.body.classList.add('is-reading');
    showRole(p);
    openThumb(p);
  }
  function leave() {
    if (!current) return;
    current.el.classList.remove('is-active');
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
    var href = 'project-detail.html?id=' + encodeURIComponent(p.sanity || p.name);
    /* No special-casing here: SiteExit's standard media exit finds the
       thumbnail's wash layer on its own and plays cover → strip → rules,
       in that order, same as any other page. */
    window.SiteExit(href);
  }
  document.addEventListener('click', function (e) {
    var row = e.target.closest ? e.target.closest('#proj-list li') : null;
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
        if (!row.thumbnail) return;
        var t = row.thumbnail;
        if (t.mediaType === 'video' && t.videoUrl) match.thumb = {type: 'video', url: t.videoUrl};
        else if (t.imageUrl) match.thumb = {type: 'image', url: SS.imageUrl(t.imageUrl, {width: 900})};
      });
    }).catch(function () {});
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
