import { render, screen } from '@testing-library/react'
import type { UseQueryResult } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorialFeature } from '@/shared/data/editorial'
import { useEditorialFeatures } from '@/shared/data/hooks'
import { installFilmTestEnvironment } from './test-utils/testEnvironment'
import { FilmFeatureSlot } from './FilmFeatureSlot'

vi.mock('@/shared/data/hooks', () => ({
  useEditorialFeatures: vi.fn(),
}))

const useEditorialFeaturesMock = vi.mocked(useEditorialFeatures)

function setQuery(overrides: Partial<UseQueryResult<EditorialFeature[]>>): void {
  useEditorialFeaturesMock.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  } as unknown as UseQueryResult<EditorialFeature[]>)
}

function editorialFeature(overrides: Partial<EditorialFeature> = {}): EditorialFeature {
  return {
    id: 'feat-4',
    slot: 'film_featured_guest_video',
    title: 'A dance floor moment',
    summary: 'Straight from a guest phone.',
    trail: null,
    sourceType: 'custom',
    sourceId: null,
    sourceLabel: null,
    sourceUrl: 'https://example.com/watch',
    isActive: true,
    displayOrder: 0,
    metadata: {},
    memoryTrail: null,
    badgeLabel: 'Guest Film Spotlight',
    ctaLabel: 'Watch clip',
    startsAt: null,
    endsAt: null,
    updatedByEmail: null,
    createdAt: '2025-05-15T00:00:00.000Z',
    updatedAt: '2025-05-15T00:00:00.000Z',
    ...overrides,
  }
}

describe('FilmFeatureSlot', () => {
  beforeEach(() => {
    installFilmTestEnvironment()
    vi.clearAllMocks()
  })

  it('renders the loading skeleton while the slot read is in flight', () => {
    setQuery({ isLoading: true })
    const { container } = render(<FilmFeatureSlot />)

    expect(container.querySelector('.animate-pulse')).not.toBeNull()
  })

  it('renders the frozen accessible error banner when the read fails', () => {
    setQuery({ isError: true, error: new Error('slot read failed') })
    render(<FilmFeatureSlot />)

    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent('Content unavailable')
    expect(banner).toHaveTextContent('film_featured_guest_video')
    expect(banner).toHaveTextContent('slot read failed')
  })

  it('renders nothing when the slot is missing or inactive', () => {
    setQuery({ data: [] })
    const { container } = render(<FilmFeatureSlot />)
    expect(container).toBeEmptyDOMElement()

    setQuery({ data: [editorialFeature({ isActive: false })] })
    const inactive = render(<FilmFeatureSlot />)
    expect(inactive.container).toBeEmptyDOMElement()
  })

  it('ignores a row for another slot (mock/API drift guard)', () => {
    setQuery({ data: [editorialFeature({ slot: 'home_moment_of_the_week' })] })
    const { container } = render(<FilmFeatureSlot />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders the spotlight card for the active film slot', () => {
    setQuery({ data: [editorialFeature()] })
    render(<FilmFeatureSlot />)

    expect(screen.getByRole('heading', { name: 'A dance floor moment' })).toBeInTheDocument()
    expect(screen.getByText('Straight from a guest phone.')).toBeInTheDocument()
    expect(screen.getByText('Guest Film Spotlight')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Watch clip/ })).toHaveAttribute(
      'href',
      'https://example.com/watch'
    )
  })
})
