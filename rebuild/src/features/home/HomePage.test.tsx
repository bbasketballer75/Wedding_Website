import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { installMotionStubs, renderHomeUi } from './test-helpers'
import { HomePage } from './HomePage'

installMotionStubs()

describe('HomePage', () => {
  it('sets the frozen Home metadata', async () => {
    await renderHomeUi(<HomePage />)

    expect(document.title).toBe("Home | Austin & Jordyn's Wedding")
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'Join us in celebrating the wedding of Austin and Jordyn. View our story, photos, and share your memories.'
    )
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'index, follow'
    )
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://www.theporadas.com/'
    )
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(
      'https://www.theporadas.com/images/home/intro-video-poster.png'
    )
  })

  it('renders nav, hero, act break, countdown, timeline and dividers in frozen order', async () => {
    const { container } = await renderHomeUi(<HomePage />)

    expect(screen.getByTestId('home-nav')).toBeInTheDocument()
    expect(screen.getByTestId('home-hero')).toBeInTheDocument()

    expect(screen.getByText('Austin and Jordyn Porada')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Wedding film, photographs, guest memories, and the story we built with everyone who celebrated with us.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enter archive' })).toBeInTheDocument()

    expect(screen.getByText('Our Story')).toBeInTheDocument()
    expect(screen.getByText('May 10, 2025 · Shared with love')).toBeInTheDocument()
    expect(document.getElementById('welcome-panel')).toContainElement(screen.getByText('married'))

    expect(
      screen.getByRole('heading', { level: 2, name: 'The Journey to I Do' })
    ).toBeInTheDocument()
    // 9 timeline milestones + the closing film CTA heading.
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(10)

    // Five ElegantDividers separate the frozen sections (frozen Home order).
    expect(container.querySelectorAll('.text-gold-500.my-8')).toHaveLength(5)
  })

  it('renders the hero action links', async () => {
    await renderHomeUi(<HomePage />)

    const hero = screen.getByTestId('home-hero')
    expect(within(hero).getByRole('link', { name: 'Film' })).toHaveAttribute('href', '/film')
    expect(within(hero).getByRole('link', { name: 'Gallery' })).toHaveAttribute('href', '/gallery')
  })

  it('scrolls to the welcome panel from the hero CTA', async () => {
    const user = userEvent.setup()
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView')
    await renderHomeUi(<HomePage />)

    await user.click(screen.getByRole('button', { name: 'Enter archive' }))

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('hides the data-driven sections while the content hook has no data', async () => {
    await renderHomeUi(<HomePage />)

    expect(screen.queryByText('You were there with us')).not.toBeInTheDocument()
    expect(screen.queryByText('Content unavailable')).not.toBeInTheDocument()
    expect(screen.queryByText('Moment of the Week')).not.toBeInTheDocument()
  })
})
