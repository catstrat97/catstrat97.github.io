# Portfolio rebuild — architecture plan


## Context
The current site is hand-written HTML/CSS/JS pages with Sanity read live in the
browser. It works, but every page change is a full reload: the browser drops the
page, refetches CSS/JS/fonts, re-runs every script, and the cursor, noise field and
animations restart from zero. That's the source of the flash and of the
"not seamless" feel. Patching it (a router bolted on) means retrofitting every
script with start/stop lifecycles. Since a redesign is coming anyway, rebuild on
an architecture that makes seamless navigation and speed the default.

## What the reference (varsha-ramesh.com) actually does
Inspected the live site:
- **Built with Framer.** Every page is **pre-rendered to static HTML** at publish
  time (`ssg-status: optimized`), served **from an edge cache in the visitor's
  region** (`ap-south-1`, `cache: cached` for a visitor in India).
- After first load, a **client-side router** takes over: page changes fetch only
  data and swap content — no reload. Page code is split per route and
  **preloaded at low priority** (`modulepreload fetchpriority="low"`).
- Fonts preconnected; images served from Framer's image CDN.

So "fast & fine-tuned" = pre-rendered HTML + edge CDN + client routing + per-page
code splitting. None of that requires Framer; we can get the same with full code
control.

## Recommended stack
| Concern | Choice | Why |
|---|---|---|
| Framework | **Astro** (static output) | Outputs plain HTML/CSS with zero JS by default; ships only the JS a page needs. Pages are `.astro` files ≈ HTML, so the current markup ports almost 1:1. |
| Page transitions | **Astro `<ClientRouter />`** (View Transitions) | Built-in no-reload navigation with prefetch. `transition:persist` keeps the **cursor, crosshair, menu and noise canvas alive across pages** — they never reset. Lifecycle events (`astro:before-swap`, `astro:page-load`) give each page script a clean start/stop. Falls back to normal navigation in old browsers. |
| Animation | **GSAP** (already used) | Keep. Exit/enter choreography hooks into the router's swap events. |
| Content | **Sanity** (keep both datasets: `production` = Work, `personal_projects` = test.fun) | Fetched **at build time**, not in the browser: pages ship with content already in the HTML — no loading spinners for text, no client Sanity requests, no CORS port issues. A Sanity webhook triggers a rebuild on publish (~1 min). |
| Images | **Sanity image CDN** via `@sanity/image-url` | Responsive `srcset`, AVIF/WebP automatic, `width/height` set to prevent layout shift. Video: WebM tiles + poster stills (pipeline already built in `scripts/`). |
| Fonts | Self-hosted (IBM Plex Sans Condensed, IBM Plex Mono, Departure Mono) | No Google Fonts round-trip; `preload` the 1–2 faces used above the fold. |
| Hosting | **Cloudflare Pages** (or Vercel) | Free tier, global edge incl. India, instant cache purge on deploy, preview URL per branch. GitHub Pages lacks build hooks for Sanity rebuilds. |
| Smooth scroll (optional) | Lenis | Only if the new design calls for it. |

## Site structure
```
src/
  layouts/Base.astro        ← <head>, critical dark bg, fonts, ClientRouter,
                              persistent shell (cursor, crosshair, menu, noise canvas)
  pages/
    index.astro             ← home
    work/index.astro        ← project list
    work/[slug].astro       ← project interior (one page per Sanity project)
    test-fun.astro          ← experiments grid
    about.astro
  components/               ← ProjectRow, MediaFrame, ExperimentTile, …
  scripts/                  ← cursor.js, noise-field.js, text-fx.js, wash.js —
                              each exports init()/destroy(), wired to router events
  lib/sanity.js             ← build-time GROQ queries (reuse current projections)
public/fonts/
studio/                     ← existing Sanity Studio (v6, two workspaces) — unchanged
```

## Navigation & preloader model
- **First visit:** pre-rendered HTML paints immediately on a dark background
  (inline critical CSS). Existing load-in choreography plays. Pages with heavy
  media (test.fun) keep their asset preloader.
- **Page to page:** link hover/viewport prefetches the next page's HTML. On click:
  exit choreography plays (copy redacts, media washes out, rules retract) while the
  next page is already in memory → swap → enter choreography. Persistent shell
  never reloads, so the cursor and noise field are continuous.
- Back/forward, direct URLs, refresh, external links all work natively.
- `prefers-reduced-motion`: shorten/skip choreography.

## Mobile
Same pages, responsive CSS. Cursor/crosshair disabled on touch; tap targets sized;
test.fun grid row height and slideshow sizing re-tuned per breakpoint. Mobile
screens come from the new Figma design.

## Performance budget (targets)
- HTML + critical CSS first paint < 1s on 4G; LCP < 2.0s; CLS ≈ 0.
- JS per page < 60 KB gzipped excluding GSAP.
- Lighthouse mobile ≥ 95.

## What carries over from the current repo
- All animation logic in `site.js` (cipher text FX, noise field, crosshair, wash,
  exit) — split into modules, behaviour unchanged.
- Page logic: `project-page.js`, `project-detail.js` (slideshow, browse),
  `test-page.js` (justified grid, hover groups, posters).
- Sanity schemas, both datasets, `scripts/` media pipeline (WebM, posters).
- Self-hosted Departure Mono.

## Open decisions (for when the design is ready)
1. Hosting: Cloudflare Pages vs Vercel (and domain).
2. About page in scope?
3. Which pages need an asset preloader vs instant reveal.
4. Mobile designs from Figma.

## Verification (when built)
Headless Chrome over CDP: record home → work → project → test.fun → home via the
menu, plus back/forward and rapid clicks, at desktop and 390px with 4G throttling.
Check no blank/white frames, cursor continuity across swaps, no duplicate listeners,
zero console errors, Lighthouse mobile scores.
