/**
 * Photos surface — gallery queries, photo engagement (likes/comments),
 * album organization, and family-share photo fetches.
 *
 * The home page, gallery page, lightbox, and family-share showcase all read
 * from these functions.
 */
import { supabase } from './client'
import type {
  AdminPhotoCommentRecord,
  AlbumOrganizerMoveInput,
  AlbumOrganizerPhoto,
  DeleteGalleryPhotosResult,
  Photo,
  PhotoAlbum,
  PhotoCommentRecord,
  PhotoEngagementSummary,
  PhotoLikeStatus,
  SaveAlbumOrganizationResult,
} from './types'

// ──────────────────────────────────────────────────────────────────────────
// Public photo fetching
// ──────────────────────────────────────────────────────────────────────────

/**
 * Fetch all photos by their exact URLs.
 *
 * Used by the family-share showcase (`fetchGuestContributionsByToken`) and the
 * claim wizard (`fetchPotentialPhotosToClaimByEmail`).
 */
export async function fetchPhotosByUrls(urls: string[]): Promise<Photo[]> {
  if (urls.length === 0) return []
  const { data, error } = await supabase.from('photos').select('*').in('url', urls)

  if (error) throw error
  return (data ?? []) as Photo[]
}

/** Try fetching photos from the Wedding Day album as a reliable fallback. */
export async function fetchWeddingDayPhotos(limit = 6): Promise<Photo[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('id, url, thumbnail, album, caption, faces, created_at')
    .eq('album', 'Wedding Day')
    .limit(limit)
  if (error) throw error
  return (data ?? []) as Photo[]
}

export async function fetchPhotosWithFaces(): Promise<Photo[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('id, url, thumbnail, album, caption, faces')
    .not('faces', 'is', null)
    .neq('faces', '[]')
  if (error) throw error
  return (data ?? []) as Photo[]
}

// ──────────────────────────────────────────────────────────────────────────
// Engagement (likes + comments)
// ──────────────────────────────────────────────────────────────────────────

export async function fetchPhotoLikeStatuses(photoKeys: string[], sessionId: string) {
  return await supabase
    .rpc('get_photo_like_statuses', {
      p_photo_keys: photoKeys,
      p_session_id: sessionId,
    })
    .returns<PhotoLikeStatus[]>()
}

export async function fetchPhotoEngagementSummary(photoKeys: string[]) {
  return await supabase
    .rpc('get_photo_engagement_summary_v1', {
      p_photo_keys: photoKeys,
    })
    .returns<PhotoEngagementSummary[]>()
}

export async function togglePhotoLike(photoKey: string, sessionId: string) {
  const response = await supabase.rpc('toggle_photo_like_v2', {
    p_photo_key: photoKey,
    p_session_id: sessionId,
  })

  if (response.error || !Array.isArray(response.data) || response.data.length === 0) {
    return {
      ...response,
      data: null,
    }
  }

  const status = response.data[0]

  return {
    ...response,
    data: {
      photo_key: status.result_photo_key,
      likes_count: status.result_likes_count,
      liked: status.result_liked,
    } satisfies PhotoLikeStatus,
  }
}

export async function fetchPhotoComments(photoKey: string) {
  return await supabase
    .from('photo_comments')
    .select('*')
    .eq('photo_key', photoKey)
    .eq('is_hidden', false)
    .order('created_at', { ascending: true })
    .returns<PhotoCommentRecord[]>()
}

export async function addPhotoComment(
  photoKey: string,
  content: string,
  author = 'Guest',
  sessionId: string
) {
  return await supabase
    .rpc('create_photo_comment_v1', {
      p_photo_key: photoKey,
      p_author: author,
      p_content: content,
      p_session_id: sessionId,
    })
    .single<PhotoCommentRecord>()
}

export async function fetchRecentPhotoComments(limit = 40) {
  return await supabase
    .rpc('get_recent_photo_comments_v1', {
      p_limit: limit,
    })
    .returns<AdminPhotoCommentRecord[]>()
}

export async function hidePhotoComment(commentId: string, hidden = true, reason?: string) {
  return await supabase
    .rpc('hide_photo_comment_v1', {
      p_comment_id: commentId,
      p_hidden: hidden,
      p_reason: reason ?? null,
    })
    .single<Pick<PhotoCommentRecord, 'id' | 'photo_key' | 'is_hidden'>>()
}

export async function deletePhotoComment(commentId: string) {
  return await supabase
    .rpc('delete_photo_comment_v1', {
      p_comment_id: commentId,
    })
    .single<{ deleted_id: string; photo_key: string }>()
}

// ──────────────────────────────────────────────────────────────────────────
// Albums (admin album organizer)
// ──────────────────────────────────────────────────────────────────────────

export async function fetchAlbumPhotos(album: PhotoAlbum) {
  return await supabase
    .from('photos')
    .select('*')
    .eq('album', album)
    .order('album_sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .returns<AlbumOrganizerPhoto[]>()
}

export async function fetchPhotoAlbumCounts() {
  const results = await Promise.all(
    ['Engagement', 'Bach+ette', 'Wedding Day', 'Guest Uploads'].map(async album => {
      const response = await supabase
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('album', album)

      return [album, response.count || 0] as const
    })
  )

  return Object.fromEntries(results) as Record<PhotoAlbum, number>
}

export async function fetchNextAlbumSortOrder(album: PhotoAlbum) {
  const { data, error } = await supabase
    .from('photos')
    .select('album_sort_order')
    .eq('album', album)
    .order('album_sort_order', { ascending: false })
    .limit(1)
    .maybeSingle<{ album_sort_order: number | null }>()

  if (error) {
    return { data: 1, error }
  }

  return {
    data: Number(data?.album_sort_order || 0) + 1,
    error: null,
  }
}

export async function saveAlbumOrganization(
  album: PhotoAlbum,
  orderedPhotoIds: string[],
  moves: AlbumOrganizerMoveInput[],
  deletePhotoIds: string[] = []
) {
  return await supabase
    .rpc('save_album_organization_v2', {
      p_album: album,
      p_ordered_photo_ids: orderedPhotoIds,
      p_moves: moves.map(move => ({
        photoId: move.photoId,
        targetAlbum: move.targetAlbum,
      })),
      p_delete_photo_ids: deletePhotoIds,
    })
    .single<SaveAlbumOrganizationResult>()
}

export async function deleteGalleryPhotos({
  photoIds = [],
  photoUrls = [],
}: {
  photoIds?: string[]
  photoUrls?: string[]
}) {
  return await supabase
    .rpc('delete_gallery_photos_v1', {
      p_photo_ids: photoIds,
      p_photo_urls: photoUrls,
    })
    .single<DeleteGalleryPhotosResult>()
}