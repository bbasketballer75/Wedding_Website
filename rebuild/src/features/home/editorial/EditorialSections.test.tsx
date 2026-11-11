import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { installMotionStubs } from '../test-helpers'
import { EditorialErrorBanner } from './EditorialErrorBanner'
import { FeaturedNoteSection } from './FeaturedNoteSection'
import { MomentOfTheWeekSection } from './MomentOfTheWeekSection'
import { StandoutUploadSection } from './StandoutUploadSection'

installMotionStubs()

const feature = {
  title: 'The First Dance',
  summary: 'A quiet moment before the lights came on.',
  badge_label: 'Moment of the Week',
  cta_label: 'See the photo',
  source_url: null,
}

describe('EditorialErrorBanner', () => {
  it('renders nothing without an error message', () => {
    const { container } = render(<EditorialErrorBanner slot='x' errorMessage={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the frozen error copy with the slot name', () => {
    render(<EditorialErrorBanner slot='home_moment_of_the_week' errorMessage='boom' />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Content unavailable')
    expect(status).toHaveTextContent('home_moment_of_the_week')
    expect(status).toHaveTextContent('VITE_SUPABASE_URL')
  })
})

describe('MomentOfTheWeekSection', () => {
  it('renders nothing while empty', () => {
    const { container } = render(
      <MomentOfTheWeekSection feature={null} loading={false} error={null} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the frozen loading skeleton', () => {
    const { container } = render(
      <MomentOfTheWeekSection feature={null} loading={true} error={null} />
    )
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
  })

  it('renders the frozen error banner', () => {
    render(<MomentOfTheWeekSection feature={null} loading={false} error='boom' />)
    expect(screen.getByTestId('editorial-error-home_moment_of_the_week')).toBeInTheDocument()
  })

  it('renders the active feature with badge, title and summary', () => {
    render(<MomentOfTheWeekSection feature={feature} loading={false} error={null} />)

    expect(screen.getByText('Moment of the Week')).toHaveClass('text-gold-600')
    expect(screen.getByRole('heading', { name: 'The First Dance' })).toBeInTheDocument()
    expect(screen.getByText('A quiet moment before the lights came on.')).toBeInTheDocument()
    // No source URL -> no CTA anchor.
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders the frozen CTA fallback and link when a source URL exists', () => {
    render(
      <MomentOfTheWeekSection
        feature={{ ...feature, cta_label: null, source_url: 'https://example.com/moment' }}
        loading={false}
        error={null}
      />
    )

    const link = screen.getByRole('link', { name: /Explore this moment/ })
    expect(link).toHaveAttribute('href', 'https://example.com/moment')
    expect(link).toHaveAttribute('target', '_blank')
  })
})

describe('StandoutUploadSection', () => {
  it('renders nothing while empty or loading', () => {
    const { container, rerender } = render(
      <StandoutUploadSection feature={null} loading={false} error={null} />
    )
    expect(container.firstChild).toBeNull()

    rerender(<StandoutUploadSection feature={null} loading={true} error={null} />)
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
  })

  it('renders the frozen error banner', () => {
    render(<StandoutUploadSection feature={null} loading={false} error='boom' />)
    expect(screen.getByTestId('editorial-error-home_newest_standout_upload')).toBeInTheDocument()
  })

  it('renders the active feature and frozen CTA fallback', () => {
    render(
      <StandoutUploadSection
        feature={{ ...feature, badge_label: null, cta_label: null, source_url: 'https://x.test/p' }}
        loading={false}
        error={null}
      />
    )

    expect(screen.getByText('Guest Spotlight')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'The First Dance' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View in gallery/ })).toHaveAttribute(
      'href',
      'https://x.test/p'
    )
  })
})

describe('FeaturedNoteSection', () => {
  it('renders nothing while empty', () => {
    const { container } = render(
      <FeaturedNoteSection feature={null} loading={false} error={null} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the frozen loading skeleton', () => {
    const { container } = render(<FeaturedNoteSection feature={null} loading={true} error={null} />)
    expect(container.querySelectorAll('.skeleton-light')).toHaveLength(4)
  })

  it('renders the frozen error banner', () => {
    render(<FeaturedNoteSection feature={null} loading={false} error='boom' />)
    expect(screen.getByTestId('editorial-error-home_featured_guestbook_note')).toBeInTheDocument()
  })

  it('renders the quote, attribution and frozen ghost CTA', () => {
    render(
      <FeaturedNoteSection
        feature={{ ...feature, cta_label: null, source_url: 'https://x.test/note' }}
        loading={false}
        error={null}
      />
    )

    expect(screen.getByText('“')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('A quiet moment before the lights came on.')).toBeInTheDocument()
    expect(screen.getByText(/—\s*The First Dance/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Read in guestbook/ })).toHaveAttribute(
      'href',
      'https://x.test/note'
    )
  })
})
