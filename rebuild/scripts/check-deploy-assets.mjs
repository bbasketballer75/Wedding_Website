/**
 * Release guard for the production deploy payload.
 *
 * The 2026-11-10 cutover shipped without the archive `/images/**` originals and
 * without the SPA `_redirects` fallback, so production served a black empty hero
 * and returned Netlify 404s for /guest/<token> and admin deep links. This guard
 * fails `build:prod` instead of letting an incomplete payload deploy.
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dist = 'dist'
const failures = []

function requireFile(relativePath) {
  if (!existsSync(join(dist, relativePath))) failures.push(`missing ${relativePath}`)
}

function requireSome(directory, predicate) {
  const full = join(dist, directory)
  if (!existsSync(full)) {
    failures.push(`missing directory ${directory}`)
    return
  }
  const match = readdirSync(full).some(predicate)
  if (!match) failures.push(`no matching file in ${directory}`)
}

requireFile('images/home/intro-video-poster.png')
requireFile('images/film/main-film-poster.png')
requireSome('images/engagement', name => /\.webp$/i.test(name))
requireSome('images/couple', name => /\.(png|webp|jpg)$/i.test(name))
requireFile('_redirects')

if (failures.length) {
  console.error('DEPLOY PAYLOAD INCOMPLETE:')
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}
console.log('Deploy payload guard: hero/film/engagement/couple images and SPA redirects present')
