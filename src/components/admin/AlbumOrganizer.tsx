import { useEffect, useMemo, useState } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  fetchAlbumPhotos,
  fetchPhotoAlbumCounts,
  saveAlbumOrganization,
  type AlbumOrganizerMoveInput,
  type AlbumOrganizerPhoto,
  type PhotoAlbum,
  PHOTO_ALBUMS,
} from '@/lib/supabase'
import { useToast } from '@/context/ToastContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { getMediaPath } from '@/utils/media'
import { GripVertical, Images, Loader2, RotateCcw, Save, Search, ArrowRightLeft } from 'lucide-react'

type OrganizerPhoto = AlbumOrganizerPhoto & {
  resolvedThumbnail: string
  resolvedUrl: string
  displayLabel: string
}

type PendingAlbumMove = {
  photo: OrganizerPhoto
  targetAlbum: PhotoAlbum
}

const EMPTY_ORGANIZER_PHOTOS: OrganizerPhoto[] = []
const EMPTY_PENDING_MOVES: PendingAlbumMove[] = []

const moveSelectOptions = (currentAlbum: PhotoAlbum) => PHOTO_ALBUMS.filter((album) => album !== currentAlbum)

function getPhotoLabel(photo: AlbumOrganizerPhoto) {
  const pathCandidate = photo.url || photo.thumbnail
  const fileName = pathCandidate.split('/').pop() || photo.id
  return photo.caption?.trim() || fileName
}

function normalizeOrganizerPhoto(photo: AlbumOrganizerPhoto): OrganizerPhoto {
  return {
    ...photo,
    resolvedThumbnail: getMediaPath(photo.thumbnail || photo.url),
    resolvedUrl: getMediaPath(photo.url),
    displayLabel: getPhotoLabel(photo),
  }
}

function photosHaveSameOrder(left: OrganizerPhoto[], right: OrganizerPhoto[]) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((photo, index) => right[index]?.id === photo.id)
}

function SortablePhotoCard({
  album,
  photo,
  canDrag,
  onMove,
}: {
  album: PhotoAlbum
  photo: OrganizerPhoto
  canDrag: boolean
  onMove: (photoId: string, targetAlbum: PhotoAlbum) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id,
    disabled: !canDrag,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={cn(
        'group overflow-hidden rounded-[1.25rem] border border-gold-100 bg-white shadow-sm transition-shadow',
        isDragging && 'shadow-[0_24px_54px_-26px_rgba(46,33,13,0.34)] ring-2 ring-gold-300/60'
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-charcoal-100">
        <img
          src={photo.resolvedThumbnail || photo.resolvedUrl}
          alt={photo.displayLabel}
          loading="lazy"
          className="h-full w-full object-cover"
        />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
          <button
            type="button"
            aria-label={canDrag ? `Drag ${photo.displayLabel}` : 'Clear search to drag reorder'}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-sm transition-colors',
              canDrag
                ? 'border-white/40 bg-black/28 text-white hover:bg-black/40'
                : 'cursor-not-allowed border-white/20 bg-black/15 text-white/45'
            )}
            {...attributes}
            {...listeners}
            disabled={!canDrag}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <select
            aria-label={`Move ${photo.displayLabel} to another album`}
            value=""
            onChange={(event) => {
              const nextAlbum = event.target.value as PhotoAlbum
              if (nextAlbum) {
                onMove(photo.id, nextAlbum)
              }
            }}
            className="h-8 rounded-full border border-white/45 bg-black/30 px-3 text-[11px] text-white outline-none backdrop-blur-sm transition-colors hover:bg-black/40"
          >
            <option value="">Move</option>
            {moveSelectOptions(album).map((targetAlbum) => (
              <option key={targetAlbum} value={targetAlbum} className="text-charcoal-900">
                {targetAlbum}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1 px-3 py-3">
        <p className="line-clamp-2 text-sm font-medium text-charcoal-800">{photo.displayLabel}</p>
        <p className="text-xs text-charcoal-500">
          {new Date(photo.created_at).toLocaleDateString()} · order {photo.album_sort_order}
        </p>
      </div>
    </article>
  )
}

export function AlbumOrganizer() {
  const { addToast } = useToast()
  const [selectedAlbum, setSelectedAlbum] = useState<PhotoAlbum>('Engagement')
  const [savedByAlbum, setSavedByAlbum] = useState<Partial<Record<PhotoAlbum, OrganizerPhoto[]>>>({})
  const [draftByAlbum, setDraftByAlbum] = useState<Partial<Record<PhotoAlbum, OrganizerPhoto[]>>>({})
  const [pendingMovesByAlbum, setPendingMovesByAlbum] = useState<Partial<Record<PhotoAlbum, PendingAlbumMove[]>>>({})
  const [countsByAlbum, setCountsByAlbum] = useState<Record<PhotoAlbum, number>>({
    Engagement: 0,
    'Bach+ette': 0,
    'Wedding Day': 0,
    'Guest Uploads': 0,
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingAlbum, setLoadingAlbum] = useState<PhotoAlbum | null>(null)
  const [savingAlbum, setSavingAlbum] = useState<PhotoAlbum | null>(null)
  const [lastSavedSummary, setLastSavedSummary] = useState<string>('No organizer changes saved yet.')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const refreshCounts = async () => {
    const nextCounts = await fetchPhotoAlbumCounts()
    setCountsByAlbum(nextCounts)
  }

  const loadAlbum = async (album: PhotoAlbum, force = false) => {
    if (!force && savedByAlbum[album]) {
      return
    }

    setLoadingAlbum(album)
    const { data, error } = await fetchAlbumPhotos(album)

    if (error) {
      addToast(`Could not load the ${album} album.`, 'error')
      setLoadingAlbum(null)
      return
    }

    const normalizedPhotos = (data || []).map(normalizeOrganizerPhoto)

    setSavedByAlbum((prev) => ({
      ...prev,
      [album]: normalizedPhotos,
    }))
    setDraftByAlbum((prev) => ({
      ...prev,
      [album]: normalizedPhotos,
    }))
    setPendingMovesByAlbum((prev) => ({
      ...prev,
      [album]: [],
    }))
    setLoadingAlbum(null)
  }

  useEffect(() => {
    void refreshCounts()
    void loadAlbum(selectedAlbum)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void loadAlbum(selectedAlbum)
    setSearchQuery('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAlbum])

  const currentSaved = savedByAlbum[selectedAlbum] ?? EMPTY_ORGANIZER_PHOTOS
  const currentDraft = draftByAlbum[selectedAlbum] ?? EMPTY_ORGANIZER_PHOTOS
  const pendingMoves = pendingMovesByAlbum[selectedAlbum] ?? EMPTY_PENDING_MOVES
  const hasUnsavedChanges = pendingMoves.length > 0 || !photosHaveSameOrder(currentSaved, currentDraft)
  const canDrag = searchQuery.trim().length === 0

  const filteredDraft = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    if (!normalizedQuery) {
      return currentDraft
    }

    return currentDraft.filter((photo) => {
      const haystack = [
        photo.displayLabel,
        photo.location,
        photo.photographer,
        ...(photo.tags || []),
        photo.url,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [currentDraft, searchQuery])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !canDrag) {
      return
    }

    const oldIndex = currentDraft.findIndex((photo) => photo.id === active.id)
    const newIndex = currentDraft.findIndex((photo) => photo.id === over.id)

    if (oldIndex < 0 || newIndex < 0) {
      return
    }

    setDraftByAlbum((prev) => ({
      ...prev,
      [selectedAlbum]: arrayMove(currentDraft, oldIndex, newIndex),
    }))
  }

  const handleMovePhoto = (photoId: string, targetAlbum: PhotoAlbum) => {
    const photoToMove = currentDraft.find((photo) => photo.id === photoId)
    if (!photoToMove) {
      return
    }

    setDraftByAlbum((prev) => ({
      ...prev,
      [selectedAlbum]: currentDraft.filter((photo) => photo.id !== photoId),
    }))
    setPendingMovesByAlbum((prev) => ({
      ...prev,
      [selectedAlbum]: [...(prev[selectedAlbum] || []), { photo: photoToMove, targetAlbum }],
    }))
  }

  const handleUndoMove = (photoId: string) => {
    const moveToUndo = pendingMoves.find((move) => move.photo.id === photoId)
    if (!moveToUndo) {
      return
    }

    setPendingMovesByAlbum((prev) => ({
      ...prev,
      [selectedAlbum]: (prev[selectedAlbum] || []).filter((move) => move.photo.id !== photoId),
    }))
    setDraftByAlbum((prev) => ({
      ...prev,
      [selectedAlbum]: [...(prev[selectedAlbum] || []), moveToUndo.photo],
    }))
  }

  const handleReset = () => {
    setDraftByAlbum((prev) => ({
      ...prev,
      [selectedAlbum]: currentSaved,
    }))
    setPendingMovesByAlbum((prev) => ({
      ...prev,
      [selectedAlbum]: [],
    }))
  }

  const handleSave = async () => {
    if (!hasUnsavedChanges) {
      return
    }

    setSavingAlbum(selectedAlbum)
    const movesPayload: AlbumOrganizerMoveInput[] = pendingMoves.map((move) => ({
      photoId: move.photo.id,
      targetAlbum: move.targetAlbum,
    }))

    const { data, error } = await saveAlbumOrganization(
      selectedAlbum,
      currentDraft.map((photo) => photo.id),
      movesPayload,
    )

    if (error) {
      addToast(`Could not save the ${selectedAlbum} arrangement.`, 'error')
      setSavingAlbum(null)
      return
    }

    const nowLabel = new Date().toLocaleString()
    setLastSavedSummary(`Saved ${selectedAlbum} on ${nowLabel}.`)

    const touchedTargets = Array.from(new Set(movesPayload.map((move) => move.targetAlbum)))

    setSavedByAlbum((prev) => {
      const next = { ...prev }
      next[selectedAlbum] = currentDraft.map((photo, index) => ({
        ...photo,
        album: selectedAlbum,
        album_sort_order: index + 1,
      }))

      for (const move of pendingMoves) {
        if (!next[move.targetAlbum]) {
          continue
        }

        next[move.targetAlbum] = [
          ...(next[move.targetAlbum] || []),
          {
            ...move.photo,
            album: move.targetAlbum,
            category: move.targetAlbum,
            album_sort_order: (next[move.targetAlbum] || []).length + 1,
          },
        ]
      }

      return next
    })

    setDraftByAlbum((prev) => {
      const next = { ...prev }
      next[selectedAlbum] = currentDraft.map((photo, index) => ({
        ...photo,
        album: selectedAlbum,
        album_sort_order: index + 1,
      }))

      for (const move of pendingMoves) {
        if (!next[move.targetAlbum]) {
          continue
        }

        next[move.targetAlbum] = [
          ...(next[move.targetAlbum] || []),
          {
            ...move.photo,
            album: move.targetAlbum,
            category: move.targetAlbum,
            album_sort_order: (next[move.targetAlbum] || []).length + 1,
          },
        ]
      }

      return next
    })

    setPendingMovesByAlbum((prev) => ({
      ...prev,
      [selectedAlbum]: [],
    }))

    if (touchedTargets.length > 0) {
      await Promise.all(touchedTargets.map((album) => loadAlbum(album, true)))
    }

    await loadAlbum(selectedAlbum, true)
    await refreshCounts()

    addToast(
      data
        ? `Saved ${selectedAlbum}. ${data.moved_count} photo${data.moved_count === 1 ? '' : 's'} moved.`
        : `Saved ${selectedAlbum}.`,
      'success'
    )
    setSavingAlbum(null)
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[1.35rem] border border-gold-100 bg-white/95 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-charcoal-500">Album organizer</p>
            <h2 className="mt-2 font-display text-2xl text-charcoal-900">Arrange the live gallery albums.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-charcoal-500">
              Drag photos into the sequence you want, move misfiled images between albums, then save the live order.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-gold-100 bg-cream-50 px-3 py-1.5 text-xs text-charcoal-600">
              {lastSavedSummary}
            </span>
            <Button variant="secondary" size="sm" onClick={handleReset} disabled={!hasUnsavedChanges || savingAlbum === selectedAlbum}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!hasUnsavedChanges || savingAlbum === selectedAlbum}>
              {savingAlbum === selectedAlbum ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save live order
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-[1.35rem] border border-gold-100 bg-white/95 p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {PHOTO_ALBUMS.map((album) => (
            <button
              key={album}
              type="button"
              onClick={() => setSelectedAlbum(album)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all',
                selectedAlbum === album
                  ? 'cinematic-toggle-active'
                  : 'bg-cream-50 text-charcoal-600 hover:bg-gold-50/70 hover:text-charcoal-800'
              )}
            >
              <span>{album}</span>
              <span className={cn('text-xs', selectedAlbum === album ? 'text-charcoal-700/80' : 'text-charcoal-400')}>
                {countsByAlbum[album] ?? 0}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-400" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={`Find a photo in ${selectedAlbum}`}
              className="h-12 rounded-full border-gold-200/70 bg-cream-50/85 pl-11 shadow-none"
            />
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-cream-50 px-4 py-2 text-sm text-charcoal-600">
            <Images className="h-4 w-4 text-gold-500" />
            {currentDraft.length} photos
          </div>

          {!canDrag && (
            <div className="justify-self-start rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700 xl:justify-self-end">
              Clear search to drag reorder.
            </div>
          )}
        </div>

        {pendingMoves.length > 0 && (
          <div className="mt-4 rounded-[1.15rem] border border-gold-100 bg-cream-50/80 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-charcoal-800">
              <ArrowRightLeft className="h-4 w-4 text-gold-600" />
              {pendingMoves.length} photo{pendingMoves.length === 1 ? '' : 's'} will move when you save
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {pendingMoves.map((move) => (
                <button
                  key={move.photo.id}
                  type="button"
                  onClick={() => handleUndoMove(move.photo.id)}
                  className="inline-flex items-center gap-2 rounded-full border border-gold-200 bg-white px-3 py-1.5 text-xs text-charcoal-600 transition-colors hover:border-gold-300 hover:bg-gold-50"
                >
                  <span className="max-w-[14rem] truncate">{move.photo.displayLabel}</span>
                  <span className="text-charcoal-400">→ {move.targetAlbum}</span>
                  <span className="text-gold-700">Undo</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[1.45rem] border border-gold-100 bg-white/95 p-4 shadow-sm">
        {loadingAlbum === selectedAlbum && !savedByAlbum[selectedAlbum] ? (
          <div className="flex min-h-[22rem] flex-col items-center justify-center text-center">
            <Loader2 className="h-8 w-8 animate-spin text-gold-500" />
            <p className="mt-4 text-charcoal-600">Loading the {selectedAlbum} album…</p>
          </div>
        ) : filteredDraft.length === 0 ? (
          <div className="flex min-h-[22rem] flex-col items-center justify-center text-center">
            <Images className="h-8 w-8 text-gold-500" />
            <p className="mt-4 font-medium text-charcoal-800">
              {searchQuery.trim() ? 'No photos match that search.' : `No photos in ${selectedAlbum} yet.`}
            </p>
          </div>
        ) : (
          <div className="h-[72vh] min-h-[32rem] overflow-y-auto pr-1">
            {canDrag ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={currentDraft.map((photo) => photo.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {currentDraft.map((photo) => (
                      <SortablePhotoCard
                        key={photo.id}
                        album={selectedAlbum}
                        photo={photo}
                        canDrag={canDrag}
                        onMove={handleMovePhoto}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {filteredDraft.map((photo) => (
                  <SortablePhotoCard
                    key={photo.id}
                    album={selectedAlbum}
                    photo={photo}
                    canDrag={false}
                    onMove={handleMovePhoto}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
