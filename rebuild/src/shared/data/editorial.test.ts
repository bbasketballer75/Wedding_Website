import { describe, expect, it } from 'vitest'
import { DataError } from './errors'
import {
  EDITORIAL_SLOTS,
  EDITORIAL_SOURCE_TYPES,
  MEMORY_TRAILS,
  fetchLiveEditorialFeatures,
  fetchSiteEditorialFeatureBySlot,
  fetchSiteEditorialFeatureHistory,
  fetchSiteEditorialFeatures,
  isEditorialFeatureLive,
  isEditorialSlot,
  isEditorialSourceType,
  isMemoryTrail,
  parseEditorialFeature,
  parseEditorialFeatures,
  recordSiteEditorialFeatureHistory,
  selectLiveEditorialFeatures,
  upsertSiteEditorialFeature,
  type EditorialFeature,
} from './editorial'
import { loadFixtures } from './test-support/fixtures'
import { createMockClient } from './test-support/mock-client'

const fixtures = loadFixtures()
const editorialFixture = fixtures.editorial

function makeFeature(overrides: Partial<EditorialFeature> = {}): EditorialFeature {
  return {
    id: 'feature-1',
    slot: 'home_moment_of_the_week',
    title: 'Moment',
    summary: null,
    trail: null,
    sourceType: 'custom',
    sourceId: null,
    sourceLabel: null,
    sourceUrl: null,
    isActive: true,
    displayOrder: 0,
    metadata: {},
    memoryTrail: null,
    badgeLabel: null,
    ctaLabel: null,
    startsAt: null,
    endsAt: null,
    updatedByEmail: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('editorial parsing (contracts/fixtures/editorial.json)', () => {
  it('parses the four fixture slots, tolerating null titles on inactive slots', () => {
    const features = parseEditorialFeatures(editorialFixture)

    expect(features).toHaveLength(4)
    expect(features[0]).toMatchObject({
      id: 'feat-1',
      slot: 'home_moment_of_the_week',
      isActive: true,
      title: 'The First Dance',
      sourceType: 'custom',
    })
    expect(features[1]).toMatchObject({
      slot: 'home_newest_standout_upload',
      isActive: false,
      title: '',
    })
    expect(features.map(feature => feature.slot).sort()).toEqual([...EDITORIAL_SLOTS].sort())
  })

  it('drops malformed/unknown-slot rows', () => {
    expect(parseEditorialFeature(null)).toBeNull()
    expect(parseEditorialFeature({ id: 'x', slot: 'not_a_slot' })).toBeNull()
    expect(parseEditorialFeature({ id: 'x' })).toBeNull()
  })

  it('exposes the frozen enums', () => {
    expect([...EDITORIAL_SLOTS]).toEqual([
      'home_newest_standout_upload',
      'home_featured_guestbook_note',
      'home_moment_of_the_week',
      'film_featured_guest_video',
    ])
    expect([...EDITORIAL_SOURCE_TYPES]).toEqual([
      'guest_upload',
      'guestbook_message',
      'film_chapter',
      'custom',
    ])
    expect([...MEMORY_TRAILS]).toEqual([
      'ceremony',
      'family',
      'dance-floor',
      'engagement-season',
      'bach-ette',
    ])
    expect(isEditorialSlot('film_featured_guest_video')).toBe(true)
    expect(isEditorialSlot('nope')).toBe(false)
    expect(isEditorialSourceType('film_chapter')).toBe(true)
    expect(isEditorialSourceType(undefined)).toBe(false)
    expect(isMemoryTrail('family')).toBe(true)
    expect(isMemoryTrail('other')).toBe(false)
  })
})

describe('editorial public visibility window', () => {
  const now = new Date('2026-11-08T12:00:00.000Z')

  it('requires isActive', () => {
    expect(isEditorialFeatureLive(makeFeature({ isActive: false }), now)).toBe(false)
    expect(isEditorialFeatureLive(makeFeature(), now)).toBe(true)
  })

  it('honours startsAt/endsAt boundaries (mirrors the RLS window)', () => {
    expect(isEditorialFeatureLive(makeFeature({ startsAt: '2026-11-08T12:00:00.000Z' }), now)).toBe(
      true
    )
    expect(isEditorialFeatureLive(makeFeature({ startsAt: '2026-11-08T12:00:01.000Z' }), now)).toBe(
      false
    )
    expect(isEditorialFeatureLive(makeFeature({ endsAt: '2026-11-08T12:00:00.000Z' }), now)).toBe(
      true
    )
    expect(isEditorialFeatureLive(makeFeature({ endsAt: '2026-11-08T11:59:59.000Z' }), now)).toBe(
      false
    )
  })

  it('treats malformed timestamps as unbounded', () => {
    expect(isEditorialFeatureLive(makeFeature({ startsAt: 'not-a-date' }), now)).toBe(true)
  })

  it('filters the fixture to its single live slot', () => {
    const live = selectLiveEditorialFeatures(parseEditorialFeatures(editorialFixture), now)
    expect(live.map(feature => feature.slot)).toEqual(['home_moment_of_the_week'])
  })
})

describe('editorial reads', () => {
  it('fetchSiteEditorialFeatures orders by display order then recency', async () => {
    const { client, calls } = createMockClient({
      tables: { site_editorial_features: { data: editorialFixture } },
    })

    const features = await fetchSiteEditorialFeatures(undefined, client)

    expect(features).toHaveLength(4)
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'site_editorial_features',
      method: 'order',
      args: ['display_order', { ascending: true }],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'site_editorial_features',
      method: 'order',
      args: ['updated_at', { ascending: false }],
    })
  })

  it('fetchSiteEditorialFeatures filters by slot', async () => {
    const { client, calls } = createMockClient({
      tables: { site_editorial_features: { data: [editorialFixture[0]] } },
    })

    await fetchSiteEditorialFeatures('home_moment_of_the_week', client)

    expect(calls).toContainEqual({
      surface: 'from',
      target: 'site_editorial_features',
      method: 'eq',
      args: ['slot', 'home_moment_of_the_week'],
    })
  })

  it('fetchSiteEditorialFeatureBySlot returns the single row or null', async () => {
    const found = createMockClient({
      tables: { site_editorial_features: { data: editorialFixture[0] } },
    })
    await expect(
      fetchSiteEditorialFeatureBySlot('home_moment_of_the_week', found.client)
    ).resolves.toMatchObject({ id: 'feat-1' })

    const missing = createMockClient({ tables: { site_editorial_features: { data: null } } })
    await expect(
      fetchSiteEditorialFeatureBySlot('home_moment_of_the_week', missing.client)
    ).resolves.toBeNull()

    const broken = createMockClient({
      tables: { site_editorial_features: { error: { message: 'denied', code: '42501' } } },
    })
    await expect(
      fetchSiteEditorialFeatureBySlot('home_moment_of_the_week', broken.client)
    ).rejects.toMatchObject({ code: 'postgrest:42501' })
  })

  it('fetchLiveEditorialFeatures applies the window client-side', async () => {
    const { client } = createMockClient({
      tables: { site_editorial_features: { data: editorialFixture } },
    })

    const live = await fetchLiveEditorialFeatures(
      undefined,
      new Date('2026-11-08T12:00:00.000Z'),
      client
    )
    expect(live).toHaveLength(1)
  })

  it('fetchSiteEditorialFeatureHistory parses known slots and caps at 80', async () => {
    const rows = [
      {
        id: 'h1',
        slot: 'home_newest_standout_upload',
        feature_id: 'f1',
        actor_email: 'admin@test.wedding',
        actor_name: 'Admin',
        change_summary: 'Updated',
        created_at: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 'h2',
        slot: 'unknown_slot',
        change_summary: 'skip',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]
    const { client, calls } = createMockClient({
      tables: { site_editorial_feature_history: { data: rows } },
    })

    const entries = await fetchSiteEditorialFeatureHistory(undefined, client)

    expect(entries).toEqual([
      {
        id: 'h1',
        slot: 'home_newest_standout_upload',
        featureId: 'f1',
        actorEmail: 'admin@test.wedding',
        actorName: 'Admin',
        changeSummary: 'Updated',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ])
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'site_editorial_feature_history',
      method: 'limit',
      args: [80],
    })
  })
})

describe('editorial writes', () => {
  it('records a history entry with optional actor fields omitted when absent', async () => {
    const { client, calls } = createMockClient({
      tables: {
        site_editorial_feature_history: {
          data: [{ id: 'history-1' }],
        },
      },
    })

    await recordSiteEditorialFeatureHistory(
      { slot: 'home_moment_of_the_week', changeSummary: 'Created' },
      client
    )

    expect(calls).toContainEqual({
      surface: 'from',
      target: 'site_editorial_feature_history',
      method: 'insert',
      args: [
        {
          slot: 'home_moment_of_the_week',
          feature_id: null,
          change_summary: 'Created',
          previous_feature: {},
          next_feature: {},
        },
      ],
    })
  })

  it('records actor fields when provided and rejects empty results', async () => {
    const { client, calls } = createMockClient({
      tables: { site_editorial_feature_history: { data: [{ id: 'history-1' }] } },
    })

    await recordSiteEditorialFeatureHistory(
      {
        slot: 'home_moment_of_the_week',
        featureId: 'f1',
        changeSummary: 'Updated',
        actor: { userId: 'admin-1', email: 'admin@test.wedding', name: 'Admin' },
      },
      client
    )

    expect(calls).toContainEqual({
      surface: 'from',
      target: 'site_editorial_feature_history',
      method: 'insert',
      args: [
        expect.objectContaining({
          feature_id: 'f1',
          actor_user_id: 'admin-1',
          actor_email: 'admin@test.wedding',
          actor_name: 'Admin',
        }),
      ],
    })

    const empty = createMockClient({ tables: { site_editorial_feature_history: { data: [] } } })
    await expect(
      recordSiteEditorialFeatureHistory(
        { slot: 'home_moment_of_the_week', changeSummary: 'x' },
        empty.client
      )
    ).rejects.toBeInstanceOf(DataError)
  })

  it('upserts a slot with onConflict slot and audit fields', async () => {
    const { client, calls } = createMockClient({
      tables: { site_editorial_features: { data: [{ id: 'feat-new' }] } },
    })

    await upsertSiteEditorialFeature(
      {
        slot: 'home_moment_of_the_week',
        title: 'New moment',
        sourceType: 'custom',
        isActive: true,
        actor: { email: 'admin@test.wedding' },
      },
      client
    )

    const upsertCall = calls.find(
      call => call.target === 'site_editorial_features' && call.method === 'upsert'
    )
    expect(upsertCall?.args[0]).toMatchObject({
      slot: 'home_moment_of_the_week',
      title: 'New moment',
      source_type: 'custom',
      is_active: true,
      updated_by_email: 'admin@test.wedding',
    })
    expect(upsertCall?.args[1]).toEqual({ onConflict: 'slot' })

    const empty = createMockClient({ tables: { site_editorial_features: { data: [] } } })
    await expect(
      upsertSiteEditorialFeature(
        { slot: 'home_moment_of_the_week', title: 'x', sourceType: 'custom' },
        empty.client
      )
    ).rejects.toMatchObject({ code: 'upsert:empty-result' })
  })
})
