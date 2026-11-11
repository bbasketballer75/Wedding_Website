/**
 * Minimal static SPA server with production-like response compression.
 *
 * Why not use `vite preview` (the Lead's :4175) for runtime measurement? Because
 * a preview server serves the raw emitted files: on the emulated slow-4G profile a
 * 1.05 MB entry script arrives uncompressed (~6.5 s), which measures the missing
 * compression of the local server, not the app. Deployed Netlify responds with
 * gzip/brotli, so `run.mjs --serve-dist rebuild/dist` starts this server and
 * measures the build the way a static host would deliver it. Measuring an
 * already-running URL (`--url`) remains supported and is reported as
 * "as-served-by-target" compression so the two modes are never confused.
 */
import { readdirSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.vtt': 'text/vtt',
}

const COMPRESSIBLE = new Set([
  '.html',
  '.js',
  '.mjs',
  '.css',
  '.json',
  '.webmanifest',
  '.txt',
  '.xml',
  '.svg',
])

function contentTypeFor(file) {
  return MIME_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
}

/** Decode the request path into a normalized, root-relative key (no traversal). */
function requestKey(requestPath) {
  let decoded
  try {
    decoded = decodeURIComponent((requestPath ?? '/').split('?')[0].split('#')[0])
  } catch {
    return null
  }
  if (decoded.includes('\0')) return null
  return path.posix.normalize(`/${decoded}`).replace(/^\/+/, '')
}

function accepts(header, encoding) {
  return (header ?? '')
    .toLowerCase()
    .split(',')
    .some(token => token.trim().startsWith(encoding))
}

/**
 * Start the static server.
 * @param {{dir: string, host?: string, port?: number, compression?: 'gzip'|'brotli'|'none'}} options
 * @returns {Promise<{url: string, port: number, close: () => Promise<void>}>}
 */
export async function startStaticServer({
  dir,
  host = '127.0.0.1',
  port = 0,
  compression = 'gzip',
}) {
  const rootDir = path.resolve(dir)
  const rootStat = await stat(rootDir)
  if (!rootStat.isDirectory()) throw new Error(`not a directory: ${rootDir}`)

  // Pre-index files so request paths are only ever used as map keys, never as
  // filesystem paths (prevents path traversal and satisfies CodeQL js/path-injection).
  const fileIndex = new Map()
  for (const entry of readdirSync(rootDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue
    const parent = entry.parentPath ?? entry.path
    const relative = path.relative(rootDir, path.join(parent, entry.name))
    fileIndex.set(relative.split(path.sep).join('/'), path.join(rootDir, relative))
  }

  function resolveRequestPath(requestPath) {
    const key = requestKey(requestPath)
    if (key === null) return null
    if (key === '') return fileIndex.get('index.html') ?? null
    const direct = fileIndex.get(key)
    if (direct) return direct
    const directoryIndex = fileIndex.get(`${key.replace(/\/$/, '')}/index.html`)
    if (directoryIndex) return directoryIndex
    // SPA fallback: serving the app shell for client-side routes (as the static
    // host does via _redirects).
    return fileIndex.get('index.html') ?? null
  }

  const cache = new Map()

  async function load(file) {
    if (cache.has(file)) return cache.get(file)
    const body = await readFile(file)
    const extension = path.extname(file).toLowerCase()
    const compressible = COMPRESSIBLE.has(extension)
    const entry = {
      body,
      contentType: contentTypeFor(file),
      gzip: compressible ? gzipSync(body, { level: 9 }) : null,
      brotli: compressible ? brotliCompressSync(body) : null,
    }
    cache.set(file, entry)
    return entry
  }

  const server = createServer(async (request, response) => {
    try {
      const file = resolveRequestPath(request.url ?? '/')
      if (!file) {
        response.writeHead(404).end('Not found')
        return
      }
      const entry = await load(file)
      const acceptEncoding = request.headers['accept-encoding']
      let body = entry.body
      let encoding = null
      if (compression === 'brotli' && entry.brotli && accepts(acceptEncoding, 'br')) {
        body = entry.brotli
        encoding = 'br'
      } else if (compression !== 'none' && entry.gzip && accepts(acceptEncoding, 'gzip')) {
        body = entry.gzip
        encoding = 'gzip'
      }
      const headers = {
        'content-type': entry.contentType,
        'content-length': body.byteLength,
        'cache-control': 'no-store',
        vary: 'accept-encoding',
      }
      if (encoding) headers['content-encoding'] = encoding
      if (request.method === 'HEAD') {
        response.writeHead(200, headers).end()
        return
      }
      response.writeHead(200, headers).end(body)
    } catch (error) {
      response.writeHead(500).end(`Internal server error: ${error.message}`)
    }
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => resolve())
  })
  const address = server.address()
  const actualPort = typeof address === 'object' && address ? address.port : port
  return {
    url: `http://${host}:${actualPort}`,
    port: actualPort,
    close: () =>
      new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve()))),
  }
}
