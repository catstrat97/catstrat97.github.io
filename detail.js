/* ============================================================
 *  detail.js — Renders a single project page from Sanity.
 *  Reads ?id=<slug> from the URL, fetches via SS.getProject,
 *  injects the hero (title, meta, description) and media column.
 * ============================================================ */
(function () {
  var rootEl = document.getElementById('project');
  var statusEl = document.getElementById('project-status');
  if (!rootEl) return;

  function showStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]);
    });
  }

  /* ── Media element (lazy-loaded) ───────────────────────────── */
  function createMedia(item) {
    var block = document.createElement('div');
    block.className = 'media-block reveal loading-placeholder';

    if (item.mediaType === 'video' && item.videoUrl) {
      var video = document.createElement('video');
      video.className = 'lazy-media';
      video.loop = true;
      video.muted = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('preload', 'none');
      video.setAttribute('data-src', item.videoUrl);
      block.appendChild(video);
    } else if (item.imageUrl) {
      var img = document.createElement('img');
      img.className = 'lazy-media';
      img.alt = item.alt || '';
      img.setAttribute('data-src', SS.imageUrl(item.imageUrl, {width: 1600}));
      block.appendChild(img);
    } else {
      return null;
    }
    return block;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var block = entry.target;
      var media = block.querySelector('.lazy-media');
      if (entry.isIntersecting) {
        block.classList.add('revealed');
        if (media && media.dataset.src) {
          if (media.tagName === 'IMG') {
            media.src = media.dataset.src;
            media.onload = function () { block.classList.remove('loading-placeholder'); };
            media.removeAttribute('data-src');
          } else if (media.tagName === 'VIDEO') {
            media.innerHTML = '<source src="' + media.dataset.src + '" type="video/mp4">';
            media.load();
            media.onloadeddata = function () { block.classList.remove('loading-placeholder'); };
            media.removeAttribute('data-src');
          }
        }
        if (media && media.tagName === 'VIDEO') {
          var pr = media.play();
          if (pr !== undefined) pr.catch(function () {});
        }
      } else if (media && media.tagName === 'VIDEO' && !media.dataset.src) {
        media.pause();
      }
    });
  }, {rootMargin: '400px 0px 400px 0px'});

  /* ── Render ────────────────────────────────────────────────── */
  function render(project) {
    document.title = project.title + ' — Sharang Sharma';

    var titleEl = document.getElementById('project-title');
    titleEl.textContent = project.title;
    titleEl.classList.add('text-fx');
    document.getElementById('project-year').textContent = project.year || '—';
    document.getElementById('project-role').textContent = project.role || '—';

    var clientItem = document.getElementById('project-client-item');
    if (project.client) {
      document.getElementById('project-client').textContent = project.client;
    } else if (clientItem) {
      clientItem.style.display = 'none';
    }

    // Tags
    var tagsEl = document.getElementById('project-tags');
    (project.tags || []).forEach(function (tag) {
      var span = document.createElement('span');
      span.className = 'tag';
      span.textContent = tag;
      tagsEl.appendChild(span);
    });

    // Content: textBlocks → description, mediaItems → media column.
    var descEl = document.getElementById('project-description');
    var mediaEl = document.getElementById('project-media');
    var media = [];

    (project.content || []).forEach(function (block) {
      if (block._type === 'textBlock' && block.body) {
        var p = document.createElement('p');
        p.className = 'project-body text-fx';
        p.textContent = block.body;
        descEl.appendChild(p);
      } else if (block._type === 'mediaItem') {
        media.push(block);
      }
    });

    if (!descEl.children.length) descEl.style.display = 'none';

    // First media full-width, remainder in a 2-column masonry.
    if (media.length) {
      var first = createMedia(media[0]);
      if (first) {
        first.classList.add('media-lead');
        mediaEl.appendChild(first);
        observer.observe(first);
      }
      if (media.length > 1) {
        var numCols = window.innerWidth <= 800 ? 1 : 2;
        var grid = document.createElement('div');
        grid.className = 'media-masonry';
        var cols = [];
        for (var i = 0; i < numCols; i++) {
          var col = document.createElement('div');
          col.className = 'masonry-col';
          cols.push(col);
          grid.appendChild(col);
        }
        for (var j = 1; j < media.length; j++) {
          var el = createMedia(media[j]);
          if (!el) continue;
          cols[(j - 1) % numCols].appendChild(el);
          observer.observe(el);
        }
        mediaEl.appendChild(grid);
      }
    }

    rootEl.hidden = false;
    showStatus('');

    // Wire the char-flip interaction onto the now-injected title/description.
    if (window.SiteFX) window.SiteFX.apply(rootEl);
  }

  /* ── Boot ──────────────────────────────────────────────────── */
  var slug = new URLSearchParams(window.location.search).get('id');

  if (!slug) {
    showStatus('No project specified.');
    return;
  }
  if (!window.SS || !SS.isConfigured()) {
    showStatus('Projects load from Sanity once the project ID is set in sanity.js.');
    return;
  }

  SS.getProject(slug)
    .then(function (project) {
      if (!project) { showStatus('Project not found.'); return; }
      render(project);
    })
    .catch(function (err) {
      console.error(err);
      showStatus('Could not load this project.');
    });
})();
