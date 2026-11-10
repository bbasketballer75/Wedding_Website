import { useCallback, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { usePageMeta } from '@/app/seo/usePageMeta'
import type { PhotoViewerEngagement } from '@/features/photo-viewer'
import { PAGE_SIZE, type CollectionTab } from './constants'
import {
  parseGallerySearch,
  queuedPhotosForIds,
  useDownloadQueue,
  useGalleryEngagement,
  useGalleryPhotos,
  type GalleryPhotosSource,
  type GalleryPhoto,
  type GuestUploadStatus,
} from './data'
import { GalleryControlPanel } from './GalleryControlPanel'
import { GalleryGrid } from './GalleryGrid'
import { GalleryHeader } from './GalleryHeader'
import { GalleryLightboxSlot } from './GalleryLightboxSlot'
import { mapGalleryPhotoToViewerPhoto } from './mapGalleryPhotoToViewerPhoto'
import { GallerySelectionActionsBar } from './GallerySelectionActionsBar'
import { GalleryUploadLookup } from './GalleryUploadLookup'
import { DownloadQueuePanel } from './DownloadQueuePanel'
import { ProgressModal } from './ProgressModal'
import { useGalleryDownloads, type GalleryToastKind } from './useGalleryDownloads'
import { useGallerySearchFilters } from './useGallerySearchFilters'
import { useGalleryToolbar } from './useGalleryToolbar'
import { useInfiniteScroll } from './useInfiniteScroll'

const SHARE_DESCRIPTION = "Check out these wedding photos from Austin & Jordyn's special day."
const GALLERY_DESCRIPTION =
  'Browse our wedding photos and share your own. A collection of memories from our special day.'

export interface GalleryPageProps {
  /**
   * Route search params. TanStack Router passes `Route.useSearch()` here once the
   * `/gallery` route is wired (`validateGallerySearch` in ./data.ts is the
   * matching `validateSearch`). Defaults to the current `window.location.search`
   * so the page is mountable in isolation.
   */
  search?: Record<string, unknown>
  /** Data source seam: the Lead swaps this for `shared/data` hooks after Wave 3. */
  source?: GalleryPhotosSource
  /** Upload-lookup seam (tests / future data layer). */
  lookupStatus?: (email: string) => Promise<GuestUploadStatus>
  /** Share-link origin (tests); defaults to `window.location.origin`. */
  shareOrigin?: string
}

/**
 * `/gallery` page — parity port of the frozen `src/pages/Gallery.tsx`
 * composition layer (the frozen file was 447 lines; all logic lives in the
 * hooks/components of this feature folder).
 *
 * Wave-5 scope: page shell, collection tabs, search, 3 view modes, selection
 * queue + cap, batch-download strategy/progress, share link, upload-status
 * lookup, curated fallback, infinite paging, query-param handling and the
 * lightbox slot seam (lightbox itself is W5-2).
 */
export function GalleryPage({ search, source, lookupStatus, shareOrigin }: GalleryPageProps) {
  const rawSearch = useMemo(() => {
    if (search) return search
    if (typeof window === 'undefined') return {}
    return Object.fromEntries(new URLSearchParams(window.location.search).entries())
  }, [search])
  const parsed = useMemo(() => parseGallerySearch(rawSearch), [rawSearch])

  const { photos, isLoading, loadError } = useGalleryPhotos(source)
  const initialQueue = useMemo(
    () => queuedPhotosForIds(photos, parsed.shareIds),
    [photos, parsed.shareIds]
  )

  const {
    viewMode,
    setViewMode,
    selectMode,
    setSelectMode,
    selectedCollection,
    handleCollectionChange,
    collectionSwitchDirection,
    emptyStateTitle,
    emptyStateBody,
  } = useGalleryToolbar({
    initialCollection: parsed.collection ?? 'Proposal',
    initialSelectMode: parsed.shareIds.length > 0,
  })

  const { searchQuery, setSearchQuery, filteredPhotos, clearAllFilters, hasActiveFilters } =
    useGallerySearchFilters({
      photos,
      selectedCollection,
      initialQuery: parsed.q,
    })

  const selection = useDownloadQueue(initialQueue)
  const { toggleLike, submitComment } = useGalleryEngagement()

  const [toasts, setToasts] = useState<
    Array<{ id: number; message: string; kind: GalleryToastKind }>
  >([])
  const toastIdRef = useRef(0)
  const pushToast = useCallback((message: string, kind: GalleryToastKind = 'success') => {
    toastIdRef.current += 1
    const id = toastIdRef.current
    setToasts(previous => [...previous.slice(-2), { id, message, kind }])
  }, [])

  const downloads = useGalleryDownloads({
    queue: selection.queue,
    ...(shareOrigin === undefined ? {} : { origin: shareOrigin }),
    addToast: pushToast,
  })

  const [isQueuePanelOpen, setQueuePanelOpen] = useState(false)
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null)
  const openLightbox = useCallback((photoId: string) => setLightboxPhotoId(photoId), [])
  const closeLightbox = useCallback(() => setLightboxPhotoId(null), [])

  const {
    displayedItems,
    hasMore,
    isLoading: isLoadingMore,
    loadMore,
    observerRef,
  } = useInfiniteScroll({
    items: filteredPhotos,
    itemsPerPage: PAGE_SIZE[viewMode],
  })

  const collectionCounts = useMemo(() => {
    const counts: Record<CollectionTab, number> = {
      Proposal: 0,
      'Bach+ette': 0,
      'Wedding Photos': 0,
      'Guest Photos': 0,
    }
    for (const photo of photos) counts[photo.collection] += 1
    return counts
  }, [photos])

  const handleToggleSelectMode = useCallback(() => {
    if (selectMode) {
      setSelectMode(false)
      selection.clear()
      setQueuePanelOpen(false)
    } else {
      setSelectMode(true)
    }
  }, [selectMode, selection, setSelectMode])

  const handleTogglePhotoSelection = useCallback(
    (photoId: string) => {
      const photo = photos.find(candidate => candidate.id === photoId)
      if (photo) selection.toggle(photo)
    },
    [photos, selection]
  )

  const handleSelectAllVisible = useCallback(() => {
    const notYetSelected = filteredPhotos.filter(photo => !selection.selectedIds.has(photo.id))
    const added = selection.selectAll(filteredPhotos)
    if (added < notYetSelected.length) {
      pushToast('Maximum 50 photos can be downloaded as a batch.', 'warning')
    } else if (added > 0) {
      pushToast(`${added} photo${added === 1 ? '' : 's'} added to the download queue.`, 'success')
    }
  }, [filteredPhotos, pushToast, selection])

  const handleDownloadPack = useCallback(async () => {
    const plan = await downloads.handleDownloadPack()
    if (plan && plan.strategy !== 'none') setQueuePanelOpen(false)
  }, [downloads])

  const handleClearQueue = useCallback(() => {
    selection.clear()
    setQueuePanelOpen(false)
  }, [selection])

  const viewerPhotos = useMemo(
    () => filteredPhotos.map(mapGalleryPhotoToViewerPhoto),
    [filteredPhotos]
  )

  const lightboxIndex = useMemo(
    () =>
      lightboxPhotoId === null
        ? -1
        : filteredPhotos.findIndex(photo => photo.id === lightboxPhotoId),
    [filteredPhotos, lightboxPhotoId]
  )

  const lightboxEngagement = useMemo<PhotoViewerEngagement>(
    () => ({
      onToggleLike: photoId => {
        void toggleLike(photoId)
      },
      onSubmitComment: async (photoId, payload) => {
        await submitComment(photoId, payload.content)
        return true
      },
    }),
    [submitComment, toggleLike]
  )

  const requestedPhotoId = useMemo(() => {
    if (parsed.photoId) return parsed.photoId
    if (parsed.sharedId && photos.some(photo => photo.id === parsed.sharedId))
      return parsed.sharedId
    return null
  }, [parsed.photoId, parsed.sharedId, photos])

  usePageMeta({
    title: parsed.shareIds.length > 0 ? 'Shared Wedding Photos' : 'Photo Gallery',
    description: parsed.shareIds.length > 0 ? SHARE_DESCRIPTION : GALLERY_DESCRIPTION,
    canonical: '/gallery',
    ...(parsed.shareIds.length > 0
      ? { image: photos.find(photo => photo.id === parsed.shareIds[0])?.thumbnail }
      : {}),
  })

  return (
    <div className='min-h-screen bg-cream-50 pt-24 pb-20'>
      <section className='px-4 pb-6'>
        <div className='mx-auto max-w-7xl'>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className='space-y-4'
          >
            <GalleryHeader visibleCount={filteredPhotos.length} />

            <GalleryControlPanel
              collectionCounts={collectionCounts}
              selectedCollection={selectedCollection}
              onCollectionChange={handleCollectionChange}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              selectMode={selectMode}
              onToggleSelectMode={handleToggleSelectMode}
              selectedPhotoIdsCount={selection.count}
              onSelectAllVisible={handleSelectAllVisible}
              onClearQueue={handleClearQueue}
              hasActiveFilters={hasActiveFilters}
              onClearAllFilters={clearAllFilters}
            />
          </motion.div>
        </div>
      </section>

      {selectMode && selection.count > 0 && (
        <GallerySelectionActionsBar
          selectedCount={selection.count}
          isDownloadingPack={downloads.isDownloadingPack}
          onShare={downloads.handleShareSelection}
          onDownload={() => void handleDownloadPack()}
        />
      )}

      <section className='flex-1 min-h-0 px-4 pb-8'>
        <div className='mx-auto max-w-7xl'>
          {loadError && (
            <div
              role='alert'
              className='mb-4 rounded-[1.25rem] border border-amber-200/80 bg-amber-50/90 p-4 text-sm text-amber-700'
            >
              {loadError}
            </div>
          )}

          <GalleryUploadLookup {...(lookupStatus === undefined ? {} : { lookupStatus })} />

          <div className='mb-5'>
            <h2 className='font-display text-3xl text-charcoal-900 sm:text-4xl'>
              {selectedCollection}
            </h2>
          </div>

          <div
            data-testid='gallery-results'
            className='rounded-[2rem] border border-white/80 bg-white/72 p-4 shadow-[0_28px_70px_-48px_rgba(46,33,13,0.38)] backdrop-blur-sm sm:p-6'
          >
            <div className='overflow-hidden lg:h-[calc(100vh-18rem)] lg:min-h-[32rem] lg:overflow-y-auto lg:pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-gold-100/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gold-400/50 hover:[&::-webkit-scrollbar-thumb]:bg-gold-500/70'>
              <GalleryGrid
                photos={displayedItems}
                isLoading={isLoading}
                viewMode={viewMode}
                selectedCollection={selectedCollection}
                collectionSwitchDirection={collectionSwitchDirection}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                observerRef={observerRef}
                selectMode={selectMode}
                selectedIds={selection.selectedIds}
                onPhotoClick={(_, index) => {
                  const photo = displayedItems[index]
                  if (photo) openLightbox(photo.id)
                }}
                onLike={photoId => void toggleLike(photoId)}
                onToggleSelect={handleTogglePhotoSelection}
                onLoadMore={loadMore}
                emptyStateTitle={emptyStateTitle}
                emptyStateBody={emptyStateBody}
                onClearFilters={clearAllFilters}
              />
            </div>
          </div>
        </div>
      </section>

      <GalleryLightboxSlot
        requestedPhotoId={requestedPhotoId}
        onOpen={openLightbox}
        photos={viewerPhotos}
        isOpen={lightboxIndex >= 0}
        initialIndex={lightboxIndex < 0 ? 0 : lightboxIndex}
        onClose={closeLightbox}
        engagement={lightboxEngagement}
      />
      {lightboxPhotoId && (
        <span data-testid='gallery-lightbox-request' className='sr-only'>
          {lightboxPhotoId}
        </span>
      )}

      <DownloadQueuePanel
        queue={selection.queue}
        isPanelOpen={isQueuePanelOpen}
        isDownloading={downloads.isDownloadingPack}
        onTogglePanel={() => setQueuePanelOpen(true)}
        onClosePanel={() => setQueuePanelOpen(false)}
        onRemove={selection.remove}
        onClearQueue={handleClearQueue}
        onDownloadAll={() => void handleDownloadPack()}
      />
      <ProgressModal
        isOpen={downloads.isDownloadingPack}
        progress={downloads.progress}
        status={downloads.progressStatus}
      />

      <div role='status' aria-live='polite' className='sr-only'>
        {toasts.map(toast => (
          <p key={toast.id}>{toast.message}</p>
        ))}
      </div>
    </div>
  )
}

export default GalleryPage

// Re-export the selection type surface so callers (router/Lead wiring) have a
// single import site for the page contract.
export type { GalleryPhoto, GalleryPhotosSource, GuestUploadStatus }
