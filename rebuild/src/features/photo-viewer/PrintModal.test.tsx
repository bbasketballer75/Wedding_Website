import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PrintModal } from './PrintModal'

const writeText = vi.fn().mockResolvedValue(undefined)
const photoUrl = '/images/engagement/PoradaProposal-29.webp'

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  writeText.mockClear()
})

function Harness({ onCloseSpy }: { onCloseSpy?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type='button' onClick={() => setOpen(true)}>
        open print
      </button>
      <PrintModal
        isOpen={open}
        onClose={() => {
          onCloseSpy?.()
          setOpen(false)
        }}
        photoUrl={photoUrl}
      />
    </>
  )
}

describe('PrintModal', () => {
  it('renders the frozen dialog, provider cards and preview', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'open print' }))

    const dialog = screen.getByRole('dialog', { name: /Order Prints/ })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(
      screen.getByText('Transform digital wedding memories into physical keepsakes')
    ).toBeInTheDocument()
    expect(screen.getByAltText('Selected print preview')).toHaveAttribute('src', photoUrl)
    expect(screen.getByRole('button', { name: /Artifact Uprising/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Shutterfly/ })).toBeInTheDocument()
    expect(screen.getByText(/How it works:/)).toBeInTheDocument()
  })

  it('copies the photo URL then opens the vendor after the frozen delay', async () => {
    vi.useFakeTimers()
    const openWindow = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<PrintModal isOpen onClose={vi.fn()} photoUrl={photoUrl} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Artifact Uprising/ }))
      await Promise.resolve()
    })
    expect(writeText).toHaveBeenCalledWith(photoUrl)
    expect(screen.getByText('Direct high-res image link copied!')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(800)
    })
    expect(openWindow).toHaveBeenCalledWith(
      'https://www.artifactuprising.com/',
      '_blank',
      'noopener,noreferrer'
    )

    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.queryByText('Direct high-res image link copied!')).not.toBeInTheDocument()
    expect(screen.getByText(/How it works:/)).toBeInTheDocument()
  })

  it('stays usable without the Clipboard API (guarded copy)', async () => {
    Reflect.deleteProperty(navigator, 'clipboard')
    render(<PrintModal isOpen onClose={vi.fn()} photoUrl={photoUrl} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Shutterfly/ }))
      await Promise.resolve()
    })

    expect(screen.getByText('Direct high-res image link copied!')).toBeInTheDocument()
  })

  it('closes via the close button and restores focus', async () => {
    const user = userEvent.setup()
    const onCloseSpy = vi.fn()
    render(<Harness onCloseSpy={onCloseSpy} />)

    const trigger = screen.getByRole('button', { name: 'open print' })
    trigger.focus()
    await user.click(trigger)
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Close print dialog' }))

    expect(onCloseSpy).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(trigger).toHaveFocus(), { timeout: 3000 })
  })

  it('closes on a backdrop click', () => {
    const onClose = vi.fn()
    render(<PrintModal isOpen onClose={onClose} photoUrl={photoUrl} />)

    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<PrintModal isOpen onClose={onClose} photoUrl={photoUrl} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('traps focus on open and wraps Tab', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'open print' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)

    const buttons = Array.from(dialog.querySelectorAll('button'))
    const first = buttons[0] as HTMLButtonElement
    const last = buttons[buttons.length - 1] as HTMLButtonElement
    last.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(first).toHaveFocus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
  })
})
