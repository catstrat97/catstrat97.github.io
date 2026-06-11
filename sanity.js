/* ============================================================
 *  sanity.js — Front-end data layer
 *  Fetches content live from Sanity's CDN (GROQ). No build step.
 *  Exposes a global `SS` with async helpers used by the pages.
 * ============================================================ */
(function () {
  // Filled in after the Sanity project is created.
  var PROJECT_ID = '2m7dbr1b';
  var DATASET = 'production';
  var API_VERSION = 'v2024-01-01';

  var QUERY_HOST = 'https://' + PROJECT_ID + '.apicdn.sanity.io';

  // Shared GROQ projection for a media item or text block.
  var MEDIA_PROJECTION =
    '{' +
    '_type, _key,' +
    '_type == "textBlock" => { body },' +
    '_type == "mediaItem" => {' +
    'mediaType, alt,' +
    '"imageUrl": image.asset->url,' +
    '"imageDims": image.asset->metadata.dimensions,' +
    '"videoUrl": video.asset->url' +
    '}' +
    '}';

  var PROJECT_PROJECTION =
    '{' +
    '_id, title, "slug": slug.current, year, role, client, tags, displayOrder,' +
    '"thumbnail": thumbnail' + MEDIA_PROJECTION + ',' +
    '"content": content[]' + MEDIA_PROJECTION +
    '}';

  function runQuery(groq, params) {
    var url = new URL(QUERY_HOST + '/' + API_VERSION + '/data/query/' + DATASET);
    url.searchParams.set('query', groq);
    if (params) {
      Object.keys(params).forEach(function (k) {
        url.searchParams.set('$' + k, JSON.stringify(params[k]));
      });
    }
    return fetch(url.toString())
      .then(function (r) {
        if (!r.ok) throw new Error('Sanity query failed: ' + r.status);
        return r.json();
      })
      .then(function (json) {
        return json.result;
      });
  }

  // Append CDN transform params to a Sanity image URL (no-op for video/files).
  function imageUrl(url, opts) {
    if (!url) return '';
    opts = opts || {};
    var q = ['auto=format'];
    if (opts.width) q.push('w=' + opts.width);
    if (opts.quality) q.push('q=' + opts.quality);
    return url + (url.indexOf('?') === -1 ? '?' : '&') + q.join('&');
  }

  window.SS = {
    isConfigured: function () {
      return PROJECT_ID !== 'REPLACE_WITH_PROJECT_ID';
    },
    imageUrl: imageUrl,
    getProjects: function () {
      return runQuery(
        '*[_type == "project"] | order(year desc, displayOrder asc) ' + PROJECT_PROJECTION
      );
    },
    getProject: function (slug) {
      return runQuery(
        '*[_type == "project" && slug.current == $slug][0] ' + PROJECT_PROJECTION,
        {slug: slug}
      );
    },
    getSettings: function () {
      return runQuery('*[_type == "siteSettings"][0]');
    },
  };
})();
