import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GalleryLightboxSlot } from './GalleryLightboxSlot'

describe('GalleryLightboxSlot', () => {
  it('renders a hidden mount point for W5-2', () => {
    render(<GalleryLightboxSlot requestedPhotoId={null} onOpen={vi.fn()} />)
    expect(document.querySelector('[data-testid="gallery-lightbox-slot"]')).not.toBeNull()
  })

  it('bridges a requested photo id to the onOpen callback once', () => {
    const onOpen = vi.fn()
    const { rerender } = render(
      <GalleryLightboxSlot requestedPhotoId='curated-1' onOpen={onOpen} />
    )
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledWith('curated-1')

    rerender(<GalleryLightboxSlot requestedPhotoId='curated-1' onOpen={onOpen} />)
    expect(onOpen).toHaveBeenCalledTimes(1)

    rerender(<GalleryLightboxSlot requestedPhotoId='curated-2' onOpen={onOpen} />)
    expect(onOpen).toHaveBeenCalledTimes(2)
    expect(onOpen).toHaveBeenLastCalledWith('curated-2')
  })

  it('does not call onOpen when no photo is requested', () => {
    const onOpen = vi.fn()
    render(<GalleryLightboxSlot requestedPhotoId={null} onOpen={onOpen} />)
    expect(onOpen).not.toHaveBeenCalled()
  })
})
