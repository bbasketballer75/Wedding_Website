/**
 * Responsive image delivery helpers (no runtime dependencies).
 *
 * Wave 8 W8-2: the media pipeline (`rebuild/scripts/media-optimize.mjs`) writes
 * AVIF/WebP/JPEG derivatives at the frozen breakpoint widths and records them
 * in `media-manifest.json`. These helpers turn that manifest into `<picture>`
 * `srcset`/`sizes` data and keep a graceful plain-`<img>` fallback for URLs that
 * the pipeline does not own (media CDN `/media/**`, absolute R2 URLs, one-off
 * static files).
 *
 * Frozen sizing evidence lives on `DEFAULT_MEDIA_WIDTHS` / `IMAGE_SIZES` below.
 */
import defaultManifestJson from './media-manifest.json'
import {
  EMPTY_MEDIA_MANIFEST,
  parseMediaManifest,
  type ImageFormat,
  type MediaManifest,
  type MediaManifestEntry,
} from './media-manifest'

export {
  DEFAULT_MEDIA_QUALITY,
  DEFAULT_MEDIA_WIDTHS,
  EMPTY_MEDIA_MANIFEST,
  IMAGE_FORMATS,
  IMAGE_MIME_TYPES,
  parseMediaManifest,
  type ImageFormat,
  type MediaDerivative,
  type MediaManifest,
  type MediaManifestConfig,
  type MediaManifestEntry,
} from './media-manifest'

/**
 * Frozen `sizes` presets for the layouts the archive actually renders.
 * - galleryGrid: 2 cols <768px, 3 cols ≥768px, 4 cols ≥1024px (frozen GalleryGrid).
 * - engagementCard: frozen fixed 220px card.
 * - heroPoster: `min(92vw, 72rem)` on ≥768px.
 * - lightbox: frozen image fills the viewer (`max-w-[90%]`).
 */
export const IMAGE_SIZES = {
  galleryGrid: '(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw',
  engagementCard: '220px',
  heroPoster: '(min-width: 768px) min(92vw, 72rem), 100vw',
  lightbox: '90vw',
  thumbnail: '160px',
} as const

export type ImageSizesPreset = keyof typeof IMAGE_SIZES

/**
 * The committed manifest is validated once at module load; a corrupt manifest
 * fails fast (it is generated, not hand-written). Falls back to the empty
 * manifest for a fresh checkout before the pipeline has run.
 */
function loadDefaultManifest(): MediaManifest {
  try {
    return parseMediaManifest(defaultManifestJson)
  } catch {
    return EMPTY_MEDIA_MANIFEST
  }
}

export const defaultMediaManifest: MediaManifest = loadDefaultManifest()

const RASTER_EXTENSION = /\.(avif|webp|jpe?g|png)$/i

/**
 * The pipeline only owns local `/images/**` rasters. CDN paths (`/media/**`),
 * absolute R2 URLs and non-raster assets keep their frozen plain-`<img>`
 * behavior.
 */
export function isOptimizableImageUrl(src: string): boolean {
  if (!src.startsWith('/images/')) return false
  if (/^https?:\/\//.test(src)) return false
  return RASTER_EXTENSION.test(src.split('?')[0] ?? '')
}

function sortedWidths(derivatives: MediaManifestEntry['derivatives']): number[] {
  return Object.keys(derivatives)
    .map(Number)
    .filter(width => Number.isFinite(width) && width > 0)
    .sort((a, b) => a - b)
}

/** Build a `srcset` for one format, ascending width order. Empty string when absent. */
export function buildSrcSet(entry: MediaManifestEntry, format: ImageFormat): string {
  return sortedWidths(entry.derivatives)
    .map(width => {
      const derivative = entry.derivatives[String(width)]?.[format]
      return derivative ? `${derivative.path} ${width}w` : null
    })
    .filter((part): part is string => part !== null)
    .join(', ')
}

/** Largest available derivative path for the fallback `<img src>`. */
export function getFallbackSource(entry: MediaManifestEntry): string {
  const widths = sortedWidths(entry.derivatives)
  for (let index = widths.length - 1; index >= 0; index--) {
    const width = widths[index]
    if (width === undefined) continue
    const jpg = entry.derivatives[String(width)]?.jpg
    if (jpg) return jpg.path
  }
  return entry.source
}

export interface ResponsiveImageSources {
  avif: string
  webp: string
  jpg: string
  fallbackSrc: string
  width: number
  height: number
  aspectRatio: number
  dominantColor: string
}

/**
 * Resolve the manifest entry for a `src`. Returns `null` when the pipeline does
 * not own the URL (CDN/absolute/unknown static file) → caller renders the
 * frozen plain-`<img>` path.
 */
export function getResponsiveImageSources(
  src: string,
  manifest: MediaManifest = defaultMediaManifest
): ResponsiveImageSources | null {
  const normalizedSrc = src.split('?')[0] ?? src
  if (!isOptimizableImageUrl(normalizedSrc)) return null

  const entry = manifest.images[normalizedSrc] ?? manifest.images[src]
  if (!entry) return null

  return {
    avif: buildSrcSet(entry, 'avif'),
    webp: buildSrcSet(entry, 'webp'),
    jpg: buildSrcSet(entry, 'jpg'),
    fallbackSrc: getFallbackSource(entry),
    width: entry.width,
    height: entry.height,
    aspectRatio: entry.aspectRatio,
    dominantColor: entry.dominantColor,
  }
}

/** `sizes` value for a preset, or the caller's own string. */
export function resolveSizes(sizes: string | undefined): string {
  if (!sizes) return IMAGE_SIZES.galleryGrid
  return (IMAGE_SIZES as Record<string, string>)[sizes] ?? sizes
}

/* ------------------------------------------------------------------------- */
/* Blurhash placeholder (dependency-free decoder, spec algorithm)             */
/* ------------------------------------------------------------------------- */

const BLURHASH_CHARSET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~'

/** Exported for tests/tooling; blurhash base83 decoding. */
export function decodeBase83(value: string): number {
  if (value.length === 0) throw new TypeError('blurhash: empty base83 string')
  let result = 0
  for (const char of value) {
    const index = BLURHASH_CHARSET.indexOf(char)
    if (index < 0) throw new TypeError(`blurhash: invalid base83 character "${char}"`)
    result = result * 83 + index
  }
  return result
}

/** Inverse of `decodeBase83` (exported for deterministic test hashes). */
export function encodeBase83(value: number, length: number): string {
  if (!Number.isInteger(value) || value < 0) throw new TypeError('blurhash: invalid base83 value')
  let result = ''
  for (let index = 1; index <= length; index++) {
    const digit = Math.floor(value / 83 ** (length - index)) % 83
    result += BLURHASH_CHARSET[digit]
  }
  return result
}

function srgbToLinear(value: number): number {
  const normalized = value / 255
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
}

function linearToSrgb(value: number): number {
  const clamped = Math.min(Math.max(value, 0), 1)
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055
}

function decodeDc(value: number): [number, number, number] {
  return [
    srgbToLinear((value >> 16) & 255),
    srgbToLinear((value >> 8) & 255),
    srgbToLinear(value & 255),
  ]
}

export interface DecodedBlurhash {
  width: number
  height: number
  /** RGBA, 4 bytes per pixel. */
  data: Uint8ClampedArray
}

export function isBlurhash(hash: string): boolean {
  if (typeof hash !== 'string' || hash.length < 6) return false
  try {
    const sizeFlag = decodeBase83(hash[0] ?? '')
    const numY = Math.floor(sizeFlag / 9) + 1
    const numX = (sizeFlag % 9) + 1
    return hash.length === 4 + 2 * numX * numY
  } catch {
    return false
  }
}

/**
 * Decode a blurhash into RGBA pixels using the spec algorithm (no dependency).
 * Throws on malformed hashes; callers can gate with `isBlurhash`.
 */
export function decodeBlurhash(hash: string, width: number, height: number): DecodedBlurhash {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new TypeError('blurhash: width and height must be positive integers')
  }
  if (!isBlurhash(hash)) throw new TypeError('blurhash: malformed hash')

  const sizeFlag = decodeBase83(hash[0] ?? '')
  const numY = Math.floor(sizeFlag / 9) + 1
  const numX = (sizeFlag % 9) + 1

  const quantisedMaximumValue = decodeBase83(hash[1] ?? '')
  const maximumValue = (quantisedMaximumValue + 1) / 166

  const colors: Array<[number, number, number]> = []
  colors[0] = decodeDc(decodeBase83(hash.substring(2, 6)))

  for (let index = 1; index < numX * numY; index++) {
    const value = decodeBase83(hash.substring(4 + index * 2, 6 + index * 2))
    colors[index] = [
      srgbToLinear(((value >> 16) & 255) / 255) * maximumValue,
      srgbToLinear(((value >> 8) & 255) / 255) * maximumValue,
      srgbToLinear((value & 255) / 255) * maximumValue,
    ]
  }

  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let red = 0
      let green = 0
      let blue = 0
      for (let j = 0; j < numY; j++) {
        for (let i = 0; i < numX; i++) {
          const basis = Math.cos((Math.PI * x * i) / width) * Math.cos((Math.PI * y * j) / height)
          const color = colors[j * numX + i] ?? [0, 0, 0]
          red += color[0] * basis
          green += color[1] * basis
          blue += color[2] * basis
        }
      }
      const offset = (y * width + x) * 4
      data[offset] = Math.round(linearToSrgb(red) * 255)
      data[offset + 1] = Math.round(linearToSrgb(green) * 255)
      data[offset + 2] = Math.round(linearToSrgb(blue) * 255)
      data[offset + 3] = 255
    }
  }

  return { width, height, data }
}

function rgbToHex(red: number, green: number, blue: number): string {
  const toPart = (value: number) =>
    Math.round(Math.min(Math.max(value, 0), 255))
      .toString(16)
      .padStart(2, '0')
  return `#${toPart(red)}${toPart(green)}${toPart(blue)}`
}

/**
 * Tiny inline placeholder from a blurhash: average colour blocks laid out as a
 * CSS `linear-gradient`. Deterministic, no canvas/DOM needed (SSR/test safe).
 */
export function blurhashToCssBackground(hash: string, columns = 4): string {
  if (columns < 2) throw new TypeError('blurhash: columns must be >= 2')
  const decoded = decodeBlurhash(hash, columns, 1)
  const stops: string[] = []
  for (let x = 0; x < columns; x++) {
    const offset = x * 4
    const color = rgbToHex(
      decoded.data[offset] ?? 0,
      decoded.data[offset + 1] ?? 0,
      decoded.data[offset + 2] ?? 0
    )
    stops.push(color)
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`
}
