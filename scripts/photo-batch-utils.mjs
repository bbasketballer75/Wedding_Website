import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import sharp from 'sharp'
import exifr from 'exifr'

const execFileAsync = promisify(execFile)

export const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'])
export const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v'])
export const IMAGE_TOOL_LONG_EDGE = 1800
export const CANONICAL_ALBUMS = ['Engagement', 'Bach+ette', 'Wedding Day', 'Guest Uploads']

const TOP_LEVEL_RULES = [
  {
    match: 'mikaylabyersphotography',
    source: 'professional',
    collection: 'Wedding Day',
    storyLane: 'wedding-day',
    memoryTrail: 'ceremony',
  },
  {
    match: 'guest-shared',
    source: 'guest',
    collection: 'Guest Uploads',
    storyLane: 'wedding-day',
    memoryTrail: 'dance-floor',
  },
  {
    match: 'bachelor+ette',
    source: 'bach+ette',
    collection: 'Bach+ette',
    storyLane: 'bach-ette',
    memoryTrail: 'bach-ette',
  },
]

export function toPosix(value) {
  return value.replaceAll('\\', '/')
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function hashString(value) {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(36)
}

export function sanitizePathSegment(segment) {
  const lastDotIndex = segment.lastIndexOf('.')
  const hasExtension = lastDotIndex > 0
  const base = hasExtension ? segment.slice(0, lastDotIndex) : segment
  const extension = hasExtension ? segment.slice(lastDotIndex) : ''
  const safeBase = base.replace(/[^A-Za-z0-9._-]/g, '_')

  if (safeBase === base) {
    return `${safeBase}${extension}`
  }

  return `${safeBase}__${hashString(segment)}${extension}`
}

export function toRemoteMediaObjectPath(relativePath, prefix = 'media') {
  const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath

  return [prefix, ...cleanPath.split('/').filter(Boolean)]
    .map(sanitizePathSegment)
    .join('/')
}

export function toSiteMediaPath(relativePath, prefix = '/media') {
  const cleanPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
  const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath
  return `${cleanPrefix}/${toPosix(cleanPath)}`
}

export function createStableId(prefix, ...parts) {
  const hash = crypto
    .createHash('sha1')
    .update(parts.filter(Boolean).join('::'))
    .digest('hex')
    .slice(0, 12)
  return `${prefix}-${hash}`
}

export function baseName(filename) {
  return path.parse(filename).name.toLowerCase()
}

export function csvEscape(value) {
  const stringValue = value == null ? '' : String(value)
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }
  return stringValue
}

export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

export async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath))
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

export async function writeMarkdown(filePath, lines) {
  await ensureDir(path.dirname(filePath))
  await fs.writeFile(filePath, `${lines.join('\n')}\n`)
}

export async function writeCsv(filePath, rows, headers) {
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ]
  await ensureDir(path.dirname(filePath))
  await fs.writeFile(filePath, `${lines.join('\n')}\n`)
}

export async function pathExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

export async function assertExists(targetPath, label = 'path') {
  if (!(await pathExists(targetPath))) {
    throw new Error(`${label} not found: ${targetPath}`)
  }
}

export async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const results = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...await walk(fullPath))
    } else if (entry.isFile()) {
      results.push(fullPath)
    }
  }

  return results
}

export function inferSourceInfo(topLevelFolder) {
  const lower = topLevelFolder.toLowerCase()
  const matched = TOP_LEVEL_RULES.find((rule) => lower.includes(rule.match))

  if (matched) {
    return {
      source: matched.source,
      collection: matched.collection,
      storyLaneSuggestion: matched.storyLane,
      memoryTrailSuggestion: matched.memoryTrail,
    }
  }

  return {
    source: 'unknown',
    collection: 'Uncategorized',
    storyLaneSuggestion: 'review',
    memoryTrailSuggestion: null,
  }
}

export function normalizeAlbum(value) {
  const normalized = String(value ?? '').trim().toLowerCase()

  if (normalized === 'engagement') return 'Engagement'

  if (
    normalized === 'bach+ette' ||
    normalized === 'bach' ||
    normalized === 'bachelorette' ||
    normalized === 'bachelor'
  ) {
    return 'Bach+ette'
  }

  if (
    normalized === 'wedding day' ||
    normalized === 'wedding-day'
  ) {
    return 'Wedding Day'
  }

  if (
    normalized === 'guest uploads' ||
    normalized === 'guest-upload' ||
    normalized === 'guest uploads/wedding day' ||
    normalized === 'guest'
  ) {
    return 'Guest Uploads'
  }

  return null
}

export function inferCanonicalAlbum(topLevelFolder, relativePath = '') {
  const sourceInfo = inferSourceInfo(topLevelFolder)
  const haystack = `${topLevelFolder} ${relativePath}`.toLowerCase()

  if (sourceInfo.source === 'guest') {
    return 'Guest Uploads'
  }

  if (sourceInfo.source === 'bach+ette') {
    return 'Bach+ette'
  }

  if (sourceInfo.source === 'professional') {
    if (haystack.includes('engagement') || haystack.includes('proposal')) {
      return 'Engagement'
    }

    return 'Wedding Day'
  }

  return normalizeAlbum(relativePath)
}

function inferOrientation(width, height) {
  if (!width || !height) return 'unknown'
  if (width > height) return 'landscape'
  if (height > width) return 'portrait'
  return 'square'
}

function inferStoryFromText(text, fallback) {
  const haystack = text.toLowerCase()

  if (haystack.includes('proposal') || haystack.includes('engagement')) {
    return {
      collection: 'Engagement',
      storyLaneSuggestion: 'engagement-season',
      memoryTrailSuggestion: 'engagement-season',
    }
  }

  if (
    haystack.includes('bach') ||
    haystack.includes('bachelorette') ||
    haystack.includes('bachelor') ||
    haystack.includes('ette')
  ) {
    return {
      collection: 'Bach+ette',
      storyLaneSuggestion: 'bach-ette',
      memoryTrailSuggestion: 'bach-ette',
    }
  }

  if (haystack.includes('dance')) {
    return {
      collection: 'Wedding Day',
      storyLaneSuggestion: 'wedding-day',
      memoryTrailSuggestion: 'dance-floor',
    }
  }

  if (haystack.includes('family') || haystack.includes('parent')) {
    return {
      collection: 'Wedding Day',
      storyLaneSuggestion: 'wedding-day',
      memoryTrailSuggestion: 'family',
    }
  }

  return fallback
}

function normalizeCaptureDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function variance(values) {
  if (values.length === 0) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  return values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length
}

async function buildAverageHash(image) {
  const resized = await image
    .clone()
    .resize(16, 16, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer()

  const avg = resized.reduce((sum, value) => sum + value, 0) / resized.length
  return Array.from(resized, (value) => (value >= avg ? '1' : '0')).join('')
}

async function estimateSharpness(image) {
  const { data, info } = await image
    .clone()
    .resize({ width: 160, height: 160, fit: 'inside', withoutEnlargement: true })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const values = []
  for (let y = 1; y < info.height - 1; y += 1) {
    for (let x = 1; x < info.width - 1; x += 1) {
      const index = y * info.width + x
      const center = data[index]
      const laplacian =
        (4 * center) -
        data[index - 1] -
        data[index + 1] -
        data[index - info.width] -
        data[index + info.width]
      values.push(laplacian)
    }
  }

  return variance(values)
}

function buildQualityScore({
  width,
  height,
  brightness,
  sharpness,
  format,
  hasCaptureDate,
  hasLocation,
}) {
  const resolutionScore = clamp(((width || 0) * (height || 0)) / 4_000_000, 0, 1.6)
  const brightnessTarget = brightness == null ? 0.45 : 1 - Math.min(Math.abs(brightness - 0.55), 0.55)
  const sharpnessScore = clamp((sharpness || 0) / 5000, 0, 1.5)
  const formatScore = format === 'heif' || format === 'heic' || format === 'jpeg' || format === 'webp' ? 0.1 : 0
  const captureScore = hasCaptureDate ? 0.15 : 0
  const locationScore = hasLocation ? 0.05 : 0

  const total =
    (resolutionScore * 0.45) +
    (brightnessTarget * 0.2) +
    (sharpnessScore * 0.2) +
    formatScore +
    captureScore +
    locationScore

  return Number((clamp(total, 0, 2.5) * 40).toFixed(2))
}

export async function fileHash(filePath) {
  const buffer = await fs.readFile(filePath)
  return crypto.createHash('sha1').update(buffer).digest('hex')
}

export async function getVideoMetadata(filePath) {
  const stat = await fs.stat(filePath)
  let parsed = null

  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ])
    parsed = JSON.parse(stdout)
  } catch {
    parsed = null
  }

  const videoStream = parsed?.streams?.find((stream) => stream.codec_type === 'video') ?? null
  const captureDate =
    normalizeCaptureDate(parsed?.format?.tags?.creation_time) ??
    normalizeCaptureDate(stat.mtime)

  return {
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
    orientation: inferOrientation(videoStream?.width ?? null, videoStream?.height ?? null),
    format: parsed?.format?.format_name ?? path.extname(filePath).slice(1),
    durationSeconds: parsed?.format?.duration ? Number(parsed.format.duration) : null,
    captureDate,
    captureDateSource: parsed?.format?.tags?.creation_time ? 'ffprobe.creation_time' : 'filesystem.mtime',
    latitude: null,
    longitude: null,
    qualityScore: null,
    averageHash: null,
    sharpness: null,
    brightness: null,
  }
}

export async function getImageMetadata(filePath, fallbackText = '') {
  const stat = await fs.stat(filePath)
  const image = sharp(filePath, { failOn: 'none' }).rotate()
  const [metadata, stats, exifData, averageHash, sharpness] = await Promise.all([
    image.metadata(),
    image.clone().stats().catch(() => null),
    exifr.parse(filePath, {
      pick: [
        'DateTimeOriginal',
        'CreateDate',
        'ModifyDate',
        'GPSLatitude',
        'GPSLongitude',
        'Make',
        'Model',
        'LensModel',
      ],
      tiff: true,
      ifd0: true,
      exif: true,
      gps: true,
    }).catch(() => null),
    buildAverageHash(image).catch(() => null),
    estimateSharpness(image).catch(() => null),
  ])

  const width = metadata.width ?? null
  const height = metadata.height ?? null
  const orientation = inferOrientation(width, height)
  const brightness = stats?.channels
    ? Number(
      (
        stats.channels
          .slice(0, 3)
          .reduce((sum, channel) => sum + channel.mean, 0) /
        (Math.min(stats.channels.length, 3) * 255)
      ).toFixed(4)
    )
    : null

  const fallbackInfo = inferSourceInfo(fallbackText)
  const inferredStory = inferStoryFromText(
    `${fallbackText} ${path.basename(filePath)}`,
    fallbackInfo,
  )

  const captureDate =
    normalizeCaptureDate(exifData?.DateTimeOriginal) ??
    normalizeCaptureDate(exifData?.CreateDate) ??
    normalizeCaptureDate(exifData?.ModifyDate) ??
    normalizeCaptureDate(stat.mtime)

  const captureDateSource =
    exifData?.DateTimeOriginal ? 'exif.DateTimeOriginal'
      : exifData?.CreateDate ? 'exif.CreateDate'
        : exifData?.ModifyDate ? 'exif.ModifyDate'
          : 'filesystem.mtime'

  const hasLocation =
    typeof exifData?.GPSLatitude === 'number' &&
    typeof exifData?.GPSLongitude === 'number'

  return {
    width,
    height,
    orientation,
    format: metadata.format ?? null,
    captureDate,
    captureDateSource,
    latitude: hasLocation ? Number(exifData.GPSLatitude.toFixed(6)) : null,
    longitude: hasLocation ? Number(exifData.GPSLongitude.toFixed(6)) : null,
    cameraMake: exifData?.Make ?? null,
    cameraModel: exifData?.Model ?? null,
    lensModel: exifData?.LensModel ?? null,
    averageHash,
    sharpness: sharpness == null ? null : Number(sharpness.toFixed(2)),
    brightness,
    qualityScore: buildQualityScore({
      width,
      height,
      brightness,
      sharpness,
      format: metadata.format,
      hasCaptureDate: captureDateSource !== 'filesystem.mtime',
      hasLocation,
    }),
    collection: inferredStory.collection,
    storyLaneSuggestion: inferredStory.storyLaneSuggestion,
    memoryTrailSuggestion: inferredStory.memoryTrailSuggestion,
  }
}

export function buildBaseKey(record) {
  const name = path.parse(record.filename).name
  const normalized = name.replace(/[-_](?:IMG|DSC)?[0-9a-f]{3,}$/i, '')
  return `${record.topLevelFolder}::${normalized}`
}

export function hammingDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Number.POSITIVE_INFINITY
  let distance = 0
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) distance += 1
  }
  return distance
}

export function buildMarkdownTable(rows, headers) {
  const headerRow = `| ${headers.join(' | ')} |`
  const divider = `| ${headers.map(() => '---').join(' | ')} |`
  const body = rows.map((row) => `| ${headers.map((header) => String(row[header] ?? '')).join(' | ')} |`)
  return [headerRow, divider, ...body].join('\n')
}

export function getKind(extension) {
  if (IMAGE_EXTENSIONS.has(extension)) return 'image'
  if (VIDEO_EXTENSIONS.has(extension)) return 'video'
  return 'other'
}

export function createTopLevelSummary(records) {
  const byFolder = new Map()

  for (const record of records) {
    const current = byFolder.get(record.topLevelFolder) ?? {
      count: 0,
      totalBytes: 0,
      images: 0,
      videos: 0,
      portraits: 0,
      landscapes: 0,
      squares: 0,
    }

    current.count += 1
    current.totalBytes += record.sizeBytes
    if (record.kind === 'image') current.images += 1
    if (record.kind === 'video') current.videos += 1
    if (record.orientation === 'portrait') current.portraits += 1
    if (record.orientation === 'landscape') current.landscapes += 1
    if (record.orientation === 'square') current.squares += 1
    byFolder.set(record.topLevelFolder, current)
  }

  return [...byFolder.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([folder, summary]) => ({
      folder,
      ...summary,
      totalGB: Number((summary.totalBytes / (1024 * 1024 * 1024)).toFixed(2)),
    }))
}
