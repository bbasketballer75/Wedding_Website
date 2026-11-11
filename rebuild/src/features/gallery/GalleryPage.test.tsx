import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GalleryPage } from './GalleryPage'
import { CURATED_PHOTOS, LIVE_PHOTOS } from './fixtures'
import type { GalleryPhoto } from './data'

function makeManyPhotos(count: number): GalleryPhoto[] {
  return Array.from({ length: count }, (_, index) => ({
    ...(CURATED_PHOTOS[index % CURATED_PHOTOS.length] as GalleryPhoto),
    id: `bulk-${index + 1}`,
    url: `/images/engagement/bulk-${index + 1}.webp`,
    thumbnail: `/images/engagement/bulk-${index + 1}.webp`,
    albumSortOrder: index + 1,
  }))
}

function photoButtons() {
  return screen.queryAllByRole('button', { name: /^Open photo/ })
}

describe('GalleryPage', () => {
  it('renders the frozen gallery copy, collection tabs and default collection counts', () => {
    render(<GalleryPage />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Browse the archive' })
    ).toBeInTheDocument()
    expect(screen.getByText('35 visible')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Start with the album you want, then use search or people browsing only when you need it.'
      )
    ).toBeInTheDocument()

    const controlBar = screen.getByTestId('gallery-control-bar')
    const tabs = within(controlBar).getAllByRole('button', { name: /collection, \d+ photos/ })
    expect(tabs).toHaveLength(4)
    expect(tabs.map(tab => tab.textContent)).toEqual([
      'Proposal35 photos',
      'Bach+ette0 photos',
      'Wedding Photos5 photos',
      'Guest Photos0 photos',
    ])

    // Proposal is the default collection: frozen h2 + 30-photo count.
    expect(screen.getByRole('heading', { level: 2, name: 'Proposal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Proposal collection, 35 photos' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('paginates: 12 masonry tiles, then Load more reveals 24 and 30', async () => {
    const user = userEvent.setup()
    render(<GalleryPage />)

    expect(photoButtons()).toHaveLength(12)
    await user.click(screen.getByRole('button', { name: /load more/i }))
    expect(photoButtons()).toHaveLength(24)
    await user.click(screen.getByRole('button', { name: /load more/i }))
    expect(photoButtons()).toHaveLength(35)
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull()
  })

  it('switches collection tabs and renders the frozen empty state for an empty album', async () => {
    const user = userEvent.setup()
    render(<GalleryPage />)

    await user.click(screen.getByRole('button', { name: 'Wedding Photos collection, 5 photos' }))
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Wedding Photos' })
    ).toBeInTheDocument()
    expect(screen.getByText('5 visible')).toBeInTheDocument()
    // AnimatePresence waits for the old grid's exit animation before mounting.
    await waitFor(() => expect(photoButtons()).toHaveLength(5))

    await user.click(screen.getByRole('button', { name: 'Bach+ette collection, 0 photos' }))
    expect(
      await screen.findByText('Bachelor and bachelorette memories is waiting for the next upload')
    ).toBeInTheDocument()
    expect(screen.getByText('0 visible')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Return to all collections' })).toBeInTheDocument()

    // The empty-state copy is derived per collection from the frozen metadata.
    await user.click(screen.getByRole('button', { name: 'Guest Photos collection, 0 photos' }))
    expect(
      await screen.findByText('Guest Perspectives is waiting for the next upload')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'A collection of memories and angles shared by our loved ones. This stays separate from the photographer coverage on purpose.'
      )
    ).toBeInTheDocument()
  })

  it('filters by search across caption/location/photographer/faces/tags', async () => {
    const user = userEvent.setup()
    render(<GalleryPage />)

    const search = screen.getByLabelText('Search gallery photos')
    await user.type(search, 'Emma Photography')
    expect(screen.getByText('35 visible')).toBeInTheDocument()
    expect(screen.getByText('Active filters')).toBeInTheDocument()
    expect(screen.getByText('Search: "Emma Photography"')).toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'jordyn')
    expect(screen.getByText('8 visible')).toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'no-such-photo-term')
    expect(screen.getByText('0 visible')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(screen.getByText('35 visible')).toBeInTheDocument()
  })

  it('toggles the three view modes with aria-pressed and the 18-item grid page size', async () => {
    const user = userEvent.setup()
    render(<GalleryPage />)

    const masonry = screen.getByRole('button', { name: 'Masonry' })
    const grid = screen.getByRole('button', { name: 'Grid' })
    const timeline = screen.getByRole('button', { name: 'Timeline' })
    expect(masonry).toHaveAttribute('aria-pressed', 'true')

    await user.click(grid)
    expect(grid).toHaveAttribute('aria-pressed', 'true')
    expect(masonry).toHaveAttribute('aria-pressed', 'false')
    await waitFor(() => expect(photoButtons()).toHaveLength(18))

    await user.click(timeline)
    expect(timeline).toHaveAttribute('aria-pressed', 'true')
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Timeline view' })
    ).toBeInTheDocument()
    await waitFor(() => expect(photoButtons()).toHaveLength(12))
  })

  it('supports select mode, select-all, the queue bar and the share link', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    render(<GalleryPage />)

    const selectToggle = screen.getByRole('button', { name: 'Select' })
    expect(selectToggle).toHaveAttribute('aria-pressed', 'false')
    await user.click(selectToggle)
    expect(selectToggle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('0 photos in queue (max 50)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Select All Visible' }))
    expect(screen.getByText('35 photos in queue (max 50)')).toBeInTheDocument()
    expect(screen.getByText('35 photos selected')).toBeInTheDocument()
    expect(screen.getByText('35 photos added to the download queue.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(writeText).toHaveBeenCalledOnce()
    expect(screen.getByText('Share link copied to clipboard')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear Selection' }))
    expect(screen.queryByText('35 photos selected')).toBeNull()
  })

  it('caps select-all at 50 photos and warns (frozen batch limit)', async () => {
    const user = userEvent.setup()
    render(<GalleryPage source={{ curated: makeManyPhotos(60), live: [] }} />)

    await user.click(screen.getByRole('button', { name: 'Select' }))
    await user.click(screen.getByRole('button', { name: 'Select All Visible' }))

    expect(screen.getByText('50 photos in queue (max 50)')).toBeInTheDocument()
    expect(screen.getByText('Maximum 50 photos can be downloaded as a batch.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download zip' })).toBeInTheDocument()
  })

  it('preselects ?share= ids in select mode and exposes the queue', () => {
    render(<GalleryPage search={{ share: 'curated-1,curated-2' }} />)

    expect(screen.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('2 photos in queue (max 50)')).toBeInTheDocument()
    expect(screen.getByText('2 photos selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Download Queue/ })).toBeInTheDocument()

    // ?share= also drives the social image (frozen GallerySEO share contract).
    expect(document.title).toBe("Shared Wedding Photos | Austin & Jordyn's Wedding")
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      'https://www.theporadas.com/images/engagement/PoradaProposal-29.webp'
    )
  })

  it('opens ?collection= and applies ?q= from the URL contract', () => {
    render(<GalleryPage search={{ collection: 'Wedding Photos', q: 'first look' }} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Wedding Photos' })).toBeInTheDocument()
    expect(screen.getByLabelText('Search gallery photos')).toHaveValue('first look')
    expect(screen.getByText('1 visible')).toBeInTheDocument()
  })

  it('bridges ?photo= and ?shared= to the lightbox slot', async () => {
    const { unmount } = render(<GalleryPage search={{ photo: 'curated-3' }} />)
    expect(await screen.findByTestId('gallery-lightbox-request')).toHaveTextContent('curated-3')
    unmount()

    render(<GalleryPage search={{ shared: 'photo-1' }} />)
    expect(await screen.findByTestId('gallery-lightbox-request')).toHaveTextContent('photo-1')
  })

  it('opens the real PhotoLightbox for a grid click and closes on Escape (focus restored)', async () => {
    const user = userEvent.setup()
    render(<GalleryPage />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const firstPhotoButton = photoButtons()[0]
    expect(firstPhotoButton).toBeDefined()
    await user.click(firstPhotoButton as HTMLElement)

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('1 / 35')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(firstPhotoButton).toHaveFocus())
  })

  it('keeps the curated photos visible when the live fetch fails', () => {
    render(
      <GalleryPage
        source={{
          curated: CURATED_PHOTOS,
          live: [],
          loadError:
            'The live gallery is taking a moment — the collections below are still ready to explore.',
        }}
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The live gallery is taking a moment — the collections below are still ready to explore.'
    )
    expect(screen.getByText('35 visible')).toBeInTheDocument()
    expect(photoButtons()).toHaveLength(12)
  })

  it('renders the skeleton state while photos load', () => {
    render(<GalleryPage source={{ curated: [], live: [], isLoading: true }} />)
    expect(screen.queryByTestId('gallery-photo-grid')).toBeNull()
    expect(screen.getByText('0 visible')).toBeInTheDocument()
  })

  it('exposes the upload-status lookup and a labelled landmark structure', () => {
    render(<GalleryPage />)
    expect(screen.getByRole('heading', { name: 'Check Your Upload Status' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email address used for your upload')).toBeInTheDocument()
    expect(screen.getByTestId('gallery-results')).toBeInTheDocument()
    expect(screen.queryAllByRole('main')).toHaveLength(0) // the shell, not the page, owns <main>
    expect(LIVE_PHOTOS).toHaveLength(5)
  })
})
