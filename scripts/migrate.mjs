/**
 * migrate.mjs — One-time import of existing projects into Sanity.
 *
 * Reads ../projects.js, uploads each project's media (videos from
 * ../img-compressed, images from ../img) to Sanity, and creates a `project`
 * document per entry plus a `siteSettings` singleton.
 *
 * Setup (in scripts/.env — git-ignored):
 *   SANITY_PROJECT_ID=xxxxxxxx
 *   SANITY_DATASET=production
 *   SANITY_TOKEN=<an Editor token from sanity.io/manage → API → Tokens>
 *
 * Then:  npm run migrate
 *
 * Safe to re-run: documents use deterministic ids (createOrReplace) and
 * Sanity de-duplicates identical asset uploads by content hash.
 */
import {createClient} from '@sanity/client'
import {readFile, access} from 'node:fs/promises'
import {createReadStream} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ── Load scripts/.env (minimal parser, no dependency) ──────────────
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

const exists = (p) => access(p).then(() => true).catch(() => false)

// ── Resolve a media src from projects.js to a local file path ──────
function resolveLocalPath(src, type) {
  if (type === 'video') {
    // originals live in img/, compressed H.264 mp4 in img-compressed/
    // (mp4 came out smaller than webm here and plays everywhere incl. Safari/iOS)
    const rel = src.replace(/^img\//, '').replace(/\.[^.]+$/, '.mp4')
    return path.join(ROOT, 'img-compressed', rel)
  }
  return path.join(ROOT, src) // images: use original
}

async function main() {
  await loadEnv()
  const projectId = process.env.SANITY_PROJECT_ID || process.env.SANITY_STUDIO_PROJECT_ID
  const dataset = process.env.SANITY_DATASET || 'production'
  const token = process.env.SANITY_TOKEN

  if (!projectId || !token) {
    console.error(
      'Missing config. Create scripts/.env with SANITY_PROJECT_ID, SANITY_DATASET, SANITY_TOKEN.',
    )
    process.exit(1)
  }

  const client = createClient({projectId, dataset, token, apiVersion: '2024-01-01', useCdn: false})

  // ── Load projects.js (plain script, not a module) ───────────────
  const projectsSrc = await readFile(path.join(ROOT, 'projects.js'), 'utf8')
  const projects = new Function(projectsSrc + '\nreturn projects;')()

  // ── Upload helper with per-run cache ────────────────────────────
  const assetCache = new Map()
  async function uploadAsset(src, type) {
    if (assetCache.has(src)) return assetCache.get(src)
    const localPath = resolveLocalPath(src, type)
    if (!(await exists(localPath))) {
      console.warn(`  ! missing ${type} file: ${path.relative(ROOT, localPath)} — skipping`)
      return null
    }
    const kind = type === 'video' ? 'file' : 'image'
    const filename = path.basename(localPath)
    process.stdout.write(`  ↑ ${path.relative(ROOT, localPath)} … `)
    const asset = await client.assets.upload(kind, createReadStream(localPath), {filename})
    console.log('ok')
    assetCache.set(src, {kind, id: asset._id})
    return {kind, id: asset._id}
  }

  function mediaItem(asset, alt, mediaType, key) {
    if (!asset) return null
    const base = {_type: 'mediaItem', _key: key, mediaType, alt: alt || ''}
    if (mediaType === 'video') {
      return {...base, video: {_type: 'file', asset: {_type: 'reference', _ref: asset.id}}}
    }
    return {...base, image: {_type: 'image', asset: {_type: 'reference', _ref: asset.id}}}
  }

  // ── Build + upsert each project ─────────────────────────────────
  const keys = Object.keys(projects)
  console.log(`Importing ${keys.length} projects…\n`)
  let order = 0

  for (const key of keys) {
    const p = projects[key]
    console.log(`• ${p.title} (${key})`)

    const thumbAsset = await uploadAsset(p.thumbnail, p.thumbnailType)
    const thumbnail = mediaItem(thumbAsset, p.title, p.thumbnailType || 'image', 'thumb')

    const content = []
    let i = 0
    for (const block of p.content || []) {
      const k = `c${i++}`
      if (block.type === 'text') {
        content.push({_type: 'textBlock', _key: k, body: block.body})
      } else {
        const asset = await uploadAsset(block.src, block.type)
        const item = mediaItem(asset, block.alt, block.type, k)
        if (item) content.push(item)
      }
    }

    const doc = {
      _id: `project-${key}`,
      _type: 'project',
      title: p.title.trim(),
      slug: {_type: 'slug', current: key},
      year: parseInt(p.year, 10) || undefined,
      role: p.role || '',
      client: p.client || '',
      tags: p.tags || [],
      displayOrder: order++,
      ...(thumbnail ? {thumbnail} : {}),
      content,
    }

    await client.createOrReplace(doc)
    console.log('  ✓ saved\n')
  }

  // ── Seed site settings (home page copy) ─────────────────────────
  await client.createOrReplace({
    _id: 'siteSettings',
    _type: 'siteSettings',
    name: 'sharang sharma',
    location: 'New Delhi, IN',
    introParagraph:
      "I'm a graphic designer and creative coder working at the intersection of  identities  & visual systems. My practice focuses on the generative nature of software as a tool to create visual systems.",
    currentPrefix: 'Currently, I work at',
    currentLinkLabel: 'Public Knowledge Studio',
    currentLinkUrl: 'https://publicknowledge.co/',
    currentSuffix: ', where I work with brand identities & flexible visual systems,',
    navLinks: [
      {_key: 'n1', label: 'Home', href: 'index.html'},
      {_key: 'n2', label: 'About', href: 'about.html'},
      {_key: 'n3', label: 'Projects', href: 'index.html'},
      {_key: 'n4', label: 'Tools', href: '#'},
      {_key: 'n5', label: 'Contact', href: 'mailto:hello@example.com'},
    ],
    socialLinks: [
      {_key: 's1', label: 'Instagram', href: 'https://instagram.com/'},
      {_key: 's2', label: 'LinkdIn', href: 'https://linkedin.com/'},
      {_key: 's3', label: 'Email', href: 'mailto:hello@example.com'},
    ],
  })
  console.log('• Site settings saved')
  console.log('\nDone. Open the Studio to review and tidy any content.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
