/**
 * add-posters.mjs — give every test.fun video a poster still.
 *
 * The grid shows videos paused (greyscale, first frame) until their group is
 * hovered, so a still looks identical at rest — and it's what the preloader
 * waits for instead of the whole video. Each poster is the frame at 0.1s of
 * the SAME WebM that plays, so poster and playback line up with no jump.
 * Uploaded as PNG; Sanity's image CDN serves it to the site as AVIF / WebP.
 *
 * Skips media that already has a poster (so a hand-picked one in Studio is
 * never overwritten). --force regenerates them all.
 *
 *   cd scripts && node add-posters.mjs [--force]
 */
import {createClient} from '@sanity/client'
import ffmpegPath from 'ffmpeg-static'
import {spawn} from 'node:child_process'
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FORCE = process.argv.includes('--force')

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
  dataset: 'personal_projects',
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

const tmp = await mkdtemp(path.join(os.tmpdir(), 'tf-posters-'))
const docs = await client.fetch(`*[_type == "experiment"]{
  _id, title,
  "videos": media[mediaType == "video"]{
    _key, "hasPoster": defined(poster.asset),
    "url": video.asset->url, "name": video.asset->originalFilename
  }
}`)

let made = 0, skipped = 0
for (const d of docs) {
  const patch = client.patch(d._id)
  let dirty = false
  for (const v of d.videos || []) {
    if (!v.url) continue
    if (v.hasPoster && !FORCE) { skipped++; continue }
    const input = path.join(tmp, v._key + '.webm')
    const res = await fetch(v.url)
    if (!res.ok) throw new Error(`download failed ${res.status}: ${v.url}`)
    await writeFile(input, Buffer.from(await res.arrayBuffer()))
    const output = path.join(tmp, v._key + '.png')
    await ffmpeg(['-y', '-ss', '0.1', '-i', input, '-frames:v', '1', output])
    const asset = await client.assets.upload('image', await readFile(output), {
      filename: (v.name || v._key).replace(/\.[^.]+$/, '') + '-poster.png',
      contentType: 'image/png',
    })
    patch.set({[`media[_key=="${v._key}"].poster`]: {
      _type: 'image', asset: {_type: 'reference', _ref: asset._id},
    }})
    dirty = true
    made++
    console.log(`  poster  ${d.title}  (${v.name})`)
  }
  if (dirty) await patch.commit()
}
await rm(tmp, {recursive: true, force: true})

const check = await client.fetch(`{
  "videos": count(*[_type == "experiment"].media[mediaType == "video"]),
  "withPoster": count(*[_type == "experiment"].media[mediaType == "video" && defined(poster.asset)])
}`)
console.log(`\n${made} posters made, ${skipped} kept. ` +
  `${check.withPoster}/${check.videos} videos now have a poster.`)
