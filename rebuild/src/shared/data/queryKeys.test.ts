import { describe, expect, it } from 'vitest'
import { authKeys, invalidationGroups, queryKeys, stableKeyPart } from './queryKeys'

describe('query key helpers', () => {
  it('stableKeyPart sorts without mutating the input', () => {
    const input = ['b', 'a', 'c']
    expect(stableKeyPart(input)).toEqual(['a', 'b', 'c'])
    expect(input).toEqual(['b', 'a', 'c'])
  })
})

describe('query key shapes', () => {
  it('namespaces every domain under its own prefix', () => {
    expect(queryKeys.photos.all).toEqual(['photos'])
    expect(queryKeys.guestbook.all).toEqual(['guestbook'])
    expect(queryKeys.guestUploads.all).toEqual(['guest-uploads'])
    expect(queryKeys.editorial.all).toEqual(['editorial'])
    expect(queryKeys.claims.all).toEqual(['claims'])
    expect(queryKeys.guestShare.all).toEqual(['guest-share'])
    expect(queryKeys.activity.all).toEqual(['activity'])
    expect(queryKeys.moderation.all).toEqual(['moderation'])
    expect(queryKeys.mediaReview.all).toEqual(['media-review'])
    expect(authKeys.all).toEqual(['auth'])
    expect(authKeys.session).toEqual(['auth', 'session'])
  })

  it('normalises set-like params so callers share cache entries', () => {
    expect(queryKeys.photos.byUrls(['/b.webp', '/a.webp'])).toEqual(
      queryKeys.photos.byUrls(['/a.webp', '/b.webp'])
    )
    expect(queryKeys.photos.likeStatuses(['p2', 'p1'], 'session')).toEqual(
      queryKeys.photos.likeStatuses(['p1', 'p2'], 'session')
    )
    expect(queryKeys.photos.engagementSummary(['p2', 'p1'])).toEqual(
      queryKeys.photos.engagementSummary(['p1', 'p2'])
    )
    expect(queryKeys.guestUploads.statusByEmail('GUEST@Example.com')).toEqual(
      queryKeys.guestUploads.statusByEmail('guest@example.com')
    )
    expect(queryKeys.claims.potentialPhotosByEmail('Guest@Example.com')).toEqual(
      queryKeys.claims.potentialPhotosByEmail('guest@example.com')
    )
  })

  it('keeps distinct resources on distinct keys', () => {
    const keys = [
      queryKeys.photos.list(0, 100),
      queryKeys.photos.byAlbum('Engagement'),
      queryKeys.photos.top(6),
      queryKeys.photos.comments('p1'),
      queryKeys.guestbook.messages(),
      queryKeys.guestbook.forPrint(),
      queryKeys.editorial.features('home_moment_of_the_week'),
      queryKeys.editorial.features(undefined),
      queryKeys.activity.feed(100),
      queryKeys.activity.item('guest_uploads', 'photo-1'),
      queryKeys.guestShare.contributions('token-1'),
      queryKeys.mediaReview.clusters('batch-1'),
      queryKeys.mediaReview.faces('batch-1'),
    ]
    const serialised = keys.map(key => JSON.stringify(key))
    expect(new Set(serialised).size).toBe(serialised.length)
  })

  it('encodes moderation audit filters, including defaults', () => {
    expect(queryKeys.moderation.auditTimeline({})).toEqual([
      'moderation',
      'audit',
      'all',
      'all',
      'all',
      'all',
      200,
    ])
    expect(
      queryKeys.moderation.auditTimeline({
        entityType: 'guest_upload',
        entityId: 'u1',
        action: 'upload_approved_published',
        actorEmail: 'admin@test.wedding',
        limit: 5,
      })
    ).toEqual([
      'moderation',
      'audit',
      'guest_upload',
      'u1',
      'upload_approved_published',
      'admin@test.wedding',
      5,
    ])
  })

  it('exposes invalidation groups that cover dependent caches', () => {
    expect(invalidationGroups.photoEngagement).toEqual([queryKeys.photos.all])
    expect(invalidationGroups.guestbook).toEqual([queryKeys.guestbook.all])
    expect(invalidationGroups.guestUploads).toEqual([
      queryKeys.guestUploads.all,
      queryKeys.activity.all,
      queryKeys.moderation.all,
    ])
    expect(invalidationGroups.editorial).toEqual([queryKeys.editorial.all, queryKeys.activity.all])
    expect(invalidationGroups.claims).toEqual([
      queryKeys.claims.all,
      queryKeys.moderation.all,
      queryKeys.activity.all,
    ])
  })

  it('every key builder returns a non-empty readonly array', () => {
    const keys: ReadonlyArray<readonly unknown[]> = [
      queryKeys.photos.list(0, 100),
      queryKeys.photos.infinite(100),
      queryKeys.photos.byAlbum('Engagement'),
      queryKeys.photos.byUrls(['/a.webp']),
      queryKeys.photos.withFaces(),
      queryKeys.photos.top(6),
      queryKeys.photos.albumCounts(),
      queryKeys.photos.nextSortOrder('Engagement'),
      queryKeys.photos.comments('photo-1'),
      queryKeys.photos.recentComments(40),
      queryKeys.photos.likeStatuses(['p1'], 'session'),
      queryKeys.photos.engagementSummary(['p1']),
      queryKeys.guestbook.messages(),
      queryKeys.guestbook.messagesWithComments(),
      queryKeys.guestbook.forPrint(),
      queryKeys.guestUploads.byStatus('pending'),
      queryKeys.guestUploads.approved(),
      queryKeys.guestUploads.pending(),
      queryKeys.guestUploads.statusByEmail('guest@example.com'),
      queryKeys.guestUploads.filmHighlights(),
      queryKeys.editorial.features(undefined),
      queryKeys.editorial.bySlot('home_moment_of_the_week'),
      queryKeys.editorial.history(undefined),
      queryKeys.claims.identities(),
      queryKeys.claims.byStatus('pending'),
      queryKeys.claims.pending(),
      queryKeys.claims.approved(),
      queryKeys.claims.rejected(),
      queryKeys.claims.potentialPhotosByEmail('guest@example.com'),
      queryKeys.guestShare.contributions('token'),
      queryKeys.activity.feed(100),
      queryKeys.activity.item('guest_uploads', 'photo-1'),
      queryKeys.moderation.auditTimeline({}),
      queryKeys.moderation.auditForEntity('guest_upload', 'upload-1'),
      queryKeys.moderation.dashboardCounts(),
      queryKeys.mediaReview.batches(),
      queryKeys.mediaReview.clusters('batch-1'),
      queryKeys.mediaReview.faces('batch-1'),
      queryKeys.mediaReview.taggingBatches(),
      queryKeys.mediaReview.knownPeople(),
      authKeys.all,
      authKeys.session,
    ]

    for (const key of keys) {
      expect(Array.isArray(key)).toBe(true)
      expect(key.length).toBeGreaterThan(0)
    }
  })
})
