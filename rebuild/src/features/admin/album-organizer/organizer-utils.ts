/**
 * Pure album-organizer logic, ported from the frozen
 * `src/components/admin/organizerUtils.ts` + the reorder branches of
 * `useAlbumOrganizer.ts`.
 *
 * Everything here is data-in/data-out so the keyboard, pointer and bulk paths
 * share one implementation and can be unit-tested without React.
 */
import { PHOTO_ALBUMS, type PhotoAlbum } from '@/shared/data/photos'
import type { OrganizerPhoto, StagedAlbumDeletion, StagedAlbumMove } from './album-organizer-data'

/** Frozen `moveSelectOptions`: every album except the origin. */
export function moveSelectOptions(currentAlbum: PhotoAlbum): PhotoAlbum[] {
  return PHOTO_ALBUMS.filter(album => album !== currentAlbum)
}

/** Frozen `photosHaveSameOrder`. */
export function photosHaveSameOrder(
  left: readonly OrganizerPhoto[],
  right: readonly OrganizerPhoto[]
): boolean {
  if (left.length !== right.length) return false
  return left.every((photo, index) => right[index]?.id === photo.id)
}

/** Frozen `countReorderedPositions`: how many rows sit at a different index. */
export function countReorderedPositions(
  left: readonly OrganizerPhoto[],
  right: readonly OrganizerPhoto[]
): number {
  const longestLength = Math.max(left.length, right.length)
  let mismatches = 0

  for (let index = 0; index < longestLength; index += 1) {
    if (left[index]?.id !== right[index]?.id) mismatches += 1
  }

  return mismatches
}

/** Move one photo from its current index to another (pointer/keyboard reorder). */
export function reorderPhotos(
  photos: readonly OrganizerPhoto[],
  activeId: string,
  overId: string
): OrganizerPhoto[] {
  const fromIndex = photos.findIndex(photo => photo.id === activeId)
  const toIndex = photos.findIndex(photo => photo.id === overId)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return [...photos]

  const next = [...photos]
  const [moved] = next.splice(fromIndex, 1)
  if (!moved) return [...photos]
  next.splice(toIndex, 0, moved)
  return next
}

/** Keyboard path: move one photo one position earlier/later. */
export function movePhotoByOffset(
  photos: readonly OrganizerPhoto[],
  photoId: string,
  offset: -1 | 1
): OrganizerPhoto[] {
  const index = photos.findIndex(photo => photo.id === photoId)
  if (index < 0) return [...photos]
  const targetIndex = index + offset
  if (targetIndex < 0 || targetIndex >= photos.length) return [...photos]
  const overId = photos[targetIndex]?.id
  if (!overId) return [...photos]
  return reorderPhotos(photos, photoId, overId)
}

/** Frozen `handleMoveSelectedToBoundary`: selected group to top or bottom. */
export function moveSelectedToBoundary(
  photos: readonly OrganizerPhoto[],
  selectedIds: ReadonlySet<string>,
  placement: 'top' | 'bottom'
): OrganizerPhoto[] {
  if (selectedIds.size === 0) return [...photos]
  const selected = photos.filter(photo => selectedIds.has(photo.id))
  const remaining = photos.filter(photo => !selectedIds.has(photo.id))
  return placement === 'top' ? [...selected, ...remaining] : [...remaining, ...selected]
}

/** Frozen `handleMoveSelectedAfter`: selected group after a specific anchor. */
export function moveSelectedAfter(
  photos: readonly OrganizerPhoto[],
  selectedIds: ReadonlySet<string>,
  anchorPhotoId: string
): OrganizerPhoto[] {
  if (selectedIds.size === 0 || !anchorPhotoId) return [...photos]
  const selected = photos.filter(photo => selectedIds.has(photo.id))
  const remaining = photos.filter(photo => !selectedIds.has(photo.id))
  const anchorIndex = remaining.findIndex(photo => photo.id === anchorPhotoId)
  if (anchorIndex < 0) return [...photos]

  return [...remaining.slice(0, anchorIndex + 1), ...selected, ...remaining.slice(anchorIndex + 1)]
}

/** Frozen search predicate (`filteredDraft`): label/location/photographer/tags/url. */
export function filterOrganizerPhotos(
  photos: readonly OrganizerPhoto[],
  query: string
): readonly OrganizerPhoto[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return photos

  return photos.filter(photo => {
    const haystack = [
      photo.caption ?? '',
      photo.location ?? '',
      photo.photographer ?? '',
      ...(photo.tags ?? []),
      photo.url,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(normalizedQuery)
  })
}

export interface DirtyDiffInput {
  album: PhotoAlbum
  saved: readonly OrganizerPhoto[]
  draft: readonly OrganizerPhoto[]
  pendingMoves: readonly StagedAlbumMove[]
  pendingDeletes: readonly StagedAlbumDeletion[]
}

/** Frozen `hasUnsavedChanges`: dirty moves, dirty deletes or a reordered draft. */
export function hasDirtyChanges(input: DirtyDiffInput): boolean {
  return (
    input.pendingMoves.length > 0 ||
    input.pendingDeletes.length > 0 ||
    !photosHaveSameOrder(input.saved, input.draft)
  )
}

/**
 * Build the exact injected-save payload. Dirty-diff only: the draft order plus
 * staged moves/deletes — untouched albums and photos never appear.
 */
export function buildSaveRequest(input: DirtyDiffInput) {
  return {
    album: input.album,
    order: input.draft.map(photo => photo.id),
    moves: input.pendingMoves.map(move => ({
      photoId: move.photo.id,
      targetAlbum: move.targetAlbum,
    })),
    deletes: input.pendingDeletes.map(deletion => deletion.photo.id),
  }
}

/** Slug used for `person_key` consistency in people review (frozen helper). */
export function slugifyPerson(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
