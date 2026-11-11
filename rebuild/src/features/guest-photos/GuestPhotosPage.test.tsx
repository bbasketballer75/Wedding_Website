import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GUEST_PHOTOS_COPY } from './constants'
import { createStubGuestPhotosApi } from './data'
import { createMixedStatusFixture } from './fixtures'
import { GuestPhotosPage } from './GuestPhotosPage'
import { installGuestPhotosMocks, renderGuestPhotosPage } from './test-utils'
import type { GuestPhotosApi } from './types'

installGuestPhotosMocks()

function createApi(overrides: Partial<GuestPhotosApi> = {}): GuestPhotosApi {
  return { ...createStubGuestPhotosApi(), ...overrides }
}

async function renderLoadedPage(api?: GuestPhotosApi) {
  const result = await renderGuestPhotosPage(
    <GuestPhotosPage {...(api === undefined ? {} : { api })} />
  )
  await screen.findByText('Jamie Rivera')
  return result
}

function classTokensOf(element: Element | null): string[] {
  return element ? (element.getAttribute('class') ?? '').split(/\s+/) : []
}

describe('GuestPhotosPage', () => {
  it('renders the frozen copy, stats, featured thumbs, upload cards and metadata', async () => {
    const { container } = await renderLoadedPage()

    expect(
      screen.getByRole('heading', { level: 1, name: GUEST_PHOTOS_COPY.title })
    ).toBeInTheDocument()
    expect(screen.getByText(GUEST_PHOTOS_COPY.eyebrow)).toBeInTheDocument()
    expect(screen.getByText(GUEST_PHOTOS_COPY.description)).toBeInTheDocument()

    // Stats: 2 approved uploads / 4 guest photos (rendered upper-case by CSS).
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('Approved uploads')).toBeInTheDocument()
    expect(screen.getByText('Guest photos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Share yours' })).toHaveAttribute('href', '/upload')

    // Featured thumbnails: first 6 photos of the approved uploads (4 here).
    const featured = screen.getAllByTestId('guest-photo-featured')
    expect(featured).toHaveLength(4)
    expect(featured[0]).toHaveAttribute('alt', 'Guest photo shared by Jamie Rivera')
    expect(featured[0]).toHaveAttribute('src', '/images/engagement/PoradaProposal-29.webp')
    expect(featured[3]).toHaveAttribute('alt', 'Guest photo shared by Morgan Lee')

    // Cards: name h2, date (CSS-uppercased in the oracle), photo count, message.
    expect(screen.getAllByTestId('guest-photo-card')).toHaveLength(2)
    expect(screen.getByRole('heading', { level: 2, name: 'Jamie Rivera' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Morgan Lee' })).toBeInTheDocument()
    expect(screen.getAllByText('May 11, 2025')).toHaveLength(2)
    expect(screen.getByText('3 photos')).toBeInTheDocument()
    expect(screen.getByText('1 photo')).toBeInTheDocument()
    expect(screen.getByText('So glad we were there — what a beautiful day!')).toBeInTheDocument()
    expect(screen.getByText('Caught some candid moments from our table.')).toBeInTheDocument()

    // Metadata oracle: title/robots/canonical from contracts/content/rendered/guest-photos.json.
    await waitFor(() => expect(document.title).toBe("Guest Photos | Austin & Jordyn's Wedding"))
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'index, follow'
    )
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://www.theporadas.com/guest-photos'
    )

    // Responsive layout tokens the frozen DOM uses (desktop/mobile grid matrix).
    const featuredGrid = featured[0]?.parentElement ?? null
    expect(classTokensOf(featuredGrid)).toEqual(
      expect.arrayContaining(['grid-cols-3', 'sm:grid-cols-6'])
    )
    const cardsGrid = container.querySelector('[data-testid="guest-photos-list"] .grid')
    expect(classTokensOf(cardsGrid)).toEqual(
      expect.arrayContaining(['sm:grid-cols-2', 'lg:grid-cols-3'])
    )
    expect(classTokensOf(container.firstElementChild)).toEqual(
      expect.arrayContaining(['archive-noise', 'pt-28', 'sm:pt-32'])
    )
  })

  it('renders approved uploads only, even when the source returns mixed statuses', async () => {
    await renderLoadedPage(
      createApi({ loadApprovedUploads: () => Promise.resolve(createMixedStatusFixture()) })
    )

    expect(screen.getAllByTestId('guest-photo-card')).toHaveLength(2)
    expect(screen.queryByText('Riley Thompson')).toBeNull()
    expect(screen.queryByText('Sam Garcia')).toBeNull()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('renders the frozen empty state when there are no approved uploads', async () => {
    const { container } = await renderGuestPhotosPage(
      <GuestPhotosPage api={createApi({ loadApprovedUploads: () => Promise.resolve([]) })} />
    )

    expect(
      await screen.findByRole('heading', { level: 2, name: GUEST_PHOTOS_COPY.emptyTitle })
    ).toBeInTheDocument()
    expect(screen.getByText(GUEST_PHOTOS_COPY.emptyBody)).toBeInTheDocument()
    expect(screen.queryAllByTestId('guest-photo-card')).toHaveLength(0)
    expect(screen.queryAllByTestId('guest-photo-featured')).toHaveLength(0)
    expect(container.firstElementChild).not.toBeNull()
  })

  it('renders the frozen error state when the source rejects', async () => {
    await renderGuestPhotosPage(
      <GuestPhotosPage
        api={createApi({
          loadApprovedUploads: () => Promise.reject(new Error('network down')),
        })}
      />
    )

    expect(
      await screen.findByRole('heading', { level: 2, name: GUEST_PHOTOS_COPY.errorTitle })
    ).toBeInTheDocument()
    expect(screen.getByText(GUEST_PHOTOS_COPY.errorBody)).toBeInTheDocument()
    expect(screen.queryAllByTestId('guest-photo-card')).toHaveLength(0)
  })

  it('renders the loading skeleton (role=status) while the source is pending', async () => {
    let resolveUploads: ((value: GuestPhotosApi extends never ? never : never) => void) | null =
      null
    const pending = new Promise<never>(() => {
      // Intentionally never settles: the skeleton is the assertion target.
      resolveUploads = () => undefined
    })
    void resolveUploads

    await renderGuestPhotosPage(
      <GuestPhotosPage api={createApi({ loadApprovedUploads: () => pending })} />
    )

    const status = screen.getByRole('status', { name: GUEST_PHOTOS_COPY.loadingLabel })
    expect(status).toBeInTheDocument()
    expect(screen.getByText(GUEST_PHOTOS_COPY.loadingSrText)).toBeInTheDocument()
    expect(screen.queryAllByTestId('guest-photo-card')).toHaveLength(0)
  })
})
