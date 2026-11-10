import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MEDIA_PIPELINE_CONFIG,
  canonicalConfigJson,
  computeAspectRatio,
  createManifestEntry,
  derivativeFileName,
  derivativePublicPath,
  detectImageFormat,
  expectedDerivativeFiles,
  parseMediaPipelineConfig,
  planSourceDerivatives,
  plannedWidths,
  readImageDimensions,
  sanitizeSlug,
  serializeMediaManifest,
  type MediaPipelineConfig,
} from './media-pipeline'
import { parseMediaManifest, type MediaManifest } from './responsive-image'

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(40)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8)
  bytes.set([0x49, 0x48, 0x44, 0x52], 12) // IHDR
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

function jpeg(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(40)
  bytes.set([0xff, 0xd8], 0)
  bytes.set([0xff, 0xc0, 0x00, 0x11, 0x08], 2)
  const view = new DataView(bytes.buffer)
  view.setUint16(7, height)
  view.setUint16(9, width)
  return bytes
}

function webpLossless(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(40)
  bytes.set([0x52, 0x49, 0x46, 0x46], 0) // RIFF
  bytes.set([0x24, 0x00, 0x00, 0x00], 4)
  bytes.set([0x57, 0x45, 0x42, 0x50], 8) // WEBP
  bytes.set([0x56, 0x50, 0x38, 0x4c], 12) // VP8L
  bytes.set([0x10, 0x00, 0x00, 0x00], 16)
  bytes[20] = 0x2f
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14)
  new DataView(bytes.buffer).setUint32(21, bits, true)
  return bytes
}

function webpExtended(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(40)
  bytes.set([0x52, 0x49, 0x46, 0x46], 0)
  bytes.set([0x24, 0x00, 0x00, 0x00], 4)
  bytes.set([0x57, 0x45, 0x42, 0x50], 8)
  bytes.set([0x56, 0x50, 0x38, 0x58], 12) // VP8X
  bytes.set([0x0a, 0x00, 0x00, 0x00], 16)
  const widthMinusOne = width - 1
  const heightMinusOne = height - 1
  bytes[24] = widthMinusOne & 0xff
  bytes[25] = (widthMinusOne >> 8) & 0xff
  bytes[26] = (widthMinusOne >> 16) & 0xff
  bytes[27] = heightMinusOne & 0xff
  bytes[28] = (heightMinusOne >> 8) & 0xff
  bytes[29] = (heightMinusOne >> 16) & 0xff
  return bytes
}

const baseConfig: MediaPipelineConfig = {
  ...DEFAULT_MEDIA_PIPELINE_CONFIG,
  widths: [320, 640, 1024, 1280],
  formats: ['avif', 'webp', 'jpg'],
}

describe('image header parsing', () => {
  it('detects formats from magic bytes', () => {
    expect(detectImageFormat(png(10, 10))).toBe('png')
    expect(detectImageFormat(jpeg(10, 10))).toBe('jpeg')
    expect(detectImageFormat(webpLossless(10, 10))).toBe('webp')
    expect(detectImageFormat(new Uint8Array([1, 2, 3]))).toBeNull()
  })

  it('reads PNG/JPEG/WebP dimensions without a decoder', () => {
    expect(readImageDimensions(png(1600, 900))).toEqual({ width: 1600, height: 900, format: 'png' })
    expect(readImageDimensions(jpeg(220, 280))).toEqual({ width: 220, height: 280, format: 'jpeg' })
    expect(readImageDimensions(webpLossless(1920, 1080))).toEqual({
      width: 1920,
      height: 1080,
      format: 'webp',
    })
    expect(readImageDimensions(webpExtended(1200, 800))).toEqual({
      width: 1200,
      height: 800,
      format: 'webp',
    })
  })

  it('throws on unsupported or corrupt headers', () => {
    expect(() => readImageDimensions(new Uint8Array([1, 2, 3]))).toThrow(/unsupported/)
    const corruptJpeg = new Uint8Array([0xff, 0xd8, 0x00, 0x00])
    expect(() => readImageDimensions(corruptJpeg)).toThrow(/dimensions/)
  })
})

describe('deterministic naming', () => {
  it('slugs nested paths predictably', () => {
    expect(sanitizeSlug('home/intro-video-poster.png')).toBe('home-intro-video-poster')
    expect(sanitizeSlug('engagement/PoradaProposal-29.webp')).toBe('engagement-poradaproposal-29')
    expect(sanitizeSlug('parent-film-cards/christine.webp')).toBe('parent-film-cards-christine')
    expect(sanitizeSlug('  Couple/Austin.JPG ')).toBe('couple-austin')
  })

  it('names derivative files and public paths', () => {
    expect(derivativeFileName('home-hero', 640, 'avif')).toBe('home-hero-640.avif')
    expect(derivativePublicPath(baseConfig, 'home-hero-640.avif')).toBe(
      '/images/optimized/home-hero-640.avif'
    )
  })

  it('never upscales and keeps the source tier', () => {
    expect(plannedWidths(1152, baseConfig)).toEqual([320, 640, 1024, 1152])
    expect(plannedWidths(300, baseConfig)).toEqual([300])
    expect(plannedWidths(1920, baseConfig)).toEqual([320, 640, 1024, 1280])
    expect(plannedWidths(1280, baseConfig)).toEqual([320, 640, 1024, 1280])
  })
})

describe('planning', () => {
  it('plans every width × format derivative', () => {
    const plan = planSourceDerivatives(
      { relativePath: 'engagement/photo.webp', width: 1024, height: 768, format: 'webp' },
      baseConfig
    )

    expect(plan.source).toBe('/images/engagement/photo.webp')
    expect(plan.slug).toBe('engagement-photo')
    expect(plan.widths).toEqual([320, 640, 1024])
    expect(plan.derivatives).toHaveLength(9)
    expect(plan.derivatives[0]?.publicPath).toBe('/images/optimized/engagement-photo-320.avif')
    expect(plan.derivatives.map(item => item.format)).toEqual([
      'avif',
      'webp',
      'jpg',
      'avif',
      'webp',
      'jpg',
      'avif',
      'webp',
      'jpg',
    ])
  })

  it('rejects invalid relative paths', () => {
    expect(() =>
      planSourceDerivatives(
        { relativePath: '../secret.png', width: 100, height: 100, format: 'png' },
        baseConfig
      )
    ).toThrow(/invalid relative path/)
    expect(() =>
      planSourceDerivatives(
        { relativePath: '---.png', width: 100, height: 100, format: 'png' },
        baseConfig
      )
    ).toThrow(/slug/)
  })

  it('computes aspect ratios and validates dominant colours', () => {
    expect(computeAspectRatio(1600, 900)).toBe(1.7778)
    expect(computeAspectRatio(220, 280)).toBe(0.7857)
    expect(() => computeAspectRatio(0, 10)).toThrow(/positive/)

    const created = createManifestEntry({
      source: '/images/a.png',
      width: 100,
      height: 50,
      dominantColor: '#ABCDEF',
      sourceSha256: 'a'.repeat(64),
      configHash: 'b'.repeat(64),
      derivatives: {
        '320': { jpg: { path: '/images/optimized/a-320.jpg', bytes: 10, sha256: 'c'.repeat(64) } },
      },
    })
    expect(created.dominantColor).toBe('#abcdef')
    expect(created.aspectRatio).toBe(2)
    expect(() =>
      createManifestEntry({
        source: '/images/a.png',
        width: 100,
        height: 50,
        dominantColor: 'red',
        sourceSha256: 'a',
        configHash: 'b',
        derivatives: {},
      })
    ).toThrow(/dominantColor/)
  })

  it('serialises the manifest deterministically (sorted keys/widths/formats)', () => {
    const plan = planSourceDerivatives(
      { relativePath: 'b/second.png', width: 640, height: 480, format: 'png' },
      baseConfig
    )
    const derivatives: Record<
      string,
      Partial<Record<'avif' | 'webp' | 'jpg', { path: string; bytes: number; sha256: string }>>
    > = {}
    for (const target of plan.derivatives) {
      const width = String(target.width)
      const bucket = derivatives[width] ?? {}
      bucket[target.format] = {
        path: target.publicPath,
        bytes: 1000 + target.width,
        sha256: 'd'.repeat(64),
      }
      derivatives[width] = bucket
    }
    const manifest: MediaManifest = {
      schemaVersion: 1,
      config: {
        widths: [640, 320],
        formats: ['jpg', 'avif', 'webp'],
        quality: { avif: 55, webp: 80, jpg: 82 },
        generator: 'test',
      },
      images: {
        '/images/b/second.png': createManifestEntry({
          source: '/images/b/second.png',
          width: 640,
          height: 480,
          dominantColor: '#102030',
          sourceSha256: 'a'.repeat(64),
          configHash: 'b'.repeat(64),
          derivatives,
        }),
      },
    }

    const first = serializeMediaManifest(manifest)
    const second = serializeMediaManifest(manifest)
    expect(first).toBe(second)
    expect(first.endsWith('\n')).toBe(true)

    const parsed = parseMediaManifest(JSON.parse(first))
    expect(Object.keys(parsed.images)).toEqual(['/images/b/second.png'])
    expect(Object.keys(parsed.config.widths ? { widths: parsed.config.widths } : {})).toBeTruthy()
    expect(parsed.config.widths).toEqual([320, 640])

    const expected = expectedDerivativeFiles(parsed)
    expect(expected).toHaveLength(6)
    expect(expected[0]).toMatchObject({
      source: '/images/b/second.png',
      width: 320,
      format: 'avif',
    })
    expect(expected[0]?.filePath).toBe('images/optimized/b-second-320.avif')
  })
})

describe('pipeline config', () => {
  it('merges defaults and validates inputs', () => {
    const config = parseMediaPipelineConfig({
      widths: [1024, 320, 640],
      formats: ['webp', 'avif'],
    })
    expect(config.widths).toEqual([320, 640, 1024])
    expect(config.formats).toEqual(['avif', 'webp'])
    expect(config.quality.avif).toBe(55)
    expect(config.sourceDir).toBe('../public/images')
    expect(config.include).toEqual([])

    expect(() => parseMediaPipelineConfig({ widths: [] })).toThrow(/widths/)
    expect(() => parseMediaPipelineConfig({ widths: [0] })).toThrow(/widths/)
    expect(() => parseMediaPipelineConfig({ widths: [100], formats: ['gif'] })).toThrow(/format/)
    expect(() => parseMediaPipelineConfig({ widths: [100], quality: { avif: 200 } })).toThrow(
      /quality/
    )
    expect(() => parseMediaPipelineConfig({ widths: [100], include: [1] })).toThrow(/include/)
  })

  it('produces a stable encoding-config fingerprint', () => {
    expect(canonicalConfigJson(baseConfig)).toBe(canonicalConfigJson({ ...baseConfig }))
    expect(canonicalConfigJson(baseConfig)).toBe(
      '{"widths":[320,640,1024,1280],"formats":["avif","webp","jpg"],"quality":{"avif":55,"webp":80,"jpg":82},"generator":"scripts/media-optimize.mjs"}'
    )
  })
})
