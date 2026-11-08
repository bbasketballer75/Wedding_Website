#!/usr/bin/env node
/**
 * Extracts the structured content contract from the frozen legacy app.
 *
 * The greenfield rebuild is not allowed to read the legacy source (see
 * contracts/README.md), so every story chapter, film chapter, quote, timeline
 * milestone, party member, track, curated photo and site constant is extracted
 * here into `contracts/content/*.json` for a human to review.
 *
 * Sources (all read-only):
 *   src/config/weddingConfig.ts
 *   src/data/film.ts
 *   src/data/engagement.ts
 *   src/data/timeline.ts
 *   src/data/weddingParty.ts
 *   src/data/music.ts
 *   src/data/memoryTrails.ts
 *   src/data/curated-photos.ts
 *   src/pages/Film.tsx        (main-film media constants)
 *   src/pages/Home.tsx        (hero poster)
 *
 * Mechanics:
 *   esbuild bundles the TypeScript data modules (with the `@` -> `src` alias
 *   and `import.meta.env` substituted to production-empty values, because
 *   src/data/film.ts and music.ts import getMediaPath from src/utils/media.ts),
 *   the bundle is imported from a temp file, and this script writes the JSON.
 *
 * Determinism:
 *   JSON is emitted in a fixed key order from fixed sources. The only timestamp
 *   in the output is MEDIA_MANIFEST.generatedAt, which is a constant (the freeze
 *   tag's date), never wall-clock time. Re-running on the unchanged frozen app
 *   must produce byte-identical files.
 *
 * Usage:
 *   node tools/extract-content/extract.mjs
 *   node tools/extract-content/extract.mjs --check   # exit 1 on drift vs disk
 */
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { importBundledModule } from './bundle.mjs'
import { fileExists, readJsonIfExists } from '../lib/fs.mjs'
import { writeContractJson } from './write-contract-json.mjs'
import { contentDir, repoPath } from '../lib/paths.mjs'
import { die, info, ok, step, warn } from '../lib/log.mjs'

const args = new Set(process.argv.slice(2))
const CHECK_ONLY = args.has('--check')

/** The freeze point this content snapshot describes (never wall-clock time). */
const GENERATED_AT = '2026-11-08T00:00:00.000Z'

const SOURCE_DIRS = ['src/config', 'src/data']

const LEGACY_CONTENT_ENTRY = `
import { COUPLE, SITE_TITLE, WEDDING_DATE } from '@/config/weddingConfig'
import {
  MAIN_FILM_RUNTIME_LABEL,
  MAIN_FILM_CHAPTERS_FALLBACK,
  familyFilms,
  filmQuotes,
  filmWatchPaths,
  getFilmGalleryTargetByMomentSlug,
  slugifyFilmMoment,
} from '@/data/film'
import { photos as engagementPhotos, storyContent } from '@/data/engagement'
import { earlyMilestones, lateMilestones } from '@/data/timeline'
import { partyData } from '@/data/weddingParty'
import { halloweenTrack, mainPlaylist, sfx } from '@/data/music'
import { MEMORY_TRAIL_IDS, memoryTrails } from '@/data/memoryTrails'
import { curatedPhotos } from '@/data/curated-photos'

export const legacyContent = {
  COUPLE,
  SITE_TITLE,
  WEDDING_DATE,
  MAIN_FILM_RUNTIME_LABEL,
  MAIN_FILM_CHAPTERS_FALLBACK,
  familyFilms,
  filmQuotes,
  filmWatchPaths,
  getFilmGalleryTargetByMomentSlug,
  slugifyFilmMoment,
  engagementPhotos,
  storyContent,
  earlyMilestones,
  lateMilestones,
  partyData,
  halloweenTrack,
  mainPlaylist,
  sfx,
  MEMORY_TRAIL_IDS,
  memoryTrails,
  curatedPhotos,
}
`

async function readLegacy(relativePath) {
  return readFile(repoPath(relativePath), 'utf8')
}

function extractLiteral(source, pattern, label) {
  const match = source.match(pattern)
  if (!match) {
    die(`extract: could not find ${label} in the frozen legacy source — refusing to invent it`)
  }
  return match[1]
}

async function loadLegacyContent() {
  const module = await importBundledModule(LEGACY_CONTENT_ENTRY, {
    sourcefile: 'legacy-content-entry.ts',
  })
  return module.legacyContent
}

function toIsoString(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('extract: WEDDING_DATE did not survive the bundle as a valid Date')
  }
  return date.toISOString()
}

async function buildContent(legacy) {
  const [configSource, filmPageSource, homePageSource, filmDataSource] = await Promise.all([
    readLegacy('src/config/weddingConfig.ts'),
    readLegacy('src/pages/Film.tsx'),
    readLegacy('src/pages/Home.tsx'),
    readLegacy('src/data/film.ts'),
  ])

  // Page-level media constants live in the pages today; pull the literals out of
  // the legacy source instead of hardcoding copies that could silently drift.
  const weddingDateLiteral = extractLiteral(
    configSource,
    /WEDDING_DATE = new Date\('([^']+)'\)/,
    'WEDDING_DATE literal'
  )
  const heroPoster = extractLiteral(homePageSource, /const HERO_POSTER = '([^']+)'/, 'HERO_POSTER')
  const mainFilmPoster = extractLiteral(
    filmPageSource,
    /const MAIN_FILM_POSTER = '([^']+)'/,
    'MAIN_FILM_POSTER'
  )
  const mainFilmVideoSrc = extractLiteral(
    filmPageSource,
    /getMediaPath\('(\/video\/main\.mp4)'\)/,
    'main film video source'
  )
  const mainFilmCaptionsSrc = extractLiteral(
    filmPageSource,
    /getMediaPath\('(\/video\/main\.vtt)'\)/,
    'main film captions source'
  )
  const chaptersSource = extractLiteral(
    filmDataSource,
    /getMediaPath\('([^']*main-film-chapters\.vtt)'\)/,
    'main film chapters source'
  )

  const weddingDateUtc = toIsoString(legacy.WEDDING_DATE)
  if (new Date(weddingDateLiteral).toISOString() !== weddingDateUtc) {
    die('extract: bundled WEDDING_DATE disagrees with the literal in weddingConfig.ts')
  }

  const chaptersFallback = legacy.MAIN_FILM_CHAPTERS_FALLBACK.map(chapter => ({
    label: chapter.label,
    time: chapter.time,
    momentSlug: legacy.slugifyFilmMoment(chapter.label),
  }))

  const momentGalleryTargets = chaptersFallback.map(chapter => {
    const target = legacy.getFilmGalleryTargetByMomentSlug(chapter.momentSlug)
    if (!target) {
      die(`extract: film chapter "${chapter.momentSlug}" has no gallery target (frozen app drift)`)
    }
    return {
      momentSlug: chapter.momentSlug,
      album: target.album,
      ...(target.searchQuery ? { searchQuery: target.searchQuery } : {}),
      ...(target.person ? { person: target.person } : {}),
      ...(target.ctaLabel ? { ctaLabel: target.ctaLabel } : {}),
    }
  })

  const mainEngagementPhoto = legacy.engagementPhotos.find(photo => photo.type === 'main')
  const secondaryEngagementPhoto = legacy.engagementPhotos.find(photo => photo.type === 'filler')
  if (!mainEngagementPhoto || !secondaryEngagementPhoto) {
    die('extract: engagement photos lost their main/filler entries (frozen app drift)')
  }

  const content = {
    'wedding.json': {
      siteTitle: legacy.SITE_TITLE,
      couple: legacy.COUPLE,
      weddingDate: weddingDateLiteral,
      weddingDateUtc,
      heroPoster,
    },
    'film.json': {
      mainFilm: {
        runtimeLabel: legacy.MAIN_FILM_RUNTIME_LABEL,
        videoSrc: mainFilmVideoSrc,
        captionsSrc: mainFilmCaptionsSrc,
        poster: mainFilmPoster,
        chaptersSource,
      },
      chaptersFallback,
      momentGalleryTargets,
      familyFilms: legacy.familyFilms,
      quotes: legacy.filmQuotes,
      watchPaths: legacy.filmWatchPaths,
    },
    'story.json': {
      story: legacy.storyContent,
      photos: {
        main: mainEngagementPhoto,
        secondary: secondaryEngagementPhoto,
        gallery: legacy.engagementPhotos.filter(photo => photo.type === 'gallery'),
      },
    },
    'timeline.json': {
      earlyMilestones: legacy.earlyMilestones,
      lateMilestones: legacy.lateMilestones,
    },
    'party.json': legacy.partyData,
    'music.json': {
      mainPlaylist: legacy.mainPlaylist,
      halloweenTrack: legacy.halloweenTrack,
      sfx: legacy.sfx,
    },
    'memory-trails.json': {
      trailIds: legacy.MEMORY_TRAIL_IDS,
      trails: legacy.memoryTrails,
    },
    'curated-photos.json': legacy.curatedPhotos,
  }

  return content
}

// ────────────────────────────────────────────────────────────────────────────
// MEDIA_MANIFEST — every media path referenced by the content contracts
// ────────────────────────────────────────────────────────────────────────────

const MEDIA_PATH_PATTERN = /^\/(?:images|video|background_audio|media)\//

const MEDIA_KIND_BY_EXTENSION = {
  '.webp': 'image',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.gif': 'image',
  '.svg': 'image',
  '.avif': 'image',
  '.mp4': 'video',
  '.webm': 'video',
  '.mov': 'video',
  '.mp3': 'audio',
  '.flac': 'audio',
  '.wav': 'audio',
  '.m4a': 'audio',
  '.vtt': 'other',
  '.srt': 'other',
}

function collectMediaPaths(value, referencedBy, sink) {
  if (typeof value === 'string') {
    if (MEDIA_PATH_PATTERN.test(value)) {
      const references = sink.get(value) ?? new Set()
      references.add(referencedBy)
      sink.set(value, references)
    }
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) collectMediaPaths(item, referencedBy, sink)
    return
  }

  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectMediaPaths(item, referencedBy, sink)
  }
}

function mediaKind(mediaPath) {
  const extension = path.extname(mediaPath).toLowerCase()
  const kind = MEDIA_KIND_BY_EXTENSION[extension]
  if (!kind) {
    die(`extract: unknown media extension for ${mediaPath} — add it to MEDIA_KIND_BY_EXTENSION`)
  }
  return kind
}

async function buildMediaManifest(content) {
  const sink = new Map()

  for (const [fileName, payload] of Object.entries(content)) {
    collectMediaPaths(payload, fileName, sink)
  }

  const media = []
  const missing = []

  for (const mediaPath of [...sink.keys()].sort()) {
    const relativePath = mediaPath.replace(/^\/+/, '')
    const existsLocally = await fileExists(repoPath('public', relativePath))
    if (!existsLocally) missing.push(mediaPath)
    media.push({
      path: mediaPath,
      kind: mediaKind(mediaPath),
      referencedBy: [...sink.get(mediaPath)].sort(),
      existsLocally,
      source: existsLocally ? 'public' : 'unknown',
    })
  }

  if (missing.length > 0) {
    for (const mediaPath of missing) {
      warn(`media referenced by content but missing locally: ${mediaPath}`)
    }
  }

  return { generatedAt: GENERATED_AT, media }
}

// ────────────────────────────────────────────────────────────────────────────
// Run
// ────────────────────────────────────────────────────────────────────────────

function digest(value) {
  return createHash('sha256')
    .update(JSON.stringify(value, null, 2))
    .digest('hex')
    .slice(0, 12)
}

step('Extract legacy content')
const legacy = await loadLegacyContent()
const content = await buildContent(legacy)
const manifest = await buildMediaManifest(content)

if (!(await fileExists(contentDir))) {
  info('creating contracts/content/')
}

let drift = 0
for (const [fileName, payload] of Object.entries(content)) {
  const target = path.join(contentDir, fileName)
  if (CHECK_ONLY) {
    const existing = await readJsonIfExists(target)
    const same = existing !== null && JSON.stringify(existing) === JSON.stringify(payload)
    if (!same) {
      drift += 1
      warn(`drift: contracts/content/${fileName}`)
    }
    continue
  }
  await writeContractJson(target, payload)
  ok(`contracts/content/${fileName} sha256:${digest(payload)}`)
}

const manifestTarget = path.join(contentDir, 'MEDIA_MANIFEST.json')
if (CHECK_ONLY) {
  const existing = await readJsonIfExists(manifestTarget)
  const same = existing !== null && JSON.stringify(existing) === JSON.stringify(manifest)
  if (!same) {
    drift += 1
    warn('drift: contracts/content/MEDIA_MANIFEST.json')
  }
} else {
  await writeContractJson(manifestTarget, manifest)
  ok(`contracts/content/MEDIA_MANIFEST.json sha256:${digest(manifest)}`)
}

info(`${Object.keys(content).length} content files from ${SOURCE_DIRS.join(', ')}`)
info(`${manifest.media.length} media paths referenced by content`)

if (CHECK_ONLY) {
  if (drift > 0) die(`extract: ${drift} artifact(s) differ from the committed contracts`)
  ok('contracts/content is up to date')
} else {
  ok('content extraction complete')
}
