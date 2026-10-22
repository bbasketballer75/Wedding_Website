/**
 * Guards the invariant behind the Sentry source map setup: `dist` must never
 * contain `.map` files.
 *
 * Source maps are uploaded to Sentry by the build plugin (which consumes the
 * bundler's maps in memory) and must never be served publicly. Plugins that run
 * after the Sentry hook — vite-plugin-pwa generating `sw.js.map`, for example —
 * still write maps to disk, so the published tree is pruned explicitly.
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Recursively delete every `.map` file under `distDir`.
 * @param {string} distDir absolute or cwd-relative dist directory
 * @returns {string[]} paths that were removed
 */
export function pruneSourcemaps(distDir) {
  const removed = []

  if (!fs.existsSync(distDir)) {
    return removed
  }

  for (const entry of fs.readdirSync(distDir, { withFileTypes: true })) {
    const full = path.join(distDir, entry.name)

    if (entry.isDirectory()) {
      removed.push(...pruneSourcemaps(full))
      continue
    }

    if (entry.name.endsWith('.map')) {
      fs.rmSync(full)
      removed.push(full)
    }
  }

  return removed
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const distDir = path.resolve(process.cwd(), 'dist')
  const removed = pruneSourcemaps(distDir)
  console.log(
    removed.length === 0
      ? 'OK: no source maps in dist'
      : `OK: removed ${removed.length} source map file(s) from dist`
  )
}
