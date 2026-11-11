/**
 * Data seams for the admin album organizer (`/admin/albums`).
 *
 * W7-1 (contracts-eng) owns `features/admin/data.ts`; this module is the
 * W7-2-owned seam so the organizer can be built and tested before the shared
 * admin API lands. Default bindings already point at the typed Wave-3 data
 * layer (`@/shared/data`), so the page works in production; tests inject the
 * deterministic fixtures below.
 *
 * TODO(Wave3/Lead): if W7-1's `features/admin/data.ts` grows the same three
 * reads/writes for other admin pages, re-export from there and delete these
 * bindings (behaviour and payload shape must stay identical:
 * `fetchAlbumPhotos`, `fetchPhotoAlbumCounts`, `saveAlbumOrganization`).
 */
import { mediaPaths } from '@/shared/data/media'
import {
  PHOTO_ALBUMS,
  fetchAlbumPhotos,
  fetchPhotoAlbumCounts,
  fetchPhotoEngagementSummary,
  saveAlbumOrganization as saveAlbumOrganizationRpc,
  type Photo,
  type PhotoAlbum,
} from '@/shared/data/photos'

/**
 * A photo row as the organizer consumes it: frozen `OrganizerPhoto` fields
 * (resolved media paths, display label, engagement counters) plus the DB order
 * columns the dirty-diff save needs.
 */
export interface OrganizerPhoto {
  id: string
  album: PhotoAlbum
  url: string
  thumbnail: string | null
  caption: string | null
  albumSortOrder: number
  createdAt: string | null
  date: string | null
  location: string | null
  photographer: string | null
  tags: readonly string[]
  likeCount: number
  commentCount: number
  hiddenCommentCount: number
}

/** Frozen `PendingAlbumMove`: keep the photo from the origin album and move it on save. */
export interface PendingAlbumMove {
  photoId: string
  targetAlbum: PhotoAlbum
}

/** In-memory staged move (keeps the full photo so `Undo` can restore it). */
export interface StagedAlbumMove {
  photo: OrganizerPhoto
  targetAlbum: PhotoAlbum
}

/** One staged deletion (`PendingAlbumDeletion` in the frozen hook). */
export interface PendingAlbumDeletion {
  photoId: string
}

/** In-memory staged deletion (keeps the full photo so `Undo` can restore it). */
export interface StagedAlbumDeletion {
  photo: OrganizerPhoto
}

/** Exact payload handed to the injected `saveAlbumOrganization` seam. */
export interface AlbumOrganizerSaveRequest {
  readonly album: PhotoAlbum
  /** Draft order after edits — the only order the server needs. */
  readonly order: readonly string[]
  /** Only the dirty moves (photoId + target album). */
  readonly moves: readonly PendingAlbumMove[]
  /** Only the dirty deletions. */
  readonly deletes: readonly string[]
}

/** Normalised RPC result (`save_album_organization_v2`). */
export interface AlbumOrganizerSaveResult {
  readonly savedAlbum: PhotoAlbum
  readonly movedCount: number
  readonly deletedCount: number
}

export interface AlbumOrganizerData {
  /** Album photos in frozen order (`album_sort_order` asc, `created_at` desc). */
  readonly fetchAlbumPhotos: (album: PhotoAlbum) => Promise<readonly OrganizerPhoto[]>
  /** Exact photo counts for the four album tabs. */
  readonly fetchAlbumCounts: () => Promise<Record<PhotoAlbum, number>>
  /** Persist the dirty diff; resolves with the RPC summary. */
  readonly saveAlbumOrganization: (
    request: AlbumOrganizerSaveRequest
  ) => Promise<AlbumOrganizerSaveResult>
}

function organizerLabel(photo: { caption: string | null; url: string; id: string }): string {
  const pathCandidate = photo.url
  const fileName = pathCandidate.split('/').pop() || photo.id
  return photo.caption?.trim() || fileName
}

/** Frozen `resolveMediaPath`/`getMediaPath` behaviour for thumbnails and full images. */
export function resolveOrganizerMediaPath(path: string | null | undefined): string {
  if (!path) return ''
  return mediaPaths.getMediaPath(path)
}

/** Frozen `getPhotoLabel`, exported for UI alt text and option labels. */
export { organizerLabel }

/** Map one typed data-layer photo (+ engagement summary) to the organizer model. */
export function toOrganizerPhoto(
  photo: Photo,
  engagement: { likeCount: number; commentCount: number; hiddenCommentCount: number } = {
    likeCount: 0,
    commentCount: 0,
    hiddenCommentCount: 0,
  }
): OrganizerPhoto {
  return {
    id: photo.id,
    album: photo.album ?? 'Engagement',
    // DB media paths are relative; the organizer renders the same CDN/local URLs
    // as the public gallery.
    url: mediaPaths.getMediaPath(photo.url),
    thumbnail: photo.thumbnail ? mediaPaths.getMediaPath(photo.thumbnail) : null,
    caption: photo.caption ?? null,
    albumSortOrder: photo.album_sort_order ?? 0,
    createdAt: photo.created_at ?? null,
    date: photo.date ?? null,
    location: photo.location ?? null,
    photographer: photo.photographer ?? null,
    tags: photo.tags ?? [],
    likeCount: engagement.likeCount,
    commentCount: engagement.commentCount,
    hiddenCommentCount: engagement.hiddenCommentCount,
  }
}

/** Default bindings against the typed Wave-3 data layer. */
export const albumOrganizerData: AlbumOrganizerData = {
  fetchAlbumPhotos: async album => {
    const photos = await fetchAlbumPhotos(album)
    if (photos.length === 0) return []

    // Frozen behaviour: hydrate per-photo engagement counts in one summary read.
    let engagementByPhoto = new Map<
      string,
      { likeCount: number; commentCount: number; hiddenCommentCount: number }
    >()
    try {
      const summaries = await fetchPhotoEngagementSummary(photos.map(photo => photo.id))
      engagementByPhoto = new Map(
        summaries.map(summary => [
          summary.photo_key,
          {
            likeCount: Number(summary.likes_count),
            commentCount: Number(summary.comments_count),
            hiddenCommentCount: Number(summary.hidden_comments_count),
          },
        ])
      )
    } catch {
      // Counts are non-critical chrome; a summary failure keeps the album usable.
    }

    return photos.map(photo => toOrganizerPhoto(photo, engagementByPhoto.get(photo.id)))
  },
  fetchAlbumCounts: () => fetchPhotoAlbumCounts(),
  saveAlbumOrganization: async request => {
    const row = await saveAlbumOrganizationRpc({
      album: request.album,
      orderedPhotoIds: [...request.order],
      moves: request.moves.map(move => ({
        photoId: move.photoId,
        targetAlbum: move.targetAlbum,
      })),
      deletePhotoIds: [...request.deletes],
    })
    return {
      savedAlbum: request.album,
      movedCount: Number(row.moved_count),
      deletedCount: Number(row.deleted_count),
    }
  },
}

/**
 * Deterministic fixture data for tests and Storybook-style stories.
 * Two albums carry photos, two are empty; every photo has a stable label/date
 * so order assertions never depend on the clock or network.
 */
export const ALBUM_ORGANIZER_FIXTURES: AlbumOrganizerData = {
  fetchAlbumPhotos: album => {
    const fixture = FIXTURE_ALBUM_PHOTOS[album]
    return Promise.resolve(fixture.map(photo => ({ ...photo })))
  },
  fetchAlbumCounts: () =>
    Promise.resolve({
      Engagement: FIXTURE_ALBUM_PHOTOS.Engagement.length,
      'Bach+ette': FIXTURE_ALBUM_PHOTOS['Bach+ette'].length,
      'Wedding Day': FIXTURE_ALBUM_PHOTOS['Wedding Day'].length,
      'Guest Uploads': FIXTURE_ALBUM_PHOTOS['Guest Uploads'].length,
    }),
  saveAlbumOrganization: request =>
    Promise.resolve({
      savedAlbum: request.album,
      movedCount: request.moves.length,
      deletedCount: request.deletes.length,
    }),
}

function fixturePhoto(
  id: string,
  album: PhotoAlbum,
  caption: string,
  albumSortOrder: number,
  dayOffset: number
): OrganizerPhoto {
  const createdAt = `2025-05-${String(10 + dayOffset).padStart(2, '0')}T12:00:00.000Z`
  return {
    id,
    album,
    url: `/images/engagement/${id}.webp`,
    thumbnail: `/images/engagement/${id}.webp`,
    caption,
    albumSortOrder,
    createdAt,
    date: createdAt.slice(0, 10),
    location: 'Wedding venue',
    photographer: 'Emma Photography',
    tags: ['wedding'],
    likeCount: albumSortOrder,
    commentCount: albumSortOrder > 1 ? 1 : 0,
    hiddenCommentCount: 0,
  }
}

export const FIXTURE_ALBUM_PHOTOS: Record<PhotoAlbum, readonly OrganizerPhoto[]> = {
  Engagement: [
    fixturePhoto('eng-1', 'Engagement', 'Ring details on the moss', 1, 0),
    fixturePhoto('eng-2', 'Engagement', 'Walking the orchard path', 2, 1),
    fixturePhoto('eng-3', 'Engagement', 'The first look', 3, 2),
  ],
  'Bach+ette': [
    fixturePhoto('bach-1', 'Bach+ette', 'Pittsburgh rooftop toast', 1, 3),
    fixturePhoto('bach-2', 'Bach+ette', 'Bride tribe brunch', 2, 4),
  ],
  'Wedding Day': [
    fixturePhoto('wd-1', 'Wedding Day', 'First look on the lawn', 1, 5),
    fixturePhoto('wd-2', 'Wedding Day', 'Vows before the applause', 2, 6),
    fixturePhoto('wd-3', 'Wedding Day', 'First dance under the lights', 3, 7),
    fixturePhoto('wd-4', 'Wedding Day', 'Dance floor chaos', 4, 8),
  ],
  'Guest Uploads': [],
}

/** Visible for tests that need the canonical album list without importing data layer. */
export { PHOTO_ALBUMS }
