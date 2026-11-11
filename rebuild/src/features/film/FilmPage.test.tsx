import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorialFeatures } from '@/shared/data/hooks'
import { installFilmTestEnvironment } from './test-utils/testEnvironment'
import { renderFilmPage } from './test-utils/renderFilmPage'
import { getVideoProgressStorageKey } from './videoProgress'

vi.mock('@/shared/data/hooks', () => ({
  useEditorialFeatures: vi.fn(),
}))

const useEditorialFeaturesMock = vi.mocked(useEditorialFeatures)

const STORAGE_KEY = getVideoProgressStorageKey('main-film')

function stubChapterFetchAsHtmlCatchAll(): void {
  // The rebuild dev server has no /video/ assets: a missing VTT is answered with
  // the SPA index.html, which the anti-HTML guard must reject (fallback path).
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<!doctype html><html><body>app shell</body></html>'),
      })
    )
  )
}

function mainVideo(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>('#wedding-film-player video:not([aria-hidden])')
}

describe('FilmPage', () => {
  beforeEach(() => {
    installFilmTestEnvironment()
    window.localStorage.clear()
    stubChapterFetchAsHtmlCatchAll()
    useEditorialFeaturesMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useEditorialFeatures>)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the frozen film copy and section order', async () => {
    await renderFilmPage()

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'The day as it felt, not just as it looked.',
      })
    ).toBeInTheDocument()
    expect(screen.getByText('Our wedding film')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Watch Now' })).toBeInTheDocument()
    expect(screen.getAllByText('45:53 feature film').length).toBeGreaterThan(0)
    expect(screen.getByText('Saturday, May 10, 2025')).toBeInTheDocument()
    expect(screen.getByText('The Lodge at Indian Lake')).toBeInTheDocument()

    expect(
      screen.getByRole('heading', { level: 2, name: 'The people who held the day together.' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: 'The people woven into the film' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: 'Watch the parent dances.' })
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Where to next' })).toBeInTheDocument()

    expect(screen.getByTestId('film-hero')).toBeInTheDocument()
    expect(screen.getByTestId('film-player-section')).toBeInTheDocument()
  })

  it('keeps the ten contract chapters when the VTT load fails (anti-HTML fallback)', async () => {
    await renderFilmPage()

    // Player header resolves to the contract fallback count once the fetch fails.
    await waitFor(() => {
      expect(screen.getByText('10 chapters', { selector: 'span' })).toBeInTheDocument()
    })

    expect(screen.getAllByRole('button', { name: /The Ceremony/ }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /First Dance/ }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /Bloopers/ }).length).toBeGreaterThan(0)
  })

  it('renders the four parent-dance cards and the players poster', async () => {
    await renderFilmPage()

    for (const label of [
      'Play Austin & Heather parent dance',
      'Play Austin & Melony parent dance',
      'Play Jordyn & Christine parent dance',
      'Play Jordyn & Jerame parent dance',
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }

    expect(mainVideo()?.getAttribute('poster')).toBe('/images/film/main-film-poster.png')
    expect(mainVideo()?.getAttribute('preload')).toBe('metadata')
  })

  it('self-hides the guest-clip section while the stub returns empty data', async () => {
    await renderFilmPage()

    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText('From your phones')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', {
        name: 'Guest angles, if you want the room back from another point of view.',
      })
    ).not.toBeInTheDocument()
  })

  it('opens the parent-dance modal from ?clip= and clears the param on close', async () => {
    const { router } = await renderFilmPage('/film?clip=mom')

    expect(
      await screen.findByRole('heading', { level: 3, name: 'Austin & Heather' })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Close parent dance video'))

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { level: 3, name: 'Austin & Heather' })
      ).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(router.state.location.searchStr).toBe('')
    })
  })

  it('jumps the main film to ?moment=<slug>', async () => {
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
    await renderFilmPage('/film?moment=the-ceremony')

    await waitFor(() => {
      expect(scrollSpy).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(mainVideo()?.currentTime).toBeCloseTo(1537.88)
    })
  })

  it('resumes saved progress from ?resume=1 and cleans the param', async () => {
    window.localStorage.setItem(STORAGE_KEY, '312')
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {})
    const { router } = await renderFilmPage('/film?resume=1')

    await waitFor(() => {
      expect(scrollSpy).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(mainVideo()?.currentTime).toBeCloseTo(312)
    })
    await waitFor(() => {
      expect(router.state.location.searchStr).toBe('')
    })
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('312')
  })

  it('opens a family-tree member modal and closes it with Escape', async () => {
    await renderFilmPage()

    const austinButtons = await screen.findAllByRole('button', { name: /Austin Porada/ })
    fireEvent.click(austinButtons[0] as HTMLElement)

    expect(
      await screen.findByRole('heading', { level: 3, name: 'Austin Porada' })
    ).toBeInTheDocument()
    expect(screen.getByText('The Groom')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { level: 3, name: 'Austin Porada' })
      ).not.toBeInTheDocument()
    })
  })

  it('sets the frozen per-route metadata and one VideoObject JSON-LD script', async () => {
    await renderFilmPage()

    await screen.findByRole('heading', { level: 1 })

    expect(document.title).toBe("Wedding Film | Austin & Jordyn's Wedding")
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'Watch the full wedding film for Austin and Jordyn, from getting ready through the last dance.'
    )
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'index, follow'
    )
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://www.theporadas.com/film'
    )
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      'https://www.theporadas.com/images/film/main-film-poster.png'
    )

    const structuredData = document.querySelectorAll('script[data-seo-structured-data="true"]')
    expect(structuredData).toHaveLength(1)
    expect(JSON.parse(structuredData[0]?.textContent ?? '{}')).toMatchObject({
      '@type': 'VideoObject',
      name: "Austin & Jordyn's Wedding Film",
      uploadDate: '2025-05-10',
      embedUrl: 'https://www.theporadas.com/film',
    })
  })
})
