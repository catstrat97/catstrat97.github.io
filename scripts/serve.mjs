/* Minimal static file server for local preview. Serves the repo root. */
import {createServer} from 'node:http'
import {readFile} from 'node:fs/promises'
import {createReadStream} from 'node:fs'
import {stat} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = process.env.PORT || 8123

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
}

createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(req.url.split('?')[0])
    if (rel === '/') rel = '/index.html'
    const full = path.join(ROOT, rel)
    if (!full.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden')
      return
    }
    const info = await stat(full)
    if (info.isDirectory()) {
      res.writeHead(403).end('Directory listing disabled')
      return
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(full).toLowerCase()] || 'application/octet-stream',
      // Dev server: never let the browser cache. Without this (and with no
      // ETag/Last-Modified) Chrome caches JS/CSS heuristically and keeps
      // serving stale code on in-site navigations — edits appear to change
      // nothing no matter how many times the code is fixed.
      'Cache-Control': 'no-store',
    })
    createReadStream(full).pipe(res)
  } catch {
    res.writeHead(404, {'Content-Type': 'text/plain'}).end('Not found')
  }
}).listen(PORT, () => console.log('Serving ' + ROOT + ' on http://localhost:' + PORT))
