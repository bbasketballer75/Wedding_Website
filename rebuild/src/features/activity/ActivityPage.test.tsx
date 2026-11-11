import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, type Mock, vi } from 'vitest'
import { ActivityPage } from './ActivityPage'
import { ACTIVITY_COPY, ACTIVITY_FIXED_NOW } from './constants'
import { createStubActivityApi } from './data'
import { ACTIVITY_FIXTURE } from './fixtures'
import { installActivityMocks, renderActivityPage, triggerIntersection } from './test-utils'
import type { ActivityApi, ActivityItem, ActivitySubscription } from './types'

const NOW = new Date(ACTIVITY_FIXED_NOW)

function makeItem(id: string, overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id,
    type: 'photo_upload',
    sourceId: `source-${id}`,
    sourceType: 'guest_uploads',
    displayName: `Guest ${id}`,
    thumbnailUrl: null,
    contentPreview: null,
    createdAt: '2025-05-10T14:00:00.000Z',
    ...overrides,
  }
}

function makeItems(start: number, count: number, overrides: Partial<ActivityItem> = {}) {
  return Array.from({ length: count }, (_, index) => makeItem(`a-${start + index}`, overrides))
}

interface ControllableApi {
  api: ActivityApi
  subscribe: Mock<ActivityApi['subscribe']>
  unsubscribe: Mock<() => void>
  emitInsert: (item: ActivityItem) => void
}

function createControllableApi(
  pages: readonly (readonly ActivityItem[])[] = [ACTIVITY_FIXTURE, []]
): ControllableApi {
  const stub = createStubActivityApi({ pages })
  const realtime: { handler: ((item: ActivityItem) => void) | null } = { handler: null }
  const unsubscribe = vi.fn<() => void>()
  const subscribe = vi.fn<ActivityApi['subscribe']>((onInsert): ActivitySubscription => {
    realtime.handler = onInsert
    return { unsubscribe }
  })
  return {
    api: { loadFeed: stub.loadFeed, subscribe },
    subscribe,
    unsubscribe,
    emitInsert: (item: ActivityItem) => realtime.handler?.(item),
  }
}

async function renderLoadedPage(props: { api?: ActivityApi; now?: Date } = {}) {
  const api = props.api ?? createControllableApi().api
  const view = await renderActivityPage(<ActivityPage api={api} now={props.now ?? NOW} />)
  await screen.findAllByTestId('activity-card')
  return view
}

describe('ActivityPage', () => {
  installActivityMocks()

  it('renders the frozen text oracle: title, tabs, fixture cards and footer', async () => {
    const { api } = createControllableApi()
    await renderActivityPage(<ActivityPage api={api} now={NOW} />)
    await screen.findAllByTestId('activity-card')

    expect(screen.getByRole('heading', { level: 1, name: 'Activity' })).toBeInTheDocument()

    const tabs = screen.getByRole('tablist', { name: ACTIVITY_COPY.filterLabel })
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map(tab => tab.textContent)
    ).toEqual(['All', 'Photos', 'Guestbook', 'Moments'])
    expect(within(tabs).getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')

    const cards = screen.getAllByTestId('activity-card')
    expect(cards).toHaveLength(2)
    expect(cards[0]).toHaveTextContent('John Doe')
    expect(cards[0]).toHaveTextContent('shared a photo')
    expect(cards[0]).toHaveTextContent('over 1 year ago')
    expect(cards[1]).toHaveTextContent('Sarah Mitchell')
    expect(cards[1]).toHaveTextContent('signed the guestbook')
    expect(cards[1]).toHaveTextContent('over 1 year ago')

    // Frozen footer copy shown while more pages are possible.
    expect(screen.getByText('Scroll for more or end of feed')).toBeInTheDocument()
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'activity-tab-all')
  })

  it('shows a skeleton while the first page is in flight', async () => {
    let resolveLoad: ((items: ActivityItem[]) => void) | null = null
    const api: ActivityApi = {
      loadFeed: () =>
        new Promise<ActivityItem[]>(resolve => {
          resolveLoad = resolve
        }),
      subscribe: () => ({ unsubscribe: () => undefined }),
    }
    await renderActivityPage(<ActivityPage api={api} now={NOW} />)

    expect(screen.getByTestId('activity-skeletons')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(ACTIVITY_COPY.loadingLabel)

    act(() => resolveLoad?.([makeItem('slow-1')]))
    expect(await screen.findByText('Guest slow-1')).toBeInTheDocument()
    expect(screen.queryByTestId('activity-skeletons')).toBeNull()
  })

  it('shows the frozen empty state when the feed has no items', async () => {
    const { api } = createControllableApi([[]])
    await renderActivityPage(<ActivityPage api={api} now={NOW} />)

    expect(await screen.findByText(ACTIVITY_COPY.emptyTitle)).toBeInTheDocument()
    expect(screen.getByText(ACTIVITY_COPY.emptyBody)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Share a Photo/ })).toHaveAttribute('href', '/upload')
    expect(screen.getByRole('link', { name: /Sign Guestbook/ })).toHaveAttribute(
      'href',
      '/guestbook'
    )
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('shows an alert when the first load fails', async () => {
    const api: ActivityApi = {
      loadFeed: () => Promise.reject(new Error('offline')),
      subscribe: () => ({ unsubscribe: () => undefined }),
    }
    await renderActivityPage(<ActivityPage api={api} now={NOW} />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(ACTIVITY_COPY.loadError)
  })

  it('filters client-side by the frozen moments type map', async () => {
    const user = userEvent.setup()
    const items = [
      makeItem('photo-1', { type: 'photo_upload', displayName: 'Photo Guest' }),
      makeItem('note-1', { type: 'guestbook_entry', displayName: 'Note Guest' }),
      makeItem('moment-1', { type: 'featured_moment', displayName: 'Moment Guest' }),
    ]
    const { api } = createControllableApi([items, []])
    await renderActivityPage(<ActivityPage api={api} now={NOW} />)
    await screen.findAllByTestId('activity-card')
    expect(screen.getAllByTestId('activity-card')).toHaveLength(3)

    await user.click(screen.getByRole('tab', { name: 'Photos' }))
    expect(screen.getAllByTestId('activity-card')).toHaveLength(1)
    expect(screen.getByText('Photo Guest')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Guestbook' }))
    expect(screen.getAllByTestId('activity-card')).toHaveLength(1)
    expect(screen.getByText('Note Guest')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Moments' }))
    expect(screen.getAllByTestId('activity-card')).toHaveLength(1)
    expect(screen.getByText('Moment Guest')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'All' }))
    expect(screen.getAllByTestId('activity-card')).toHaveLength(3)
  })

  it('supports ARIA tab keyboard navigation (arrows, Home, End)', async () => {
    const { api } = createControllableApi()
    await renderLoadedPage({ api })
    const user = userEvent.setup()

    const allTab = screen.getByRole('tab', { name: 'All' })
    allTab.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Photos' })).toHaveAttribute('aria-selected', 'true')
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Photos' }))

    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Moments' })).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Moments' })).toHaveAttribute('aria-selected', 'true')
  })

  it('appends the next page when the sentinel intersects, then ends the feed', async () => {
    const { api } = createControllableApi([makeItems(1, 3), makeItems(4, 2), []])
    await renderLoadedPage({ api })
    expect(screen.getAllByTestId('activity-card')).toHaveLength(3)
    expect(screen.getByText(ACTIVITY_COPY.feedFooter)).toBeInTheDocument()

    act(() => {
      triggerIntersection()
    })
    await waitFor(() => expect(screen.getAllByTestId('activity-card')).toHaveLength(5), {
      timeout: 5000,
    })

    act(() => {
      triggerIntersection()
    })
    // Empty page => hasMore false. The frozen page keeps the footer as the
    // end-of-feed copy ("Scroll for more or end of feed"); only the loading
    // state goes away and no further rows are appended.
    await waitFor(() => expect(screen.queryByText(ACTIVITY_COPY.loadingMore)).toBeNull(), {
      timeout: 3000,
    })
    expect(screen.getByText(ACTIVITY_COPY.feedFooter)).toBeInTheDocument()
    expect(screen.getAllByTestId('activity-card')).toHaveLength(5)
  })

  it('shows the new-activity banner on a realtime insert and prepends on click', async () => {
    const user = userEvent.setup()
    const controllable = createControllableApi()
    await renderLoadedPage({ api: controllable.api })
    expect(screen.queryByTestId('new-activity-banner')).toBeNull()

    const inserted = makeItem('live-1', {
      type: 'guestbook_entry',
      displayName: 'Live Guest',
      createdAt: '2025-05-13T12:00:00.000Z',
    })
    act(() => controllable.emitInsert(inserted))

    const banner = await screen.findByTestId('new-activity-banner')
    expect(banner).toHaveTextContent('1 new activity — click to load')
    // Announcement live region (a11y) is populated, not just the visible banner.
    expect(screen.getByRole('status')).toHaveTextContent(ACTIVITY_COPY.newActivityAnnouncement(1))

    // The pending item is not in the feed until the banner is activated.
    expect(screen.queryByText('Live Guest')).toBeNull()

    await user.click(banner)
    await waitFor(() => expect(screen.queryByTestId('new-activity-banner')).toBeNull())
    const cards = screen.getAllByTestId('activity-card')
    expect(cards[0]).toHaveTextContent('Live Guest')
    expect(cards).toHaveLength(3)
  })

  it('accumulates multiple inserts in the banner count', async () => {
    const controllable = createControllableApi()
    await renderLoadedPage({ api: controllable.api })

    act(() => {
      controllable.emitInsert(makeItem('live-1'))
      controllable.emitInsert(makeItem('live-2'))
      controllable.emitInsert(makeItem('live-3'))
    })

    const banner = await screen.findByTestId('new-activity-banner')
    expect(banner).toHaveTextContent('3 new activity — click to load')
    expect(screen.getByRole('status')).toHaveTextContent(ACTIVITY_COPY.newActivityAnnouncement(3))
  })

  it('disables realtime under window.__E2E__ (frozen kill switch)', async () => {
    const windowWithE2E = window as Window & { __E2E__?: boolean }
    windowWithE2E.__E2E__ = true
    const controllable = createControllableApi()
    await renderLoadedPage({ api: controllable.api })

    expect(controllable.subscribe).not.toHaveBeenCalled()
    expect(screen.queryByTestId('new-activity-banner')).toBeNull()
    delete windowWithE2E.__E2E__
  })

  it('unsubscribes the realtime channel on unmount', async () => {
    const controllable = createControllableApi()
    const view = await renderLoadedPage({ api: controllable.api })
    expect(controllable.subscribe).toHaveBeenCalledTimes(1)

    view.unmount()
    expect(controllable.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('keeps the visible banner keyboard operable (Enter activates)', async () => {
    const user = userEvent.setup()
    const controllable = createControllableApi()
    await renderLoadedPage({ api: controllable.api })

    act(() => controllable.emitInsert(makeItem('live-keyboard', { displayName: 'Keyboard Guest' })))
    const banner = await screen.findByTestId('new-activity-banner')
    banner.focus()
    await user.keyboard('{Enter}')

    await waitFor(() => expect(screen.queryByTestId('new-activity-banner')).toBeNull())
    expect(screen.getAllByTestId('activity-card')[0]).toHaveTextContent('Keyboard Guest')
  })

  it('does not render filter tabs when the feed is empty (frozen early return)', async () => {
    const { api } = createControllableApi([[]])
    await renderActivityPage(<ActivityPage api={api} now={NOW} />)
    await screen.findByText(ACTIVITY_COPY.emptyTitle)
    expect(screen.queryByRole('tabpanel')).toBeNull()
  })

  it('renders no banner and no alert in the default fixture state', async () => {
    const { api } = createControllableApi()
    await renderLoadedPage({ api })
    expect(screen.queryByTestId('new-activity-banner')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByTestId('activity-skeletons')).toBeNull()
  })

  it('wires the injected clock into card timestamps', async () => {
    const { api } = createControllableApi([
      [makeItem('recent', { createdAt: '2026-11-08T12:00:00.000Z' })],
      [],
    ])
    await renderLoadedPage({ api, now: NOW })
    expect(screen.getByText('about 5 hours ago')).toBeInTheDocument()
  })

  it('activates a tab with a click and keeps only that filter selected', async () => {
    const user = userEvent.setup()
    const { api } = createControllableApi()
    await renderLoadedPage({ api })

    await user.click(screen.getByRole('tab', { name: 'Guestbook' }))
    const guestbookTab = screen.getByRole('tab', { name: 'Guestbook' })
    expect(guestbookTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getAllByTestId('activity-card')).toHaveLength(1)
    expect(screen.getByText('Sarah Mitchell')).toBeInTheDocument()

    // Keyboard activation of the roving-tabindex control.
    fireEvent.keyDown(screen.getByRole('tab', { name: 'All' }), { key: 'Home' })
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByTestId('activity-card')).toHaveLength(2)
  })
})
