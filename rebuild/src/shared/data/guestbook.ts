/**
 * Guestbook data API — read (with replies), submit (RPC + documented fallback),
 * reactions, replies and admin deletion.
 *
 * Frozen surface: `src/pages/guestbook/*` hooks + `src/lib/supabase/claims.ts`
 * (guestbook reads by email) + `src/pages/admin/GuestbookModeration.tsx`.
 *
 * IMPORTANT — known baseline defect (risk register R17, A3 §5): the deployed
 * `submit_guestbook_message_with_rate_limit` RPC still inserts a dropped
 * `guestbook_messages.type` column, so it raises at runtime. The frozen client
 * silently falls back to a direct table insert, which bypasses server-side rate
 * limiting. We preserve that behaviour here (RPC first, direct insert fallback)
 * and mark the result `viaFallback: true` so the UI/telemetry can see it; the
 * repair is Wave 3/cutover work (see `contracts/schema/rpc.md` §3).
 */
import type { TypedSupabaseClient } from './client'
import { getSupabaseClient } from './client'
import { DataError, toDataError, unwrapResult } from './errors'
import type { Json, RpcRow, TableRow } from './schema'
import { isJsonObject } from './schema'

export type GuestbookMessageRow = TableRow<'guestbook_messages'>
export type GuestbookCommentRow = TableRow<'guestbook_comments'>
export type GuestbookReactionCounts = Record<string, number>

/** One reply to a guestbook note. */
export interface GuestbookComment {
  id: string
  author: string
  content: string
  createdAt: string
}

/** Normalised guestbook note (home page, /guestbook, print, guest-share). */
export interface GuestbookMessage {
  id: string
  name: string
  content: string
  createdAt: string
  mediaUrl: string | null
  reactions: GuestbookReactionCounts
  comments: GuestbookComment[]
}

/** Input accepted by the public composer. */
export interface GuestbookMessageInput {
  name: string
  email: string
  content: string
  mediaUrl?: string | null
}

/** What happened when the guest pressed "leave a note". */
export type GuestbookSubmitResult =
  | {
      status: 'submitted'
      messageId: string
      rateLimitRemaining: number | null
      /** True when the broken RPC failed and the direct-insert fallback was used. */
      viaFallback: boolean
    }
  | { status: 'rate-limited'; message: string; resetAfterSeconds: number | null }
  | { status: 'failed'; error: DataError }

const GUESTBOOK_READ_ERROR = 'The guestbook is taking a moment. Please try again.'
const GUESTBOOK_WRITE_ERROR = 'That guestbook change could not be saved. Please try again.'

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/** Parse a `guestbook_messages.reactions` jsonb value into numeric counters. */
export function parseReactions(value: Json | null | undefined): GuestbookReactionCounts {
  if (!isJsonObject(value)) return {}

  const reactions: GuestbookReactionCounts = {}
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
      reactions[key] = Math.trunc(raw)
    }
  }
  return reactions
}

/**
 * Sanitise a locally computed reaction map before writing it back: non-negative
 * integers only, unknown keys preserved (the reaction set is content-defined).
 */
export function sanitizeReactions(
  input: Readonly<Record<string, number>>
): GuestbookReactionCounts {
  const reactions: GuestbookReactionCounts = {}
  for (const [key, raw] of Object.entries(input)) {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
      reactions[key] = Math.trunc(raw)
    }
  }
  return reactions
}

/** Parse one reply. Returns `null` for malformed rows instead of throwing. */
export function parseGuestbookComment(raw: unknown): GuestbookComment | null {
  if (!isJsonObject(raw as Json | null)) return null
  const record = raw as Record<string, Json | undefined>

  const id = asString(record.id)
  const content = asString(record.content)
  if (!id || content === null) return null

  return {
    id,
    author: asString(record.author) ?? 'Guest',
    content,
    createdAt: asString(record.created_at) ?? '',
  }
}

/**
 * Parse a guestbook note (with optional nested comments).
 *
 * Accepts both the PostgREST embed shape (`comments: guestbook_comments(...)`)
 * and the `get_guestbook_messages_with_comments` RPC shape (same key), plus the
 * plain row shape (no comments).
 */
export function parseGuestbookMessage(raw: unknown): GuestbookMessage | null {
  if (!isJsonObject(raw as Json | null)) return null
  const record = raw as Record<string, Json | undefined>

  const id = asString(record.id)
  const content = asString(record.content)
  if (!id || content === null) return null

  const rawComments = record.comments
  const comments: GuestbookComment[] = []
  if (Array.isArray(rawComments)) {
    for (const entry of rawComments) {
      const comment = parseGuestbookComment(entry)
      if (comment) comments.push(comment)
    }
  }

  return {
    id,
    name: asString(record.name) ?? 'A guest',
    content,
    createdAt: asString(record.created_at) ?? '',
    mediaUrl: asString(record.media_url),
    reactions: parseReactions(record.reactions),
    comments,
  }
}

/** Parse a list, dropping malformed entries. */
export function parseGuestbookMessages(raw: readonly unknown[]): GuestbookMessage[] {
  const messages: GuestbookMessage[] = []
  for (const entry of raw) {
    const message = parseGuestbookMessage(entry)
    if (message) messages.push(message)
  }
  return messages
}

/** Public feed: newest notes first, with their replies embedded. */
export async function fetchGuestbookMessages(
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<GuestbookMessage[]> {
  const { data, error } = await client
    .from('guestbook_messages')
    .select(
      'id, name, content, created_at, reactions, media_url, comments:guestbook_comments(id, author, content, created_at)'
    )
    .order('created_at', { ascending: false })

  if (error) throw toDataError(error, GUESTBOOK_READ_ERROR)
  return parseGuestbookMessages(data ?? [])
}

/** Print route: chronological, name/content only. */
export interface GuestbookPrintEntry {
  id: string
  name: string
  content: string
  createdAt: string
}

export async function fetchGuestbookForPrint(
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<GuestbookPrintEntry[]> {
  const rows = unwrapResult(
    await client
      .from('guestbook_messages')
      .select('id, name, content, created_at')
      .order('created_at', { ascending: true }),
    GUESTBOOK_READ_ERROR
  )

  return (rows ?? []).map(row => ({
    id: row.id,
    name: row.name,
    content: row.content,
    createdAt: row.created_at ?? '',
  }))
}

/**
 * Read through the server-aggregated RPC (`get_guestbook_messages_with_comments`).
 *
 * Not used by the current client-side guestbook hook (it uses the PostgREST
 * embed above) but part of the deployed API surface used by legacy scripts, the
 * e2e mock and the rendered-content extractor. Kept here for the parity/contract
 * surface and documented in `contracts/schema/rpc.md`.
 */
export async function fetchGuestbookMessagesWithCommentsRpc(
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<GuestbookMessage[]> {
  const { data, error } = await client.rpc('get_guestbook_messages_with_comments')
  if (error) throw toDataError(error, GUESTBOOK_READ_ERROR)

  const rows: Array<RpcRow<'get_guestbook_messages_with_comments'>> = data ?? []
  const messages: GuestbookMessage[] = []
  for (const row of rows) {
    const message = parseGuestbookMessage(row)
    if (message) messages.push(message)
  }
  return messages
}

/**
 * Submit a note: rate-limited RPC first, direct insert fallback when the RPC is
 * broken (current production baseline, risk R17). Never throws — UI maps the
 * discriminated result.
 */
export async function submitGuestbookMessage(
  input: GuestbookMessageInput,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<GuestbookSubmitResult> {
  try {
    const { data, error } = await client.rpc('submit_guestbook_message_with_rate_limit', {
      p_name: input.name,
      p_email: input.email,
      p_content: input.content,
      p_media_url: input.mediaUrl ?? undefined,
      p_max_requests: 3,
      p_window_minutes: 1,
    })

    if (!error) {
      const result = (data ?? [])[0]
      if (result) {
        if (!result.success) {
          return {
            status: 'rate-limited',
            message: result.error_message || 'Just a moment before the next note.',
            resetAfterSeconds: Number.isFinite(result.rate_limit_reset_after)
              ? Number(result.rate_limit_reset_after)
              : null,
          }
        }
        return {
          status: 'submitted',
          messageId: result.message_id,
          rateLimitRemaining: Number.isFinite(result.rate_limit_remaining)
            ? Number(result.rate_limit_remaining)
            : null,
          viaFallback: false,
        }
      }
    }
  } catch {
    // Fall through to the direct insert; the RPC raising must not lose the note.
  }

  // Documented fallback (same behaviour as the frozen composer). RLS allows
  // public INSERT on guestbook_messages, so this still works while R17 is open.
  try {
    const { data, error } = await client
      .from('guestbook_messages')
      .insert({
        name: input.name,
        email: input.email,
        content: input.content,
        media_url: input.mediaUrl ?? null,
      })
      .select('id')
      .single()

    if (error) throw error
    return {
      status: 'submitted',
      messageId: data.id,
      rateLimitRemaining: null,
      viaFallback: true,
    }
  } catch (error) {
    return {
      status: 'failed',
      error: toDataError(error, 'Your note did not go through. Please try again.'),
    }
  }
}

/** Persist the locally toggled reaction map for one note. */
export async function updateGuestbookReactions(
  messageId: string,
  reactions: Readonly<Record<string, number>>,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<void> {
  const { error } = await client
    .from('guestbook_messages')
    .update({ reactions: sanitizeReactions(reactions) })
    .eq('id', messageId)

  if (error) throw toDataError(error, GUESTBOOK_WRITE_ERROR)
}

/** Add a reply to a note (public insert, no auth — mirrors the frozen composer). */
export async function addGuestbookReply(
  input: { messageId: string; content: string; author?: string },
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<GuestbookCommentRow> {
  const rows = unwrapResult(
    await client
      .from('guestbook_comments')
      .insert({
        message_id: input.messageId,
        author: input.author ?? 'Guest',
        content: input.content,
      })
      .select('*'),
    GUESTBOOK_WRITE_ERROR
  )

  const row = (rows ?? [])[0]
  if (!row) {
    throw new DataError({
      message: GUESTBOOK_WRITE_ERROR,
      code: 'insert:empty-result',
      cause: { table: 'guestbook_comments', messageId: input.messageId },
    })
  }
  return row
}

/**
 * Admin: delete guestbook notes by id.
 *
 * Baseline drift (A3 §6 S4): `guestbook_messages` has no DELETE RLS policy, so
 * this call is denied for anon/authenticated until the rebuild adds the admin
 * delete RPC. Kept here so the admin surface is complete and the contract test
 * can record the current behaviour.
 */
export async function deleteGuestbookMessages(
  messageIds: readonly string[],
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<number> {
  if (messageIds.length === 0) return 0

  const { data, error } = await client
    .from('guestbook_messages')
    .delete()
    .in('id', [...messageIds])
    .select('id')

  if (error) throw toDataError(error, GUESTBOOK_WRITE_ERROR)
  return (data ?? []).length
}

/** The note shape stored by the rate-limited submit RPC, re-exported for tests. */
export type GuestbookSubmitRpcRow = RpcRow<'submit_guestbook_message_with_rate_limit'>
