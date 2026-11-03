/**
 * import-experiments.mjs — turn the old masonry-grid entries into test.fun
 * experiments.
 *
 * migrate.mjs already put the 26 entries from projects.js into Sanity as
 * `project` docs (ids `project-<key>`), with every file uploaded. This copies
 * each one into an `experiment` doc that points at the SAME assets — nothing
 * is uploaded again, and the `project` docs are left untouched.
 *
 * Every experiment is standalone (no series), as specified; group them later
 * by setting the Series field in Studio.
 *
 * Safe to re-run: ids are deterministic (`experiment-<key>`) and written with
 * createOrReplace. Run with --dry to print what would be written.
 *
 *   cd scripts && node import-experiments.mjs [--dry]
 */
import {createClient} from '@sanity/client'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DRY = process.argv.includes('--dry')

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
const dataset = process.env.SANITY_DATASET || 'production'
const token = process.env.SANITY_TOKEN
if (!projectId || !token) {
  console.error('Missing config. Create scripts/.env with SANITY_PROJECT_ID, SANITY_DATASET, SANITY_TOKEN.')
  process.exit(1)
}
const client = createClient({projectId, dataset, token, apiVersion: '2024-01-01', useCdn: false})

// Only the docs migrate.mjs created from projects.js (ids `project-<key>`) —
// never the client work made by hand in Studio. Sycamore and Absentia Labs
// live in the Work section, so they're excluded by title as well as by id.
const EXCLUDE_TITLES = ['sycamore', 'absentia labs']
const src = await client.fetch(
  `*[_type == "project" && string::startsWith(_id, "project-")
     && !(lower(title) in $exclude)]{
    _id, title, year, "slug": slug.current,
    "media": content[_type == "mediaItem"]
  }`,
  {exclude: EXCLUDE_TITLES}
)

const docs = src
  .filter((p) => p.media && p.media.length)
  .map((p) => {
    const key = p._id.replace(/^project-/, '')
    return {
      _id: `experiment-${key}`,
      _type: 'experiment',
      title: (p.title || key).trim(),
      slug: {_type: 'slug', current: p.slug || key},
      ...(p.year ? {year: Number(p.year)} : {}),
      // Same mediaItem objects, same asset references — a copy of the
      // pointers, not of the files.
      media: p.media.map((m, i) => ({...m, _key: m._key || `m${i}`})),
    }
  })

console.log(`${docs.length} experiments from ${src.length} migrated projects:`)
for (const d of docs) console.log(`  ${d._id.padEnd(40)} ${d.media.length} media  ${d.title}`)

if (DRY) {
  console.log('\n--dry: nothing written.')
  process.exit(0)
}
const tx = client.transaction()
for (const d of docs) tx.createOrReplace(d)
const res = await tx.commit()
console.log(`\nWrote ${res.results.length} documents.`)
