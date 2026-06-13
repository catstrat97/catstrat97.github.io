/* ============================================================
 *  home.js — Renders the home page projects (list + grid views),
 *  filter chips, and Grid/List toggle. Data comes from sanity.js.
 * ============================================================ */
(function () {
  var listEl = document.getElementById('projects-table');
  var gridEl = document.getElementById('projects-grid');
  var chipsEl = document.getElementById('filter-chips');
  var toggleEl = document.getElementById('view-toggle');
  var statusEl = document.getElementById('projects-status');
  if (!listEl) return;

  var GRID_COLS = window.innerWidth <= 800 ? 1 : 5;

  var state = {projects: [], activeTag: null, view: 'list'};

  function abbrevYear(year) {
    return year ? String(year).slice(-2) + '’' : '';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]);
    });
  }

  // Fixed filter set for now (matches the Figma toolbar). Matched against the
  // project tags case-insensitively.
  var FILTER_TAGS = ['Identity', 'Motion', 'Poster', 'Test'];

  function filtered() {
    if (!state.activeTag) return state.projects;
    var want = state.activeTag.toLowerCase();
    return state.projects.filter(function (p) {
      return (p.tags || []).some(function (t) {
        return String(t).toLowerCase() === want;
      });
    });
  }

  /* ── List (year-grouped table) ─────────────────────────────── */
  function renderList() {
    var rows = filtered();
    listEl.innerHTML = '';

    if (!rows.length) {
      listEl.insertAdjacentHTML('beforeend',
        '<div class="project-row"><span class="col-name">No projects.</span></div>');
      return;
    }

    // Group by year, preserving the (already year-desc) order.
    var groups = [];
    var byYear = {};
    rows.forEach(function (p) {
      var key = p.year || 0;
      if (!byYear[key]) { byYear[key] = []; groups.push(key); }
      byYear[key].push(p);
    });

    groups.forEach(function (year) {
      var group = document.createElement('div');
      group.className = 'year-group';
      byYear[year].forEach(function (p, i) {
        var a = document.createElement('a');
        a.className = 'project-row';
        a.href = 'project.html?id=' + encodeURIComponent(p.slug);
        a.innerHTML =
          '<span class="col-year">' + (i === 0 ? abbrevYear(p.year) : '') + '</span>' +
          '<span class="col-name">' + escapeHtml(p.title) + '</span>' +
          '<span class="col-role">' + escapeHtml(p.role) + '</span>';
        group.appendChild(a);
      });
      listEl.appendChild(group);
    });
  }

  /* ── Grid (masonry) ────────────────────────────────────────── */
  function mediaUrl(item) {
    if (!item) return null;
    if (item.mediaType === 'video') return {type: 'video', url: item.videoUrl};
    if (item.imageUrl) return {type: 'image', url: SS.imageUrl(item.imageUrl, {width: 800})};
    return null;
  }

  function renderGrid() {
    var rows = filtered();
    gridEl.innerHTML = '';
    var cols = [];
    for (var i = 0; i < GRID_COLS; i++) {
      var col = document.createElement('div');
      col.className = 'masonry-col';
      cols.push(col);
      gridEl.appendChild(col);
    }

    rows.forEach(function (p, index) {
      var media = mediaUrl(p.thumbnail);
      if (!media || !media.url) return;
      var a = document.createElement('a');
      a.className = 'grid-link loading-placeholder';
      a.href = 'project.html?id=' + encodeURIComponent(p.slug);
      a.setAttribute('aria-label', p.title);
      if (media.type === 'video') {
        a.innerHTML = '<video class="lazy-media" loop muted playsinline preload="none" ' +
          'data-src="' + media.url + '"></video>';
      } else {
        a.innerHTML = '<img class="lazy-media" data-src="' + media.url + '" alt="' +
          escapeHtml(p.title) + '">';
      }
      cols[index % GRID_COLS].appendChild(a);
    });

    observeMedia(gridEl);
  }

  /* ── Lazy load + video autoplay ────────────────────────────── */
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var el = entry.target;
      if (entry.isIntersecting) {
        if (el.dataset.src) {
          if (el.tagName === 'IMG') {
            el.src = el.dataset.src;
            el.onload = function () { el.parentElement.classList.remove('loading-placeholder'); };
            el.removeAttribute('data-src');
          } else if (el.tagName === 'VIDEO') {
            el.innerHTML = '<source src="' + el.dataset.src + '" type="video/mp4">';
            el.load();
            el.onloadeddata = function () { el.parentElement.classList.remove('loading-placeholder'); };
            el.removeAttribute('data-src');
          }
        }
        if (el.tagName === 'VIDEO') {
          var pr = el.play();
          if (pr !== undefined) pr.catch(function () {});
        }
      } else if (el.tagName === 'VIDEO' && !el.dataset.src) {
        el.pause();
      }
    });
  }, {rootMargin: '400px 0px 400px 0px'});

  function observeMedia(root) {
    root.querySelectorAll('.lazy-media').forEach(function (m) { observer.observe(m); });
  }

  /* ── Filter chips ──────────────────────────────────────────── */
  function renderChips() {
    if (!chipsEl) return;
    chipsEl.innerHTML = '';
    FILTER_TAGS.forEach(function (tag) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = tag;
      b.setAttribute('aria-pressed', String(state.activeTag === tag));
      b.addEventListener('click', function () {
        state.activeTag = state.activeTag === tag ? null : tag;
        renderChips();
        renderList();
        renderGrid();
      });
      chipsEl.appendChild(b);
    });
  }

  /* ── View toggle ───────────────────────────────────────────── */
  function applyView() {
    var showGrid = state.view === 'grid';
    gridEl.classList.toggle('is-active', showGrid);
    listEl.classList.toggle('is-hidden', showGrid);
    if (toggleEl) {
      toggleEl.querySelectorAll('button').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.view === state.view));
      });
    }
  }

  if (toggleEl) {
    toggleEl.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      state.view = btn.dataset.view;
      applyView();
    });
  }

  /* ── Boot ──────────────────────────────────────────────────── */
  function showStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  if (!window.SS || !SS.isConfigured()) {
    showStatus('Projects load from Sanity once the project ID is set in sanity.js.');
    return;
  }

  SS.getProjects()
    .then(function (projects) {
      state.projects = projects || [];
      showStatus('');
      renderChips();
      renderList();
      renderGrid();
      applyView();
      // Scramble the list section in the first time it's scrolled into view.
      if (window.SiteFX && window.SiteFX.scrambleOnScroll) {
        window.SiteFX.scrambleOnScroll(
          document.querySelector('.projects'),
          document.querySelectorAll(
            '.view-toggle button, .filter-label, #filter-chips button, .table-head span, ' +
            '#projects-table .col-year, #projects-table .col-name, #projects-table .col-role'));
      }
    })
    .catch(function (err) {
      console.error(err);
      showStatus('Could not load projects.');
    });
})();
