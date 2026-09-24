import type { AlbumOrganizerPhoto, PhotoAlbum } from '@/lib/supabase'
import { PHOTO_ALBUMS } from '@/lib/supabase'
import { getMediaPath } from '@/utils/media'

export type OrganizerPhoto = AlbumOrganizerPhoto & {
  resolvedThumbnail: string
  resolvedUrl: string
  displayLabel: string
  likeCount: number
  commentCount: number
  hiddenCommentCount: number
}

export type PendingAlbumMove = {
  photo: OrganizerPhoto
  targetAlbum: PhotoAlbum
}

export type PendingAlbumDeletion = {
  photo: OrganizerPhoto
}

export const EMPTY_ORGANIZER_PHOTOS: OrganizerPhoto[] = []
export const EMPTY_PENDING_MOVES: PendingAlbumMove[] = []
export const EMPTY_PENDING_DELETIONS: PendingAlbumDeletion[] = []
export const EMPTY_SELECTED_IDS: string[] = []

export const moveSelectOptions = (currentAlbum: PhotoAlbum) =>
  PHOTO_ALBUMS.filter(album => album !== currentAlbum)

export function getPhotoLabel(photo: AlbumOrganizerPhoto) {
  const pathCandidate = photo.url || photo.thumbnail
  const fileName = pathCandidate.split('/').pop() || photo.id
  return photo.caption?.trim() || fileName
}

export function normalizeOrganizerPhoto(photo: AlbumOrganizerPhoto): OrganizerPhoto {
  return {
    ...photo,
    resolvedThumbnail: getMediaPath(photo.thumbnail || photo.url),
    resolvedUrl: getMediaPath(photo.url),
    displayLabel: getPhotoLabel(photo),
    likeCount: 0,
    commentCount: 0,
    hiddenCommentCount: 0,
  }
}

export function hydratePhotoEngagement(
  photos: OrganizerPhoto[],
  summaryRows: Array<{
    photo_key: string
    likes_count: number
    comments_count: number
    hidden_comments_count: number
  }> = []
) {
  const summaryByKey = new Map(summaryRows.map(row => [row.photo_key, row] as const))

  return photos.map(photo => {
    const summary = summaryByKey.get(photo.id)
    return summary
      ? {
          ...photo,
          likeCount: summary.likes_count,
          commentCount: summary.comments_count,
          hiddenCommentCount: summary.hidden_comments_count,
        }
      : photo
  })
}

export function photosHaveSameOrder(left: OrganizerPhoto[], right: OrganizerPhoto[]) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((photo, index) => right[index]?.id === photo.id)
}

export function countReorderedPositions(left: OrganizerPhoto[], right: OrganizerPhoto[]) {
  const longestLength = Math.max(left.length, right.length)
  let mismatches = 0

  for (let index = 0; index < longestLength; index += 1) {
    if (left[index]?.id !== right[index]?.id) {
      mismatches += 1
    }
  }

  return mismatches
}
