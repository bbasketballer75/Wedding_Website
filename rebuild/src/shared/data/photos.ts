/**
 * Photos, photo engagement (likes/comments) and album organisation.
 *
 * Portfolio of the frozen app's query surface:
 * - `src/lib/supabase/photos.ts` (gallery reads, engagement RPCs, albums)
 * - `src/hooks/useGalleryData.ts` (paged read + engagement hydration)
 * - `src/components/sections/GuestHighlightReel.tsx` (top-photos read)
 *
 * Reads return normalised view models (`Photo`) built from the generated
 * `photos` row type; no hand-written duplicate row interface exists.
 */
import type { TypedSupabaseClient } from './client'
import { getSupabaseClient } from './client'
import { DataError, toDataError, unwrapResult } from './errors'
import type { Json, RpcRow, TableRow } from './schema'
import { isJsonObject, readJsonNumber, readJsonNumberOr, readJsonString } from './schema'

/** The four product albums (mirrors the DB CHECK constraint). */
export const PHOTO_ALBUMS = ['Engagement', 'Bach+ette', 'Wedding Day', 'Guest Uploads'] as const
export type PhotoAlbum = (typeof PHOTO_ALBUMS)[number]

/** True when a raw string is one of the four product albums. */
export function isPhotoAlbum(value: string | null | undefined): value is PhotoAlbum {
  return typeof value === 'string' && (PHOTO_ALBUMS as readonly string[]).includes(value)
}

/** Page size used by the frozen gallery fetch (must stay ≤ PostgREST max_rows). */
export const GALLERY_PAGE_SIZE = 1000

/** A face rectangle normalised from the `photos.faces` jsonb column. */
export interface PhotoFaceBox {
  left: number
  top: number
  width: number
  height: number
}

/** A tagged face on a photo. Coordinates are stored as 0–100 percentages. */
export interface PhotoFace {
  id: string
  name: string
  x: number
  y: number
  box: PhotoFaceBox | null
}

type RawPhotoRow = TableRow<'photos'>

/**
 * Normalised photo view model. Reuses every generated row column and only
 * replaces the columns that are nullable/untyped in the database with the shape
 * the UI actually consumes.
 */
export interface Photo extends Omit<
  RawPhotoRow,
  'album' | 'faces' | 'tags' | 'likes' | 'is_professional'
> {
  album: PhotoAlbum | null
  faces: PhotoFace[]
  tags: string[]
  likes: number
  isProfessional: boolean
}

/** Engagement counters attached to a photo (from the two engagement RPCs). */
export interface PhotoEngagement {
  likeCount: number
  liked: boolean
  commentCount: number
}

export type PhotoLikeStatus = RpcRow<'get_photo_like_statuses'>
export type PhotoEngagementSummary = RpcRow<'get_photo_engagement_summary_v1'>
export type PhotoCommentRow = TableRow<'photo_comments'>
export type RecentPhotoCommentRow = RpcRow<'get_recent_photo_comments_v1'>
export type ToggleLikeResult = { photoKey: string; likesCount: number; liked: boolean }
export type AlbumCounts = Record<PhotoAlbum, number>

const GALLERY_READ_ERROR = 'The gallery is taking a moment. Please try again.'
const GALLERY_WRITE_ERROR = 'That gallery change could not be saved. Please try again.'
const ENGAGEMENT_ERROR = 'That interaction could not be saved. Please try again.'

// ─────────────────────────────────────────────────────────────────────────────
// Parsing / mapping
// ─────────────────────────────────────────────────────────────────────────────

function readNumber(value: Json | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/**
 * Parse the `photos.faces` jsonb value into `PhotoFace[]`.
 *
 * The column is untyped JSON written by the media pipeline, so every field is
 * validated: malformed entries are dropped rather than crashing a page.
 */
export function parsePhotoFaces(value: Json | null | undefined): PhotoFace[] {
  if (!Array.isArray(value)) return []

  const faces: PhotoFace[] = []
  for (const entry of value) {
    if (!isJsonObject(entry)) continue

    const id = readJsonString(entry, 'id')
    const name = readJsonString(entry, 'name')
    if (!id || !name) continue

    const boxValue = entry.box
    let box: PhotoFaceBox | null = null
    if (isJsonObject(boxValue)) {
      box = {
        left: readJsonNumberOr(boxValue, 'left', 0),
        top: readJsonNumberOr(boxValue, 'top', 0),
        width: readJsonNumberOr(boxValue, 'width', 0),
        height: readJsonNumberOr(boxValue, 'height', 0),
      }
    }

    faces.push({
      id,
      name,
      x: readJsonNumberOr(entry, 'x', 0),
      y: readJsonNumberOr(entry, 'y', 0),
      box,
    })
  }

  return faces
}

/** Map a generated `photos` row to the normalised `Photo` view model. */
export function mapPhotoRow(row: RawPhotoRow): Photo {
  return {
    ...row,
    album: isPhotoAlbum(row.album) ? row.album : null,
    faces: parsePhotoFaces(row.faces),
    tags: row.tags ?? [],
    likes: readNumber(row.likes, 0),
    isProfessional: row.is_professional ?? false,
    album_sort_order: row.album_sort_order ?? 0,
    download_url: row.download_url ?? null,
  }
}

/** Map a list of rows. */
export function mapPhotoRows(rows: readonly RawPhotoRow[]): Photo[] {
  return rows.map(mapPhotoRow)
}

/**
 * Merge curated (contract/content) photos with live ones.
 *
 * Frozen behaviour (`useGalleryData`): dedupe by id, then url, then thumbnail;
 * the live row wins field-by-field over the curated shell. Order: curated first.
 */
export function mergePhotos(curated: readonly Photo[], live: readonly Photo[]): Photo[] {
  const merged: Photo[] = []

  for (const photo of [...curated, ...live]) {
    const duplicateIndex = merged.findIndex(
      existing =>
        existing.id === photo.id ||
        existing.url === photo.url ||
        existing.thumbnail === photo.thumbnail
    )

    const existing = merged[duplicateIndex]
    if (duplicateIndex >= 0 && existing) {
      merged[duplicateIndex] = { ...existing, ...photo }
    } else {
      merged.push(photo)
    }
  }

  return merged
}

/**
 * Index the two engagement RPC responses by photo key (id).
 *
 * Frozen hydration rules (`useGalleryData`): likes prefer the per-session status
 * count, then the summary count, then the row value; `liked` comes from the
 * session status; comment count comes from the summary.
 */
export function indexPhotoEngagement(
  statuses: readonly PhotoLikeStatus[],
  summaries: readonly PhotoEngagementSummary[]
): Map<string, PhotoEngagement> {
  const index = new Map<string, PhotoEngagement>()

  for (const summary of summaries) {
    index.set(summary.photo_key, {
      likeCount: Number(summary.likes_count),
      liked: false,
      commentCount: Number(summary.comments_count),
    })
  }

  for (const status of statuses) {
    const existing = index.get(status.photo_key)
    index.set(status.photo_key, {
      likeCount: Number(status.likes_count),
      liked: status.liked,
      commentCount: existing?.commentCount ?? 0,
    })
  }

  return index
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

export interface PhotoPage {
  page: number
  pageSize?: number
}

/**
 * Fetch one page of live photos, newest first (gallery infinite scroll).
 * Pages are 0-based and use PostgREST `range` (inclusive bounds).
 */
export async function fetchPhotoPage(
  options: PhotoPage,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<Photo[]> {
  const pageSize = options.pageSize ?? GALLERY_PAGE_SIZE
  const from = options.page * pageSize
  const to = from + pageSize - 1

  const rows = unwrapResult(
    await client
      .from('photos')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to),
    GALLERY_READ_ERROR
  )

  return mapPhotoRows(rows ?? [])
}

/** Fetch every live photo (loops pages until a short page). */
export async function fetchAllPhotos(
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<Photo[]> {
  const photos: Photo[] = []
  let page = 0

  while (true) {
    const rows = await fetchPhotoPage({ page, pageSize: GALLERY_PAGE_SIZE }, client)
    photos.push(...rows)
    if (rows.length < GALLERY_PAGE_SIZE) break
    page += 1
  }

  return photos
}

/** Fetch photos by their exact `url` values (family-share showcase, claim wizard). */
export async function fetchPhotosByUrls(
  urls: readonly string[],
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<Photo[]> {
  if (urls.length === 0) return []

  const rows = unwrapResult(
    await client
      .from('photos')
      .select('*')
      .in('url', [...urls]),
    GALLERY_READ_ERROR
  )
  return mapPhotoRows(rows ?? [])
}

/** Fetch `Wedding Day` photos — the home page's reliable fallback row. */
export async function fetchWeddingDayPhotos(
  limit = 6,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<Photo[]> {
  const rows = unwrapResult(
    await client
      .from('photos')
      .select('id, url, thumbnail, album, caption, faces, created_at')
      .eq('album', 'Wedding Day')
      .limit(limit),
    GALLERY_READ_ERROR
  )

  // The narrow select omits columns; normalise through the same mapper by
  // filling the absent fields with model defaults.
  return (rows ?? []).map(row => mapPhotoRow({ ...emptyPhotoRow(), ...row }))
}

/** Fetch every photo that has at least one tagged face (people browsing). */
export async function fetchPhotosWithFaces(
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<Photo[]> {
  const rows = unwrapResult(
    await client
      .from('photos')
      .select('id, url, thumbnail, album, caption, faces')
      .not('faces', 'is', null)
      .neq('faces', '[]'),
    GALLERY_READ_ERROR
  )
  return (rows ?? []).map(row => mapPhotoRow({ ...emptyPhotoRow(), ...row }))
}

/** Fetch the most-liked photos (home "standout moments" reel). */
export async function fetchTopPhotos(
  limit: number,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<Photo[]> {
  const rows = unwrapResult(
    await client.from('photos').select('*').order('likes', { ascending: false }).limit(limit),
    GALLERY_READ_ERROR
  )
  return mapPhotoRows(rows ?? [])
}

function emptyPhotoRow(): RawPhotoRow {
  return {
    id: '',
    url: '',
    thumbnail: '',
    caption: null,
    category: null,
    location: null,
    date: null,
    likes: null,
    photographer: null,
    is_professional: null,
    tags: null,
    faces: null,
    created_at: null,
    album: null,
    album_sort_order: 0,
    download_url: null,
  }
}

function readStringArray(value: Json | undefined): string[] | null {
  if (!Array.isArray(value)) return null
  return value.filter((entry): entry is string => typeof entry === 'string')
}

/**
 * Parse an arbitrary record into a `Photo` (tolerant of partial selects and
 * fixture rows). Used by the guest-share and claim paths where photos arrive
 * nested inside another resource.
 */
export function parsePhotoRecord(raw: unknown): Photo | null {
  if (!isJsonObject(raw as Json | null)) return null
  const record = raw as Record<string, Json | undefined>

  const id = readJsonString(record, 'id')
  const url = readJsonString(record, 'url')
  if (!id || url === null) return null

  return mapPhotoRow({
    ...emptyPhotoRow(),
    id,
    url,
    thumbnail: readJsonString(record, 'thumbnail') ?? url,
    caption: readJsonString(record, 'caption'),
    category: readJsonString(record, 'category'),
    location: readJsonString(record, 'location'),
    date: readJsonString(record, 'date'),
    likes: readJsonNumber(record, 'likes'),
    photographer: readJsonString(record, 'photographer'),
    is_professional: typeof record.is_professional === 'boolean' ? record.is_professional : null,
    tags: readStringArray(record.tags),
    faces: record.faces ?? null,
    created_at: readJsonString(record, 'created_at'),
    album: readJsonString(record, 'album'),
    album_sort_order: readJsonNumber(record, 'album_sort_order') ?? 0,
    download_url: readJsonString(record, 'download_url'),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Engagement
// ─────────────────────────────────────────────────────────────────────────────

/** Per-session like state + totals for a batch of photo keys. */
export async function fetchPhotoLikeStatuses(
  photoKeys: readonly string[],
  sessionId: string,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<PhotoLikeStatus[]> {
  if (photoKeys.length === 0) return []

  const { data, error } = await client.rpc('get_photo_like_statuses', {
    p_photo_keys: [...photoKeys],
    p_session_id: sessionId,
  })
  if (error) throw toDataError(error, ENGAGEMENT_ERROR)
  return data ?? []
}

/** Aggregate like/comment totals for a batch of photo keys. */
export async function fetchPhotoEngagementSummary(
  photoKeys: readonly string[],
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<PhotoEngagementSummary[]> {
  if (photoKeys.length === 0) return []

  const { data, error } = await client.rpc('get_photo_engagement_summary_v1', {
    p_photo_keys: [...photoKeys],
  })
  if (error) throw toDataError(error, ENGAGEMENT_ERROR)
  return data ?? []
}

/**
 * Toggle the current session's like and return the authoritative totals.
 * Uses `toggle_photo_like_v2`; the RPC returns `result_*` columns.
 */
export async function togglePhotoLike(
  photoKey: string,
  sessionId: string,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<ToggleLikeResult> {
  const { data, error } = await client.rpc('toggle_photo_like_v2', {
    p_photo_key: photoKey,
    p_session_id: sessionId,
  })
  if (error) throw toDataError(error, ENGAGEMENT_ERROR)

  const row = (data ?? [])[0]
  if (!row) {
    throw new DataError({
      message: ENGAGEMENT_ERROR,
      code: 'rpc:empty-result',
      cause: { rpc: 'toggle_photo_like_v2', photoKey },
    })
  }

  return {
    photoKey: row.result_photo_key,
    likesCount: Number(row.result_likes_count),
    liked: row.result_liked,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Comments
// ─────────────────────────────────────────────────────────────────────────────

/** Visible comments for one photo, oldest first. */
export async function fetchPhotoComments(
  photoKey: string,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<PhotoCommentRow[]> {
  const rows = unwrapResult(
    await client
      .from('photo_comments')
      .select('*')
      .eq('photo_key', photoKey)
      .eq('is_hidden', false)
      .order('created_at', { ascending: true }),
    GALLERY_READ_ERROR
  )
  return rows ?? []
}

/** Add a comment through the sanitising `create_photo_comment_v1` RPC. */
export async function addPhotoComment(
  input: { photoKey: string; content: string; author?: string; sessionId: string },
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<RpcRow<'create_photo_comment_v1'>> {
  const { data, error } = await client.rpc('create_photo_comment_v1', {
    p_photo_key: input.photoKey,
    p_author: input.author ?? 'Guest',
    p_content: input.content,
    p_session_id: input.sessionId,
  })
  if (error) throw toDataError(error, ENGAGEMENT_ERROR)

  const row = (data ?? [])[0]
  if (!row) {
    throw new DataError({
      message: ENGAGEMENT_ERROR,
      code: 'rpc:empty-result',
      cause: { rpc: 'create_photo_comment_v1', photoKey: input.photoKey },
    })
  }
  return row
}

/** Admin queue: recent comments joined onto photos. */
export async function fetchRecentPhotoComments(
  limit = 40,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<RecentPhotoCommentRow[]> {
  const { data, error } = await client.rpc('get_recent_photo_comments_v1', { p_limit: limit })
  if (error) throw toDataError(error, GALLERY_READ_ERROR)
  return data ?? []
}

/** Admin: soft-hide or restore a comment. */
export async function hidePhotoComment(
  commentId: string,
  hidden = true,
  reason?: string,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<RpcRow<'hide_photo_comment_v1'>> {
  const { data, error } = await client.rpc('hide_photo_comment_v1', {
    p_comment_id: commentId,
    p_hidden: hidden,
    p_reason: reason,
  })
  if (error) throw toDataError(error, GALLERY_WRITE_ERROR)

  const row = (data ?? [])[0]
  if (!row) {
    throw new DataError({
      message: GALLERY_WRITE_ERROR,
      code: 'rpc:empty-result',
      cause: { rpc: 'hide_photo_comment_v1', commentId },
    })
  }
  return row
}

/** Admin: hard-delete a comment. */
export async function deletePhotoComment(
  commentId: string,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<RpcRow<'delete_photo_comment_v1'>> {
  const { data, error } = await client.rpc('delete_photo_comment_v1', {
    p_comment_id: commentId,
  })
  if (error) throw toDataError(error, GALLERY_WRITE_ERROR)

  const row = (data ?? [])[0]
  if (!row) {
    throw new DataError({
      message: GALLERY_WRITE_ERROR,
      code: 'rpc:empty-result',
      cause: { rpc: 'delete_photo_comment_v1', commentId },
    })
  }
  return row
}

// ─────────────────────────────────────────────────────────────────────────────
// Albums (admin organiser)
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch one album ordered exactly like the frozen organiser. */
export async function fetchAlbumPhotos(
  album: PhotoAlbum,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<Photo[]> {
  const rows = unwrapResult(
    await client
      .from('photos')
      .select('*')
      .eq('album', album)
      .order('album_sort_order', { ascending: true })
      .order('created_at', { ascending: false }),
    GALLERY_READ_ERROR
  )
  return mapPhotoRows(rows ?? [])
}

/** Exact photo counts for the four album tabs (0 defaults). */
export async function fetchPhotoAlbumCounts(
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<AlbumCounts> {
  const entries = await Promise.all(
    PHOTO_ALBUMS.map(async album => {
      const { count, error } = await client
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('album', album)
      if (error) throw toDataError(error, GALLERY_READ_ERROR)
      return [album, count ?? 0] as const
    })
  )

  const counts = { Engagement: 0, 'Bach+ette': 0, 'Wedding Day': 0, 'Guest Uploads': 0 }
  for (const [album, count] of entries) counts[album] = count
  return counts
}

/** Next free `album_sort_order` for an album (1 when the album is empty). */
export async function fetchNextAlbumSortOrder(
  album: PhotoAlbum,
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<number> {
  const { data, error } = await client
    .from('photos')
    .select('album_sort_order')
    .eq('album', album)
    .order('album_sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw toDataError(error, GALLERY_READ_ERROR)
  return Number(data?.album_sort_order ?? 0) + 1
}

/** One move between albums, as accepted by `save_album_organization_v2`. */
export interface AlbumOrganizerMove {
  photoId: string
  targetAlbum: PhotoAlbum
}

/** Save the whole album order + inter-album moves + deletions in one RPC. */
export async function saveAlbumOrganization(
  input: {
    album: PhotoAlbum
    orderedPhotoIds: readonly string[]
    moves: readonly AlbumOrganizerMove[]
    deletePhotoIds?: readonly string[]
  },
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<RpcRow<'save_album_organization_v2'>> {
  const { data, error } = await client.rpc('save_album_organization_v2', {
    p_album: input.album,
    p_ordered_photo_ids: [...input.orderedPhotoIds],
    p_moves: input.moves.map(move => ({
      photoId: move.photoId,
      targetAlbum: move.targetAlbum,
    })),
    p_delete_photo_ids: [...(input.deletePhotoIds ?? [])],
  })
  if (error) throw toDataError(error, GALLERY_WRITE_ERROR)

  const row = (data ?? [])[0]
  if (!row) {
    throw new DataError({
      message: GALLERY_WRITE_ERROR,
      code: 'rpc:empty-result',
      cause: { rpc: 'save_album_organization_v2', album: input.album },
    })
  }
  return row
}

/** Delete gallery photos by id and/or url (dependent likes/comments are cascaded by the RPC). */
export async function deleteGalleryPhotos(
  input: { photoIds?: readonly string[]; photoUrls?: readonly string[] },
  client: TypedSupabaseClient = getSupabaseClient()
): Promise<RpcRow<'delete_gallery_photos_v1'>> {
  const { data, error } = await client.rpc('delete_gallery_photos_v1', {
    p_photo_ids: [...(input.photoIds ?? [])],
    p_photo_urls: [...(input.photoUrls ?? [])],
  })
  if (error) throw toDataError(error, GALLERY_WRITE_ERROR)

  const row = (data ?? [])[0]
  if (!row) {
    throw new DataError({
      message: GALLERY_WRITE_ERROR,
      code: 'rpc:empty-result',
      cause: { rpc: 'delete_gallery_photos_v1' },
    })
  }
  return row
}
