/**
 * compress.mjs — Re-encode project videos to web-friendly sizes.
 *
 * Walks ../img, finds every .mp4/.MP4/.mov/.webm, and writes a compressed
 * .webm (VP9) + a compressed .mp4 (H.264) into ../img-compressed, mirroring
 * the folder structure. Originals are never touched.
 *
 *   npm run compress
 *
 * Review the output, then point migrate.mjs at img-compressed.
 */
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {readdir, mkdir, stat, access} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import ffmpegPath from 'ffmpeg-static'

const run = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(__dirname, '../img')
const OUT = path.resolve(__dirname, '../img-compressed')

const VIDEO_RE = /\.(mp4|mov|webm|m4v)$/i

async function walk(dir) {
  const entries = await readdir(dir, {withFileTypes: true})
  const files = []
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) files.push(...(await walk(full)))
    else if (VIDEO_RE.test(e.name)) files.push(full)
  }
  return files
}

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1)

// Cap width at 1600px (only downscale) and force even dimensions —
// libx264 rejects odd dimensions, and some sources (e.g. 607px ProRes) are odd.
// Even width via 2*trunc(.../2); height -2 keeps it even and proportional.
const VF = "scale='2*trunc(min(1600,iw)/2)':-2"

const exists = (p) => access(p).then(() => true).catch(() => false)

async function encodeWebm(input, output) {
  // VP9, CRF 33 is a good quality/size balance for web loops. Strip audio
  // (these are muted loops).
  await run(ffmpegPath, [
    '-y', '-i', input,
    '-vf', VF,
    '-c:v', 'libvpx-vp9', '-crf', '33', '-b:v', '0',
    '-row-mt', '1', '-an',
    output,
  ])
}

async function encodeMp4(input, output) {
  await run(ffmpegPath, [
    '-y', '-i', input,
    '-vf', VF,
    '-c:v', 'libx264', '-crf', '24', '-preset', 'medium',
    '-movflags', '+faststart', '-pix_fmt', 'yuv420p', '-an',
    output,
  ])
}

async function main() {
  const files = await walk(SRC)
  if (!files.length) {
    console.log('No videos found under', SRC)
    return
  }
  console.log(`Found ${files.length} video(s). Encoding → ${OUT}\n`)

  let totalIn = 0
  let totalOut = 0
  const failed = []

  for (const input of files) {
    const rel = path.relative(SRC, input)
    const base = rel.replace(VIDEO_RE, '')
    const webmOut = path.join(OUT, base + '.webm')
    const mp4Out = path.join(OUT, base + '.mp4')
    await mkdir(path.dirname(webmOut), {recursive: true})

    const inSize = (await stat(input)).size
    totalIn += inSize

    // Skip if both outputs already exist (incremental re-runs).
    if ((await exists(webmOut)) && (await exists(mp4Out))) {
      const webmSize = (await stat(webmOut)).size
      totalOut += webmSize
      console.log(`• ${rel}  — already done, skipping`)
      continue
    }

    process.stdout.write(`• ${rel}  (${mb(inSize)} MB) → `)
    try {
      await encodeWebm(input, webmOut)
      await encodeMp4(input, mp4Out)
      const webmSize = (await stat(webmOut)).size
      const mp4Size = (await stat(mp4Out)).size
      totalOut += webmSize
      console.log(`webm ${mb(webmSize)} MB / mp4 ${mb(mp4Size)} MB`)
    } catch (err) {
      console.log('FAILED')
      failed.push({rel, message: String(err.message || err).split('\n')[0]})
    }
  }

  console.log(
    `\nDone. Originals: ${mb(totalIn)} MB → webm total: ${mb(totalOut)} MB ` +
      `(${(100 - (totalOut / totalIn) * 100).toFixed(0)}% smaller).`,
  )
  if (failed.length) {
    console.log(`\n${failed.length} file(s) failed:`)
    for (const f of failed) console.log(`  ✗ ${f.rel} — ${f.message}`)
  }
  console.log('Images were left untouched — Sanity optimises those on its CDN.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
