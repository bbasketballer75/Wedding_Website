/**
 * Media manifest types, constants and runtime validation.
 *
 * Deliberately JSON-free: this module is imported by Node scripts
 * (`scripts/media-optimize.mjs` imports the `.ts` file directly, which Node
 * type-strips) and by the browser components. The generated manifest JSON is
 * only imported by `responsive-image.ts`, which scripts never load, so Node's
 * "JSON imports need attributes" rule never applies to the script graph.
 */

export type ImageFormat = 'avif' | 'webp' | 'jpg'

export const IMAGE_FORMATS: readonly ImageFormat[] = ['avif', 'webp', 'jpg']

export const IMAGE_MIME_TYPES: Record<ImageFormat, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpg: 'image/jpeg',
}

/**
 * Derivative widths, derived from the frozen breakpoints:
 * - `contracts/ui.json` breakpoints: mobile 768, tablet 1024, desktop 1280, wide 1536;
 * - frozen `src/components/ui/OptimizedImage.tsx` ResponsiveImage defaults:
 *   640×480, 768×576, 1024×768, 1280×960;
 * - frozen Home hero poster `w-[min(92vw,72rem)]` (≤1152 CSS px);
 * - frozen engagement cards `min-w-[220px] h-[280px]` (DPR-2 → 440/560);
 * - frozen gallery grid 2 (<768) / 3 (≥768) / 4 (≥1024) columns.
 */
export const DEFAULT_MEDIA_WIDTHS: readonly number[] = [320, 480, 640, 768, 1024, 1280, 1600, 1920]

/** Default quality per format (documented in `rebuild/perf/media.config.json`). */
export const DEFAULT_MEDIA_QUALITY: Record<ImageFormat, number> = {
  avif: 55,
  webp: 80,
  jpg: 82,
}

export interface MediaDerivative {
  path: string
  bytes: number
  sha256: string
}

export interface MediaManifestEntry {
  /** Original public path, e.g. `/images/home/intro-video-poster.png`. */
  source: string
  width: number
  height: number
  aspectRatio: number
  dominantColor: string
  sourceSha256: string
  configHash: string
  /** `derivatives[width][format]` */
  derivatives: Record<string, Partial<Record<ImageFormat, MediaDerivative>>>
}

export interface MediaManifestConfig {
  widths: number[]
  formats: ImageFormat[]
  quality: Record<ImageFormat, number>
  generator: string
}

export interface MediaManifest {
  schemaVersion: number
  config: MediaManifestConfig
  images: Record<string, MediaManifestEntry>
}

export const EMPTY_MEDIA_MANIFEST: MediaManifest = {
  schemaVersion: 1,
  config: {
    widths: [],
    formats: ['avif', 'webp', 'jpg'],
    quality: { ...DEFAULT_MEDIA_QUALITY },
    generator: 'scripts/media-optimize.mjs',
  },
  images: {},
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`media manifest: ${label} must be a finite number`)
  }
  return value
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new TypeError(`media manifest: ${label} must be a string`)
  }
  return value
}

function parseDerivative(value: unknown, label: string): MediaDerivative {
  if (!isPlainObject(value)) throw new TypeError(`media manifest: ${label} must be an object`)
  return {
    path: assertString(value.path, `${label}.path`),
    bytes: assertNumber(value.bytes, `${label}.bytes`),
    sha256: assertString(value.sha256, `${label}.sha256`),
  }
}

/** Runtime validation for the generated manifest (used by scripts and components). */
export function parseMediaManifest(input: unknown): MediaManifest {
  if (!isPlainObject(input)) throw new TypeError('media manifest: root must be an object')
  const schemaVersion = assertNumber(input.schemaVersion, 'schemaVersion')
  if (schemaVersion !== 1) {
    throw new TypeError(`media manifest: unsupported schemaVersion ${schemaVersion}`)
  }

  if (!isPlainObject(input.config)) throw new TypeError('media manifest: config must be an object')
  const config = input.config
  const widths = config.widths
  if (!Array.isArray(widths)) throw new TypeError('media manifest: config.widths must be an array')
  if (!Array.isArray(config.formats)) {
    throw new TypeError('media manifest: config.formats must be an array')
  }
  if (!isPlainObject(config.quality)) {
    throw new TypeError('media manifest: config.quality must be an object')
  }

  const parsedImages: Record<string, MediaManifestEntry> = {}
  const images = input.images
  if (!isPlainObject(images)) throw new TypeError('media manifest: images must be an object')

  for (const [key, rawEntry] of Object.entries(images)) {
    if (!isPlainObject(rawEntry)) {
      throw new TypeError(`media manifest: images["${key}"] must be an object`)
    }
    if (!isPlainObject(rawEntry.derivatives)) {
      throw new TypeError(`media manifest: images["${key}"].derivatives must be an object`)
    }

    const derivatives: Record<string, Partial<Record<ImageFormat, MediaDerivative>>> = {}
    for (const [width, formats] of Object.entries(rawEntry.derivatives)) {
      if (!isPlainObject(formats)) {
        throw new TypeError(`media manifest: images["${key}"].derivatives["${width}"] invalid`)
      }
      const parsedFormats: Partial<Record<ImageFormat, MediaDerivative>> = {}
      for (const format of IMAGE_FORMATS) {
        const derivative = formats[format]
        if (derivative !== undefined) {
          parsedFormats[format] = parseDerivative(
            derivative,
            `images["${key}"].derivatives["${width}"].${format}`
          )
        }
      }
      derivatives[width] = parsedFormats
    }

    parsedImages[key] = {
      source: assertString(rawEntry.source, `images["${key}"].source`),
      width: assertNumber(rawEntry.width, `images["${key}"].width`),
      height: assertNumber(rawEntry.height, `images["${key}"].height`),
      aspectRatio: assertNumber(rawEntry.aspectRatio, `images["${key}"].aspectRatio`),
      dominantColor: assertString(rawEntry.dominantColor, `images["${key}"].dominantColor`),
      sourceSha256: assertString(rawEntry.sourceSha256, `images["${key}"].sourceSha256`),
      configHash: assertString(rawEntry.configHash, `images["${key}"].configHash`),
      derivatives,
    }
  }

  return {
    schemaVersion,
    config: {
      widths: widths.map((width, index) => assertNumber(width, `config.widths[${index}]`)),
      formats: config.formats as ImageFormat[],
      quality: config.quality as Record<ImageFormat, number>,
      generator: assertString(config.generator, 'config.generator'),
    },
    images: parsedImages,
  }
}
