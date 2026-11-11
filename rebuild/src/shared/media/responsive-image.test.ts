import { describe, expect, it } from 'vitest'
import defaultManifest from './media-manifest.json'
import {
  EMPTY_MEDIA_MANIFEST,
  IMAGE_SIZES,
  buildSrcSet,
  blurhashToCssBackground,
  decodeBase83,
  decodeBlurhash,
  encodeBase83,
  getFallbackSource,
  getResponsiveImageSources,
  isBlurhash,
  isOptimizableImageUrl,
  parseMediaManifest,
  resolveSizes,
  type MediaManifest,
  type MediaManifestEntry,
} from './responsive-image'

function derivative(path: string, bytes = 100) {
  return { path, bytes, sha256: '0'.repeat(64) }
}

const entry: MediaManifestEntry = {
  source: '/images/home/hero.png',
  width: 1600,
  height: 900,
  aspectRatio: 1.7778,
  dominantColor: '#123456',
  sourceSha256: 'a'.repeat(64),
  configHash: 'b'.repeat(64),
  derivatives: {
    '640': {
      avif: derivative('/images/optimized/home-hero-640.avif'),
      jpg: derivative('/images/optimized/home-hero-640.jpg'),
    },
    '320': {
      avif: derivative('/images/optimized/home-hero-320.avif'),
      jpg: derivative('/images/optimized/home-hero-320.jpg'),
    },
    '1280': {
      webp: derivative('/images/optimized/home-hero-1280.webp'),
      jpg: derivative('/images/optimized/home-hero-1280.jpg'),
    },
  },
}

const manifest: MediaManifest = {
  schemaVersion: 1,
  config: {
    widths: [320, 640, 1280],
    formats: ['avif', 'webp', 'jpg'],
    quality: { avif: 55, webp: 80, jpg: 82 },
    generator: 'test',
  },
  images: { '/images/home/hero.png': entry },
}

describe('media manifest', () => {
  it('validates the committed default manifest', () => {
    const parsed = parseMediaManifest(defaultManifest)
    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.images).toEqual({})
    expect(parsed.config.widths).toEqual([320, 480, 640, 768, 1024, 1280, 1600, 1920])
    expect(parsed.config.formats).toEqual(['avif', 'webp', 'jpg'])
  })

  it('validates generated entries and rejects malformed manifests', () => {
    expect(parseMediaManifest(manifest).images['/images/home/hero.png']?.width).toBe(1600)

    expect(() => parseMediaManifest({ ...manifest, schemaVersion: 2 })).toThrow(/schemaVersion/)
    expect(() => parseMediaManifest({ ...manifest, images: [] })).toThrow(/images/)
    expect(() =>
      parseMediaManifest({
        ...manifest,
        images: { '/images/x.png': { ...entry, derivatives: { '320': { avif: { path: 'x' } } } } },
      })
    ).toThrow(/bytes/)
    expect(() => parseMediaManifest(null)).toThrow(/root/)
  })

  it('keeps the empty manifest constant for stubs', () => {
    expect(EMPTY_MEDIA_MANIFEST.images).toEqual({})
    expect(EMPTY_MEDIA_MANIFEST.config.generator).toBe('scripts/media-optimize.mjs')
  })
})

describe('srcset builders', () => {
  it('builds an ascending-width srcset per format', () => {
    expect(buildSrcSet(entry, 'jpg')).toBe(
      '/images/optimized/home-hero-320.jpg 320w, /images/optimized/home-hero-640.jpg 640w, /images/optimized/home-hero-1280.jpg 1280w'
    )
    expect(buildSrcSet(entry, 'avif')).toBe(
      '/images/optimized/home-hero-320.avif 320w, /images/optimized/home-hero-640.avif 640w'
    )
    expect(buildSrcSet(entry, 'webp')).toBe('/images/optimized/home-hero-1280.webp 1280w')
  })

  it('uses the largest JPEG as the fallback source', () => {
    expect(getFallbackSource(entry)).toBe('/images/optimized/home-hero-1280.jpg')
    expect(getFallbackSource({ ...entry, derivatives: {} })).toBe('/images/home/hero.png')
  })

  it('exposes frozen sizes presets and resolves them', () => {
    expect(resolveSizes('galleryGrid')).toBe(IMAGE_SIZES.galleryGrid)
    expect(resolveSizes('heroPoster')).toBe(IMAGE_SIZES.heroPoster)
    expect(resolveSizes('50vw')).toBe('50vw')
    expect(resolveSizes(undefined)).toBe(IMAGE_SIZES.galleryGrid)
  })

  it('only owns local /images rasters', () => {
    expect(isOptimizableImageUrl('/images/photo.webp')).toBe(true)
    expect(isOptimizableImageUrl('/images/photo.jpg?v=2')).toBe(true)
    expect(isOptimizableImageUrl('/media/_thumbs/Album/photo.webp')).toBe(false)
    expect(isOptimizableImageUrl('https://media.wedding.theporadas.com/x.jpg')).toBe(false)
    expect(isOptimizableImageUrl('/images/icon.svg')).toBe(false)
    expect(isOptimizableImageUrl('/favicon.ico')).toBe(false)
  })

  it('resolves manifest sources and returns null for CDN/unknown URLs', () => {
    const sources = getResponsiveImageSources('/images/home/hero.png', manifest)
    expect(sources).not.toBeNull()
    expect(sources?.fallbackSrc).toBe('/images/optimized/home-hero-1280.jpg')
    expect(sources?.width).toBe(1600)
    expect(sources?.aspectRatio).toBe(1.7778)
    expect(sources?.dominantColor).toBe('#123456')

    expect(
      getResponsiveImageSources(
        'https://media.wedding.theporadas.com/media/Engagement/a.jpg',
        manifest
      )
    ).toBeNull()
    expect(getResponsiveImageSources('/images/unknown.png', manifest)).toBeNull()
    expect(getResponsiveImageSources('/media/Engagement/a.jpg', manifest)).toBeNull()
  })
})

describe('blurhash placeholder', () => {
  it('round-trips base83 values', () => {
    expect(decodeBase83('TSUA')).toBe(16777215)
    expect(encodeBase83(16777215, 4)).toBe('TSUA')
    expect(decodeBase83('0')).toBe(0)
    expect(() => decodeBase83('!')).toThrow(/base83/)
    expect(() => decodeBase83('')).toThrow(/empty/)
  })

  it('validates hashes and decodes a solid white 1x1 hash', () => {
    expect(isBlurhash('00TSUA')).toBe(true)
    expect(isBlurhash('00TSU')).toBe(false)
    expect(isBlurhash('nope')).toBe(false)

    const decoded = decodeBlurhash('00TSUA', 4, 3)
    expect(decoded.width).toBe(4)
    expect(decoded.height).toBe(3)
    expect(decoded.data).toHaveLength(4 * 3 * 4)
    for (let index = 0; index < decoded.data.length; index += 4) {
      expect(decoded.data[index]).toBeGreaterThanOrEqual(250)
      expect(decoded.data[index + 1]).toBeGreaterThanOrEqual(250)
      expect(decoded.data[index + 2]).toBeGreaterThanOrEqual(250)
      expect(decoded.data[index + 3]).toBe(255)
    }
  })

  it('rejects malformed decode inputs', () => {
    expect(() => decodeBlurhash('00TSUA', 0, 3)).toThrow(/positive integers/)
    expect(() => decodeBlurhash('bad', 4, 3)).toThrow(/malformed/)
  })

  it('builds a small deterministic CSS gradient placeholder', () => {
    const background = blurhashToCssBackground('00TSUA', 4)
    expect(background).toMatch(/^linear-gradient\(90deg, #[0-9a-f]{6}(, #[0-9a-f]{6}){3}\)$/)
    expect(background).toBe(blurhashToCssBackground('00TSUA', 4))
    expect(() => blurhashToCssBackground('00TSUA', 1)).toThrow(/columns/)
  })
})
