/**
 * GalleryGrid — extracted from src/pages/Gallery.tsx.
 *
 * Owns the photo grid + AnimatePresence transition + infinite-scroll trigger
 * + empty state. Parent passes photos + scroll-callback state; this component
 * just renders.
 */
import { type RefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Photo } from '@/lib/supabase'
import { Loader2, Filter } from 'lucide-react'
import { VirtualizedPhotoGrid } from '@/components/gallery/VirtualizedPhotoGrid'
import { GallerySkeleton } from '@/components/ui/Skeleton'
import { Button } from '@/components/ui/Button'

export interface GalleryGridProps {
  photos: Photo[]
  isLoading: boolean
  viewMode: 'masonry' | 'grid' | 'timeline'
  selectedCollection?: string
  collectionSwitchDirection?: number
  hasMore?: boolean
  isLoadingMore?: boolean
  observerRef?: RefObject<HTMLDivElement | null>
  selectMode?: boolean
  selectedIds?: Set<string>
  onPhotoClick?: (photo: Photo, index: number) => void
  onLike?: (photoId: string) => void
  onToggleSelect?: (photoId: string) => void
  onLoadMore?: () => void
  emptyStateTitle?: string
  emptyStateBody?: string
  onClearFilters?: () => void
}

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
          <Filter className='h-7 w-7' />
        </div>
        <p className='mt-6 font-display text-2xl text-charcoal-900'>{emptyStateTitle}</p>
        <p className='mt-2 max-w-md text-charcoal-500'>{emptyStateBody}</p>
        <Button variant='secondary' className='mt-6' onClick={onClearFilters}>
          Return to all collections
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
              <VirtualizedPhotoGrid
                photos={photos}
                onPhotoClick={selectMode ? undefined : onPhotoClick}
                onLike={selectMode ? undefined : onLike}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
              />
            </div>
          ) : (
            <VirtualizedPhotoGrid
              photos={photos}
              onPhotoClick={selectMode ? undefined : onPhotoClick}
              onLike={selectMode ? undefined : onLike}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {hasMore && (
        <div ref={observerRef} className='flex justify-center py-8'>
          {isLoadingMore ? (
            <div className='flex items-center gap-2 rounded-full bg-cream-50 px-4 py-2 text-charcoal-500'>
              <Loader2 className='h-4 w-4 animate-spin text-gold-500' />
              Loading more moments...
            </div>
          ) : (
            <Button variant='secondary' onClick={onLoadMore}>
              Load more
            </Button>
          )}
        </div>
      )}
    </>
  )
}
