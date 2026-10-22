/**
 * Ensures the published tree can never contain source maps, including maps
 * written by plugins that run after the Sentry upload hook (vite-plugin-pwa
 * emits `sw.js.map`).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { pruneSourcemaps } from '../../scripts/prune-sourcemaps.js'

let tmpRoot: string | null = null

function makeDist(layout: Record<string, string>): string {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sentry-maps-'))
  for (const [relative, content] of Object.entries(layout)) {
    const file = path.join(tmpRoot, relative)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
  }
  return tmpRoot
}

afterEach(() => {
  if (tmpRoot) {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
    tmpRoot = null
  }
})

describe('pruneSourcemaps', () => {
  it('removes nested source maps and keeps the shipped files', () => {
    const dist = makeDist({
      'index.html': '<html></html>',
      'assets/index-abc.js': 'console.log(1)',
      'assets/index-abc.js.map': '{"version":3}',
      'assets/chunk-def.js.map': '{"version":3}',
      'sw.js': 'self.addEventListener("install",()=>{})',
      'sw.js.map': '{"version":3}',
      'icons/icon-192x192.png': 'png',
    })

    const removed = pruneSourcemaps(dist)

    expect(removed).toHaveLength(3)
    expect(fs.existsSync(path.join(dist, 'assets/index-abc.js.map'))).toBe(false)
    expect(fs.existsSync(path.join(dist, 'assets/chunk-def.js.map'))).toBe(false)
    expect(fs.existsSync(path.join(dist, 'sw.js.map'))).toBe(false)
    expect(fs.existsSync(path.join(dist, 'assets/index-abc.js'))).toBe(true)
    expect(fs.existsSync(path.join(dist, 'sw.js'))).toBe(true)
    expect(fs.existsSync(path.join(dist, 'index.html'))).toBe(true)
  })

  it('is a no-op when dist does not exist', () => {
    expect(pruneSourcemaps(path.join(os.tmpdir(), 'definitely-missing-dist-dir'))).toEqual([])
  })
})
