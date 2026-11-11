import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { installMotionStubs, renderHomeUi } from '../test-helpers'
import { GuestHighlightReel } from './GuestHighlightReel'

installMotionStubs()

const photos = [
  { id: 'photo-1', url: '/media/guest/one.jpg', caption: 'First dance' },
  { id: 'photo-2', url: '/media/guest/two.jpg', thumbnail: '/media/guest/two-thumb.jpg' },
]

const quotes = [
  { id: 'quote-1', content: 'Your vows made the whole room disappear.', name: 'Sarah Mitchell' },
  { id: 'quote-2', content: 'Best night of the year.', name: 'The Millers' },
]

describe('GuestHighlightReel', () => {
  it('hides itself while loading', async () => {
    await renderHomeUi(<GuestHighlightReel photos={[]} quotes={[]} loading />)

    expect(screen.queryByText('You were there with us')).not.toBeInTheDocument()
  })

  it('hides itself when there is no data (frozen empty state)', async () => {
    await renderHomeUi(<GuestHighlightReel photos={[]} quotes={[]} loading={false} />)

    expect(screen.queryByText('You were there with us')).not.toBeInTheDocument()
  })

  it('renders the photo grid, counter and gallery link when photos exist', async () => {
    await renderHomeUi(<GuestHighlightReel photos={photos} quotes={[]} loading={false} />)

    expect(screen.getByText('Memories from our guests')).toBeInTheDocument()
    expect(screen.getByText('You were there with us')).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByText('View the full gallery →')).toHaveAttribute('href', '/gallery')
    // Mobile single image + two desktop grid images.
    expect(document.querySelectorAll('img')).toHaveLength(3)
    expect(screen.getAllByAltText('First dance')).toHaveLength(2)
  })

  it('moves between photos with the frozen mobile controls', async () => {
    const user = userEvent.setup()
    await renderHomeUi(<GuestHighlightReel photos={photos} quotes={[]} loading={false} />)

    await user.click(screen.getByRole('button', { name: 'Next photo' }))
    expect(screen.getByText('2 / 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous photo' }))
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('renders the rotating quote, attribution and guestbook link', async () => {
    await renderHomeUi(<GuestHighlightReel photos={[]} quotes={[quotes[0]!]} loading={false} />)

    expect(screen.getByText(/Your vows made the whole room disappear/)).toBeInTheDocument()
    expect(screen.getByText('— Sarah Mitchell')).toBeInTheDocument()
    expect(screen.getByText('Read the guestbook')).toHaveAttribute('href', '/guestbook')
    // Single quote: no dot controls.
    expect(screen.queryByRole('button', { name: 'View quote 1' })).not.toBeInTheDocument()
  })

  it('switches quotes through the frozen dot controls', async () => {
    const user = userEvent.setup()
    await renderHomeUi(<GuestHighlightReel photos={[]} quotes={quotes} loading={false} />)

    expect(screen.getByText(/Your vows made the whole room disappear/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'View quote 2' }))
    expect(await screen.findByText(/Best night of the year/)).toBeInTheDocument()
    expect(screen.getByText('— The Millers')).toBeInTheDocument()
  })
})
