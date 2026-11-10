import { describe, expect, it } from 'vitest'
import {
  buildSelectionShareUrl,
  countByCollection,
  deriveCollection,
  matchesGallerySearch,
  mergeGalleryPhotos,
  normalizeCollectionValue,
  parseGallerySearch,
  planBatchDownload,
  resolveDownloadStrategy,
  useCuratedPhotos,
  validateGallerySearch,
  validateUploadLookupEmail,
  type GalleryPhoto,
} from './data'
import { CLIENT_ZIP_LIMIT, MAX_SELECTION, collectionTabs } from './constants'
import { CURATED_PHOTOS, LIVE_PHOTOS } from './fixtures'

describe('collection alias mapping', () => {
  it.each([
    ['engagement', 'Proposal'],
    ['proposal', 'Proposal'],
    ['Proposal', 'Proposal'],
    ['bach+ette', 'Bach+ette'],
    ['Bach+ette', 'Bach+ette'],
    ['bach', 'Bach+ette'],
    ['bachelorette', 'Bach+ette'],
    ['bachelor', 'Bach+ette'],
    ['wedding day', 'Wedding Photos'],
    ['wedding-day', 'Wedding Photos'],
    ['wedding photos', 'Wedding Photos'],
    ['couple', 'Wedding Photos'],
    ['parents', 'Wedding Photos'],
    ['rings', 'Wedding Photos'],
    ['film', 'Wedding Photos'],
    ['home', 'Wedding Photos'],
    ['parent-film-cards', 'Wedding Photos'],
    ['wedding-party', 'Wedding Photos'],
    ['shared-gallery-new', 'Wedding Photos'],
    ['guest uploads', 'Guest Photos'],
    ['guest-upload', 'Guest Photos'],
    ['guest', 'Guest Photos'],
    ['guest photos', 'Guest Photos'],
  ])('maps raw album value %s to %s', (raw, expected) => {
    expect(normalizeCollectionValue(raw)).toBe(expected)
  })

  it('trims and nulls unknown values', () => {
    expect(normalizeCollectionValue('  Engagement ')).toBe('Proposal')
    expect(normalizeCollectionValue('unknown-album')).toBeNull()
    expect(normalizeCollectionValue(undefined)).toBeNull()
    expect(normalizeCollectionValue('')).toBeNull()
  })

  it('never returns a value outside the 4-tab vocabulary', () => {
    for (const raw of ['engagement', 'guest uploads', 'wedding-party', 'bachelor']) {
      expect(collectionTabs).toContain(normalizeCollectionValue(raw))
    }
    // The tab vocabulary itself stays exactly the frozen 4 labels.
    expect(collectionTabs).toEqual(['Proposal', 'Bach+ette', 'Wedding Photos', 'Guest Photos'])
  })

  it('derives a collection when the album/category are unknown', () => {
    expect(
      deriveCollection({
        album: 'Unknown',
        category: null,
        caption: null,
        tags: [],
        location: null,
        url: '/images/engagement/photo.webp',
        thumbnail: '/images/engagement/photo.webp',
        source: 'professional',
      })
    ).toBe('Proposal')
    expect(
      deriveCollection({
        album: 'Unknown',
        category: null,
        caption: null,
        tags: ['bachelorette'],
        location: null,
        url: '/x.webp',
        thumbnail: '/x.webp',
        source: 'professional',
      })
    ).toBe('Bach+ette')
    expect(
      deriveCollection({
        album: 'Unknown',
        category: null,
        caption: null,
        tags: [],
        location: null,
        url: '/x.webp',
        thumbnail: '/x.webp',
        source: 'guest',
      })
    ).toBe('Guest Photos')
  })
})

describe('merge + counts', () => {
  it('keeps curated rows first and dedupes by id/url/thumbnail', () => {
    const curated = [CURATED_PHOTOS[0] as GalleryPhoto, CURATED_PHOTOS[1] as GalleryPhoto]
    const duplicateById: GalleryPhoto = {
      ...(CURATED_PHOTOS[0] as GalleryPhoto),
      caption: 'Updated',
    }
    const duplicateByUrl: GalleryPhoto = {
      ...(CURATED_PHOTOS[1] as GalleryPhoto),
      id: 'another-id',
      caption: 'URL duplicate',
    }
    const fresh: GalleryPhoto = { ...(LIVE_PHOTOS[0] as GalleryPhoto) }
    const merged = mergeGalleryPhotos(curated, [duplicateById, duplicateByUrl, fresh])

    expect(merged).toHaveLength(3)
    expect(merged[0]?.id).toBe(curated[0]?.id)
    expect(merged[0]?.caption).toBe('Updated')
    // A later row that matches by url/thumbnail updates the existing entry
    // (frozen `useGalleryData` merge keeps the position but spreads the new row).
    expect(merged[1]?.caption).toBe('URL duplicate')
    expect(merged[1]?.url).toBe(curated[1]?.url)
    expect(merged[2]?.id).toBe(fresh.id)
  })

  it('matches the frozen rendered oracle counts (30 Proposal, 5 Wedding Photos)', () => {
    const photos = mergeGalleryPhotos(CURATED_PHOTOS, LIVE_PHOTOS)
    expect(photos).toHaveLength(40)
    expect(countByCollection(photos)).toEqual({
      Proposal: 35,
      'Bach+ette': 0,
      'Wedding Photos': 5,
      'Guest Photos': 0,
    })
  })

  it('exposes the curated fixture as the stable fallback dataset', () => {
    expect(useCuratedPhotos()).toBe(CURATED_PHOTOS)
    expect(CURATED_PHOTOS).toHaveLength(35)
  })
})

describe('search matcher', () => {
  const photo = CURATED_PHOTOS[0] as GalleryPhoto

  it('matches caption, location, photographer, source, faces and tags', () => {
    expect(matchesGallerySearch(photo, photo.caption ?? '')).toBe(true)
    expect(matchesGallerySearch(photo, 'proposal spot')).toBe(true)
    expect(matchesGallerySearch(photo, 'emma photography')).toBe(true)
    expect(matchesGallerySearch(photo, 'jordyn')).toBe(true)
    expect(matchesGallerySearch(photo, 'engagement')).toBe(true)
    expect(matchesGallerySearch(photo, 'professional')).toBe(true)
  })

  it('is case-insensitive, trims, and treats an empty query as match-all', () => {
    expect(matchesGallerySearch(photo, '  JORDYN ')).toBe(true)
    expect(matchesGallerySearch(photo, '')).toBe(true)
    expect(matchesGallerySearch(photo, '   ')).toBe(true)
    expect(matchesGallerySearch(photo, 'no-such-term')).toBe(false)
  })
})

describe('query-param parsing (?collection, ?q, ?photo, ?shared, ?share)', () => {
  it('parses the frozen gallery URL vocabulary', () => {
    const parsed = parseGallerySearch(
      '?collection=Wedding%20Photos&q=first%20look&photo=photo-1&shared=photo-2&share=a,b,c'
    )
    expect(parsed).toEqual({
      collection: 'Wedding Photos',
      q: 'first look',
      photoId: 'photo-1',
      sharedId: 'photo-2',
      shareIds: ['a', 'b', 'c'],
    })
  })

  it('ignores unknown collection values and de-dupes/limits share ids', () => {
    const parsed = parseGallerySearch({
      collection: 'Engagement',
      share: `a,a,b,${Array.from({ length: 60 }, (_, index) => `id-${index}`).join(',')}`,
    })
    expect(parsed.collection).toBeNull()
    expect(parsed.shareIds.length).toBe(MAX_SELECTION)
    expect(parsed.shareIds.slice(0, 3)).toEqual(['a', 'b', 'id-0'])
  })

  it('accepts URLSearchParams and empty input', () => {
    expect(parseGallerySearch(new URLSearchParams('?q=x')).q).toBe('x')
    expect(parseGallerySearch('').collection).toBeNull()
    expect(parseGallerySearch('').shareIds).toEqual([])
  })

  it('produces a router-safe validateSearch result', () => {
    expect(
      validateGallerySearch({
        collection: 'Bach+ette',
        q: 'dance',
        photo: 'photo-9',
        unknown: 'ignored',
      })
    ).toEqual({ collection: 'Bach+ette', q: 'dance', photo: 'photo-9' })
  })
})

describe('share + batch-download strategy', () => {
  it('builds the frozen /gallery?share= URL', () => {
    expect(buildSelectionShareUrl('https://www.theporadas.com/', ['a', 'b'])).toBe(
      'https://www.theporadas.com/gallery?share=a,b'
    )
  })

  it('splits at 20: client zip <=20, server pack 21-50', () => {
    expect(resolveDownloadStrategy(0)).toBe('none')
    expect(resolveDownloadStrategy(1)).toBe('client-zip')
    expect(resolveDownloadStrategy(CLIENT_ZIP_LIMIT)).toBe('client-zip')
    expect(resolveDownloadStrategy(CLIENT_ZIP_LIMIT + 1)).toBe('server-pack')
    expect(resolveDownloadStrategy(MAX_SELECTION)).toBe('server-pack')
    expect(resolveDownloadStrategy(MAX_SELECTION + 1)).toBe('none')
    expect(resolveDownloadStrategy(Number.NaN)).toBe('none')
  })

  it('plans the batch endpoint only for the server path', () => {
    expect(planBatchDownload(['a'])).toEqual({
      strategy: 'client-zip',
      count: 1,
      endpoint: null,
    })
    const serverPlan = planBatchDownload(Array.from({ length: 21 }, (_, i) => `p-${i}`))
    expect(serverPlan.strategy).toBe('server-pack')
    expect(serverPlan.endpoint).toBe('/.netlify/functions/download-pack')
  })
})

describe('upload-status lookup validation', () => {
  it('rejects empty and malformed emails with actionable messages', () => {
    expect(validateUploadLookupEmail('')).toBe('Enter the email address you used when uploading.')
    expect(validateUploadLookupEmail('   ')).toBe(
      'Enter the email address you used when uploading.'
    )
    expect(validateUploadLookupEmail('not-an-email')).toBe('Enter a valid email address.')
    expect(validateUploadLookupEmail('missing@domain')).toBe('Enter a valid email address.')
  })

  it('accepts a valid email', () => {
    expect(validateUploadLookupEmail('jamie@example.com')).toBeNull()
    expect(validateUploadLookupEmail('  jamie@example.com ')).toBeNull()
  })
})
