/**
 * Stack-neutral static SPA server for the parity harness.
 *
 * The frozen legacy oracle and the future rebuild are both served as plain
 * static production builds with an index.html fallback. The Lead owns the
 * canonical legacy server; this module exists so the rebuild side (and local
 * harness tests) can be served without touching vite preview or fixed ports.
 *
 * Usage:
 *   node tools/parity/serve.mjs [--dir <build-dir>] [--port 4175] [--host 127.0.0.1]
 *
 * Defaults: --dir dist, --port 4175, --host 127.0.0.1. Ports 5173/4173/4174 are
 * owned by the Lead; do not point this at them without asking.
 */
import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROOT, HarnessError, log } from './util.mjs'

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
  '.wav': 'audio/wav',
  '.vtt': 'text/vtt',
  '.webp.json': 'application/json',
}

function contentType(file) {
  return MIME_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
}

async function fileIfReadable(file) {
  try {
    const stat = await fs.stat(file)
    if (!stat.isFile()) return null
    return stat
  } catch {
    return null
  }
}

/**
 * Extensions eligible for `--fallback-dir`. Deliberately media/font-only:
 * documents (.html), scripts (.js/.mjs) and styles (.css) are NEVER served from
 * the fallback tree, so a fallback cannot mask a missing app shell or script.
 */
const FALLBACK_EXTENSIONS = new Set([
  '.webp',
  '.png',
  '.jpg',
  '.jpeg',
  '.avif',
  '.gif',
  '.svg',
  '.ico',
  '.mp4',
  '.webm',
  '.ogv',
  '.mp3',
  '.m4a',
  '.wav',
  '.ogg',
  '.aac',
  '.vtt',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
])

function isFallbackEligible(requestPath) {
  const extension = path.extname(requestPath.split('?')[0]).toLowerCase()
  return FALLBACK_EXTENSIONS.has(extension)
}

function safeResolve(rootDir, requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0].split('#')[0])
  const resolved = path.resolve(rootDir, `.${path.posix.normalize(decoded)}`)
  if (!resolved.startsWith(path.resolve(rootDir))) return null
  return resolved
}

/**
 * Create (but do not start listening on) a static SPA server.
 *
 * `fallbackDir` (CLI `--fallback-dir`) serves media-looking files from a second
 * directory when the build itself has none. This exists because the frozen
 * media contract is byte-identical across legacy/rebuild: during the rebuild
 * window the greenfield `dist/` may not ship `public/` assets yet, so parity
 * runs point the fallback at the frozen legacy `public/` tree until Wave 8's
 * media pipeline lands. Documents/scripts/styles are never served from it.
 *
 * @returns {{server: import('node:http').Server, url: string, port: number, close: () => Promise<void>}}
 */
export async function createStaticServer({
  dir,
  fallbackDir = null,
  host = '127.0.0.1',
  port = 4175,
  quiet = false,
} = {}) {
  const rootDir = path.resolve(dir ?? path.join(ROOT, 'dist'))
  try {
    const stat = await fs.stat(rootDir)
    if (!stat.isDirectory()) throw new Error('not a directory')
  } catch (error) {
    throw new HarnessError(`serve: build directory not found: ${rootDir} (${error.message})`)
  }
  const fallbackRoot = fallbackDir ? path.resolve(fallbackDir) : null
  if (fallbackRoot) {
    try {
      const stat = await fs.stat(fallbackRoot)
      if (!stat.isDirectory()) throw new Error('not a directory')
    } catch (error) {
      throw new HarnessError(`serve: --fallback-dir not found: ${fallbackRoot} (${error.message})`)
    }
  }
  const server = http.createServer(async (request, response) => {
    try {
      const target = safeResolve(rootDir, request.url ?? '/')
      if (!target) {
        response.writeHead(403).end('Forbidden')
        return
      }
      let file = target
      let stat = await fileIfReadable(file)
      if (!stat && fallbackRoot && isFallbackEligible(request.url ?? '/')) {
        // Media-only fallback: serve the frozen media byte-for-byte when the
        // rebuild build ships none yet. Never applies to html/js/css.
        const fallbackTarget = safeResolve(fallbackRoot, request.url ?? '/')
        if (fallbackTarget) {
          const fallbackStat = await fileIfReadable(fallbackTarget)
          if (fallbackStat) {
            file = fallbackTarget
            stat = fallbackStat
            if (!quiet) log.step(`${request.method} ${request.url} → 200 (fallback media)`)
          }
        }
      }
      if (!stat) {
        // Requested asset with an extension that is not HTML → 404, never the
        // SPA shell (a missing .js/.css/image must stay visible as missing).
        const requestedExtension = path.extname((request.url ?? '/').split('?')[0]).toLowerCase()
        if (requestedExtension && requestedExtension !== '.html') {
          response.writeHead(404).end('Not found')
          return
        }
        // Directory request or extensionless SPA route → index.html fallback.
        const index = path.join(rootDir, 'index.html')
        const indexStat = await fileIfReadable(index)
        if (!indexStat) {
          response.writeHead(404).end('Not found')
          return
        }
        file = index
      }
      const body = await fs.readFile(file)
      const headers = {
        'content-type': contentType(file),
        'content-length': body.length,
        'cache-control': 'no-store',
      }
      if (request.method === 'HEAD') {
        response.writeHead(200, headers).end()
        return
      }
      response.writeHead(200, headers).end(body)
      if (!quiet) log.step(`${request.method} ${request.url} → 200`)
    } catch (error) {
      log.error(`serve: ${request.method} ${request.url} failed: ${error.message}`)
      response.writeHead(500).end('Internal server error')
    }
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => resolve())
  })
  const address = server.address()
  const actualPort = typeof address === 'object' && address ? address.port : port
  return {
    server,
    port: actualPort,
    url: `http://${host}:${actualPort}`,
    close: () =>
      new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve()))),
  }
}

function parseArgs(argv) {
  const options = {
    dir: path.join(ROOT, 'dist'),
    fallbackDir: null,
    host: '127.0.0.1',
    port: 4175,
    quiet: false,
    help: false,
  }
  const args = [...argv]
  const readValue = flag => {
    const value = args.shift()
    if (value === undefined) throw new HarnessError(`${flag} needs a value`)
    return value
  }
  while (args.length > 0) {
    const arg = args.shift()
    switch (arg) {
      case '--dir':
        options.dir = path.resolve(readValue(arg))
        break
      case '--fallback-dir':
        options.fallbackDir = path.resolve(readValue(arg))
        break
      case '--port': {
        const port = Number(readValue(arg))
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          throw new HarnessError('--port must be an integer between 1 and 65535')
        }
        options.port = port
        break
      }
      case '--host':
        options.host = readValue(arg)
        break
      case '--quiet':
        options.quiet = true
        break
      case '--help':
      case '-h':
        options.help = true
        break
      default:
        throw new HarnessError(`unknown argument "${arg}"`)
    }
  }
  return options
}

export async function main(argv) {
  try {
    const options = parseArgs(argv)
    if (options.help) {
      process.stdout.write(
        'Usage: node tools/parity/serve.mjs [--dir <build-dir>] [--fallback-dir <media-dir>] [--port 4175] [--host 127.0.0.1] [--quiet]\n' +
          '  --dir           build directory to serve (default: dist)\n' +
          '  --fallback-dir  media/font-only fallback tree for missing assets (e.g. the frozen public/ tree)\n' +
          '  --port          listen port (default: 4175; Lead-owned ports 4174/4175 must be confirmed first)\n'
      )
      return 0
    }
    const { url, close } = await createStaticServer(options)
    log.out(
      `Accepting connections at ${url} (serving ${options.dir}` +
        `${options.fallbackDir ? `, media fallback ${options.fallbackDir}` : ''})`
    )
    const shutdown = async () => {
      await close().catch(() => {})
      process.exit(0)
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
    return null // keep running
  } catch (error) {
    log.error(error.message)
    return 2
  }
}

const invokedDirectly = (() => {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return path.resolve(entry) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
})()

if (invokedDirectly) {
  const code = await main(process.argv.slice(2))
  if (code !== null) process.exitCode = code
}
