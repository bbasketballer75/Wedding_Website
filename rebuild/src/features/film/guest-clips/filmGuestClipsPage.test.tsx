import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorialFeatures } from '@/shared/data/hooks'
import type { FilmGuestClip } from './filmGuestClips'
import { installFilmTestEnvironment } from '../test-utils/testEnvironment'
import { renderFilmPage } from '../test-utils/renderFilmPage'

const adapterMock = vi.hoisted(() => ({ fetchFilmGuestClips: vi.fn() }))

vi.mock('@/app/routes/film-clips-adapter', () => ({
  fetchFilmGuestClips: adapterMock.fetchFilmGuestClips,
}))
vi.mock('@/shared/data/hooks', () => ({
  useEditorialFeatures: vi.fn(),
}))

const fetchFilmGuestClipsMock = vi.mocked(adapterMock.fetchFilmGuestClips)
const useEditorialFeaturesMock = vi.mocked(useEditorialFeatures)

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

function stubChapterFetchAsHtmlCatchAll(): void {
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

describe('FilmPage guest clips (Wave 9 wiring)', () => {
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

  it('renders the wired guest clips when the adapter returns rows', async () => {
    fetchFilmGuestClipsMock.mockResolvedValue([clip()])
    await renderFilmPage()

    await screen.findByRole('heading', { level: 1 })
    expect((await screen.findAllByText('From your phones')).length).toBeGreaterThan(0)
    expect(
      screen.getByRole('heading', {
        name: 'Guest angles, if you want the room back from another point of view.',
      })
    ).toBeInTheDocument()
    expect(screen.getByText('Right after the toasts')).toBeInTheDocument()
    expect(screen.getAllByText('Ceremony').length).toBeGreaterThan(0)

    // The clip card opens the frozen guest-highlight modal.
    fireEvent.click(screen.getByRole('button', { name: /Right after the toasts/ }))
    expect(await screen.findByText('Added')).toBeInTheDocument()
  })

  it('self-hides the section when the data layer returns no approved video clips', async () => {
    fetchFilmGuestClipsMock.mockResolvedValue([])
    await renderFilmPage()

    await screen.findByRole('heading', { level: 1 })
    await waitFor(() => {
      expect(fetchFilmGuestClipsMock).toHaveBeenCalledTimes(1)
    })

    expect(screen.queryByText('From your phones')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', {
        name: 'Guest angles, if you want the room back from another point of view.',
      })
    ).not.toBeInTheDocument()
  })

  it('keeps the page usable and the section hidden when the guest-clip read fails', async () => {
    fetchFilmGuestClipsMock.mockRejectedValue(new Error('data layer offline'))
    await renderFilmPage()

    await screen.findByRole('heading', { level: 1 })
    await waitFor(() => {
      expect(fetchFilmGuestClipsMock).toHaveBeenCalledTimes(1)
    })

    expect(screen.queryByText('From your phones')).not.toBeInTheDocument()
    // The rest of the film page still rendered.
    expect(screen.getByTestId('film-player-section')).toBeInTheDocument()
  })
})
