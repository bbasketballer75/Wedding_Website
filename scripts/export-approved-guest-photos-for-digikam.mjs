import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  createStableId,
  ensureDir,
  sanitizePathSegment,
  slugify,
  toPosix,
  writeJson,
  writeMarkdown,
} from './photo-batch-utils.mjs'
import { createClient } from '@supabase/supabase-js'

const workingRoot = process.argv[2]

if (!workingRoot) {
  console.error('Usage: node scripts/export-approved-guest-photos-for-digikam.mjs <working-root>')
  process.exit(1)
}

const PROJECT_URL = process.env.VITE_SUPABASE_URL
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const MEDIA_BASE_URL = process.env.VITE_MEDIA_BASE_URL
const PAGE_SIZE = 200

if (!PROJECT_URL) {
  throw new Error('Missing VITE_SUPABASE_URL')
}

if (!ANON_KEY) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY')
}

if (!MEDIA_BASE_URL) {
  throw new Error('Missing VITE_MEDIA_BASE_URL')
}

const supabase = createClient(PROJECT_URL, ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

function resolveMediaUrl(url) {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url

  const base = MEDIA_BASE_URL.endsWith('/') ? MEDIA_BASE_URL.slice(0, -1) : MEDIA_BASE_URL
  const cleanPath = url.startsWith('/') ? url : `/${url}`
  return `${base}${cleanPath}`
}

function inferExtension(photoUrl) {
  try {
    const pathname = new URL(photoUrl).pathname
    return path.extname(pathname) || '.webp'
  } catch {
    return path.extname(photoUrl) || '.webp'
  }
}

function buildGuestRelativePath(item) {
  const categorySlug = slugify(item.collection || 'guest-uploads') || 'guest-uploads'
  const guestSlug = slugify(item.guestName || 'guest') || 'guest'
  const datePart = String(item.created_at || '').slice(0, 10) || 'undated'
  const sourceUrl = resolveMediaUrl(item.url) || item.url
  const extension = inferExtension(sourceUrl)
  const baseName = (() => {
    try {
      return path.basename(new URL(sourceUrl).pathname, extension)
    } catch {
      return path.basename(String(sourceUrl || item.id), extension)
    }
  })()

  const safeBase = sanitizePathSegment(baseName || item.id).replace(/\.[^.]+$/, '')
  return toPosix(path.join('Guest Uploads', categorySlug, guestSlug, `${datePart}-${item.id}-${safeBase}${extension}`))
}

async function fetchApprovedGuestUploads() {
  const uploads = []
  let from = 0

  while (true) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('guest_uploads')
      .select('id, guest_name, guest_email, photo_urls, photo_fingerprints, status, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: true })
      .range(from, to)

    if (error) {
      throw error
    }

    const rows = data || []
    uploads.push(...rows)

    if (rows.length < PAGE_SIZE) {
      break
    }

    from += PAGE_SIZE
  }

  return uploads
}

async function fetchPhotoRowsByUrls(urls) {
  const rows = []

  for (let index = 0; index < urls.length; index += PAGE_SIZE) {
    const urlChunk = urls.slice(index, index + PAGE_SIZE)
    const { data, error } = await supabase
      .from('photos')
      .select('id, url, thumbnail, caption, category, location, date, photographer, tags, faces, created_at')
      .in('url', urlChunk)

    if (error) {
      throw error
    }

    rows.push(...(data || []))
  }

  return new Map(rows.map((row) => [row.url, row]))
}

async function downloadToFile(url, destinationPath) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  await ensureDir(path.dirname(destinationPath))
  await fs.writeFile(destinationPath, Buffer.from(arrayBuffer))
}

async function main() {
  const absoluteWorkingRoot = path.resolve(workingRoot)
  const organizedRoot = path.join(absoluteWorkingRoot, 'organized')
  const publishRoot = path.join(absoluteWorkingRoot, 'publish')
  const uploads = await fetchApprovedGuestUploads()
  const uploadItems = uploads.flatMap((upload) =>
    (upload.photo_urls || []).map((url, index) => ({
      uploadId: upload.id,
      url,
      fingerprint: upload.photo_fingerprints?.[index] || null,
      guestName: upload.guest_name,
      guestEmail: upload.guest_email,
      created_at: upload.created_at,
    })),
  )
  const liveRowsByUrl = await fetchPhotoRowsByUrls(uploadItems.map((item) => item.url))

  const downloadedItems = []

  for (const item of uploadItems) {
    const sourceUrl = resolveMediaUrl(item.url)
    if (!sourceUrl) continue

    const liveRow = liveRowsByUrl.get(item.url)
    const relativePath = buildGuestRelativePath({
      ...item,
      id: liveRow?.id || createStableId('guest-upload-photo', item.uploadId, item.url),
      collection: liveRow?.category || 'Guest Uploads',
    })
    const destinationPath = path.join(organizedRoot, relativePath)

    await downloadToFile(sourceUrl, destinationPath)

    downloadedItems.push({
      id: liveRow?.id || createStableId('guest-upload-photo', item.uploadId, item.url),
      photoRowId: liveRow?.id || null,
      guestUploadId: item.uploadId,
      relativePath,
      destination: destinationPath,
      destinationRelativePath: relativePath,
      kind: 'image',
      source: 'guest',
      collection: liveRow?.category || 'Guest Uploads',
      storyLaneSuggestion: slugify(liveRow?.category || 'guest-uploads') || 'guest-uploads',
      remoteUrl: item.url,
      remoteThumbnailUrl: liveRow?.thumbnail ?? item.url,
      caption: liveRow?.caption ?? null,
      location: liveRow?.location ?? null,
      captureDate: liveRow?.date ?? item.created_at ?? null,
      photographer: liveRow?.photographer ?? `${item.guestName} (Guest)`,
      existingFaces: liveRow?.faces ?? [],
      existingTags: liveRow?.tags ?? [],
      guestName: item.guestName,
      guestEmail: item.guestEmail,
      fingerprint: item.fingerprint,
      created_at: item.created_at ?? null,
    })
  }

  const manifestPath = path.join(organizedRoot, 'organization-manifest.json')
  const reportPath = path.join(publishRoot, 'guest-photo-tagging-export-report.json')
  const summaryPath = path.join(publishRoot, 'guest-photo-tagging-export-report.md')

  await writeJson(manifestPath, downloadedItems)
  await writeJson(reportPath, {
    workingRoot: absoluteWorkingRoot,
    approvedGuestUploadCount: uploads.length,
    exportedPhotoCount: downloadedItems.length,
    matchedLivePhotoRowCount: downloadedItems.filter((item) => item.photoRowId).length,
    generatedAt: new Date().toISOString(),
    items: downloadedItems.map((item) => ({
      id: item.id,
      photoRowId: item.photoRowId,
      guestUploadId: item.guestUploadId,
      relativePath: item.relativePath,
      remoteUrl: item.remoteUrl,
      collection: item.collection,
    })),
  })
  await writeMarkdown(summaryPath, [
    '# Guest Photo Tagging Export Report',
    '',
    `Working root: \`${absoluteWorkingRoot}\``,
    '',
    `Approved guest uploads scanned: **${uploads.length}**`,
    `Guest photos exported: **${downloadedItems.length}**`,
    `Matched live photo rows: **${downloadedItems.filter((item) => item.photoRowId).length}**`,
    '',
    '## Next Step',
    `1. Open \`${organizedRoot}\` in digiKam.`,
    '2. Detect and recognize faces.',
    '3. Run `Album -> Write Metadata to Files`.',
    `4. Run \`npm run media:batch:faces:digikam -- "${absoluteWorkingRoot}"\`.`,
    `5. Run \`npm run media:guest:tag:sync -- "${absoluteWorkingRoot}"\`.`,
  ])

  console.log(`Exported ${downloadedItems.length} approved guest-upload photos to ${organizedRoot}`)
  console.log(`Wrote organization manifest to ${manifestPath}`)
  console.log(`Wrote export report to ${reportPath}`)
}

await main()
