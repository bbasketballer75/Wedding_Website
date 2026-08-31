import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShareModal } from './ShareModal'

describe('ShareModal', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps Facebook and X share actions available without Lucide brand exports', () => {
    const title = "Austin & Jordyn's Wedding"
    const description = 'Celebrate with us!'
    const url = 'https://example.com/wedding?from=guest'
    const openWindow = vi.spyOn(window, 'open').mockImplementation(() => null)

    render(
      <ShareModal isOpen onClose={vi.fn()} title={title} description={description} url={url} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Share via Facebook' }))
    fireEvent.click(screen.getByRole('button', { name: 'Share via Twitter' }))

    expect(openWindow).toHaveBeenNthCalledWith(
      1,
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      '_blank',
      'width=600,height=400'
    )
    expect(openWindow).toHaveBeenNthCalledWith(
      2,
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${title} 💍 ${description}`)}&url=${encodeURIComponent(url)}`,
      '_blank',
      'width=600,height=400'
    )
  })
})
