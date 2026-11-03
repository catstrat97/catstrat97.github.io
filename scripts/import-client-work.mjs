/**
 * import-client-work.mjs — add Peak Love and Choco Colibri to the Work CMS
 * (dataset `production`) from ~/Desktop/Sharang/Website Portfolio.
 *
 * Uses each project's curated `presentation/` set:
 *   · videos  presentation/web/*.webm. Choco Colibri's are already web-sized
 *             and go up untouched. Peak Love's are 4K/60 exports (up to
 *             134 MB), so a web copy is made: 1920px wide, VP9 — the originals
 *             on disk are never modified.
 *   · stills  presentation/stills/*.png — uploaded as-is; Sanity's image CDN
 *             serves them to the site as AVIF/WebP at display size.
 *   · posters every video gets a still from its first frame (as
 *             add-posters.mjs), so the frame paints before the video loads.
 *
 * Doc ids are `work-<slug>` (not `project-*`, which move-to-personal.mjs
 * --cleanup treats as old migrated entries). createOrReplace + content-hash
 * dedupe make it safe to re-run.
 *
 *   cd scripts && node import-client-work.mjs [--dry]
 */
import {createClient} from '@sanity/client'
import ffmpegPath from 'ffmpeg-static'
import {spawn} from 'node:child_process'
import {readFile, stat, mkdtemp, rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(os.homedir(), 'Desktop/Sharang/Website Portfolio')
const DRY = process.argv.includes('--dry')

// Media order: each loop leads, followed by the stills that share its section.
const PROJECTS = [
  {
    slug: 'choco-colibri',
    title: 'Choco Colibri',
    client: 'Choco Colibri',
    year: 2026,
    role: 'web design, development',
    tags: ['web design', 'development'],
    displayOrder: 2,
    dir: 'Chococolibri',
    optimise: false,
    order: [
      'web/loop-01_desktop-hero.webm',
      'stills/still-01_carousel_hero-product.png',
      'stills/still-02_single_more-than-a-chocolaterie.png',
      'stills/still-03_single_footer-wordmark.png',
      'web/loop-02_desktop-bestsellers-carousel.webm',
      'stills/still-04_inset45_categories.png',
      'stills/still-05_inset45_craftsmanship.png',
      'web/loop-03_mobile-triptych.webm',
      'stills/still-06_triptych_hero-menu-product.png',
      'stills/still-07_triptych_bestsellers-categories-experiences.png',
    ],
  },
  {
    slug: 'peak-love',
    title: 'Peak Love',
    client: 'Peak Love',
    year: 2026,
    role: 'identity, web design, development',
    tags: ['identity', 'web design', 'development'],
    displayOrder: 1,
    dir: 'Peak Love',
    optimise: true,
    order: [
      'web/loop-01_home-gradient-hover.webm',
      'web/loop-08_home-nav-hover.webm',
      'web/loop-02_shop-image-scroll.webm',
      'web/loop-04_index-layout-4x5.webm',
      'web/loop-05_conveyor-4x5.webm',
      'web/loop-07_bottle-interior-hover.webm',
      'web/loop-03_sound-wave-macro.webm',
      'web/loop-09_inspiration.webm',
      'web/loop-06_mobile-triptych.webm',
    ],
  },
]

async function loadEnv() {
  try {
    const text = await readFile(path.join(__dirname, '.env'), 'utf8')
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    /* no .env — rely on real env vars */
  }
}
await loadEnv()
const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID || process.env.SANITY_STUDIO_PROJECT_ID,
  dataset: 'production',
  token: process.env.SANITY_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false,
})

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args, {stdio: ['ignore', 'ignore', 'pipe']})
    let err = ''
    p.stderr.on('data', (d) => (err = (err + d).slice(-2000)))
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error('ffmpeg failed:\n' + err))))
  })
}
const mb = (n) => (n / 1048576).toFixed(1) + ' MB'
const tmp = await mkdtemp(path.join(os.tmpdir(), 'client-work-'))
let totalBefore = 0, totalAfter = 0

async function uploadImage(file, name) {
  const a = await client.assets.upload('image', await readFile(file), {filename: name})
  return {_type: 'image', asset: {_type: 'reference', _ref: a._id}}
}

async function videoItem(p, rel, key) {
  const srcFile = path.join(SRC, p.dir, 'presentation', rel)
  const base = path.basename(rel, path.extname(rel))
  let file = srcFile
  if (p.optimise) {
    file = path.join(tmp, `${p.slug}-${base}.webm`)
    await ffmpeg(['-y', '-i', srcFile, '-an',
      // Landscape: cap width at 1920. Portrait (4:5): cap height at 1350,
      // full frame kept (no crop) — the conveyor goes 134 MB → 8 MB.
      '-vf', base.includes('4x5')
        ? "scale=-2:'min(1350,ih)':flags=lanczos"
        : "scale='min(1920,iw)':-2:flags=lanczos",
      '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0',
      '-deadline', 'good', '-cpu-used', '3', '-row-mt', '1', '-pix_fmt', 'yuv420p',
      file])
  }
  const before = (await stat(srcFile)).size, after = (await stat(file)).size
  totalBefore += before; totalAfter += after
  console.log(`  video  ${base.padEnd(42)} ${mb(before).padStart(9)}` +
    (p.optimise ? ` → ${mb(after)}` : '  (as-is)'))
  if (DRY) return null
  const posterFile = path.join(tmp, `${p.slug}-${base}-poster.png`)
  await ffmpeg(['-y', '-ss', '0.1', '-i', file, '-frames:v', '1', posterFile])
  const v = await client.assets.upload('file', await readFile(file), {
    filename: base + '.webm', contentType: 'video/webm',
  })
  return {
    _type: 'mediaItem', _key: key, mediaType: 'video', alt: `${p.title} — ${base}`,
    video: {_type: 'file', asset: {_type: 'reference', _ref: v._id}},
    poster: await uploadImage(posterFile, base + '-poster.png'),
  }
}

async function imageItem(p, rel, key) {
  const file = path.join(SRC, p.dir, 'presentation', rel)
  const base = path.basename(rel, path.extname(rel))
  console.log(`  image  ${base.padEnd(42)} ${mb((await stat(file)).size).padStart(9)}`)
  if (DRY) return null
  return {
    _type: 'mediaItem', _key: key, mediaType: 'image', alt: `${p.title} — ${base}`,
    image: await uploadImage(file, path.basename(rel)),
  }
}

for (const p of PROJECTS) {
  console.log(`\n${p.title}`)
  const content = []
  for (const [i, rel] of p.order.entries()) {
    const key = `m${String(i).padStart(2, '0')}`
    const item = rel.endsWith('.webm') ? await videoItem(p, rel, key) : await imageItem(p, rel, key)
    if (item) content.push(item)
  }
  if (DRY) continue
  await client.createOrReplace({
    _id: `work-${p.slug}`,
    _type: 'project',
    title: p.title,
    slug: {_type: 'slug', current: p.slug},
    year: p.year,
    role: p.role,
    client: p.client,
    tags: p.tags,
    displayOrder: p.displayOrder,
    thumbnail: {...content[0], _key: 'thumb'},
    content,
  })
  console.log(`  → wrote work-${p.slug} (${content.length} media)`)
}
await rm(tmp, {recursive: true, force: true})
console.log(`\nVideos: ${mb(totalBefore)} → ${mb(totalAfter)}`)

if (!DRY) {
  const check = await client.fetch(`*[_type == "project"] | order(displayOrder asc){
    title, "media": count(content), "videos": count(content[mediaType == "video"]),
    "posters": count(content[defined(poster.asset)]), "thumb": defined(thumbnail)
  }`)
  console.log('\nWork now holds:')
  for (const r of check) {
    console.log(`  ${r.title.padEnd(16)} media ${r.media ?? 0}  videos ${r.videos ?? 0}  posters ${r.posters ?? 0}  thumb ${r.thumb}`)
  }
}
