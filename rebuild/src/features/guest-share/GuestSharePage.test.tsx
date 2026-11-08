import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ClipboardAdapter } from './clipboard'
import { GUEST_SHARE_COPY } from './constants'
import { createStubGuestShareApi, STUB_VALID_TOKEN } from './data'
import {
  createDuplicatePhotoAlbum,
  createGuestShareAlbumFixture,
  createNotesOnlyAlbum,
  createPhotosOnlyAlbum,
} from './fixtures'
import { GuestSharePage } from './GuestSharePage'
import { installGuestShareMocks, renderGuestSharePage } from './test-utils'
import type { GuestShareAlbum, GuestShareApi } from './types'

installGuestShareMocks()

function createApi(overrides: Partial<GuestShareApi> = {}): GuestShareApi {
  return { ...createStubGuestShareApi(), ...overrides }
}

function manualScheduler() {
  const tasks: Array<{ callback: () => void; delayMs: number }> = []
  return {
    schedule: (callback: () => void, delayMs: number) => {
      tasks.push({ callback, delayMs })
      return tasks.length
    },
    runAll: () => {
      while (tasks.length > 0) tasks.shift()?.callback()
    },
    count: () => tasks.length,
  }
}

async function renderReadyPage(
  props: Partial<Parameters<typeof GuestSharePage>[0]> = {},
  api: GuestShareApi = createApi()
) {
  const result = await renderGuestSharePage(
    <GuestSharePage token={STUB_VALID_TOKEN} api={api} {...props} />
  )
  await screen.findByRole('heading', { level: 1, name: "Jane Miller's Showcase" })
  return result
}

function classTokensOf(element: Element | null): string[] {
  return element ? (element.getAttribute('class') ?? '').split(/\s+/) : []
}

describe('GuestSharePage — loading / invalid / network', () => {
  it('renders the frozen loading state while the token resolves', async () => {
    const pending = new Promise<GuestShareAlbum | null>(() => undefined)
    await renderGuestSharePage(
      <GuestSharePage token={STUB_VALID_TOKEN} api={createApi({ loadAlbum: () => pending })} />
    )

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(GUEST_SHARE_COPY.loadingMessage)).toBeInTheDocument()
  })

  it('renders "Album Link Unresolved" for an invalid token, focuses the error and offers the gallery escape', async () => {
    await renderGuestSharePage(
      <GuestSharePage
        token={STUB_VALID_TOKEN}
        api={createApi({ loadAlbum: () => Promise.resolve(null) })}
      />
    )

    const heading = await screen.findByRole('heading', {
      level: 2,
      name: GUEST_SHARE_COPY.invalidTitle,
    })
    expect(screen.getByText(GUEST_SHARE_COPY.invalidBody)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: GUEST_SHARE_COPY.retry })).toBeNull()
    expect(screen.getByRole('link', { name: GUEST_SHARE_COPY.backToGallery })).toHaveAttribute(
      'href',
      '/gallery'
    )
    await waitFor(() => expect(document.activeElement).toBe(heading))
  })

  it('treats a missing token as invalid', async () => {
    await renderGuestSharePage(<GuestSharePage token={undefined} />)
    expect(
      await screen.findByRole('heading', { level: 2, name: GUEST_SHARE_COPY.invalidTitle })
    ).toBeInTheDocument()
  })

  it('renders "Connection Trouble" for a network failure and retries into the album', async () => {
    const user = userEvent.setup()
    const loadAlbum = vi
      .fn<GuestShareApi['loadAlbum']>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(createGuestShareAlbumFixture())

    await renderGuestSharePage(
      <GuestSharePage token={STUB_VALID_TOKEN} api={createApi({ loadAlbum })} />
    )

    const heading = await screen.findByRole('heading', {
      level: 2,
      name: GUEST_SHARE_COPY.networkTitle,
    })
    expect(screen.getByText(GUEST_SHARE_COPY.networkBody)).toBeInTheDocument()
    await waitFor(() => expect(document.activeElement).toBe(heading))

    await user.click(screen.getByRole('button', { name: GUEST_SHARE_COPY.retry }))
    expect(
      await screen.findByRole('heading', { level: 1, name: "Jane Miller's Showcase" })
    ).toBeInTheDocument()
    expect(loadAlbum).toHaveBeenCalledTimes(2)
  })
})

describe('GuestSharePage — album content', () => {
  it('renders the frozen identity header, stats, tabs, photos and noindex metadata', async () => {
    const { container } = await renderReadyPage()

    expect(screen.getByText(GUEST_SHARE_COPY.eyebrow)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: GUEST_SHARE_COPY.backToGallery })).toHaveAttribute(
      'href',
      '/gallery'
    )
    expect(screen.getByText('6 Photos Shared')).toBeInTheDocument()
    expect(screen.getByText(GUEST_SHARE_COPY.bullet)).toBeInTheDocument()
    expect(screen.getByText('3 Messages Written')).toBeInTheDocument()

    const tabs = screen.getByRole('tablist', { name: GUEST_SHARE_COPY.tabsLabel })
    expect(within(tabs).getAllByRole('tab')).toHaveLength(2)
    expect(screen.getByRole('tab', { name: 'Photos (6)' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Guestbook Note (3)' })).toHaveAttribute(
      'aria-selected',
      'false'
    )

    const photos = screen.getAllByTestId('guest-share-photo')
    expect(photos).toHaveLength(6)
    expect(photos[0]).toHaveAccessibleName('Open photo: First look on the lawn')
    expect(screen.getByText('24')).toBeInTheDocument()

    await waitFor(() =>
      expect(document.title).toBe("Jane Miller's Album | Austin & Jordyn's Wedding")
    )
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow'
    )

    // Responsive layout tokens the frozen DOM uses.
    expect(classTokensOf(container.firstElementChild)).toEqual(
      expect.arrayContaining(['min-h-screen', 'pt-28', 'sm:pt-32'])
    )
    const photosGrid = photos[0]?.parentElement ?? null
    expect(classTokensOf(photosGrid)).toEqual(
      expect.arrayContaining(['grid-cols-1', 'sm:grid-cols-2', 'md:grid-cols-3'])
    )
  })

  it('dedupes duplicate photo rows from the data source', async () => {
    await renderReadyPage(
      {},
      createApi({ loadAlbum: () => Promise.resolve(createDuplicatePhotoAlbum()) })
    )
    expect(screen.getAllByTestId('guest-share-photo')).toHaveLength(6)
    expect(screen.getByRole('tab', { name: 'Photos (6)' })).toBeInTheDocument()
  })

  it('auto-switches to the guestbook-note tab when the album has notes but no photos', async () => {
    await renderGuestSharePage(
      <GuestSharePage
        token={STUB_VALID_TOKEN}
        api={createApi({ loadAlbum: () => Promise.resolve(createNotesOnlyAlbum()) })}
      />
    )
    await screen.findByRole('heading', { level: 1, name: "Jane Miller's Showcase" })

    expect(screen.getByRole('tab', { name: 'Guestbook Note (3)' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByText('0 Photos Shared')).toBeInTheDocument()
    const notes = screen.getAllByTestId('guest-share-note')
    expect(notes).toHaveLength(3)
    expect(screen.getAllByText(GUEST_SHARE_COPY.withLove)).toHaveLength(3)

    // The photos panel still exists when the user switches back to it.
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Photos (0)' }))
    expect(screen.getByText(GUEST_SHARE_COPY.noPhotosTitle)).toBeInTheDocument()
  })

  it('shows the frozen empty states for a photos-only album', async () => {
    const user = userEvent.setup()
    await renderGuestSharePage(
      <GuestSharePage
        token={STUB_VALID_TOKEN}
        api={createApi({ loadAlbum: () => Promise.resolve(createPhotosOnlyAlbum()) })}
      />
    )
    await screen.findByRole('heading', { level: 1, name: "Jane Miller's Showcase" })

    expect(screen.getByRole('tab', { name: 'Photos (6)' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('tab', { name: 'Guestbook Note (0)' }))
    expect(screen.getByText(GUEST_SHARE_COPY.noNotesTitle)).toBeInTheDocument()
    expect(screen.getByText(GUEST_SHARE_COPY.noNotesBody)).toBeInTheDocument()
  })

  it('keeps the tab strip keyboard operable with automatic activation', async () => {
    const user = userEvent.setup()
    await renderReadyPage()

    const photosTab = screen.getByRole('tab', { name: 'Photos (6)' })
    const guestbookTab = screen.getByRole('tab', { name: 'Guestbook Note (3)' })
    photosTab.focus()

    await user.keyboard('{ArrowRight}')
    expect(guestbookTab).toHaveAttribute('aria-selected', 'true')
    expect(document.activeElement).toBe(guestbookTab)

    await user.keyboard('{ArrowRight}')
    expect(photosTab).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowLeft}')
    expect(guestbookTab).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{Home}')
    expect(photosTab).toHaveAttribute('aria-selected', 'true')
    expect(document.activeElement).toBe(photosTab)

    await user.keyboard('{End}')
    expect(guestbookTab).toHaveAttribute('aria-selected', 'true')
  })

  it('opens the lightbox slot with the clicked photo index (W5-2 seam)', async () => {
    const user = userEvent.setup()
    await renderReadyPage()

    const slot = screen.getByTestId('guest-share-lightbox-slot')
    expect(slot).toHaveAttribute('data-is-open', 'false')
    expect(slot).toHaveAttribute('data-photo-count', '6')

    const photos = screen.getAllByTestId('guest-share-photo')
    const second = photos[1]
    expect(second).toBeDefined()
    await user.click(second as HTMLElement)

    expect(slot).toHaveAttribute('data-is-open', 'true')
    expect(slot).toHaveAttribute('data-initial-index', '1')
  })
})

describe('GuestSharePage — copy link', () => {
  it('copies the album URL, flips the button label for 2 s and notifies', async () => {
    const user = userEvent.setup()
    const scheduler = manualScheduler()
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve())
    const onNotify = vi.fn()
    const clipboard: ClipboardAdapter = { writeText }

    await renderReadyPage({
      pageUrl: 'https://www.theporadas.com/guest/valid-showcase-token',
      clipboard,
      schedule: scheduler.schedule,
      onNotify,
    })

    await user.click(screen.getByRole('button', { name: GUEST_SHARE_COPY.shareCta }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: GUEST_SHARE_COPY.copiedCta })).toBeInTheDocument()
    )
    expect(writeText).toHaveBeenCalledWith('https://www.theporadas.com/guest/valid-showcase-token')
    expect(onNotify).toHaveBeenCalledWith(GUEST_SHARE_COPY.copySuccessMessage, 'success')
    expect(screen.getByText(GUEST_SHARE_COPY.copySuccessMessage)).toBeInTheDocument()
    expect(scheduler.count()).toBe(1)

    act(() => scheduler.runAll())
    await waitFor(() =>
      expect(screen.getByRole('button', { name: GUEST_SHARE_COPY.shareCta })).toBeInTheDocument()
    )
  })

  it('falls back to the execCommand path when the Clipboard API is absent', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn<(text: string) => Promise<void>>()
    const fallbackCopy = vi.fn(() => true)

    await renderReadyPage({ clipboard: { fallbackCopy } })
    await user.click(screen.getByRole('button', { name: GUEST_SHARE_COPY.shareCta }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: GUEST_SHARE_COPY.copiedCta })).toBeInTheDocument()
    )
    expect(writeText).not.toHaveBeenCalled()
    expect(fallbackCopy).toHaveBeenCalledTimes(1)
  })

  it('warns (and keeps the label) when copying fails', async () => {
    const user = userEvent.setup()
    const onNotify = vi.fn()

    await renderReadyPage({
      clipboard: { writeText: () => Promise.reject(new Error('denied')) },
      onNotify,
    })
    await user.click(screen.getByRole('button', { name: GUEST_SHARE_COPY.shareCta }))

    await waitFor(() =>
      expect(onNotify).toHaveBeenCalledWith(GUEST_SHARE_COPY.copyFailureMessage, 'warning')
    )
    expect(screen.getByRole('button', { name: GUEST_SHARE_COPY.shareCta })).toBeInTheDocument()
    expect(screen.getByText(GUEST_SHARE_COPY.copyFailureMessage)).toBeInTheDocument()
  })
})
