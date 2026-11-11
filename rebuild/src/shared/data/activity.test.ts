import { describe, expect, it, vi } from 'vitest'
import {
  ACTIVITY_SOURCE_TYPES,
  ACTIVITY_TYPES,
  fetchActivityFeed,
  fetchActivityItem,
  isActivitySourceType,
  isActivityType,
  parseActivityItem,
  parseActivityItems,
  subscribeToActivityInserts,
} from './activity'
import { DataError } from './errors'
import { loadFixtures } from './test-support/fixtures'
import { createMockClient } from './test-support/mock-client'

const fixtures = loadFixtures()
const activityFixture = fixtures.activity

describe('activity parsing (contracts/fixtures/activity.json)', () => {
  it('parses every fixture item', () => {
    const items = parseActivityItems(activityFixture)

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      id: 'act-1',
      type: 'photo_upload',
      sourceId: 'photo-1',
      sourceType: 'guest_uploads',
      displayName: 'John Doe',
      thumbnailUrl: '/images/engagement/PoradaProposal-29.webp',
    })
    expect(items[1]).toMatchObject({ type: 'guestbook_entry', thumbnailUrl: null })
  })

  it('drops unknown types/sources and malformed rows', () => {
    expect(parseActivityItem(null)).toBeNull()
    expect(
      parseActivityItem({ id: 'a', source_id: 's', type: 'unknown', source_type: 'guest_uploads' })
    ).toBeNull()
    expect(
      parseActivityItem({ id: 'a', source_id: 's', type: 'photo_upload', source_type: 'unknown' })
    ).toBeNull()
    expect(
      parseActivityItem({ id: 'a', type: 'photo_upload', source_type: 'guest_uploads' })
    ).toBeNull()
  })

  it('exposes the frozen enums', () => {
    expect([...ACTIVITY_TYPES]).toEqual(['photo_upload', 'guestbook_entry', 'featured_moment'])
    expect([...ACTIVITY_SOURCE_TYPES]).toEqual([
      'guest_uploads',
      'guestbook_messages',
      'site_editorial_features',
    ])
    expect(isActivityType('featured_moment')).toBe(true)
    expect(isActivityType('photo_upload ')).toBe(false)
    expect(isActivitySourceType('guestbook_messages')).toBe(true)
    expect(isActivitySourceType(null)).toBe(false)
  })
})

describe('activity reads', () => {
  it('fetchActivityFeed orders newest first and applies the limit', async () => {
    const { client, calls } = createMockClient({
      tables: { activity_log: { data: activityFixture } },
    })

    const items = await fetchActivityFeed(50, client)

    expect(items).toHaveLength(2)
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'activity_log',
      method: 'order',
      args: ['created_at', { ascending: false }],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'activity_log',
      method: 'limit',
      args: [50],
    })
  })

  it('fetchActivityFeed wraps read failures', async () => {
    const { client } = createMockClient({
      tables: { activity_log: { error: { message: 'denied', code: '42501' } } },
    })
    await expect(fetchActivityFeed(10, client)).rejects.toMatchObject({ code: 'postgrest:42501' })
  })

  it('fetchActivityItem finds one source row or returns null', async () => {
    const found = createMockClient({
      tables: { activity_log: { data: activityFixture[0] } },
    })
    await expect(
      fetchActivityItem('guest_uploads', 'photo-1', found.client)
    ).resolves.toMatchObject({
      id: 'act-1',
    })
    expect(found.calls).toContainEqual({
      surface: 'from',
      target: 'activity_log',
      method: 'eq',
      args: ['source_type', 'guest_uploads'],
    })
    expect(found.calls).toContainEqual({
      surface: 'from',
      target: 'activity_log',
      method: 'eq',
      args: ['source_id', 'photo-1'],
    })

    const missing = createMockClient({ tables: { activity_log: { data: null } } })
    await expect(fetchActivityItem('guest_uploads', 'nope', missing.client)).resolves.toBeNull()

    const broken = createMockClient({ tables: { activity_log: { error: new Error('boom') } } })
    await expect(fetchActivityItem('guest_uploads', 'x', broken.client)).rejects.toBeInstanceOf(
      DataError
    )
  })
})

describe('activity realtime subscription', () => {
  it('forwards parsed INSERT payloads and unsubscribes cleanly', () => {
    const { client, realtime, removeChannelMock } = createMockClient({})
    const listener = vi.fn()

    const subscription = subscribeToActivityInserts(listener, { client })
    realtime.emitInsert('activity_log', activityFixture[0])

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ id: 'act-1' }))

    subscription.unsubscribe()
    expect(removeChannelMock).toHaveBeenCalledTimes(1)
  })

  it('ignores unparsable realtime payloads', () => {
    const { client, realtime } = createMockClient({})
    const listener = vi.fn()

    subscribeToActivityInserts(listener, { client })
    realtime.emitInsert('activity_log', { id: 'bad' })

    expect(listener).not.toHaveBeenCalled()
  })

  it('can be disabled (deterministic parity/e2e screenshots)', () => {
    const { client, channelMock, removeChannelMock } = createMockClient({})
    const listener = vi.fn()

    const subscription = subscribeToActivityInserts(listener, { client, enabled: false })
    expect(channelMock).not.toHaveBeenCalled()
    subscription.unsubscribe()
    expect(removeChannelMock).not.toHaveBeenCalled()
  })
})
