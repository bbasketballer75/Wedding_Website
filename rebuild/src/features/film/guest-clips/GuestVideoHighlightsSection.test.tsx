import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFilmTestEnvironment } from '../test-utils/testEnvironment'
import { GuestVideoHighlightsSection } from './GuestVideoHighlightsSection'
import type { FilmGuestClip } from './filmGuestClips'

function clip(overrides: Partial<FilmGuestClip> = {}): FilmGuestClip {
  return {
    id: 'upload-1-0',
    uploadId: 'upload-1',
    guestName: 'Jamie Rivera',
    title: 'Right after the toasts',
    description: 'Our table, right after the toasts.',
    videoUrl: 'https://cdn.example.com/clip-1.mp4',
    createdAt: '2025-05-11T10:00:00.000Z',
    badge: 'From your phones',
    trail: 'Ceremony',
    ...overrides,
  }
}

describe('GuestVideoHighlightsSection', () => {
  beforeEach(() => {
    installFilmTestEnvironment()
  })

  it('self-hides when there are no guest clips (frozen behaviour)', () => {
    const { container } = render(
      <GuestVideoHighlightsSection clips={[]} isLoading={false} onOpen={vi.fn()} />
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('shows six skeletons while loading', () => {
    const { container } = render(
      <GuestVideoHighlightsSection clips={[]} isLoading onOpen={vi.fn()} />
    )

    // Six CardSkeleton roots (each renders several inner skeleton bars).
    expect(container.querySelectorAll('.bg-cream-100')).toHaveLength(6)
  })

  it('renders the frozen heading, trail chips and clip cards', () => {
    const onOpen = vi.fn()
    render(<GuestVideoHighlightsSection clips={[clip()]} isLoading={false} onOpen={onOpen} />)

    expect(
      screen.getByRole('heading', {
        name: 'Guest angles, if you want the room back from another point of view.',
      })
    ).toBeInTheDocument()
    expect(screen.getAllByText('From your phones').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ceremony').length).toBeGreaterThan(0)
    expect(screen.getByText('Right after the toasts')).toBeInTheDocument()

    const card = screen.getByRole('button', { name: /Right after the toasts/ })
    fireEvent.click(card)
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'upload-1-0' }))
  })
})
