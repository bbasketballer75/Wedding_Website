import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi, type Mock } from 'vitest'
import type { GuestbookPrintEntry } from '@/shared/data/guestbook'
import type { Photo, PhotoAlbum } from '@/shared/data/photos'
import { PrintPage } from './PrintPage'
import type { LoadPrintAlbumPhotos, LoadPrintGuestbook } from './printTypes'

/**
 * Structural stand-ins for the typed data-layer view models. `PrintPage` only
 * reads `id`, `url`, `thumbnail` and `caption` from a photo, so a minimal cast
 * keeps the tests focused on the page contract rather than row scaffolding.
 */
function makePhoto(id: string, caption: string | null, album: PhotoAlbum = 'Wedding Day'): Photo {
  return {
    id,
    url: `/images/${album.replace(/\s+/g, '-').toLowerCase()}/${id}.webp`,
    thumbnail: `/images/${album.replace(/\s+/g, '-').toLowerCase()}/${id}.webp`,
    caption,
    album,
  } as unknown as Photo
}

const WEDDING_PHOTOS: readonly Photo[] = [
  makePhoto('wedding-1', 'First look on the lawn'),
  makePhoto('wedding-2', 'Walking toward the ceremony garden'),
  makePhoto('wedding-3', 'Quiet vows before the applause'),
  makePhoto('wedding-4', 'The first kiss'),
  makePhoto('wedding-5', 'A table full of laughter'),
  makePhoto('wedding-6', 'First dance under the lights'),
]

const ENGAGEMENT_PHOTOS: readonly Photo[] = [
  makePhoto('engagement-1', 'Ring details', 'Engagement'),
]

const GUESTBOOK_ENTRIES: readonly GuestbookPrintEntry[] = [
  { id: 'note-1', name: 'Sarah Mitchell', createdAt: '2025-05-11T10:00:00Z', content: 'Vows.' },
  { id: 'note-2', name: 'Mike Chen', createdAt: '2025-05-11T11:00:00Z', content: 'Dance floor.' },
  {
    id: 'note-3',
    name: 'Aunt Patricia',
    createdAt: '2025-05-11T12:00:00Z',
    content: 'Video hello.',
  },
]

interface TestLoaders {
  loadAlbumPhotos: Mock<LoadPrintAlbumPhotos>
  loadGuestbook: Mock<LoadPrintGuestbook>
}

function createLoaders(): TestLoaders {
  const loadAlbumPhotos = vi.fn((album: PhotoAlbum): Promise<readonly Photo[]> => {
    if (album === 'Wedding Day') return Promise.resolve(WEDDING_PHOTOS)
    if (album === 'Engagement') return Promise.resolve(ENGAGEMENT_PHOTOS)
    return Promise.resolve([])
  })
  const loadGuestbook = vi.fn((): Promise<readonly GuestbookPrintEntry[]> =>
    Promise.resolve(GUESTBOOK_ENTRIES)
  )
  return { loadAlbumPhotos, loadGuestbook }
}

function emptyLoaders(): TestLoaders {
  return {
    loadAlbumPhotos: vi.fn(() => Promise.resolve([] as readonly Photo[])),
    loadGuestbook: vi.fn(() => Promise.resolve([] as readonly GuestbookPrintEntry[])),
  }
}

function renderPage(loaders: TestLoaders = createLoaders()) {
  const view = render(
    <PrintPage loadAlbumPhotos={loaders.loadAlbumPhotos} loadGuestbook={loaders.loadGuestbook} />
  )
  return { ...loaders, ...view }
}

/** Wait until both one-shot reads have settled and the book shows the album. */
async function renderLoadedPage(loaders: TestLoaders = createLoaders()) {
  const view = renderPage(loaders)
  await screen.findByText('First look on the lawn')
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /Print \/ Save PDF/i })).toBeEnabled()
  })
  return view
}

function getPrintButton(): HTMLElement {
  return screen.getByRole('button', { name: /Print \/ Save PDF/i })
}

describe('PrintPage', () => {
  it('renders the frozen Memory Book copy, controls and print container', async () => {
    await renderLoadedPage()

    // Frozen page metadata (PrintSEO: title template, noindex, canonical /print).
    expect(document.title).toBe("Memory Book | Austin & Jordyn's Wedding")
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow'
    )
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://www.theporadas.com/print'
    )

    // Control panel + settings copy from the rendered oracle.
    expect(screen.getByText('Memory Book')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Choose what to include' })).toBeVisible()
    expect(screen.getByText('Photo albums')).toBeInTheDocument()
    expect(screen.getByText('Max photos per album')).toBeInTheDocument()

    // Print book: title block and the album section.
    const printBook = screen.getByTestId('print-book')
    expect(printBook).toBeInTheDocument()
    expect(within(printBook).getByText('A wedding archive')).toBeInTheDocument()
    expect(
      within(printBook).getByRole('heading', { level: 1, name: 'Austin & Jordyn Porada' })
    ).toBeInTheDocument()
    expect(within(printBook).getAllByText('May 10, 2025')).toHaveLength(2)
    expect(
      within(printBook).getByRole('heading', { level: 2, name: 'Wedding Day' })
    ).toBeInTheDocument()

    // Frozen control order: Engagement, Bach+ette, Wedding Day, Guest Uploads.
    const albumToggleTestIds = Array.from(
      document.querySelectorAll('[data-testid^="print-album-toggle-"]')
    ).map(element => element.getAttribute('data-testid'))
    expect(albumToggleTestIds).toEqual([
      'print-album-toggle-Engagement',
      'print-album-toggle-Bach+ette',
      'print-album-toggle-Wedding Day',
      'print-album-toggle-Guest Uploads',
    ])

    // Print-only hiding is class-driven: the chrome lives under `.no-print`.
    expect(screen.getByTestId('print-settings-panel').className).toContain('no-print')
    for (const testId of ['print-button', 'print-max-photos-slider', 'print-max-photos-number']) {
      expect(screen.getByTestId(testId).closest('.no-print')).not.toBeNull()
    }
  })

  it('pre-loads the default Wedding Day album once on mount', async () => {
    const loaders = await renderLoadedPage()

    expect(loaders.loadAlbumPhotos).toHaveBeenCalledTimes(1)
    expect(loaders.loadAlbumPhotos).toHaveBeenCalledWith('Wedding Day')
    expect(loaders.loadGuestbook).toHaveBeenCalledTimes(1)

    const weddingDayToggle = screen.getByTestId('print-album-toggle-Wedding Day')
    expect(weddingDayToggle).toHaveAttribute('aria-pressed', 'true')
    expect(weddingDayToggle).toHaveTextContent('6 photos')

    expect(screen.getByTestId('print-album-toggle-Engagement')).toHaveTextContent('0 photos')
    expect(screen.getByTestId('print-album-toggle-Bach+ette')).toHaveTextContent('0 photos')
    expect(screen.getByTestId('print-album-toggle-Guest Uploads')).toHaveTextContent('0 photos')

    expect(screen.getByText('First look on the lawn')).toBeInTheDocument()
    expect(screen.getByText('First dance under the lights')).toBeInTheDocument()
  })

  it('keeps print disabled while there is nothing to print', async () => {
    const loaders = emptyLoaders()
    renderPage(loaders)

    await waitFor(() => {
      expect(loaders.loadGuestbook).toHaveBeenCalledTimes(1)
      expect(getPrintButton()).toBeDisabled()
    })

    // Frozen empty book state: with no album included, the hint is shown.
    fireEvent.click(screen.getByTestId('print-album-toggle-Wedding Day'))
    expect(screen.getByText('Select at least one album above to include photos.')).toBeVisible()
    expect(screen.queryByText('Words from our guests')).not.toBeInTheDocument()
    expect(getPrintButton()).toBeDisabled()
  })

  it('enables print when only the guestbook has content and reverts when it is excluded', async () => {
    const loaders: TestLoaders = {
      loadAlbumPhotos: vi.fn(() => Promise.resolve([] as readonly Photo[])),
      loadGuestbook: vi.fn(() => Promise.resolve(GUESTBOOK_ENTRIES)),
    }
    renderPage(loaders)

    await waitFor(() => expect(getPrintButton()).toBeEnabled())
    expect(screen.getByRole('heading', { level: 2, name: 'Words from our guests' })).toBeVisible()

    fireEvent.click(screen.getByTestId('print-guestbook-toggle'))

    expect(getPrintButton()).toBeDisabled()
    expect(screen.queryByRole('heading', { level: 2, name: 'Words from our guests' })).toBeNull()
  })

  it('lazy-loads an album exactly once when it is first included', async () => {
    const loaders = await renderLoadedPage()
    loaders.loadAlbumPhotos.mockClear()

    const engagementToggle = screen.getByTestId('print-album-toggle-Engagement')
    fireEvent.click(engagementToggle)

    await screen.findByText('Ring details')
    expect(loaders.loadAlbumPhotos).toHaveBeenCalledTimes(1)
    expect(loaders.loadAlbumPhotos).toHaveBeenCalledWith('Engagement')
    expect(engagementToggle).toHaveAttribute('aria-pressed', 'true')
    expect(engagementToggle).toHaveTextContent('1 photo')

    // Excluding and re-including an already-loaded album must not re-read it.
    fireEvent.click(engagementToggle)
    expect(engagementToggle).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(engagementToggle)
    expect(engagementToggle).toHaveAttribute('aria-pressed', 'true')
    expect(loaders.loadAlbumPhotos).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Ring details')).toBeInTheDocument()
  })

  it('clamps the numeric max-photos input and caps the rendered photos', async () => {
    await renderLoadedPage()

    const slider = screen.getByRole('slider', { name: /Max photos per album/ })
    const numberInput = screen.getByRole('spinbutton', { name: /Max photos per album/ })

    expect(slider).toHaveAttribute('min', '6')
    expect(slider).toHaveAttribute('max', '200')
    expect(slider).toHaveAttribute('step', '2')
    expect(numberInput).toHaveAttribute('min', '1')
    expect(numberInput).toHaveAttribute('max', '500')
    expect(numberInput).toHaveValue(40)

    fireEvent.change(numberInput, { target: { value: '900' } })
    expect(numberInput).toHaveValue(500)

    fireEvent.change(numberInput, { target: { value: '0' } })
    expect(numberInput).toHaveValue(1)

    fireEvent.change(numberInput, { target: { value: '' } })
    expect(numberInput).toHaveValue(1)

    fireEvent.change(numberInput, { target: { value: '2' } })
    expect(numberInput).toHaveValue(2)

    const printBook = screen.getByTestId('print-book')
    expect(within(printBook).getAllByRole('img')).toHaveLength(2)

    fireEvent.change(slider, { target: { value: '60' } })
    expect(numberInput).toHaveValue(60)
  })

  it('calls window.print from the enabled print button', async () => {
    await renderLoadedPage()

    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    try {
      fireEvent.click(getPrintButton())
      expect(printSpy).toHaveBeenCalledTimes(1)
    } finally {
      printSpy.mockRestore()
    }
  })

  it('does not print while the button is disabled', async () => {
    renderPage(emptyLoaders())
    await waitFor(() => expect(getPrintButton()).toBeDisabled())

    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    try {
      fireEvent.click(getPrintButton())
      expect(printSpy).not.toHaveBeenCalled()
    } finally {
      printSpy.mockRestore()
    }
  })

  it('exposes the frozen guestbook keepsake when included', async () => {
    await renderLoadedPage()

    expect(screen.getAllByText('3 messages')).toHaveLength(2)
    expect(screen.getByRole('heading', { level: 2, name: 'Words from our guests' })).toBeVisible()
    expect(screen.getByText('— Sarah Mitchell')).toBeInTheDocument()
    expect(screen.getByText('— Mike Chen')).toBeInTheDocument()
    expect(screen.getByText('— Aunt Patricia')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('print-guestbook-toggle'))

    expect(screen.queryByRole('heading', { level: 2, name: 'Words from our guests' })).toBeNull()
    // The toggle keeps its own count; the control-panel counter is gone.
    expect(screen.getAllByText('3 messages')).toHaveLength(1)
    expect(screen.getByTestId('print-guestbook-toggle')).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps every control keyboard-operable and labelled', async () => {
    await renderLoadedPage()

    const toggles = [
      screen.getByTestId('print-album-toggle-Engagement'),
      screen.getByTestId('print-album-toggle-Bach+ette'),
      screen.getByTestId('print-album-toggle-Wedding Day'),
      screen.getByTestId('print-album-toggle-Guest Uploads'),
    ]
    for (const toggle of toggles) {
      expect(toggle).toHaveAttribute('type', 'button')
      expect(toggle).toHaveAttribute('aria-pressed')
      toggle.focus()
      expect(toggle).toHaveFocus()
    }

    const guestbookToggle = screen.getByTestId('print-guestbook-toggle')
    expect(guestbookToggle).toHaveAttribute('aria-pressed', 'true')
    guestbookToggle.focus()
    expect(guestbookToggle).toHaveFocus()

    expect(screen.getByRole('slider', { name: 'Max photos per album slider' })).toBeVisible()
    expect(screen.getByRole('spinbutton', { name: 'Max photos per album number' })).toBeVisible()

    getPrintButton().focus()
    expect(getPrintButton()).toHaveFocus()
  })
})
