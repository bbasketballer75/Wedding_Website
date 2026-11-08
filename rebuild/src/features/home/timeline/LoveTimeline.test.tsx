import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { installMotionStubs, renderHomeUi } from '../test-helpers'
import { LoveTimeline } from './LoveTimeline'

installMotionStubs()

describe('LoveTimeline', () => {
  it('renders the frozen header and all nine milestones', async () => {
    await renderHomeUi(<LoveTimeline />)

    expect(screen.getByText('Our Love Story')).toHaveClass('tracking-[0.4em]')
    expect(
      screen.getByRole('heading', { level: 2, name: 'The Journey to I Do' })
    ).toBeInTheDocument()
    expect(screen.getByText(/From a summer job to forever/)).toBeInTheDocument()

    // 9 milestones + the closing film CTA card are all level-3 headings.
    const milestoneTitles = screen.getAllByRole('heading', { level: 3 })
    expect(milestoneTitles).toHaveLength(10)

    expect(screen.getByRole('heading', { level: 3, name: 'The Meeting' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'First Date' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Moved to Ligonier' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'Bought Our First Home' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: 'The Kitties Arrive' })
    ).toBeInTheDocument()
    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .some(heading => heading.textContent?.includes('The Proposal'))
    ).toBe(true)
    expect(
      screen.getByRole('heading', { level: 3, name: 'Bachelor & Bachelorette' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: "Jordyn's Bridal Shower" })
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'We Got Married!' })).toBeInTheDocument()
  })

  it('renders the frozen Halloween proposal card copy', async () => {
    await renderHomeUi(<LoveTimeline />)

    expect(screen.getByText('She said yes, and the whole party tipped into forever.')).toBeVisible()
    expect(
      screen.getByText(/Halloween night • costumes on • forever got weird in the best way/)
    ).toBeInTheDocument()
    expect(screen.getByText('1 / 8')).toBeInTheDocument()
  })

  it('renders the frozen carousel counters and media labels', async () => {
    await renderHomeUi(<LoveTimeline />)

    expect(screen.getByText('1 / 4')).toBeInTheDocument()
    expect(screen.getByText('1 / 6')).toBeInTheDocument()
    expect(screen.getAllByText('Where it all began')).toHaveLength(1)
    expect(screen.getAllByText('Love sparked')).toHaveLength(1)
    expect(screen.getAllByText('Forever begins')).toHaveLength(1)
    expect(screen.getAllByText('Ligonier, PA')).toHaveLength(2)
    expect(screen.getByText('Our First Home')).toBeInTheDocument()
  })

  it('expands and collapses long milestone descriptions', async () => {
    const user = userEvent.setup()
    await renderHomeUi(<LoveTimeline />)

    const [readMore] = screen.getAllByRole('button', { name: 'Read more' })
    expect(readMore).toBeDefined()
    await user.click(readMore!)

    expect(screen.getByRole('button', { name: 'Read less' })).toBeInTheDocument()
    expect(screen.getByText(/something bigger was beginning\./)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Read less' }))
    expect(screen.queryByText(/something bigger was beginning\./)).not.toBeInTheDocument()
  })

  it('renders the frozen film CTA', async () => {
    await renderHomeUi(<LoveTimeline />)

    expect(screen.getByText('The whole night, start to finish.')).toBeInTheDocument()
    expect(
      screen.getByText('Ceremony, vows, speeches, first dance — and everything in between.')
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Watch the Film' })).toHaveAttribute('href', '/film')
  })

  it('shows the frozen resume label when film progress is saved', async () => {
    window.localStorage.setItem('video-progress-main-film', '125.4')
    await renderHomeUi(<LoveTimeline />)

    expect(screen.getByRole('link', { name: 'Resume at 2:05' })).toHaveAttribute(
      'href',
      '/film?resume=1'
    )
  })
})
