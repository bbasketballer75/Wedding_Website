import { type RefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Filter, Loader2 } from 'lucide-react'
import { Button, Skeleton } from '@/shared/ui'
import type { GalleryPhoto } from './data'
import type { ViewMode } from './constants'
import { GALLERY_COPY } from './constants'
import { PhotoGrid } from './PhotoGrid'

export interface GalleryGridProps {
  photos: GalleryPhoto[]
  isLoading: boolean
  viewMode: ViewMode
  selectedCollection?: string
  collectionSwitchDirection?: number
  hasMore?: boolean
  isLoadingMore?: boolean
  observerRef?: RefObject<HTMLDivElement | null>
  selectMode?: boolean
  selectedIds?: ReadonlySet<string>
  onPhotoClick?: (photo: GalleryPhoto, index: number) => void
  onLike?: (photoId: string) => void
  onToggleSelect?: (photoId: string) => void
  onLoadMore?: () => void
  emptyStateTitle?: string
  emptyStateBody?: string
  onClearFilters?: () => void
}

/** Frozen `GallerySkeleton`/`PhotoSkeleton` shape, rebuilt on the ported `Skeleton`. */
function GallerySkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className='grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4'>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className='space-y-2'>
          <Skeleton className='h-48 w-full rounded-xl' />
          <div className='flex gap-2'>
            <Skeleton className='h-3 w-20' />
            <Skeleton className='h-3 w-12' />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Frozen `src/components/gallery/GalleryGrid.tsx` port: skeleton, empty state,
 * collection/view transition, the photo grid and the infinite-scroll trigger.
 */
export function GalleryGrid({
  photos,
  isLoading,
  viewMode,
  selectedCollection = '',
  collectionSwitchDirection = 0,
  hasMore = false,
  isLoadingMore = false,
  observerRef,
  selectMode,
  selectedIds,
  onPhotoClick,
  onLike,
  onToggleSelect,
  onLoadMore,
  emptyStateTitle,
  emptyStateBody,
  onClearFilters,
}: GalleryGridProps) {
  if (isLoading) {
    return <GallerySkeleton count={12} />
  }

  if (photos.length === 0) {
    return (
      <div className='flex min-h-[20rem] flex-col items-center justify-center text-center'>
        <div className='flex h-16 w-16 items-center justify-center rounded-full bg-gold-100 text-gold-600'>
          <Filter className='h-7 w-7' aria-hidden='true' />
        </div>
        <p className='mt-6 font-display text-2xl text-charcoal-900'>{emptyStateTitle}</p>
        <p className='mt-2 max-w-md text-charcoal-500'>{emptyStateBody}</p>
        <Button variant='secondary' className='mt-6' onClick={onClearFilters}>
          {GALLERY_COPY.emptyActionLabel}
        </Button>
      </div>
    )
  }

  return (
    <>
      <AnimatePresence mode='wait' custom={collectionSwitchDirection}>
        <motion.div
          key={`${selectedCollection}-${viewMode}`}
          custom={collectionSwitchDirection}
          variants={{
            initial: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 30 : -30 }),
            animate: { opacity: 1, x: 0 },
            exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? -30 : 30 }),
          }}
          initial='initial'
          animate='animate'
          exit='exit'
          transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {viewMode === 'timeline' ? (
            <div>
              <h2 className='mb-4 font-display text-2xl text-charcoal-900'>Timeline view</h2>
              <PhotoGrid
                photos={photos}
                viewMode='timeline'
                selectMode={selectMode}
                selectedIds={selectedIds}
                onPhotoClick={selectMode ? undefined : onPhotoClick}
                onLike={selectMode ? undefined : onLike}
                onToggleSelect={onToggleSelect}
              />
            </div>
          ) : (
            <PhotoGrid
              photos={photos}
              viewMode={viewMode}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onPhotoClick={selectMode ? undefined : onPhotoClick}
              onLike={selectMode ? undefined : onLike}
              onToggleSelect={onToggleSelect}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {hasMore && (
        <div ref={observerRef} className='flex justify-center py-8'>
          {isLoadingMore ? (
            <div className='flex items-center gap-2 rounded-full bg-cream-50 px-4 py-2 text-charcoal-500'>
              <Loader2 className='h-4 w-4 animate-spin text-gold-500' aria-hidden='true' />
              Loading more moments...
            </div>
          ) : (
            <Button variant='secondary' onClick={onLoadMore}>
              {GALLERY_COPY.loadMoreLabel}
            </Button>
          )}
        </div>
      )}
    </>
  )
}
