import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GalleryLightboxSlot, type GalleryLightboxSlotProps } from './GalleryLightboxSlot'
import { mapGalleryPhotoToViewerPhoto } from './mapGalleryPhotoToViewerPhoto'
import type { GalleryPhoto } from './data'
import type { ViewerPhoto } from '@/features/photo-viewer'

const VIEWER_PHOTOS: ViewerPhoto[] = [
  { id: 'curated-1', url: '/images/engagement/one.webp', caption: 'First look' },
  { id: 'curated-2', url: '/images/engagement/two.webp', caption: 'Ceremony' },
]

function renderSlot(overrides: Partial<GalleryLightboxSlotProps> = {}) {
  return render(
    <GalleryLightboxSlot
      requestedPhotoId={null}
      onOpen={vi.fn()}
      photos={VIEWER_PHOTOS}
      {...overrides}
    />
  )
}

describe('GalleryLightboxSlot', () => {
  it('renders the real viewer only when open (closed = no DOM change)', () => {
    const { container } = renderSlot()
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('bridges a requested photo id to the onOpen callback once', () => {
    const onOpen = vi.fn()
    const { rerender } = renderSlot({ requestedPhotoId: 'curated-1', onOpen })
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledWith('curated-1')

    rerender(
      <GalleryLightboxSlot requestedPhotoId='curated-1' onOpen={onOpen} photos={VIEWER_PHOTOS} />
    )
    expect(onOpen).toHaveBeenCalledTimes(1)

    rerender(
      <GalleryLightboxSlot requestedPhotoId='curated-2' onOpen={onOpen} photos={VIEWER_PHOTOS} />
    )
    expect(onOpen).toHaveBeenCalledTimes(2)
    expect(onOpen).toHaveBeenLastCalledWith('curated-2')
  })

  it('does not call onOpen when no photo is requested', () => {
    const onOpen = vi.fn()
    renderSlot({ requestedPhotoId: null, onOpen })
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('renders the frozen portal dialog at the requested index when open', async () => {
    renderSlot({ isOpen: true, initialIndex: 1, onClose: vi.fn() })
    // The viewer is lazy-loaded on first open (kept out of the gallery route chunk).
    const dialog = await screen.findByRole('dialog', {}, { timeout: 5000 })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Photo viewer — Ceremony')).toBeInTheDocument()
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })

  it('closes through the viewer contract (Esc -> onClose)', async () => {
    const onClose = vi.fn()
    renderSlot({ isOpen: true, onClose })
    await screen.findByRole('dialog', {}, { timeout: 5000 })

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('maps the gallery view model onto the viewer contract', () => {
    const photo = {
      id: 'gallery-1',
      url: '/images/gallery/one.webp',
      thumbnail: '/images/gallery/one-thumb.webp',
      downloadUrl: '/images/gallery/one-full.webp',
      caption: 'A caption',
      album: 'Wedding Day',
      category: 'Ceremony',
      likes: 7,
      liked: true,
      commentCount: 2,
      aspectRatio: 1.5,
      time: '4:12 PM',
      location: 'The Lodge',
      photographer: 'Studio',
      date: '2025-05-10',
      createdAt: '2025-05-11T12:00:00.000Z',
      faces: [{ id: 'face-1', name: 'Austin Porada', x: 40, y: 50 }],
      tags: ['ceremony'],
      source: 'professional' as const,
      collection: 'Wedding Photos' as const,
      albumSortOrder: 3,
    } satisfies GalleryPhoto

    expect(mapGalleryPhotoToViewerPhoto(photo)).toMatchObject({
      id: 'gallery-1',
      thumbnail: '/images/gallery/one-thumb.webp',
      download_url: '/images/gallery/one-full.webp',
      album: 'Wedding Day',
      album_sort_order: 3,
      likes: 7,
      liked: true,
      commentCount: 2,
      is_professional: true,
      tags: ['ceremony'],
      created_at: '2025-05-11T12:00:00.000Z',
      faces: [{ id: 'face-1', name: 'Austin Porada', x: 40, y: 50 }],
    })
  })

  it('opens the viewer for a gallery grid click (integration)', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { rerender } = renderSlot({ isOpen: false, onClose })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    rerender(
      <GalleryLightboxSlot
        requestedPhotoId={null}
        onOpen={vi.fn()}
        photos={VIEWER_PHOTOS}
        isOpen
        initialIndex={0}
        onClose={onClose}
      />
    )
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
