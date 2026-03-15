import 'dotenv/config'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { readJson, writeJson, writeMarkdown } from './photo-batch-utils.mjs'

const workingRoot = process.argv[2]
const reviewPathArg = process.argv[3]

if (!workingRoot) {
  console.error('Usage: node scripts/sync-guest-photo-face-metadata.mjs <working-root> [review-json]')
  process.exit(1)
}

const PROJECT_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PHOTO_LOOKUP_CHUNK_SIZE = 40

if (!PROJECT_URL) {
  throw new Error('Missing VITE_SUPABASE_URL')
}

if (!SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
}

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

function resolveConfirmedNames(reviewItems) {
  const byClusterId = new Map(reviewItems.map((item) => [item.clusterId, item]))

  function getResolvedName(clusterId, seen = new Set()) {
    if (!clusterId || seen.has(clusterId)) return null
    seen.add(clusterId)

    const item = byClusterId.get(clusterId)
    if (!item) return null
    if (item.confirmedName?.trim()) return item.confirmedName.trim()
    if (item.mergeIntoClusterId) return getResolvedName(item.mergeIntoClusterId, seen)
    return null
  }

  return new Map(reviewItems.map((item) => [item.clusterId, getResolvedName(item.clusterId)]))
}

async function fetchExistingPhotosByIds(ids) {
  const existing = []

  for (const idChunk of chunk(ids, PHOTO_LOOKUP_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from('photos')
      .select('id, url, faces')
      .in('id', idChunk)

    if (error) {
      throw error
    }

    existing.push(...(data || []))
  }

  return new Map(existing.map((row) => [row.id, row]))
}

function normalizeFaces(faces) {
  return JSON.stringify(
    [...faces]
      .map((face) => ({
        id: face.id,
        name: face.name,
        x: face.x,
        y: face.y,
        box: face.box ?? null,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  )
}

async function main() {
  const absoluteWorkingRoot = path.resolve(workingRoot)
  const organizedRoot = path.join(absoluteWorkingRoot, 'organized')
  const facesRoot = path.join(absoluteWorkingRoot, 'faces')
  const publishRoot = path.join(absoluteWorkingRoot, 'publish')
  const organizationManifestPath = path.join(organizedRoot, 'organization-manifest.json')
  const annotationsPath = path.join(facesRoot, 'face-annotations-by-photo.json')
  const reviewPath = reviewPathArg
    ? path.resolve(reviewPathArg)
    : path.join(facesRoot, 'face-review.json')

  const organizationManifest = await readJson(organizationManifestPath)
  const annotationsByPhoto = await readJson(annotationsPath)
  const reviewItems = await readJson(reviewPath)

  const confirmedNames = resolveConfirmedNames(reviewItems)
  const annotationsByRecordId = new Map(annotationsByPhoto.map((annotation) => [annotation.recordId, annotation.faces]))
  const annotationsByRelativePath = new Map(
    annotationsByPhoto.map((annotation) => [annotation.relativePath, annotation.faces]),
  )

  const targetIds = organizationManifest
    .map((item) => item.photoRowId || item.id)
    .filter(Boolean)
  const existingById = await fetchExistingPhotosByIds(targetIds)
  const updates = []
  const unchanged = []
  const missing = []

  for (const item of organizationManifest) {
    const photoRowId = item.photoRowId || item.id
    const existing = existingById.get(photoRowId)
    if (!existing) {
      missing.push({
        id: photoRowId,
        relativePath: item.relativePath,
      })
      continue
    }

    const faces = (annotationsByRecordId.get(photoRowId) ?? annotationsByRelativePath.get(item.relativePath) ?? [])
      .map((face, index) => {
        const confirmedName = confirmedNames.get(face.clusterId)
        if (!confirmedName) return null

        return {
          id: `${face.clusterId}-${index + 1}`,
          name: confirmedName,
          x: face.x,
          y: face.y,
          box: face.box ?? null,
        }
      })
      .filter(Boolean)

    if (normalizeFaces(faces) === normalizeFaces(existing.faces ?? [])) {
      unchanged.push({
        id: photoRowId,
        url: existing.url,
        faceCount: faces.length,
      })
      continue
    }

    updates.push({
      id: photoRowId,
      url: existing.url,
      faces,
    })
  }

  for (const updateChunk of chunk(updates, PHOTO_LOOKUP_CHUNK_SIZE)) {
    const { error } = await supabase
      .from('photos')
      .upsert(updateChunk, { onConflict: 'id' })

    if (error) {
      throw error
    }
  }

  const report = {
    workingRoot: absoluteWorkingRoot,
    updatedPhotoRows: updates.length,
    unchangedPhotoRows: unchanged.length,
    missingPhotoRows: missing.length,
    generatedAt: new Date().toISOString(),
    updatedRows: updates.map((item) => ({
      id: item.id,
      url: item.url,
      faceCount: item.faces.length,
    })),
    missingRows: missing,
  }

  const reportPath = path.join(publishRoot, 'guest-photo-face-sync-report.json')
  const summaryPath = path.join(publishRoot, 'guest-photo-face-sync-report.md')

  await writeJson(reportPath, report)
  await writeMarkdown(summaryPath, [
    '# Guest Photo Face Sync Report',
    '',
    `Working root: \`${absoluteWorkingRoot}\``,
    '',
    `Updated photo rows: **${updates.length}**`,
    `Unchanged photo rows: **${unchanged.length}**`,
    `Missing photo rows: **${missing.length}**`,
    '',
    '## Notes',
    '- This sync updates only the `faces` field on the existing guest `photos` rows.',
    '- The local digiKam metadata is treated as the source of truth for confirmed guest face tags.',
  ])

  console.log(`Updated ${updates.length} guest photo rows with digiKam face metadata`)
  console.log(`Skipped ${unchanged.length} guest photo rows that were already current`)
  console.log(`Wrote sync report to ${reportPath}`)
}

await main()
