/**
 * Dependency inventory for the frozen legacy app.
 *
 * The question this answers is not "what is installed" (package.json says that)
 * but "which declared packages actually reach the browser bundle, which are
 * Node-only build/test tooling, and which appear to have no import site at all".
 * That distinction is what lets the rebuild shrink the dependency surface
 * deliberately instead of inheriting it.
 *
 * Evidence is collected by actually scanning the repo:
 *   - src/**             runtime source (split into src / srcTests / srcStyles)
 *   - scripts/**         Node media + release scripts
 *   - tools/**           workbench scripts
 *   - tests/**           Playwright suites
 *   - supabase/**        edge/functions + scripts
 *   - netlify/**         edge functions
 *   - root config files  vite/vitest/eslint/playwright/lighthouse/netlify/CI configs
 *
 * A package is only classified `unused` when no import site and no tool/config
 * mention exists. Known indirect usages (jsdom via vitest environment, terser
 * via `minify: 'terser'`, ...) are still detected through those config strings.
 */
import { readFile } from 'node:fs/promises'
import { builtinModules } from 'node:module'
import path from 'node:path'
import {
  CODE_EXTENSIONS,
  STYLESHEET_EXTENSIONS,
  isTestFile,
  packageNameOf,
  parseReferences,
  walkSourceFiles,
} from './routes.mjs'

const SCAN_ROOTS = [
  { root: 'scripts', bucket: 'scripts' },
  { root: 'tools', bucket: 'tools' },
  { root: 'tests', bucket: 'tests' },
  { root: 'supabase', bucket: 'supabase' },
  { root: 'netlify', bucket: 'netlify' },
]

/** Generated workbench output inside a scanned root: not legacy source. */
const EXCLUDED_SCAN_PREFIXES = ['tools/parity/output/', 'tools/extract-content/.cache/']

const CONFIG_FILES = [
  'vite.config.js',
  'vitest.config.js',
  'eslint.config.js',
  'playwright.config.ts',
  'playwright.config.visual.ts',
  'playwright.config.visual-prod.ts',
  '.lighthouserc.cjs',
  'netlify.toml',
  'tsconfig.json',
  'tsconfig.node.json',
  'index.html',
]

/** Config text that pins CLI tooling but is not an import site. */
const TEXT_FILES = [
  '.github/workflows/ci.yml',
  '.github/workflows/rebuild.yml',
  '.github/workflows/lighthouse-ci.yml',
  '.github/workflows/visual-prod.yml',
  '.husky/pre-commit',
  '.husky/pre-push',
]

const BUCKETS = [
  'src',
  'srcTests',
  'srcStyles',
  'scripts',
  'tools',
  'tests',
  'supabase',
  'netlify',
  'config',
]

/** Packages whose only src appearance is a build-time CSS @import. */
const BUILD_ONLY_CSS_PACKAGES = new Set(['tailwindcss'])

const RUNTIME_USAGE_EXCEPTIONS = {
  jsdom: 'loaded by Vitest through test.environment="jsdom" (string in vitest.config.js)',
  typescript: 'provides the tsc-test binary; no import site',
  '@typescript/native': 'npm alias for typescript@7; provides the tsc binary used by `npx tsc`',
  '@vitest/coverage-v8': 'loaded by `vitest --coverage` via provider v8; no import site',
  '@vitest/ui': 'enables `vitest --ui` through the vitest CLI',
  terser: 'selected by the literal string "minify: \'terser\'" in vite.config.js',
  tailwindcss: 'resolved by @tailwindcss/vite from the CSS @import in src/index.css',
  'vite-plugin-pwa': 'imported by vite.config.js; also provides the virtual:pwa-register module',
}

const OVERLAP_GROUPS = [
  {
    id: 'sentry-entrypoints',
    packages: ['@sentry/browser', '@sentry/react'],
    reason:
      '@sentry/react builds on @sentry/browser; two entry points for one error pipeline must be justified by bundle cost',
  },
  {
    id: 'masonry-vs-virtualization',
    packages: ['react-masonry-css', '@tanstack/react-virtual'],
    reason: 'two different grid/windowing strategies used for the same gallery surface',
  },
  {
    id: 'dual-typescript',
    packages: ['typescript', '@typescript/native'],
    reason:
      'two TypeScript compilers installed via npm aliases; the CI runs both `tsc` and `tsc6` type-checks',
  },
  {
    id: 'testing-library-surface',
    packages: ['@testing-library/dom', '@testing-library/react'],
    reason:
      '@testing-library/react already depends on @testing-library/dom; a direct devDep is redundant',
  },
  {
    id: 'aws-s3-pair',
    packages: ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'],
    reason: 'companion pair for R2 presigning; both are Node-side only today',
  },
  {
    id: 'minifiers',
    packages: ['terser', 'csso'],
    reason: 'two minification tools; vite uses terser, csso needs usage proof',
  },
  {
    id: 'ml-stacks',
    packages: ['@tensorflow/tfjs', '@vladmandic/human'],
    reason: 'two ML stacks in devDependencies; only one may ship in a face-recognition bundle',
  },
  {
    id: 'font-sources',
    packages: [
      '@fontsource/allura',
      '@fontsource/cormorant-garamond',
      '@fontsource/instrument-sans',
      '@fontsource/inter',
      '@fontsource/outfit',
      '@fontsource/pinyon-script',
    ],
    reason: 'six self-hosted font families; only the ones actually @import-ed cost download weight',
  },
  {
    id: 'radix-surface',
    packages: [
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-slot',
    ],
    reason:
      'six Radix primitives declared for one UI layer; the shipped surface must match exactly what is imported',
  },
]

const BUILTIN_MODULES = new Set(builtinModules)

function isBuiltinModule(name) {
  return name.startsWith('node:') || BUILTIN_MODULES.has(name)
}

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function tokenPattern(token) {
  return new RegExp(`(?<![\\w@/-])${escapeRegExp(token)}(?![\\w/-])`)
}

function emptyUsage() {
  return Object.fromEntries(BUCKETS.map(bucket => [bucket, { occurrences: 0, files: [] }]))
}

function recordUsage(usage, bucket, relPath) {
  const entry = usage[bucket]
  entry.occurrences += 1
  if (!entry.files.includes(relPath)) entry.files.push(relPath)
}

function isPackageSpecifier(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('@/')) {
    return false
  }
  if (specifier.startsWith('virtual:') || /^[a-z]+:/.test(specifier)) return false
  if (/^https?:\/\//.test(specifier)) return false
  return true
}

async function listTree(root, prefix) {
  try {
    return await walkSourceFiles(root, { prefix })
  } catch {
    return []
  }
}

async function readTextIfFile(absolutePath) {
  try {
    return await readFile(absolutePath, 'utf8')
  } catch {
    return null
  }
}

async function readInstalledPackage(repoRoot, name) {
  const raw = await readTextIfFile(
    path.join(repoRoot, 'node_modules', ...name.split('/'), 'package.json')
  )
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    const binNames = []
    if (typeof parsed.bin === 'string') binNames.push(name.split('/').pop())
    else if (parsed.bin && typeof parsed.bin === 'object') binNames.push(...Object.keys(parsed.bin))
    return { version: parsed.version || null, name: parsed.name || null, binNames }
  } catch {
    return null
  }
}

/**
 * Scan the repo and classify every declared dependency.
 */
export async function analyzeDependencies({ repoRoot, packageJson }) {
  const declarations = {
    dependencies: packageJson.dependencies || {},
    devDependencies: packageJson.devDependencies || {},
  }
  const declaredNames = [
    ...Object.keys(declarations.dependencies),
    ...Object.keys(declarations.devDependencies),
  ].sort((left, right) => left.localeCompare(right))
  const usageByName = new Map(declaredNames.map(name => [name, emptyUsage()]))
  const undeclared = new Map()
  const virtualModuleImporters = new Map()

  const addReference = (bucket, relPath, specifier) => {
    if (!isPackageSpecifier(specifier)) return
    const name = packageNameOf(specifier)
    const usage = usageByName.get(name)
    if (!usage) {
      if (isBuiltinModule(name)) return
      if (!undeclared.has(name)) {
        undeclared.set(name, { buckets: new Set(), files: new Set() })
      }
      const record = undeclared.get(name)
      record.buckets.add(bucket)
      record.files.add(relPath)
      return
    }
    recordUsage(usage, bucket, relPath)
  }

  // 1. src/** — runtime source, tests inside src, and stylesheets separately.
  const srcFiles = await listTree(path.join(repoRoot, 'src'), 'src')
  for (const file of srcFiles) {
    const extension = path.extname(file.relPath)
    const isCode = CODE_EXTENSIONS.has(extension)
    const isStylesheet = STYLESHEET_EXTENSIONS.has(extension)
    if (!isCode && !isStylesheet) continue
    const content = await readTextIfFile(file.absPath)
    if (content === null) continue
    const bucket = isStylesheet
      ? 'srcStyles'
      : isTestFile(file.relPath) || /setupTests\./.test(file.relPath)
        ? 'srcTests'
        : 'src'
    for (const reference of parseReferences(file.relPath, content)) {
      if (reference.specifier.startsWith('virtual:')) {
        if (!virtualModuleImporters.has(reference.specifier)) {
          virtualModuleImporters.set(reference.specifier, new Set())
        }
        virtualModuleImporters.get(reference.specifier).add(file.relPath)
        continue
      }
      addReference(bucket, file.relPath, reference.specifier)
    }
  }

  // 2. Existing non-src source trees.
  for (const { root, bucket } of SCAN_ROOTS) {
    const files = await listTree(path.join(repoRoot, root), root)
    for (const file of files) {
      if (EXCLUDED_SCAN_PREFIXES.some(prefix => file.relPath.startsWith(prefix))) continue
      const extension = path.extname(file.relPath)
      if (!CODE_EXTENSIONS.has(extension) && !STYLESHEET_EXTENSIONS.has(extension)) continue
      const content = await readTextIfFile(file.absPath)
      if (content === null) continue
      for (const reference of parseReferences(file.relPath, content)) {
        addReference(bucket, file.relPath, reference.specifier)
      }
    }
  }

  // 3. Root config files: imports count as config usage, text is kept for CLI
  //    detection (a package can be "used" only through a config string).
  const configTexts = []
  for (const configFile of CONFIG_FILES) {
    const absolutePath = path.join(repoRoot, configFile)
    const content = await readTextIfFile(absolutePath)
    if (content === null) continue
    configTexts.push(content)
    const extension = path.extname(configFile)
    if (!CODE_EXTENSIONS.has(extension)) continue
    for (const reference of parseReferences(configFile, content)) {
      addReference('config', configFile, reference.specifier)
    }
  }
  for (const textFile of TEXT_FILES) {
    const content = await readTextIfFile(path.join(repoRoot, textFile))
    if (content !== null) configTexts.push(content)
  }
  const configText = configTexts.join('\n')
  const scriptText = Object.values(packageJson.scripts || {}).join('\n')
  const cliText = `${scriptText}\n${configText}`

  // 4. Installed versions + bins (no npm/network calls).
  const installedByName = new Map()
  for (const name of declaredNames) {
    installedByName.set(name, await readInstalledPackage(repoRoot, name))
  }

  const packages = declaredNames.map(name => {
    const declaredIn = Object.prototype.hasOwnProperty.call(declarations.dependencies, name)
      ? 'dependencies'
      : 'devDependencies'
    const declaredVersion =
      declarations.dependencies[name] ?? declarations.devDependencies[name] ?? null
    const installed = installedByName.get(name)
    const usage = usageByName.get(name)
    const bins = installed ? installed.binNames : []
    const binMentions = bins.filter(bin => tokenPattern(bin).test(cliText))
    const packageNameMentioned = tokenPattern(name).test(configText)
    const importOccurrences = BUCKETS.reduce((sum, bucket) => sum + usage[bucket].occurrences, 0)

    let classification = 'unused'
    if (name.startsWith('@types/') && usage.src.occurrences === 0) {
      classification = 'types-only'
    } else if (usage.src.occurrences > 0) {
      classification = 'browser-bundle'
    } else if (usage.srcStyles.occurrences > 0) {
      classification = BUILD_ONLY_CSS_PACKAGES.has(name) ? 'node-only' : 'browser-bundle'
    } else if (usage.srcTests.occurrences > 0) {
      classification = 'test-only'
    } else if (
      ['scripts', 'tools', 'tests', 'supabase', 'netlify', 'config'].some(
        bucket => usage[bucket].occurrences > 0
      )
    ) {
      classification = 'node-only'
    } else if (binMentions.length > 0 || packageNameMentioned) {
      classification = 'node-only'
    }

    const notes = []
    if (RUNTIME_USAGE_EXCEPTIONS[name]) notes.push(RUNTIME_USAGE_EXCEPTIONS[name])
    if (classification === 'unused' && importOccurrences === 0) {
      notes.push('no import site in src/scripts/tools/tests/supabase/netlify/config')
    }
    if (name.startsWith('@fontsource/')) {
      notes.push(
        usage.srcStyles.occurrences > 0
          ? 'font family imported from src/index.css'
          : 'font family declared but not imported from any stylesheet'
      )
    }

    return {
      name,
      declaredIn,
      declaredVersion,
      installedVersion: installed ? installed.version : null,
      installedName: installed ? installed.name : null,
      bins,
      classification,
      importOccurrences,
      importSite: Object.fromEntries(
        BUCKETS.map(bucket => [
          bucket,
          {
            occurrences: usage[bucket].occurrences,
            files: usage[bucket].files.slice(0, 6),
            fileCount: usage[bucket].files.length,
          },
        ])
      ),
      mentions: { bins: binMentions, packageNameInConfig: packageNameMentioned },
      notes,
    }
  })

  const byClassification = classification =>
    packages.filter(pkg => pkg.classification === classification)
  const unused = byClassification('unused').map(pkg => ({
    name: pkg.name,
    declaredIn: pkg.declaredIn,
    declaredVersion: pkg.declaredVersion,
    notes: pkg.notes,
  }))

  const sectionMismatches = []
  for (const pkg of packages) {
    if (
      pkg.declaredIn === 'dependencies' &&
      ['node-only', 'test-only', 'types-only'].includes(pkg.classification)
    ) {
      sectionMismatches.push({
        name: pkg.name,
        declaredIn: pkg.declaredIn,
        classification: pkg.classification,
        note: 'runtime dependency that only reaches Node-side tooling; it does not belong in the browser bundle',
      })
    }
    if (pkg.declaredIn === 'devDependencies' && pkg.classification === 'browser-bundle') {
      sectionMismatches.push({
        name: pkg.name,
        declaredIn: pkg.declaredIn,
        classification: pkg.classification,
        note: 'browser bundle dependency declared as devDependency',
      })
    }
  }

  const overlaps = OVERLAP_GROUPS.map(group => {
    const members = group.packages
      .map(name => packages.find(pkg => pkg.name === name))
      .filter(Boolean)
      .map(pkg => ({
        name: pkg.name,
        declaredIn: pkg.declaredIn,
        classification: pkg.classification,
        importOccurrences: pkg.importOccurrences,
      }))
    return { id: group.id, reason: group.reason, members }
  }).filter(group => group.members.length >= 2)

  const fontPackages = packages
    .filter(pkg => pkg.name.startsWith('@fontsource/'))
    .map(pkg => ({
      name: pkg.name,
      used: pkg.importSite.srcStyles.occurrences > 0,
      stylesheetImports: pkg.importSite.srcStyles.occurrences,
    }))

  const virtualModules = [...virtualModuleImporters.entries()]
    .map(([module, importers]) => ({
      module,
      importers: [...importers].sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => left.module.localeCompare(right.module))

  // Imported but not declared in package.json: works only while a transitive
  // dependency keeps hoisting it, so it is a latent break on any dependency
  // bump. Builtins and virtual modules are excluded.
  const undeclaredDirectUsage = [...undeclared.entries()]
    .map(([name, record]) => ({
      name,
      buckets: [...record.buckets].sort((left, right) => left.localeCompare(right)),
      importers: [...record.files].sort((left, right) => left.localeCompare(right)).slice(0, 8),
      importerCount: record.files.size,
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

  return {
    declaredCounts: {
      dependencies: Object.keys(declarations.dependencies).length,
      devDependencies: Object.keys(declarations.devDependencies).length,
      total: declaredNames.length,
    },
    classificationCounts: {
      'browser-bundle': byClassification('browser-bundle').length,
      'node-only': byClassification('node-only').length,
      'test-only': byClassification('test-only').length,
      'types-only': byClassification('types-only').length,
      unused: unused.length,
    },
    scanScope: [
      'src/**',
      ...SCAN_ROOTS.map(entry => `${entry.root}/**`),
      ...CONFIG_FILES,
      ...TEXT_FILES,
    ],
    packages,
    unused,
    sectionMismatches,
    fontPackages,
    overlaps,
    virtualModules,
    undeclaredDirectUsage,
  }
}
