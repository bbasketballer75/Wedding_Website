import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

/**
 * Script-level self-checks for the two generators. These spawn the real CLI in
 * a temp directory (no project build is produced or mutated) and assert the
 * deterministic outputs + `--check` drift gate, exactly as CI/the Lead run them.
 */
const REBUILD_ROOT = resolve(process.cwd())
const PUBLIC_IMAGES = resolve(REBUILD_ROOT, 'public', 'images')
const tempDirs: string[] = []

function makeTempDir(prefix: string): string {
  const directory = mkdtempSync(resolve(tmpdir(), `w8-1-${prefix}-`))
  tempDirs.push(directory)
  return directory
}

function runScript(
  script: string,
  args: string[]
): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(
      process.execPath,
      [resolve(REBUILD_ROOT, 'scripts', script), ...args],
      {
        cwd: REBUILD_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    )
    return { status: 0, stdout, stderr: '' }
  } catch (error) {
    const execError = error as { status?: number; stdout?: string; stderr?: string }
    return {
      status: execError.status ?? 1,
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? '',
    }
  }
}

const TEMPLATE = `<!doctype html>
<html lang="en" class="dark-theme">
  <head>
    <meta charset="UTF-8" />
    <!-- seo:start -->
    <title>Default title</title>
    <meta name="description" content="default" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="https://www.theporadas.com/" />
    <!-- seo:end -->
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index-hash.js"></script>
  </body>
</html>
`

function seedDist(directory: string): void {
  mkdirSync(directory, { recursive: true })
  writeFileSync(resolve(directory, 'index.html'), TEMPLATE, 'utf8')
}

function seedPublic(directory: string): void {
  mkdirSync(directory, { recursive: true })
  cpSync(PUBLIC_IMAGES, resolve(directory, 'images'), { recursive: true })
}

afterAll(() => {
  for (const directory of tempDirs) rmSync(directory, { recursive: true, force: true })
})

describe('scripts/generate-sitemap.mjs', () => {
  it('writes deterministic artifacts and passes its own --check', () => {
    const directory = makeTempDir('gen')
    const out = resolve(directory, 'public')
    seedPublic(out)
    const dist = resolve(directory, 'empty-dist')

    const first = runScript('generate-sitemap.mjs', ['--out', out, '--dist', dist])
    expect(first.status, first.stderr).toBe(0)
    for (const name of ['sitemap.xml', 'robots.txt', 'manifest.webmanifest', 'sw.js']) {
      expect(existsSync(resolve(out, name)), `${name} should be generated`).toBe(true)
    }

    const snapshot = new Map(
      ['sitemap.xml', 'robots.txt', 'manifest.webmanifest', 'sw.js'].map(name => [
        name,
        readFileSync(resolve(out, name), 'utf8'),
      ])
    )
    const second = runScript('generate-sitemap.mjs', ['--out', out, '--dist', dist])
    expect(second.status, second.stderr).toBe(0)
    for (const [name, content] of snapshot) {
      expect(readFileSync(resolve(out, name), 'utf8'), `${name} should be stable`).toBe(content)
    }

    const check = runScript('generate-sitemap.mjs', ['--check', '--out', out, '--dist', dist])
    expect(check.status, check.stderr).toBe(0)
    expect(check.stdout).toContain('check ok')
  })

  it('fails --check when a generated artifact drifts', () => {
    const directory = makeTempDir('gen-drift')
    const out = resolve(directory, 'public')
    seedPublic(out)
    const dist = resolve(directory, 'empty-dist')
    expect(runScript('generate-sitemap.mjs', ['--out', out, '--dist', dist]).status).toBe(0)

    writeFileSync(resolve(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n', 'utf8')
    const check = runScript('generate-sitemap.mjs', ['--check', '--out', out, '--dist', dist])
    expect(check.status).toBe(1)
    expect(check.stderr).toContain('stale')
    expect(check.stderr).toContain('robots.txt')
  })

  it('fails when a manifest icon is missing from the served tree', () => {
    const directory = makeTempDir('gen-icon')
    const out = resolve(directory, 'public')
    seedPublic(out)
    rmSync(resolve(out, 'images', 'icons', 'icon-192x192.png'), { force: true })
    const result = runScript('generate-sitemap.mjs', ['--check', '--out', out, '--dist', 'nope'])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('icons are missing')
    expect(result.stderr).toContain('/images/icons/icon-192x192.png')
  })
})

describe('scripts/prerender.mjs', () => {
  it('writes one HTML file per route, changing only the metadata block', () => {
    const directory = makeTempDir('pre')
    const dist = resolve(directory, 'dist')
    seedDist(dist)

    const result = runScript('prerender.mjs', ['--dist', dist])
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('prerendered 12 route files')

    const expectedPaths = [
      'index.html',
      'film/index.html',
      'gallery/index.html',
      'guestbook/index.html',
      'upload/index.html',
      'guest-photos/index.html',
      'print/index.html',
      'activity/index.html',
      'admin/index.html',
      'admin/login/index.html',
      'guest/index.html',
      'people/index.html',
    ]
    for (const relativePath of expectedPaths) {
      expect(existsSync(resolve(dist, relativePath)), `${relativePath} should exist`).toBe(true)
    }

    const home = readFileSync(resolve(dist, 'index.html'), 'utf8')
    expect(home).toContain("<title>Home | Austin &amp; Jordyn's Wedding</title>")
    expect(home).toContain('<meta name="robots" content="index, follow" />')
    expect(home).toContain('<!-- seo:start -->')
    expect(home).toContain('<script type="module" src="/assets/index-hash.js"></script>')
    // LCP boot shell: inside #root, inline CSS only, aria-hidden, no network refs.
    expect(home).toContain('<!-- boot-shell:start -->')
    expect(home).toContain('data-boot-shell="" aria-hidden="true"')
    expect(home).toContain('<style data-boot-shell>')
    expect(home).toContain('data-boot-shell-heading>Austin &amp; Jordyn</h1>')
    const homeShell = home.slice(
      home.indexOf('<!-- boot-shell:start -->'),
      home.indexOf('<!-- boot-shell:end -->')
    )
    expect(homeShell).not.toMatch(/https?:/)
    expect(homeShell).not.toContain('<script')
    expect(homeShell).not.toContain('<img')

    const activity = readFileSync(resolve(dist, 'activity/index.html'), 'utf8')
    expect(activity).toContain("<title>Activity | Austin &amp; Jordyn's Wedding</title>")
    expect(activity).toContain(
      '<meta name="description" content="See the latest photos, guestbook notes, and memories added to Austin and Jordyn\'s wedding archive." />'
    )
    expect(activity).toContain(
      '<link rel="canonical" href="https://www.theporadas.com/activity" />'
    )
    expect(activity).toContain('<meta name="robots" content="index, follow" />')

    const admin = readFileSync(resolve(dist, 'admin/index.html'), 'utf8')
    expect(admin).toContain('<meta name="robots" content="noindex, nofollow" />')
    expect(admin).not.toContain('<link rel="canonical"')
    expect(admin).not.toContain('boot-shell')
    expect(admin).toContain('<div id="root"></div>')

    const guest = readFileSync(resolve(dist, 'guest/index.html'), 'utf8')
    expect(guest).toContain('<meta name="robots" content="noindex, nofollow" />')
    expect(guest).not.toContain('<link rel="canonical"')

    const people = readFileSync(resolve(dist, 'people/index.html'), 'utf8')
    expect(people).toContain('<meta name="robots" content="noindex, nofollow" />')
    expect(people).toContain('<link rel="canonical" href="https://www.theporadas.com/404" />')
    expect(people).toContain('Page Not Found | Austin &amp; Jordyn')
    expect(people).not.toContain('boot-shell')

    const film = readFileSync(resolve(dist, 'film/index.html'), 'utf8')
    expect(film).toContain('data-boot-shell="" aria-hidden="true"')
    expect(film).toContain('data-boot-shell-heading>The Wedding Film</h1>')
    expect(film).toContain('Watch the full wedding film for Austin and Jordyn')
    const filmShell = film.slice(
      film.indexOf('<!-- boot-shell:start -->'),
      film.indexOf('<!-- boot-shell:end -->')
    )
    expect(filmShell).not.toMatch(/https?:/)

    // Hydration document unchanged: only the metadata block and the (public
    // only) boot shell may differ per route; the rest of the document is shared.
    const homeBefore = home.slice(0, home.indexOf('<!-- seo:start -->'))
    for (const relativePath of expectedPaths) {
      const file = readFileSync(resolve(dist, relativePath), 'utf8')
      expect(file.slice(0, file.indexOf('<!-- seo:start -->'))).toBe(homeBefore)
      expect(file).toContain('<script type="module" src="/assets/index-hash.js"></script>')
    }
    const adminShell = readFileSync(resolve(dist, 'admin/index.html'), 'utf8')
    for (const relativePath of [
      'guest/index.html',
      'people/index.html',
      'admin/login/index.html',
    ]) {
      const file = readFileSync(resolve(dist, relativePath), 'utf8')
      expect(file.slice(file.indexOf('<!-- seo:end -->'))).toBe(
        adminShell.slice(adminShell.indexOf('<!-- seo:end -->'))
      )
    }
  })

  it('is idempotent and passes --check after generation', () => {
    const directory = makeTempDir('pre-idem')
    const dist = resolve(directory, 'dist')
    seedDist(dist)
    expect(runScript('prerender.mjs', ['--dist', dist]).status).toBe(0)
    const firstRun = readFileSync(resolve(dist, 'activity/index.html'), 'utf8')
    expect(runScript('prerender.mjs', ['--dist', dist]).status).toBe(0)
    expect(readFileSync(resolve(dist, 'activity/index.html'), 'utf8')).toBe(firstRun)

    const check = runScript('prerender.mjs', ['--check', '--dist', dist])
    expect(check.status, check.stderr).toBe(0)
    expect(check.stdout).toContain('check ok')
  })

  it('honours --site-url for canonical and social URLs', () => {
    const directory = makeTempDir('pre-site')
    const dist = resolve(directory, 'dist')
    seedDist(dist)
    const staging = 'https://staging.theporadas.com'
    expect(runScript('prerender.mjs', ['--dist', dist, '--site-url', staging]).status).toBe(0)
    const home = readFileSync(resolve(dist, 'index.html'), 'utf8')
    expect(home).toContain(`<link rel="canonical" href="${staging}/" />`)
    expect(home).toContain(`<meta property="og:url" content="${staging}/" />`)
    expect(
      runScript('prerender.mjs', ['--check', '--dist', dist, '--site-url', staging]).status
    ).toBe(0)
    expect(runScript('prerender.mjs', ['--check', '--dist', dist]).status).toBe(1)
  })

  it('fails --check on metadata drift, missing files and body tampering', () => {
    const directory = makeTempDir('pre-drift')
    const dist = resolve(directory, 'dist')
    seedDist(dist)
    expect(runScript('prerender.mjs', ['--dist', dist]).status).toBe(0)

    const activityPath = resolve(dist, 'activity/index.html')
    const original = readFileSync(activityPath, 'utf8')
    writeFileSync(activityPath, original.replace('/activity"', '/wrong"'), 'utf8')
    let check = runScript('prerender.mjs', ['--check', '--dist', dist])
    expect(check.status).toBe(1)
    expect(check.stderr).toContain('activity/index.html')
    writeFileSync(activityPath, original, 'utf8')

    const peoplePath = resolve(dist, 'people/index.html')
    const people = readFileSync(peoplePath, 'utf8')
    writeFileSync(
      peoplePath,
      people.replace('<div id="root"></div>', '<div id="root">tampered</div>'),
      'utf8'
    )
    check = runScript('prerender.mjs', ['--check', '--dist', dist])
    expect(check.status).toBe(1)
    expect(check.stderr).toContain('people/index.html differs at line')
    writeFileSync(peoplePath, people, 'utf8')

    rmSync(peoplePath)
    check = runScript('prerender.mjs', ['--check', '--dist', dist])
    expect(check.status).toBe(1)
    expect(check.stderr).toContain('people/index.html is missing')
  })

  it('explains how to produce a build when --dist has no index.html', () => {
    const directory = makeTempDir('pre-nobuild')
    const result = runScript('prerender.mjs', ['--dist', resolve(directory, 'missing')])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('vite build')
  })

  it('refuses a template without markers', () => {
    const directory = makeTempDir('pre-nomarkers')
    const dist = resolve(directory, 'dist')
    mkdirSync(dist, { recursive: true })
    writeFileSync(resolve(dist, 'index.html'), '<!doctype html><html><head></head></html>', 'utf8')
    const result = runScript('prerender.mjs', ['--dist', dist])
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('exactly one')
  })

  it('keeps the template body/scripts byte-identical (hydration unchanged)', () => {
    const directory = makeTempDir('pre-body')
    const dist = resolve(directory, 'dist')
    seedDist(dist)
    expect(runScript('prerender.mjs', ['--dist', dist]).status).toBe(0)
    const film = readFileSync(resolve(dist, 'film/index.html'), 'utf8')
    expect(film).toContain('<script type="module" src="/assets/index-hash.js"></script>')
    // The shell is the only body change; the rest of the document is untouched.
    const outsideShell = film.replace(
      /<div id="root">[\s\S]*<\/div>\n {4}<script/,
      '<div id="root"></div>\n    <script'
    )
    expect(outsideShell).toContain('<div id="root"></div>')
  })

  it('fails --check when the boot shell drifts', () => {
    const directory = makeTempDir('pre-shell-drift')
    const dist = resolve(directory, 'dist')
    seedDist(dist)
    expect(runScript('prerender.mjs', ['--dist', dist]).status).toBe(0)
    const filmPath = resolve(dist, 'film/index.html')
    const film = readFileSync(filmPath, 'utf8')
    writeFileSync(filmPath, film.replace('The Wedding Film</h1>', 'Wrong Headline</h1>'), 'utf8')
    const check = runScript('prerender.mjs', ['--check', '--dist', dist])
    expect(check.status).toBe(1)
    expect(check.stderr).toContain('film/index.html differs at line')
  })
})
