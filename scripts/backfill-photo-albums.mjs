import 'dotenv/config'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  assertExists,
  inferCanonicalAlbum,
  normalizeAlbum,
  readJson,
  toSiteMediaPath,
  writeJson,
  writeMarkdown,
} from './photo-batch-utils.mjs'

const PROJECT_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const workingRoot = process.argv[2]
const manifestArg = process.argv[3]

if (!workingRoot) {
  console.error('Usage: node scripts/backfill-photo-albums.mjs <working-root> [manifest-json]')
  process.exit(1)
}

if (!PROJECT_URL) {
  throw new Error('Missing VITE_SUPABASE_URL')
}

if (!SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
}

const PHOTO_LOOKUP_CHUNK_SIZE = 40

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

function chunk(items, size) {
  const chunks = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

async function fetchPhotosByUrls(urls) {
  const rows = []

  for (const urlChunk of chunk(urls, PHOTO_LOOKUP_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from('photos')
      .select('id, url, album, category, is_professional, album_sort_order, download_url')
      .in('url', urlChunk)

    if (error) {
      throw error
    }

    rows.push(...(data || []))
  }

  return rows
}

async function fetchAllPhotos() {
  const { data, error } = await supabase
    .from('photos')
    .select('id, url, album, category, is_professional, album_sort_order, created_at, download_url')

  if (error) {
    throw error
  }

  return data || []
}

async function upsertAlbumUpdates(updates) {
  for (const updateChunk of chunk(updates, PHOTO_LOOKUP_CHUNK_SIZE)) {
    const { error } = await supabase
      .from('photos')
      .upsert(updateChunk, { onConflict: 'id' })

    if (error) {
      throw error
    }
  }
}

function createNextSortTracker(rows) {
  return rows.reduce((acc, row) => {
    const album =
      normalizeAlbum(row.album)
      ?? normalizeAlbum(row.category)
      ?? (row.is_professional ? 'Wedding Day' : 'Guest Uploads')

    if (!album) {
      return acc
    }

    const currentValue = Number(row.album_sort_order || 0)
    acc[album] = Math.max(acc[album] || 0, currentValue)
    return acc
  }, Object.create(null))
}

async function main() {
  const absoluteWorkingRoot = path.resolve(workingRoot)
  const publishRoot = path.join(absoluteWorkingRoot, 'publish')
  const manifestPath = manifestArg
    ? path.resolve(manifestArg)
    : path.join(publishRoot, 'wedding-photo-import-manifest.json')

  await assertExists(manifestPath, 'publish manifest')

  const manifestRows = await readJson(manifestPath)
  const manifestEntries = manifestRows
    .map((row) => {
      const topLevelFolder = String(row.sourceRelativePath || '').split('/')[0] || ''
      const album =
        inferCanonicalAlbum(topLevelFolder, row.sourceRelativePath ?? '')
        ?? normalizeAlbum(row.album ?? row.photoRowDraft?.album ?? row.collection ?? row.category)
      if (!album) return null

      return {
        album,
        url: toSiteMediaPath(row.photoRowDraft.url),
        download_url: toSiteMediaPath(row.photoRowDraft.download_url ?? row.photoRowDraft.url),
        sourceRelativePath: row.sourceRelativePath,
      }
    })
    .filter(Boolean)

  const manifestByUrl = new Map(manifestEntries.map((row) => [row.url, row]))
  const manifestUrls = manifestEntries.map((row) => row.url)
  const [matchedLiveRows, allLiveRows] = await Promise.all([
    fetchPhotosByUrls(manifestUrls),
    fetchAllPhotos(),
  ])

  const matchedLiveByUrl = new Map(matchedLiveRows.map((row) => [row.url, row]))
  const updates = []
  const unchanged = []
  const exceptions = []
  const fallbackUpdates = []
  const nextSortByAlbum = createNextSortTracker(allLiveRows)

  const reserveSortOrder = (album) => {
    nextSortByAlbum[album] = (nextSortByAlbum[album] || 0) + 1
    return nextSortByAlbum[album]
  }

  for (const manifestEntry of manifestEntries) {
    const existing = matchedLiveByUrl.get(manifestEntry.url)
    if (!existing) {
      if (manifestEntry.album === 'Engagement') {
        continue
      }

      exceptions.push({
        url: manifestEntry.url,
        album: manifestEntry.album,
        sourceRelativePath: manifestEntry.sourceRelativePath,
        reason: 'manifest-row-not-found-in-live-photos',
      })
      continue
    }

    const currentAlbum = normalizeAlbum(existing.album ?? existing.category)
    const hasSortOrder = Number(existing.album_sort_order || 0) > 0
    if (currentAlbum === manifestEntry.album && existing.category === manifestEntry.album && hasSortOrder) {
      unchanged.push({
        id: existing.id,
        url: existing.url,
        album: manifestEntry.album,
      })
      continue
    }

    updates.push({
      id: existing.id,
      album: manifestEntry.album,
      category: manifestEntry.album,
      download_url: manifestEntry.download_url,
      album_sort_order:
        currentAlbum === manifestEntry.album && hasSortOrder
          ? existing.album_sort_order
          : reserveSortOrder(manifestEntry.album),
    })
  }

  for (const liveRow of allLiveRows) {
    if (manifestByUrl.has(liveRow.url)) {
      continue
    }

    const fallbackAlbum =
      normalizeAlbum(liveRow.album)
      ?? normalizeAlbum(liveRow.category)
      ?? (liveRow.is_professional ? 'Wedding Day' : 'Guest Uploads')

    if (!fallbackAlbum) {
      exceptions.push({
        id: liveRow.id,
        url: liveRow.url,
        currentAlbum: liveRow.album,
        currentCategory: liveRow.category,
        reason: 'could-not-derive-album-for-live-row',
      })
      continue
    }

    const hasSortOrder = Number(liveRow.album_sort_order || 0) > 0

    if (normalizeAlbum(liveRow.album) === fallbackAlbum && liveRow.category === fallbackAlbum && hasSortOrder) {
      continue
    }

    fallbackUpdates.push({
      id: liveRow.id,
      album: fallbackAlbum,
      category: fallbackAlbum,
      download_url: liveRow.download_url ?? liveRow.url,
      album_sort_order:
        normalizeAlbum(liveRow.album) === fallbackAlbum && hasSortOrder
          ? liveRow.album_sort_order
          : reserveSortOrder(fallbackAlbum),
    })
  }

  const allUpdates = [...updates, ...fallbackUpdates]

  if (allUpdates.length > 0) {
    await upsertAlbumUpdates(allUpdates)
  }

  const report = {
    workingRoot: absoluteWorkingRoot,
    manifestRowCount: manifestEntries.length,
    updatedPhotoRows: allUpdates.length,
    unchangedPhotoRows: unchanged.length,
    fallbackUpdatedPhotoRows: fallbackUpdates.length,
    exceptionCount: exceptions.length,
    generatedAt: new Date().toISOString(),
    exceptions,
  }

  const reportPath = path.join(publishRoot, 'wedding-photo-album-backfill-report.json')
  const summaryPath = path.join(publishRoot, 'wedding-photo-album-backfill-report.md')

  await writeJson(reportPath, report)
  await writeMarkdown(summaryPath, [
    '# Wedding Photo Album Backfill Report',
    '',
    `Working root: \`${absoluteWorkingRoot}\``,
    '',
    `Manifest rows considered: **${manifestEntries.length}**`,
    `Updated photo rows: **${allUpdates.length}**`,
    `Fallback-updated live rows: **${fallbackUpdates.length}**`,
    `Unchanged photo rows: **${unchanged.length}**`,
    `Exceptions: **${exceptions.length}**`,
    '',
    '## Notes',
    '- `photos.album` is now the canonical public album field.',
    '- `photos.category` is mirrored to the same album value for compatibility during rollout.',
    '- Engagement manifest rows that are still intentionally unpublished are ignored if missing from the live table.',
  ])

  console.log(`Updated ${allUpdates.length} live photo rows with canonical album values`)
  console.log(`Wrote album backfill report to ${reportPath}`)
}

await main()
