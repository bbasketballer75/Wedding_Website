/**
 * Bundles frozen legacy modules so a plain-Node script can import their values.
 *
 * The legacy app is TypeScript with a `@` -> `src` path alias and modules that
 * read `import.meta.env` (e.g. src/utils/media.ts). Node can strip types, but it
 * cannot resolve the alias or evaluate `import.meta.env`, so workbench scripts
 * that need *values* (never behavior) go through esbuild: the pseudo-entry is
 * bundled to a temp ESM file with the alias mapped and every `import.meta.env`
 * key substituted to a deterministic production-like value, then imported.
 *
 * `source` is TypeScript/JavaScript; `resolveDir` anchors extensionless relative
 * imports (e.g. tests/e2e/support/publicSite.ts imports './mockData').
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { repoPath } from '../lib/paths.mjs'

/**
 * Deterministic stand-in for Vite's env. Values are empty/false on purpose: the
 * extracted contracts must not depend on a developer's .env file.
 */
export const EMPTY_ENV_DEFINES = {
  'import.meta.env.VITE_MEDIA_BASE_URL': '""',
  'import.meta.env.VITE_SITE_URL': '""',
  'import.meta.env.VITE_SUPABASE_URL': '""',
  'import.meta.env.VITE_SUPABASE_ANON_KEY': '""',
  'import.meta.env.DEV': 'false',
  'import.meta.env.PROD': 'true',
}

/**
 * Bundle `source` and import the resulting ESM module.
 *
 * @param {string} source TypeScript/JavaScript module source.
 * @param {{ resolveDir?: string, sourcefile?: string, external?: string[] }} [options]
 * @returns {Promise<Record<string, unknown>>} the bundle's namespace object
 */
export async function importBundledModule(source, options = {}) {
  const { resolveDir = repoPath(), sourcefile = 'workbench-entry.ts', external = [] } = options

  const bundle = await build({
    stdin: { contents: source, resolveDir, loader: 'ts', sourcefile },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    alias: { '@': repoPath('src') },
    define: EMPTY_ENV_DEFINES,
    external,
    logLevel: 'silent',
  })

  const directory = await mkdtemp(path.join(tmpdir(), 'porada-legacy-'))
  const bundlePath = path.join(directory, 'legacy-bundle.mjs')

  try {
    await writeFile(bundlePath, bundle.outputFiles[0].text, 'utf8')
    return await import(pathToFileURL(bundlePath).href)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
