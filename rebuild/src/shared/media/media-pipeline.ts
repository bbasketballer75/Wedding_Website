/**
 * Media optimisation pipeline helpers (pure, no `sharp` import).
 *
 * `rebuild/scripts/media-optimize.mjs` uses these helpers for planning,
 * deterministic naming, config validation and manifest serialisation; the
 * actual encoding is the only part that needs `sharp` (devDependency, installed
 * by the Lead after approval).
 *
 * Output contract: the build is self-contained — derivatives live under
 * `rebuild/public/images/optimized/**` and are never symlinks/copies of the
 * legacy sources. Source directories are read-only inputs.
 */
import type {
  ImageFormat,
  MediaDerivative,
  MediaManifest,
  MediaManifestConfig,
  MediaManifestEntry,
} from './media-manifest.ts'
import {
  DEFAULT_MEDIA_QUALITY,
  DEFAULT_MEDIA_WIDTHS,
  IMAGE_FORMATS,
  IMAGE_MIME_TYPES,
} from './media-manifest.ts'

export type SourceImageFormat = 'png' | 'jpeg' | 'webp'

export interface ImageDimensions {
  width: number
  height: number
  format: SourceImageFormat
}

export interface MediaPipelineConfig extends MediaManifestConfig {
  sourceDir: string
  outputDir: string
  publicPath: string
  manifestPath: string
  /** Optional include filters (substring/slug match) — approved subsets. */
  include: string[]
  /** Optional exclude filters. */
  exclude: string[]
}

export const DEFAULT_MEDIA_PIPELINE_CONFIG: MediaPipelineConfig = {
  sourceDir: '../public/images',
  outputDir: 'public/images/optimized',
  publicPath: '/images/optimized',
  manifestPath: 'src/shared/media/media-manifest.json',
  widths: [...DEFAULT_MEDIA_WIDTHS],
  formats: [...IMAGE_FORMATS],
  quality: { ...DEFAULT_MEDIA_QUALITY },
  generator: 'scripts/media-optimize.mjs',
  include: [],
  exclude: [],
}

/* ------------------------------------------------------------------------- */
/* Minimal raster header parsing (no dependency; used by --plan/--check)     */
/* ------------------------------------------------------------------------- */

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  let result = ''
  for (let index = 0; index < length; index++) {
    result += String.fromCharCode(bytes[offset + index] ?? 0)
  }
  return result
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0)
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8)
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16)
}

export function detectImageFormat(bytes: Uint8Array): SourceImageFormat | null {
  if (bytes.length >= 8 && readAscii(bytes, 0, 8) === '\x89PNG\r\n\x1a\n') return 'png'
  if (bytes.length >= 3 && (bytes[0] ?? 0) === 0xff && (bytes[1] ?? 0) === 0xd8) return 'jpeg'
  if (
    bytes.length >= 12 &&
    readAscii(bytes, 0, 4) === 'RIFF' &&
    readAscii(bytes, 8, 4) === 'WEBP'
  ) {
    return 'webp'
  }
  return null
}

function parseJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  let offset = 2
  while (offset + 9 < bytes.length) {
    if ((bytes[offset] ?? 0) !== 0xff) {
      offset += 1
      continue
    }
    let marker = bytes[offset + 1] ?? 0
    // Skip fill bytes.
    while (marker === 0xff && offset + 2 < bytes.length) {
      offset += 1
      marker = bytes[offset + 1] ?? 0
    }
    const SOF_MARKERS = new Set([
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
    ])
    if (SOF_MARKERS.has(marker)) {
      const height = readUint16BE(bytes, offset + 5)
      const width = readUint16BE(bytes, offset + 7)
      if (width > 0 && height > 0) return { width, height }
      return null
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    const segmentLength = readUint16BE(bytes, offset + 2)
    if (segmentLength < 2) return null
    offset += 2 + segmentLength
  }
  return null
}

function parseWebpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const chunk = readAscii(bytes, 12, 4)
  if (chunk === 'VP8X') {
    const width = readUint24LE(bytes, 24) + 1
    const height = readUint24LE(bytes, 27) + 1
    return { width, height }
  }
  if (chunk === 'VP8L') {
    if ((bytes[20] ?? 0) !== 0x2f) return null
    const bits = readUint32LE(bytes, 21)
    const width = (bits & 0x3fff) + 1
    const height = ((bits >> 14) & 0x3fff) + 1
    return { width, height }
  }
  if (chunk === 'VP8 ') {
    if ((bytes[23] ?? 0) !== 0x9d || (bytes[24] ?? 0) !== 0x01 || (bytes[25] ?? 0) !== 0x2a) {
      return null
    }
    const width = readUint16LE(bytes, 26) & 0x3fff
    const height = readUint16LE(bytes, 28) & 0x3fff
    return { width, height }
  }
  return null
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  )
}

/** Read raster dimensions/format from the file header bytes only. */
export function readImageDimensions(bytes: Uint8Array): ImageDimensions {
  const format = detectImageFormat(bytes)
  if (!format) throw new TypeError('media: unsupported or corrupt image (expected PNG/JPEG/WebP)')

  if (format === 'png') {
    const width =
      ((bytes[16] ?? 0) << 24) |
      ((bytes[17] ?? 0) << 16) |
      ((bytes[18] ?? 0) << 8) |
      (bytes[19] ?? 0)
    const height =
      ((bytes[20] ?? 0) << 24) |
      ((bytes[21] ?? 0) << 16) |
      ((bytes[22] ?? 0) << 8) |
      (bytes[23] ?? 0)
    return { width, height, format }
  }

  const parsed = format === 'jpeg' ? parseJpegDimensions(bytes) : parseWebpDimensions(bytes)
  if (!parsed || parsed.width <= 0 || parsed.height <= 0) {
    throw new TypeError(`media: could not parse ${format} dimensions`)
  }
  return { ...parsed, format }
}

/* ------------------------------------------------------------------------- */
/* Deterministic naming + planning                                           */
/* ------------------------------------------------------------------------- */

/** `home/intro-video-poster.png` → `home-intro-video-poster`. */
export function sanitizeSlug(relativePath: string): string {
  return relativePath
    .trim()
    .replace(/\.[a-z0-9]+$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function derivativeFileName(slug: string, width: number, format: ImageFormat): string {
  return `${slug}-${width}.${format}`
}

export function derivativePublicPath(config: MediaPipelineConfig, fileName: string): string {
  return `${config.publicPath.replace(/\/+$/, '')}/${fileName}`
}

/**
 * Widths to emit for one source: every configured width that does not upscale,
 * plus the source's own width when it is smaller than the largest configured
 * width (so DPR-2 hero images keep their original resolution tier).
 */
export function plannedWidths(sourceWidth: number, config: MediaPipelineConfig): number[] {
  if (!Number.isFinite(sourceWidth) || sourceWidth <= 0) {
    throw new TypeError('media: source width must be a positive number')
  }
  const widths = [
    ...new Set(config.widths.filter(width => width > 0 && width <= sourceWidth)),
  ].sort((a, b) => a - b)
  const maxConfigured = config.widths.length > 0 ? Math.max(...config.widths) : 0
  if (
    widths.length === 0 ||
    (sourceWidth <= maxConfigured && widths[widths.length - 1] !== sourceWidth)
  ) {
    widths.push(Math.round(sourceWidth))
  }
  return [...new Set(widths)].sort((a, b) => a - b)
}

export interface PlannedDerivative {
  source: string
  slug: string
  width: number
  format: ImageFormat
  fileName: string
  publicPath: string
}

export interface SourceImagePlan {
  source: string
  sourcePath: string
  relativePath: string
  width: number
  height: number
  format: SourceImageFormat
  slug: string
  widths: number[]
  derivatives: PlannedDerivative[]
}

/** Build every derivative target for one source file. */
export function planSourceDerivatives(
  input: {
    relativePath: string
    width: number
    height: number
    format: SourceImageFormat
  },
  config: MediaPipelineConfig
): SourceImagePlan {
  if (input.relativePath.startsWith('/') || input.relativePath.includes('..')) {
    throw new TypeError(`media: invalid relative path "${input.relativePath}"`)
  }
  const slug = sanitizeSlug(input.relativePath)
  if (!slug) throw new TypeError(`media: cannot derive a slug from "${input.relativePath}"`)

  const widths = plannedWidths(input.width, config)
  const derivatives: PlannedDerivative[] = []
  for (const width of widths) {
    for (const format of config.formats) {
      const fileName = derivativeFileName(slug, width, format)
      derivatives.push({
        source: `/images/${input.relativePath}`,
        slug,
        width,
        format,
        fileName,
        publicPath: derivativePublicPath(config, fileName),
      })
    }
  }

  return {
    source: `/images/${input.relativePath}`,
    sourcePath: input.relativePath,
    relativePath: input.relativePath,
    width: input.width,
    height: input.height,
    format: input.format,
    slug,
    widths,
    derivatives,
  }
}

export function computeAspectRatio(width: number, height: number): number {
  if (width <= 0 || height <= 0) throw new TypeError('media: dimensions must be positive')
  return Math.round((width / height) * 10000) / 10000
}

export interface ManifestEntryInput {
  source: string
  width: number
  height: number
  dominantColor: string
  sourceSha256: string
  configHash: string
  derivatives: Record<string, Partial<Record<ImageFormat, MediaDerivative>>>
}

export function createManifestEntry(input: ManifestEntryInput): MediaManifestEntry {
  if (!/^#[0-9a-f]{6}$/i.test(input.dominantColor)) {
    throw new TypeError(`media: dominantColor must be #rrggbb, got "${input.dominantColor}"`)
  }
  return {
    source: input.source,
    width: input.width,
    height: input.height,
    aspectRatio: computeAspectRatio(input.width, input.height),
    dominantColor: input.dominantColor.toLowerCase(),
    sourceSha256: input.sourceSha256,
    configHash: input.configHash,
    derivatives: input.derivatives,
  }
}

/** Deterministic JSON: sorted image keys, numeric width order, format order. */
export function serializeMediaManifest(manifest: MediaManifest): string {
  const images: Record<string, MediaManifestEntry> = {}
  for (const source of Object.keys(manifest.images).sort()) {
    const entry = manifest.images[source]
    if (!entry) continue
    const derivatives: Record<string, Partial<Record<ImageFormat, MediaDerivative>>> = {}
    const widths = Object.keys(entry.derivatives)
      .map(Number)
      .sort((a, b) => a - b)
    for (const width of widths) {
      const formats = entry.derivatives[String(width)]
      if (!formats) continue
      const ordered: Partial<Record<ImageFormat, MediaDerivative>> = {}
      for (const format of IMAGE_FORMATS) {
        const derivative = formats[format]
        if (derivative) ordered[format] = derivative
      }
      derivatives[String(width)] = ordered
    }
    images[source] = { ...entry, derivatives }
  }

  const ordered: MediaManifest = {
    schemaVersion: manifest.schemaVersion,
    config: {
      widths: [...manifest.config.widths].sort((a, b) => a - b),
      formats: [...IMAGE_FORMATS].filter(format => manifest.config.formats.includes(format)),
      quality: manifest.config.quality,
      generator: manifest.config.generator,
    },
    images,
  }
  return `${JSON.stringify(ordered, null, 2)}\n`
}

export interface ExpectedDerivativeFile {
  source: string
  width: number
  format: ImageFormat
  publicPath: string
  /** Path on disk relative to the rebuild root. */
  filePath: string
  bytes: number
  sha256: string
  sourceSha256: string
  configHash: string
}

/** Flatten a manifest into the expected on-disk derivative files (`--check`). */
export function expectedDerivativeFiles(manifest: MediaManifest): ExpectedDerivativeFile[] {
  const expected: ExpectedDerivativeFile[] = []
  for (const source of Object.keys(manifest.images).sort()) {
    const entry = manifest.images[source]
    if (!entry) continue
    const widths = Object.keys(entry.derivatives)
      .map(Number)
      .sort((a, b) => a - b)
    for (const width of widths) {
      const formats = entry.derivatives[String(width)]
      if (!formats) continue
      for (const format of IMAGE_FORMATS) {
        const derivative = formats[format]
        if (!derivative) continue
        expected.push({
          source,
          width,
          format,
          publicPath: derivative.path,
          filePath: derivative.path.replace(/^\//, ''),
          bytes: derivative.bytes,
          sha256: derivative.sha256,
          sourceSha256: entry.sourceSha256,
          configHash: entry.configHash,
        })
      }
    }
  }
  return expected
}

export function formatLabel(format: ImageFormat): string {
  return IMAGE_MIME_TYPES[format]
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new TypeError(`media config: ${label} must be a string array`)
  }
  return value as string[]
}

/** Validate `rebuild/perf/media.config.json` (or CLI overrides). */
export function parseMediaPipelineConfig(input: unknown): MediaPipelineConfig {
  if (!isPlainObject(input)) throw new TypeError('media config: root must be an object')

  const widths = input.widths
  if (
    !Array.isArray(widths) ||
    widths.length === 0 ||
    widths.some(width => typeof width !== 'number' || !Number.isInteger(width) || width <= 0)
  ) {
    throw new TypeError('media config: widths must be a non-empty array of positive integers')
  }

  const formats =
    input.formats === undefined
      ? [...IMAGE_FORMATS]
      : (parseStringArray(input.formats, 'formats') as ImageFormat[])
  for (const format of formats) {
    if (!IMAGE_FORMATS.includes(format)) {
      throw new TypeError(`media config: unsupported format "${format}"`)
    }
  }

  if (input.quality !== undefined && !isPlainObject(input.quality)) {
    throw new TypeError('media config: quality must be an object')
  }
  const quality: Record<ImageFormat, number> = { ...DEFAULT_MEDIA_QUALITY }
  const qualityInput = isPlainObject(input.quality) ? input.quality : {}
  for (const format of IMAGE_FORMATS) {
    const value = qualityInput[format]
    if (value !== undefined) {
      if (typeof value !== 'number' || value < 1 || value > 100) {
        throw new TypeError(`media config: quality.${format} must be 1..100`)
      }
      quality[format] = value
    }
  }

  const optionalString = (value: unknown, fallback: string, label: string): string => {
    if (value === undefined) return fallback
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError(`media config: ${label} must be a non-empty string`)
    }
    return value
  }

  return {
    sourceDir: optionalString(
      input.sourceDir,
      DEFAULT_MEDIA_PIPELINE_CONFIG.sourceDir,
      'sourceDir'
    ),
    outputDir: optionalString(
      input.outputDir,
      DEFAULT_MEDIA_PIPELINE_CONFIG.outputDir,
      'outputDir'
    ),
    publicPath: optionalString(
      input.publicPath,
      DEFAULT_MEDIA_PIPELINE_CONFIG.publicPath,
      'publicPath'
    ),
    manifestPath: optionalString(
      input.manifestPath,
      DEFAULT_MEDIA_PIPELINE_CONFIG.manifestPath,
      'manifestPath'
    ),
    widths: [...new Set(widths as number[])].sort((a, b) => a - b),
    formats: [...IMAGE_FORMATS].filter(format => formats.includes(format)),
    quality,
    generator: optionalString(
      input.generator,
      DEFAULT_MEDIA_PIPELINE_CONFIG.generator,
      'generator'
    ),
    include: input.include === undefined ? [] : parseStringArray(input.include, 'include'),
    exclude: input.exclude === undefined ? [] : parseStringArray(input.exclude, 'exclude'),
  }
}

/** Stable description of the encoding configuration (hashed by the generator). */
export function canonicalConfigJson(config: MediaPipelineConfig): string {
  return JSON.stringify({
    widths: [...config.widths].sort((a, b) => a - b),
    formats: [...IMAGE_FORMATS].filter(format => config.formats.includes(format)),
    quality: {
      avif: config.quality.avif,
      webp: config.quality.webp,
      jpg: config.quality.jpg,
    },
    generator: config.generator,
  })
}
