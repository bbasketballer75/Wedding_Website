import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShareModal } from './ShareModal'

const writeText = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  writeText.mockClear()
  Reflect.deleteProperty(navigator, 'share')
})

function Harness({ url = 'https://example.com/wedding' }: { url?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type='button' onClick={() => setOpen(true)}>
        open share
      </button>
      <ShareModal isOpen={open} onClose={() => setOpen(false)} url={url} />
    </>
  )
}

describe('ShareModal', () => {
  it('renders the frozen dialog copy and preview', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'open share' }))

    const dialog = screen.getByRole('dialog', { name: /Share/ })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Spread the love!')).toBeInTheDocument()
    expect(screen.getByText("Austin & Jordyn's Wedding")).toBeInTheDocument()
    expect(screen.getByText('https://example.com/wedding')).toBeInTheDocument()
  })

  it('copies the link and flips the Copy Link state', async () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'open share' }))
    const copy = await screen.findByRole('button', { name: 'Share via Copy Link' })
    fireEvent.click(copy)

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://example.com/wedding'))
    await waitFor(() => expect(copy.querySelector('svg')).toHaveClass('text-green-600'))
  })

  it('opens the frozen Facebook and Twitter sharer windows', async () => {
    const user = userEvent.setup()
    const openWindow = vi.spyOn(window, 'open').mockImplementation(() => null)
    const title = "Austin & Jordyn's Wedding"
    const description = 'Celebrate with us!'
    const url = 'https://example.com/wedding?from=guest'
    render(
      <ShareModal isOpen onClose={vi.fn()} title={title} description={description} url={url} />
    )
    await screen.findByRole('dialog')

    await user.click(screen.getByRole('button', { name: 'Share via Facebook' }))
    await user.click(screen.getByRole('button', { name: 'Share via Twitter' }))

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

  it('renders the injected image preview', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ShareModal
        isOpen
        onClose={vi.fn()}
        title='T'
        description='D'
        url='https://x.test'
        imageUrl='/images/preview.webp'
      />
    )
    await screen.findByRole('dialog')
    expect(container.ownerDocument.querySelector('img')).toHaveAttribute(
      'src',
      '/images/preview.webp'
    )
    expect(user).toBeTruthy()
  })

  it('offers the frozen native share button when navigator.share exists', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'open share' }))

    await user.click(screen.getByRole('button', { name: /More Options/ }))
    expect(share).toHaveBeenCalledWith({
      title: "Austin & Jordyn's Wedding",
      text: 'Watch our wedding film and browse photos from our special day!',
      url: 'https://example.com/wedding',
    })
  })

  it('closes on Esc, backdrop click and the close button, restoring focus', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const trigger = screen.getByRole('button', { name: 'open share' })
    trigger.focus()
    await user.click(trigger)
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Close share dialog' }))
    await waitFor(() => expect(trigger).toHaveFocus(), { timeout: 3000 })

    await user.click(trigger)
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(dialog.parentElement as HTMLElement)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(trigger)
    await screen.findByRole('dialog')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('traps focus inside the dialog', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'open share' }))

    const dialog = screen.getByRole('dialog')
    const close = screen.getByRole('button', { name: 'Close share dialog' })
    expect(close).toHaveFocus()
    expect(dialog.contains(document.activeElement)).toBe(true)
  })
})
