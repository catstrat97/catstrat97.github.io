/**
 * move-to-personal.mjs — give test.fun its own CMS, with light tiles.
 *
 * Moves the personal experiments out of the Work dataset (`production`) into
 * their own dataset (`personal_projects`), media library included:
 *
 *   1. COPY  — every experiment is re-created in `personal_projects`.
 *              · Videos are TRANSCODED on the way: a small VP9 WebM, 240px
 *                tall (tiles are 66px, so this covers 3.6× density), no
 *                audio, ≤30fps. The full-size originals are what made the
 *                preloader crawl — 123 MB for 15 thumbnails.
 *              · Images are copied as-is: Sanity's CDN already serves them
 *                as AVIF/WebP at tile size, so the original stays the master.
 *   2. CHECK — the copy is re-read and counted; any shortfall aborts.
 *   3. CLEAN — only with --cleanup, and only after the check passes: the
 *              personal docs are backed up to scripts/backups/ as JSON, then
 *              removed from `production`, leaving Work purely professional.
 *              Removed: the `experiment-*` docs, and the `project-*` docs the
 *              June migration made from projects.js. Client work (Sycamore,
 *              Absentia Labs — Studio-made ids) is never touched. Files stay
 *              in Work's media library, and in ../img, untouched.
 *
 * Safe to re-run: deterministic ids + createOrReplace; Sanity de-duplicates
 * identical uploads by content hash.
 *
 *   cd scripts && node move-to-personal.mjs            # copy + check
 *   cd scripts && node move-to-personal.mjs --cleanup  # copy + check + clean
 */
import {createClient} from '@sanity/client'
import ffmpegPath from 'ffmpeg-static'
import {spawn} from 'node:child_process'
import {readFile, writeFile, mkdir, mkdtemp, rm, stat} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLEANUP = process.argv.includes('--cleanup')
const TARGET = 'personal_projects'

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
const projectId = process.env.SANITY_PROJECT_ID || process.env.SANITY_STUDIO_PROJECT_ID
const token = process.env.SANITY_TOKEN
if (!projectId || !token) {
  console.error('Missing config. Create scripts/.env with SANITY_PROJECT_ID, SANITY_TOKEN.')
  process.exit(1)
}
const opts = {projectId, token, apiVersion: '2024-01-01', useCdn: false}
const work = createClient({...opts, dataset: 'production'})
const personal = createClient({...opts, dataset: TARGET})

const tmp = await mkdtemp(path.join(os.tmpdir(), 'tf-move-'))
const mb = (n) => (n / 1048576).toFixed(2) + ' MB'

function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args, {stdio: ['ignore', 'ignore', 'pipe']})
    let err = ''
    p.stderr.on('data', (d) => (err = (err + d).slice(-2000)))
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg failed:\n' + err))))
  })
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed ${res.status}: ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(dest, buf)
  return buf
}

// ── 1. COPY ─────────────────────────────────────────────────────────
const src = await work.fetch(`*[_type == "experiment"]{
  ..., "media": media[]{
    ...,
    "img": image.asset->{_id, url, originalFilename, mimeType},
    "vid": video.asset->{_id, url, originalFilename, mimeType, size}
  }
}`)
if (!src.length) {
  console.log('No experiments in production — nothing to move.')
  process.exit(0)
}

const done = new Map() // source asset id → new asset id
let before = 0, after = 0

async function copyImage(a) {
  if (done.has(a._id)) return done.get(a._id)
  const file = path.join(tmp, a._id)
  const buf = await download(a.url, file)
  const up = await personal.assets.upload('image', buf, {
    filename: a.originalFilename || path.basename(new URL(a.url).pathname),
    contentType: a.mimeType,
  })
  done.set(a._id, up._id)
  console.log(`  image  ${(a.originalFilename || '').padEnd(30)} copied`)
  return up._id
}

async function transcodeVideo(a) {
  if (done.has(a._id)) return done.get(a._id)
  const input = path.join(tmp, a._id + path.extname(new URL(a.url).pathname))
  await download(a.url, input)
  const output = path.join(tmp, a._id + '.webm')
  await ffmpeg([
    '-y', '-i', input,
    '-an',                                        // tiles are always muted
    '-vf', "scale=-2:'min(240,ih)':flags=lanczos",
    '-fpsmax', '30',
    '-c:v', 'libvpx-vp9', '-crf', '36', '-b:v', '0',
    '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1',
    '-pix_fmt', 'yuv420p',
    output,
  ])
  const {size} = await stat(output)
  before += a.size || 0; after += size
  const base = (a.originalFilename || a._id).replace(/\.[^.]+$/, '')
  const up = await personal.assets.upload('file', await readFile(output), {
    filename: base + '.webm',
    contentType: 'video/webm',
  })
  done.set(a._id, up._id)
  console.log(`  video  ${(a.originalFilename || '').padEnd(30)} ${mb(a.size || 0).padStart(9)} → ${mb(size)} webm`)
  return up._id
}

console.log(`Moving ${src.length} experiments into ${TARGET}…`)
const tx = personal.transaction()
for (const d of src) {
  const media = []
  for (const m of d.media || []) {
    const {img, vid, ...item} = m
    if (img) item.image = {...item.image, asset: {_type: 'reference', _ref: await copyImage(img)}}
    if (vid) item.video = {...item.video, asset: {_type: 'reference', _ref: await transcodeVideo(vid)}}
    media.push(item)
  }
  const {_rev, _createdAt, _updatedAt, series, ...doc} = d
  tx.createOrReplace({...doc, media}) // no series yet — all standalone
}
await tx.commit()
await rm(tmp, {recursive: true, force: true})
console.log(`\nVideos: ${mb(before)} → ${mb(after)}`)

// ── 2. CHECK ────────────────────────────────────────────────────────
const want = {docs: src.length, media: src.reduce((n, d) => n + (d.media || []).length, 0)}
const got = await personal.fetch(`{
  "docs": count(*[_type == "experiment"]),
  "media": count(*[_type == "experiment"].media[]),
  "broken": count(*[_type == "experiment"].media[
    !defined(image.asset->_id) && !defined(video.asset->_id)
  ]),
  "nonWebm": count(*[_type == "experiment"].media[
    mediaType == "video" && video.asset->mimeType != "video/webm"
  ])
}`)
console.log(`Check — ${TARGET} has ${got.docs}/${want.docs} experiments, ` +
  `${got.media}/${want.media} media, ${got.broken} broken refs, ${got.nonWebm} non-WebM videos.`)
if (got.docs < want.docs || got.media < want.media || got.broken || got.nonWebm) {
  console.error('Copy incomplete — NOT cleaning up production.')
  process.exit(1)
}

// ── 3. CLEAN ────────────────────────────────────────────────────────
if (!CLEANUP) {
  console.log('\nCopy verified. Re-run with --cleanup to remove the personal docs from Work.')
  process.exit(0)
}
const toRemove = await work.fetch(`*[
  _type == "experiment" ||
  (_type == "project" && string::startsWith(_id, "project-")
    && !(lower(title) in ["sycamore", "absentia labs"]))
]`)
await mkdir(path.join(__dirname, 'backups'), {recursive: true})
const file = path.join(__dirname, 'backups',
  `work-personal-docs-${new Date().toISOString().slice(0, 10)}.json`)
await writeFile(file, JSON.stringify(toRemove, null, 2))
console.log(`\nBacked up ${toRemove.length} docs → scripts/backups/${path.basename(file)}`)

const del = work.transaction()
for (const d of toRemove) del.delete(d._id)
await del.commit()
const left = await work.fetch(`*[_type == "project"]{title}`)
console.log(`Removed ${toRemove.length} docs. Work now holds: ${left.map((p) => p.title).join(', ')}`)
