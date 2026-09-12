import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GalleryGrid } from './GalleryGrid'

// Mock VirtualizedPhotoGrid since it depends on heavy deps
vi.mock('@/components/gallery/VirtualizedPhotoGrid', () => ({
  VirtualizedPhotoGrid: ({ photos, selectMode }: { photos: unknown[]; selectMode?: boolean }) => (
    <div data-testid='grid' data-select-mode={selectMode ? 'true' : 'false'}>
      photos={photos.length}
    </div>
  ),
}))

vi.mock('@/context/ToastContext', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

import type { Photo } from '@/lib/supabase'

const emptyPhotos: Photo[] = []
const somePhotos = [
  { id: 'p1', url: '', thumbnail: '' } as Photo,
  { id: 'p2', url: '', thumbnail: '' } as Photo,
]

describe('GalleryGrid', () => {
  it('renders the skeleton while loading', () => {
    render(
      <GalleryGrid photos={emptyPhotos} isLoading viewMode='masonry' onPhotoClick={() => {}} />
    )
    // GallerySkeleton uses animate-pulse class
    expect(screen.getAllByText('', { selector: '.animate-pulse' }).length).toBeGreaterThan(0)
  })

  it('renders the grid when not loading', () => {
    render(
      <GalleryGrid
        photos={somePhotos}
        isLoading={false}
        viewMode='masonry'
        onPhotoClick={() => {}}
      />
    )
    expect(screen.getByTestId('grid')).toBeInTheDocument()
    expect(screen.getByTestId('grid').textContent).toContain('photos=2')
  })

  it('forwards selectMode to the grid', () => {
    render(
      <GalleryGrid
        photos={somePhotos}
        isLoading={false}
        viewMode='masonry'
        selectMode
        selectedIds={new Set(['p1'])}
        onPhotoClick={() => {}}
        onToggleSelect={() => {}}
      />
    )
    expect(screen.getByTestId('grid').getAttribute('data-select-mode')).toBe('true')
  })

  it('renders empty state when photos array is empty and not loading', () => {
    render(
      <GalleryGrid
        photos={emptyPhotos}
        isLoading={false}
        viewMode='masonry'
        emptyStateTitle='Nothing here yet'
        emptyStateBody='Try a different collection'
        onPhotoClick={() => {}}
        onClearFilters={() => {}}
      />
    )
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument()
  })
})
