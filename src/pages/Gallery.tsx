import { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { GallerySEO } from '@/components/seo/SEOHead'
import { useDownloadStore } from '@/stores/downloadStore'
import { DownloadQueuePanel } from '@/components/gallery/DownloadQueuePanel'
import { ProgressModal } from '@/components/gallery/ProgressModal'
import { FaceRecognition } from '@/components/face-recognition/FaceRecognition'
import { GalleryUploadLookup } from '@/components/gallery/GalleryUploadLookup'
import { GalleryHeader } from '@/components/gallery/GalleryHeader'
import { GalleryGrid } from '@/components/gallery/GalleryGrid'
import { GallerySelectionActionsBar } from '@/components/gallery/GallerySelectionActionsBar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { useGalleryData } from '@/hooks/useGalleryData'
import { useGalleryEngagement } from '@/hooks/useGalleryEngagement'
import { useGalleryDownloads } from '@/hooks/useGalleryDownloads'
import { useGallerySearchFilters } from '@/hooks/useGallerySearchFilters'
import { useGalleryToolbar } from '@/hooks/useGalleryToolbar'
import { Search, Grid3X3, LayoutGrid, CalendarDays, X, CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchPhotoComments, supabase, Photo } from '@/lib/supabase'
import { useGalleryStore } from '@/stores/galleryStore'
import { useToast } from '@/context/ToastContext'
import {
  COLLECTION_COVERS,
  collectionTabs,
  type CollectionTab,
  type GalleryPhoto,
} from '@/components/gallery/constants'
import { formatPhotoCommentTimestamp, normalizeGalleryPhoto } from '@/components/gallery/data'
import { curatedPhotos } from '@/data/curated-photos'

// Lazy-loaded so it splits into its own chunk — saves ~35 kB gzip on initial Gallery load.
const PhotoLightbox = lazy(() =>
  import('@/components/photo-viewer/PhotoLightbox').then(m => ({ default: m.PhotoLightbox }))
)

const viewOptions = [
  {
    key: 'masonry',
    label: 'Masonry',
    icon: LayoutGrid,
  },
  {
    key: 'grid',
    label: 'Grid',
    icon: Grid3X3,
  },
  {
    key: 'timeline',
    label: 'Timeline',
    icon: CalendarDays,
  },
] as const

export default function Gallery() {
  const { addToast } = useToast()
  const [searchParams] = useSearchParams()
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const { photos, isLoading, loadError, setPhotos } = useGalleryData(
    'Proposal',
    curatedPhotos.map(normalizeGalleryPhoto),
    curatedPhotos.map(normalizeGalleryPhoto)
  )
  const {
    viewMode,
    setViewMode,
    selectMode,
    setSelectMode,
    selectedCollection,
    setSelectedCollection,
    handleCollectionChange,
    collectionSwitchDirectionRef,
    emptyStateTitle,
    emptyStateBody,
  } = useGalleryToolbar()
  const {
    searchQuery,
    faceFilter,
    setSearchQuery,
    setFaceFilter,
    deferredSearchQuery,
    filteredPhotos,
    detectedFaces,
    handleFaceFilter,
    clearFaceFilter,
    clearAllFilters,
    hasActiveFilters,
  } = useGallerySearchFilters({ photos, selectedCollection })
  const queue = useDownloadStore(state => state.queue)
  const addToQueue = useDownloadStore(state => state.addToQueue)
  const removeFromQueue = useDownloadStore(state => state.removeFromQueue)
  const selectedPhotoIds = useMemo(() => new Set(queue.map(p => p.id)), [queue])
  const {
    downloadingId,
    isDownloadingPack,
    handleDownload,
    handleDownloadPack,
    handleShareSelection,
  } = useGalleryDownloads({ photos, selectedPhotoIds })
  const { submittingCommentPhotoId, toggleLike, submitComment } = useGalleryEngagement({
    setPhotos,
  })
  const clearQueue = useDownloadStore(state => state.clearQueue)
  const [sharedPhotoMeta, setSharedPhotoMeta] = useState<{ url: string; caption?: string } | null>(
    null
  )
  const galleryScrollRef = useRef<HTMLDivElement>(null)
  // Fetch shared photo metadata from Supabase when ?shared= param is present
  useEffect(() => {
    const requestedShared = searchParams.get('shared')
    if (!requestedShared) return

    const fetchSharedPhoto = async () => {
      const { data } = await supabase
        .from('photos')
        .select('url, caption')
        .eq('id', requestedShared)
        .single()

      if (data) {
        setSharedPhotoMeta({ url: data.url, caption: data.caption })
      }
    }

    fetchSharedPhoto()
  }, [searchParams])

  useEffect(() => {
    const requestedQuery = searchParams.get('q') || ''
    const requestedCollection = searchParams.get('collection') as CollectionTab | null
    const requestedPhotoId = searchParams.get('photo')
    const requestedPerson = searchParams.get('person')
    const requestedShare = searchParams.get('share')

    setSearchQuery(current => (current !== requestedQuery ? requestedQuery : current))
    setFaceFilter(current => (current !== requestedPerson ? requestedPerson : current))

    if (requestedShare && photos.length > 0) {
      const ids = requestedShare.split(',').filter(Boolean)
      const validPhotos = ids
        .map(id => photos.find(p => p.id === id))
        .filter((p): p is GalleryPhoto => p !== undefined)

      if (validPhotos.length > 0) {
        setSelectMode(true)
        // Use getState() so this effect doesn't need addToQueue as a dep —
        // Zustand actions are stable but ESLint can't verify that.
        const enqueue = useDownloadStore.getState().addToQueue
        for (const photo of validPhotos) {
          enqueue({
            id: photo.id,
            url: photo.url,
            thumbnail: photo.thumbnail || photo.url,
            caption: photo.caption,
            downloadUrl: photo.downloadUrl,
            collection: photo.collection,
          })
        }
      }
    }

    if (requestedCollection && collectionTabs.includes(requestedCollection)) {
      setSelectedCollection(current =>
        current !== requestedCollection ? requestedCollection : current
      )
      return
    }

    if (!requestedCollection && requestedPhotoId) {
      const targetPhoto = photos.find(photo => photo.id === requestedPhotoId)
      if (targetPhoto) {
        setSelectedCollection(current =>
          current !== targetPhoto.collection ? targetPhoto.collection : current
        )
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setters from useGalleryToolbar / useGallerySearchFilters are stable; intentionally re-running on photo set changes only.
  }, [photos, searchParams])

  // Open the lightbox when ?photo= or ?shared= URL params are present.
  useEffect(() => {
    const requestedPhotoId = searchParams.get('photo')
    const sharedParam = searchParams.get('shared')

    if (!isLoading) {
      // Handle ?shared= param
      if (sharedParam && photos.length > 0) {
        const photoIndex = photos.findIndex(photo => photo.id === sharedParam)
        if (photoIndex >= 0 && lightboxIndex !== photoIndex) {
          setLightboxIndex(photoIndex)
          useGalleryStore.getState().openImageModal(photoIndex)
        }
      }
      // Handle ?photo= param — only when lightbox is not yet open so that
      // subsequent filter changes don't jump the already-open lightbox.
      else if (requestedPhotoId && lightboxIndex === null) {
        const photoIndex = filteredPhotos.findIndex(photo => photo.id === requestedPhotoId)
        if (photoIndex >= 0) {
          setLightboxIndex(photoIndex)
        }
      }
    }
  }, [isLoading, lightboxIndex, searchParams, photos, filteredPhotos])

  // Infinite scroll for masonry/grid views
  const {
    displayedItems,
    hasMore,
    isLoading: isLoadingMore,
    loadMore,
    observerRef,
  } = useInfiniteScroll({
    items: filteredPhotos,
    itemsPerPage: viewMode === 'grid' ? 18 : 12,
    rootRef: galleryScrollRef,
  })

  const collectionCounts = useMemo(() => {
    return collectionTabs.reduce<Record<CollectionTab, number>>(
      (acc, tab) => {
        acc[tab] = photos.filter(photo => photo.collection === tab).length
        return acc
      },
      {
        Proposal: 0,
        'Bach+ette': 0,
        'Wedding Photos': 0,
        'Guest Photos': 0,
      }
    )
  }, [photos])

  const openLightbox = (index: number) => {
    if (index >= 0) {
      useGalleryStore.getState().openImageModal(index)
    }
  }
  const handleToggleSelect = (photoId: string) => {
    if (selectedPhotoIds.has(photoId)) {
      removeFromQueue(photoId)
    } else {
      const photo = photos.find(p => p.id === photoId)
      if (photo) {
        addToQueue({
          id: photo.id,
          url: photo.url,
          thumbnail: photo.thumbnail || photo.url,
          caption: photo.caption,
          downloadUrl: photo.downloadUrl,
          collection: photo.collection,
        })
      }
    }
  }

  const handleExitSelectMode = () => {
    setSelectMode(false)
    clearQueue()
  }

  const handleSelectAllVisible = () => {
    let addedCount = 0
    const currentQueueIds = new Set(queue.map(p => p.id))
    const photosToSelect = filteredPhotos

    for (const photo of photosToSelect) {
      if (!currentQueueIds.has(photo.id)) {
        if (queue.length + addedCount >= 50) {
          addToast('Maximum 50 photos can be downloaded as a batch.', 'warning')
          break
        }
        addToQueue({
          id: photo.id,
          url: photo.url,
          thumbnail: photo.thumbnail || photo.url,
          caption: photo.caption,
          downloadUrl: photo.downloadUrl,
          collection: photo.collection,
        })
        addedCount++
      }
    }
  }

  useEffect(() => {
    galleryScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [selectedCollection, deferredSearchQuery, faceFilter, viewMode])

  useEffect(() => {
    if (lightboxIndex === null) {
      return
    }

    const activePhoto = filteredPhotos[lightboxIndex]
    if (!activePhoto || activePhoto.comments) {
      return
    }

    let cancelled = false

    void (async () => {
      const { data } = await fetchPhotoComments(activePhoto.id)
      if (cancelled || !data) {
        return
      }

      const mappedComments = data.map(comment => ({
        id: comment.id,
        author: comment.author,
        content: comment.content,
        timestamp: formatPhotoCommentTimestamp(comment.created_at),
      }))

      setPhotos(prev =>
        prev.map(photo =>
          photo.id === activePhoto.id
            ? {
                ...photo,
                comments: mappedComments,
                commentCount: mappedComments.length,
              }
            : photo
        )
      )
    })()

    return () => {
      cancelled = true
    }
  }, [filteredPhotos, lightboxIndex, setPhotos])

  const shareParam = searchParams.get('share')
  const sharedParam = searchParams.get('shared')
  const shareImageUrl = shareParam
    ? photos.find(p => p.id === shareParam.split(',')[0])?.thumbnail
    : sharedParam
      ? sharedPhotoMeta?.url
      : undefined

  return (
    <div className='min-h-screen bg-cream-50 pt-24 pb-20'>
      <GallerySEO shareImage={shareImageUrl} />

      <section className='px-4 pb-6'>
        <div className='mx-auto max-w-7xl'>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className='space-y-4'
          >
            <GalleryHeader visibleCount={filteredPhotos.length} />

            <div className='mt-8 border-t border-charcoal-900/8 pt-6'>
              <div
                data-testid='gallery-control-bar'
                className='rounded-[1.6rem] border border-white/80 bg-white/78 p-4 shadow-[0_24px_64px_-48px_rgba(46,33,13,0.34)] backdrop-blur-sm sm:p-5'
              >
                <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
                  {collectionTabs.map(tab => {
                    const isActive = selectedCollection === tab
                    const coverUrl = COLLECTION_COVERS[tab]
                    return (
                      <button
                        key={tab}
                        type='button'
                        onClick={() => handleCollectionChange(tab)}
                        aria-pressed={isActive}
                        className={cn(
                          'relative h-40 cursor-pointer overflow-hidden rounded-2xl bg-gold-100 transition-all duration-300',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2',
                          isActive
                            ? 'scale-[1.02] ring-2 ring-gold-400 ring-offset-2 shadow-lg'
                            : 'scale-[0.98] hover:scale-[1.00] hover:shadow-md'
                        )}
                        style={{
                          backgroundImage: `url('${coverUrl}')`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      >
                        <div
                          className={cn(
                            'absolute inset-0 transition-opacity',
                            isActive
                              ? 'bg-gradient-to-t from-black/50 via-black/15 to-transparent'
                              : 'bg-gradient-to-t from-black/65 via-black/25 to-transparent'
                          )}
                        />
                        <div className='absolute bottom-0 left-0 p-3 text-left'>
                          <p className='font-display text-sm leading-tight text-white'>{tab}</p>
                          <p className='mt-0.5 text-xs text-white/70'>
                            {collectionCounts[tab]} photos
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div
                  data-testid='gallery-filter-bar'
                  className='mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center'
                >
                  <div className='relative'>
                    <Search className='pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-400' />
                    <Input
                      type='text'
                      placeholder='Search by caption, location, photographer, or tags'
                      value={searchQuery}
                      onChange={event => setSearchQuery(event.target.value)}
                      className='h-12 rounded-full border-gold-200/70 bg-cream-50/85 pl-11 pr-11 text-charcoal-900 placeholder:text-charcoal-400 shadow-none'
                    />
                    {searchQuery && (
                      <button
                        type='button'
                        onClick={() => setSearchQuery('')}
                        aria-label='Clear gallery search'
                        className='absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-charcoal-400 transition-colors hover:bg-white hover:text-charcoal-600'
                      >
                        <X className='h-4 w-4' />
                      </button>
                    )}
                  </div>

                  <div className='flex items-center gap-2'>
                    <div className='inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-cream-50/90 p-1'>
                      {viewOptions.map(option => {
                        const Icon = option.icon
                        const isActive = viewMode === option.key

                        return (
                          <button
                            key={option.key}
                            type='button'
                            onClick={() => setViewMode(option.key)}
                            aria-pressed={isActive}
                            className={cn(
                              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all',
                              isActive
                                ? 'bg-gold-500 text-white shadow-sm'
                                : 'text-charcoal-500 hover:bg-white hover:text-charcoal-700'
                            )}
                          >
                            <Icon className='h-4 w-4' />
                            {option.label}
                          </button>
                        )
                      })}
                    </div>

                    <button
                      type='button'
                      onClick={() => (selectMode ? handleExitSelectMode() : setSelectMode(true))}
                      aria-pressed={selectMode}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all',
                        selectMode
                          ? 'border-gold-400 bg-gold-500 text-white shadow-sm'
                          : 'border-gold-200/70 bg-cream-50/90 text-charcoal-500 hover:bg-white hover:text-charcoal-700'
                      )}
                    >
                      <CheckSquare className='h-4 w-4' />
                      Select
                    </button>
                  </div>
                </div>

                {selectMode && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className='mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold-200 bg-cream-50/50 p-3'
                  >
                    <div className='flex items-center gap-3'>
                      <span className='text-sm font-medium text-charcoal-700'>
                        {selectedPhotoIds.size} photo{selectedPhotoIds.size !== 1 ? 's' : ''} in
                        queue (max 50)
                      </span>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Button
                        variant='secondary'
                        size='sm'
                        onClick={handleSelectAllVisible}
                        className='h-9 rounded-full px-4 text-xs font-medium'
                      >
                        Select All Visible
                      </Button>
                      {selectedPhotoIds.size > 0 && (
                        <Button
                          variant='secondary'
                          size='sm'
                          onClick={() => clearQueue()}
                          className='h-9 rounded-full px-4 text-xs font-medium border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800'
                        >
                          Clear Selection
                        </Button>
                      )}
                    </div>
                  </motion.div>
                )}

                <div className='mt-3 flex items-center justify-between border-t border-charcoal-900/6 pt-3'>
                  <FaceRecognition onPhotoFilter={handleFaceFilter} detectedFaces={detectedFaces} />
                  <a
                    href='/people'
                    className='text-xs text-charcoal-400 hover:text-gold-600 transition-colors'
                  >
                    People page →
                  </a>
                </div>

                {hasActiveFilters && (
                  <div className='mt-4 flex flex-wrap items-center gap-2 border-t border-charcoal-900/8 pt-4'>
                    <span className='text-[10px] uppercase tracking-[0.28em] text-charcoal-500'>
                      Active filters
                    </span>
                    <span className='inline-flex items-center gap-2 rounded-full bg-cream-50 px-3 py-1.5 text-sm text-charcoal-600'>
                      {selectedCollection}
                    </span>
                    {searchQuery && (
                      <span className='inline-flex items-center gap-2 rounded-full bg-cream-50 px-3 py-1.5 text-sm text-charcoal-600'>
                        {`Search: "${searchQuery}"`}
                      </span>
                    )}
                    {faceFilter && (
                      <button
                        type='button'
                        onClick={clearFaceFilter}
                        className='inline-flex items-center gap-2 rounded-full bg-cream-50 px-3 py-1.5 text-sm text-charcoal-600 transition-colors hover:text-gold-700'
                      >
                        {faceFilter}
                        <X className='h-3.5 w-3.5' />
                      </button>
                    )}
                    <button
                      type='button'
                      onClick={clearAllFilters}
                      className='text-sm text-gold-700 transition-colors hover:text-gold-800 sm:ml-auto'
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Selection action bar */}
      {selectMode && selectedPhotoIds.size > 0 && (
        <GallerySelectionActionsBar
          selectedCount={selectedPhotoIds.size}
          isDownloadingPack={isDownloadingPack}
          onShare={handleShareSelection}
          onDownload={() => void handleDownloadPack()}
        />
      )}

      <section className='flex-1 min-h-0 px-4 pb-8'>
        <div className='mx-auto max-w-7xl'>
          {loadError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className='mb-4 rounded-[1.25rem] border border-amber-200/80 bg-amber-50/90 p-4 text-sm text-amber-700'
            >
              {loadError}
            </motion.div>
          )}

          {/* Upload Status Lookup Section */}
          <GalleryUploadLookup />

          <div className='mb-5'>
            <h2 className='font-display text-3xl text-charcoal-900 sm:text-4xl'>
              {selectedCollection}
            </h2>
          </div>

          <div
            data-testid='gallery-results'
            className='rounded-[2rem] border border-white/80 bg-white/72 p-4 shadow-[0_28px_70px_-48px_rgba(46,33,13,0.38)] backdrop-blur-sm sm:p-6'
          >
            <div
              ref={galleryScrollRef}
              className='overflow-hidden lg:h-[calc(100vh-18rem)] lg:min-h-[32rem] lg:overflow-y-auto lg:pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-gold-100/40 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gold-400/50 hover:[&::-webkit-scrollbar-thumb]:bg-gold-500/70'
            >
              <GalleryGrid
                photos={displayedItems as Photo[]}
                isLoading={isLoading}
                viewMode={viewMode}
                selectedCollection={selectedCollection}
                collectionSwitchDirection={collectionSwitchDirectionRef.current}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                observerRef={observerRef}
                selectMode={selectMode}
                selectedIds={selectedPhotoIds}
                onPhotoClick={(_, index) => openLightbox(index)}
                onLike={toggleLike}
                onToggleSelect={handleToggleSelect}
                onLoadMore={loadMore}
                emptyStateTitle={emptyStateTitle}
                emptyStateBody={emptyStateBody}
                onClearFilters={clearAllFilters}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced Lightbox — lazy-loaded so it splits into its own chunk */}
      <Suspense fallback={null}>
        <PhotoLightbox
          photos={filteredPhotos as Photo[]}
          onLike={toggleLike}
          onDownload={handleDownload}
          isDownloading={downloadingId !== null}
          onAddComment={submitComment}
          isSubmittingComment={submittingCommentPhotoId === filteredPhotos[lightboxIndex ?? 0]?.id}
          highlightedFaceName={faceFilter}
        />
      </Suspense>

      {/* Download queue overlay and progress modal */}
      <DownloadQueuePanel />
      <ProgressModal />
    </div>
  )
}
