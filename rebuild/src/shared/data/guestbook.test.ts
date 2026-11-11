import { describe, expect, it } from 'vitest'
import { DataError, isDataError } from './errors'
import {
  addGuestbookReply,
  deleteGuestbookMessages,
  fetchGuestbookForPrint,
  fetchGuestbookMessages,
  fetchGuestbookMessagesWithCommentsRpc,
  parseGuestbookComment,
  parseGuestbookMessage,
  parseGuestbookMessages,
  parseReactions,
  sanitizeReactions,
  submitGuestbookMessage,
  updateGuestbookReactions,
} from './guestbook'
import type { TableRow } from './schema'
import { loadFixtures } from './test-support/fixtures'
import { createMockClient } from './test-support/mock-client'

const fixtures = loadFixtures()
const guestbookFixture = fixtures.guestbook
const messages = guestbookFixture.messages

function makeMessageRow(overrides: Partial<TableRow<'guestbook_messages'>> = {}) {
  return {
    id: 'message-x',
    name: 'Guest',
    email: 'guest@example.com',
    content: 'Hello',
    media_url: null,
    reactions: {},
    created_at: '2026-01-01T00:00:00.000Z',
    ip_address: null,
    rate_limited: false,
    ...overrides,
  } satisfies TableRow<'guestbook_messages'>
}

describe('guestbook parsing (contracts/fixtures/guestbook.json)', () => {
  it('parses every fixture message with replies and reactions', () => {
    const parsed = parseGuestbookMessages(messages)

    expect(parsed).toHaveLength(3)
    expect(parsed[0]).toMatchObject({
      id: 'message-1',
      name: 'Sarah Mitchell',
      reactions: { love: 12, clap: 4 },
    })
    expect(parsed[0]?.comments).toEqual([
      {
        id: 'comment-1',
        author: 'Austin',
        content: 'This is exactly how it felt. Thank you for being there.',
        createdAt: '2025-05-12T20:30:00.000Z',
      },
    ])
    expect(parsed[1]?.comments).toEqual([])
  })

  it('parses the admin copy shape and the submit response shape', () => {
    expect(parseGuestbookMessage(guestbookFixture.adminMessages[0])?.id).toBe('gb-msg-1')
    expect(parseGuestbookMessage(guestbookFixture.submitResponse)).toBeNull()
  })

  it('drops malformed messages/comments/reactions instead of throwing', () => {
    expect(parseGuestbookMessage(null)).toBeNull()
    expect(parseGuestbookMessage({ id: 'x' })).toBeNull()
    expect(parseGuestbookMessage({ id: 'x', content: null })).toBeNull()
    expect(parseGuestbookComment('nope')).toBeNull()
    expect(parseGuestbookComment({ id: 'c' })).toBeNull()

    const parsed = parseGuestbookMessage({
      id: 'm',
      content: 'text',
      reactions: { love: 2, bad: 'x', negative: -1, float: 1.9, nan: Number.NaN },
      comments: [{ id: 'c1', content: 'reply' }, 'broken'],
    })
    expect(parsed?.reactions).toEqual({ love: 2, float: 1 })
    expect(parsed?.comments).toEqual([
      { id: 'c1', author: 'Guest', content: 'reply', createdAt: '' },
    ])
    expect(parsed?.name).toBe('A guest')
  })

  it('parseReactions and sanitizeReactions keep only non-negative integers', () => {
    expect(parseReactions(null)).toEqual({})
    expect(parseReactions({ love: 3, hate: -2, meh: 0.5, text: 'x' })).toEqual({
      love: 3,
      meh: 0,
    })

    expect(sanitizeReactions({ love: 3, zero: 0, negative: -1, float: 2.7 })).toEqual({
      love: 3,
      float: 2,
    })
  })
})

describe('guestbook reads', () => {
  it('fetchGuestbookMessages embeds replies and orders newest first', async () => {
    const { client, calls } = createMockClient({
      tables: { guestbook_messages: { data: messages } },
    })

    const result = await fetchGuestbookMessages(client)

    expect(result).toHaveLength(3)
    expect(result[0]?.comments[0]?.author).toBe('Austin')

    const selectCall = calls.find(
      call =>
        call.surface === 'from' && call.target === 'guestbook_messages' && call.method === 'select'
    )
    expect(String(selectCall?.args[0])).toContain('comments:guestbook_comments(')
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'guestbook_messages',
      method: 'order',
      args: ['created_at', { ascending: false }],
    })
  })

  it('fetchGuestbookMessages wraps read failures', async () => {
    const { client } = createMockClient({
      tables: { guestbook_messages: { error: { message: 'denied', code: '42501' } } },
    })
    await expect(fetchGuestbookMessages(client)).rejects.toMatchObject({
      code: 'postgrest:42501',
    })
  })

  it('fetchGuestbookForPrint maps the narrow chronological select', async () => {
    const rows = [
      { id: 'm1', name: 'A', content: 'first', created_at: '2025-01-01T00:00:00.000Z' },
      { id: 'm2', name: 'B', content: 'second', created_at: null },
    ]
    const { client, calls } = createMockClient({ tables: { guestbook_messages: { data: rows } } })

    const entries = await fetchGuestbookForPrint(client)

    expect(entries).toEqual([
      { id: 'm1', name: 'A', content: 'first', createdAt: '2025-01-01T00:00:00.000Z' },
      { id: 'm2', name: 'B', content: 'second', createdAt: '' },
    ])
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'guestbook_messages',
      method: 'order',
      args: ['created_at', { ascending: true }],
    })
  })

  it('fetchGuestbookMessagesWithCommentsRpc parses the server aggregate', async () => {
    const { client, calls } = createMockClient({
      rpcs: {
        get_guestbook_messages_with_comments: {
          data: [
            {
              id: 'm-rpc',
              name: 'RPC Guest',
              email: 'rpc@example.com',
              content: 'Server aggregate',
              media_url: null,
              reactions: { love: 1 },
              created_at: '2026-02-02T00:00:00.000Z',
              comments: [
                {
                  id: 'c-rpc',
                  author: 'Austin',
                  content: 'reply',
                  created_at: '2026-02-02T01:00:00.000Z',
                },
              ],
            },
          ],
        },
      },
    })

    const result = await fetchGuestbookMessagesWithCommentsRpc(client)

    expect(result).toHaveLength(1)
    expect(result[0]?.comments[0]?.author).toBe('Austin')
    expect(calls).toContainEqual({
      surface: 'rpc',
      target: 'get_guestbook_messages_with_comments',
      method: 'rpc',
      args: [{}],
    })
  })
})

describe('guestbook submit (RPC + documented fallback for R17)', () => {
  const input = { name: 'Fixture Guest', email: 'fixture@example.com', content: 'A note' }

  it('uses the rate-limited RPC when it works', async () => {
    const { client, calls } = createMockClient({
      rpcs: {
        submit_guestbook_message_with_rate_limit: {
          data: [
            {
              success: true,
              message_id: 'message-new',
              error_message: '',
              rate_limit_remaining: 2,
              rate_limit_reset_after: 30,
            },
          ],
        },
      },
    })

    const result = await submitGuestbookMessage(input, client)

    expect(result).toEqual({
      status: 'submitted',
      messageId: 'message-new',
      rateLimitRemaining: 2,
      viaFallback: false,
    })
    expect(calls).toContainEqual({
      surface: 'rpc',
      target: 'submit_guestbook_message_with_rate_limit',
      method: 'rpc',
      args: [
        expect.objectContaining({
          p_name: 'Fixture Guest',
          p_email: 'fixture@example.com',
          p_content: 'A note',
          p_max_requests: 3,
          p_window_minutes: 1,
        }),
      ],
    })
    expect(calls.some(call => call.target === 'guestbook_messages')).toBe(false)
  })

  it('maps the RPC rate-limit response to a friendly result', async () => {
    const { client } = createMockClient({
      rpcs: {
        submit_guestbook_message_with_rate_limit: {
          data: [
            {
              success: false,
              message_id: null,
              error_message: 'Rate limit exceeded. Please wait 42 seconds.',
              rate_limit_remaining: 0,
              rate_limit_reset_after: 42,
            },
          ],
        },
      },
    })

    await expect(submitGuestbookMessage(input, client)).resolves.toEqual({
      status: 'rate-limited',
      message: 'Rate limit exceeded. Please wait 42 seconds.',
      resetAfterSeconds: 42,
    })
  })

  it('fails closed when the RPC errors (R17 repaired: no direct-insert fallback)', async () => {
    const { client, calls } = createMockClient({
      rpcs: {
        submit_guestbook_message_with_rate_limit: {
          error: { message: 'column "type" does not exist', code: '42703' },
        },
      },
      tables: { guestbook_messages: { data: { id: 'fallback-id' } } },
    })

    const result = await submitGuestbookMessage(input, client)

    expect(result.status).toBe('failed')
    // The D-01/D-02 migrations revoke direct guest inserts, so the data layer
    // must never attempt the old bypass path.
    expect(calls.some(call => call.target === 'guestbook_messages')).toBe(false)
  })

  it('fails closed when the RPC returns an empty result', async () => {
    const { client } = createMockClient({
      rpcs: { submit_guestbook_message_with_rate_limit: { data: [] } },
    })

    await expect(submitGuestbookMessage(input, client)).resolves.toMatchObject({
      status: 'failed',
    })
  })

  it('returns a safe failure detail when the RPC is denied', async () => {
    const { client } = createMockClient({
      rpcs: {
        submit_guestbook_message_with_rate_limit: {
          error: { message: 'new row violates row-level security policy', code: '42501' },
        },
      },
    })

    const result = await submitGuestbookMessage(input, client)

    expect(result.status).toBe('failed')
    if (result.status === 'failed') {
      expect(isDataError(result.error)).toBe(true)
      expect(result.error.message).not.toContain('row-level security')
    }
  })
})

describe('guestbook writes', () => {
  it('persists sanitised reaction maps', async () => {
    const { client, calls } = createMockClient({ tables: { guestbook_messages: { data: [] } } })

    await updateGuestbookReactions('message-1', { love: 3, zero: 0 }, client)

    expect(calls).toContainEqual({
      surface: 'from',
      target: 'guestbook_messages',
      method: 'update',
      args: [{ reactions: { love: 3 } }],
    })
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'guestbook_messages',
      method: 'eq',
      args: ['id', 'message-1'],
    })
  })

  it('wraps reaction update failures', async () => {
    const { client } = createMockClient({
      tables: { guestbook_messages: { error: new Error('network') } },
    })
    await expect(updateGuestbookReactions('m', { love: 1 }, client)).rejects.toBeInstanceOf(
      DataError
    )
  })

  it('adds a reply and returns the row', async () => {
    const row = makeMessageRow({ id: 'ignored' })
    const { client, calls } = createMockClient({
      tables: {
        guestbook_comments: {
          data: [
            { id: 'c-new', message_id: 'm1', author: 'Guest', content: 'Reply', created_at: null },
          ],
        },
      },
    })

    const reply = await addGuestbookReply({ messageId: 'm1', content: 'Reply' }, client)

    expect(reply.id).toBe('c-new')
    expect(calls).toContainEqual({
      surface: 'from',
      target: 'guestbook_comments',
      method: 'insert',
      args: [{ message_id: 'm1', author: 'Guest', content: 'Reply' }],
    })
    expect(row.id).toBe('ignored')
  })

  it('rejects empty insert results', async () => {
    const { client } = createMockClient({ tables: { guestbook_comments: { data: [] } } })
    await expect(
      addGuestbookReply({ messageId: 'm1', content: 'x' }, client)
    ).rejects.toMatchObject({
      code: 'insert:empty-result',
    })
  })

  it('deleteGuestbookMessages short-circuits and uses the admin RPC', async () => {
    const empty = createMockClient({})
    await expect(deleteGuestbookMessages([], empty.client)).resolves.toBe(0)
    expect(empty.calls).toHaveLength(0)

    const { client, calls } = createMockClient({
      rpcs: { delete_guestbook_messages_v1: { data: 2 } },
    })
    await expect(deleteGuestbookMessages(['m1', 'm2'], client)).resolves.toBe(2)
    expect(calls).toContainEqual({
      surface: 'rpc',
      target: 'delete_guestbook_messages_v1',
      method: 'rpc',
      args: [{ p_message_ids: ['m1', 'm2'] }],
    })
  })

  it('wraps guestbook delete RPC failures', async () => {
    const { client } = createMockClient({
      rpcs: {
        delete_guestbook_messages_v1: { error: { message: 'not authorized', code: '42501' } },
      },
    })
    await expect(deleteGuestbookMessages(['m1'], client)).rejects.toBeInstanceOf(DataError)
  })
})
