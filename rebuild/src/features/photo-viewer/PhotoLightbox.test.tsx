import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PhotoLightbox } from './PhotoLightbox'
import type { PhotoLightboxProps, ViewerPhoto } from './types'
import { getFocusableElements } from './useFocusTrap'

const faces = [
  { id: 'face-1', name: 'Austin Porada', x: 38, y: 42 },
  { id: 'face-2', name: 'Jordyn Porada', x: 62, y: 40 },
]

function makePhoto(index: number, overrides: Partial<ViewerPhoto> = {}): ViewerPhoto {
  return {
    id: `photo-${index}`,
    url: `/images/photo-${index}.webp`,
    caption: `Caption ${index}`,
    likes: index * 10,
    comments: [],
    faces: [],
    date: '2025-05-10T14:00:00Z',
    ...overrides,
  }
}

const photos: ViewerPhoto[] = [
  makePhoto(1, {
    likeCount: 24,
    faces,
    exif: {
      camera: 'Canon EOS R5',
      lens: 'RF 50mm F1.2',
      aperture: 'f/1.8',
      shutterSpeed: '1/250s',
      iso: 'ISO 100',
    },
  }),
  makePhoto(2),
  makePhoto(3, { likes: 3, liked: true }),
]

function Harness({
  initialOpen = true,
  photos: harnessPhotos = photos,
  onCloseSpy,
  ...props
}: Partial<PhotoLightboxProps> & {
  initialOpen?: boolean
  photos?: ViewerPhoto[]
  onCloseSpy?: () => void
}) {
  const [open, setOpen] = useState(initialOpen)
  const close = () => {
    onCloseSpy?.()
    setOpen(false)
  }
  return (
    <div>
      <button type='button' onClick={() => setOpen(true)}>
        open lightbox
      </button>
      <PhotoLightbox isOpen={open} photos={harnessPhotos} {...props} onClose={close} />
    </div>
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.style.overflow = ''
})

describe('PhotoLightbox', () => {
  it('renders the frozen portal dialog, counter, caption and image', () => {
    render(<Harness />)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'lightbox-title')
    expect(screen.getByText('Photo viewer — Caption 1')).toHaveClass('sr-only')
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Caption 1' })).toHaveAttribute(
      'src',
      '/images/photo-1.webp'
    )
    // Caption appears in the slide-up overlay and the Details panel.
    expect(screen.getAllByText('Caption 1').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('24')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Like photo' })).toBeInTheDocument()
  })

  it('renders nothing when there are no photos (frozen behavior)', () => {
    const { container } = render(<PhotoLightbox isOpen photos={[]} onClose={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens on initialIndex and navigates with bounds', async () => {
    const user = userEvent.setup()
    render(<Harness initialIndex={2} />)

    expect(screen.getByText('3 / 3')).toBeInTheDocument()
    const next = screen.getByRole('button', { name: 'Next photo' })
    expect(next).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Previous photo' }))
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Previous photo' }))
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous photo' })).toBeDisabled()

    fireEvent.keyDown(document, { key: 'ArrowLeft' })
    expect(screen.getByText('1 / 3')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('calls onClose from Esc, the close button and the backdrop', async () => {
    const user = userEvent.setup()
    const onCloseSpy = vi.fn()
    render(<Harness onCloseSpy={onCloseSpy} />)
    const reopen = async () => {
      await user.click(screen.getByRole('button', { name: 'open lightbox' }))
      await screen.findByRole('dialog')
    }

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(onCloseSpy).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await reopen()
    await user.click(screen.getByRole('button', { name: 'Close photo viewer' }))
    await waitFor(() => expect(onCloseSpy).toHaveBeenCalledTimes(2))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await reopen()
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    await waitFor(() => expect(onCloseSpy).toHaveBeenCalledTimes(3))
  })

  it('restores focus to the trigger when the viewer closes', async () => {
    const user = userEvent.setup()
    render(<Harness initialOpen={false} />)

    const trigger = screen.getByRole('button', { name: 'open lightbox' })
    trigger.focus()
    await user.click(trigger)
    await screen.findByRole('dialog')

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(trigger).toHaveFocus(), { timeout: 3000 })
  })

  it('traps Tab focus inside the dialog', () => {
    render(<Harness />)
    const dialog = screen.getByRole('dialog')
    const focusable = getFocusableElements(dialog)
    expect(focusable.length).toBeGreaterThan(3)

    const first = focusable[0] as HTMLElement
    const last = focusable[focusable.length - 1] as HTMLElement

    last.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(first).toHaveFocus()

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
  })

  it('clamps button zoom to 1–3×', () => {
    render(<Harness />)
    const image = screen.getByTestId('lightbox-image')

    for (let i = 0; i < 8; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    }
    expect(image).toHaveAttribute('data-zoom', '3')

    for (let i = 0; i < 8; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    }
    expect(image).toHaveAttribute('data-zoom', '1')
  })

  it('toggles 1× ↔ 2× on double-tap', () => {
    render(<Harness />)
    const image = screen.getByTestId('lightbox-image')
    const img = screen.getByRole('img', { name: 'Caption 1' })

    fireEvent.click(img, { clientX: 100, clientY: 100 })
    fireEvent.click(img, { clientX: 104, clientY: 103 })
    expect(image).toHaveAttribute('data-zoom', '2')

    fireEvent.click(img, { clientX: 100, clientY: 100 })
    fireEvent.click(img, { clientX: 101, clientY: 101 })
    expect(image).toHaveAttribute('data-zoom', '1')
  })

  it('pinch-zooms the image within the same clamp', () => {
    render(<Harness />)
    const content = screen.getByTestId('lightbox-content')
    const image = screen.getByTestId('lightbox-image')

    fireEvent.touchStart(content, {
      touches: [
        { clientX: 0, clientY: 0 },
        { clientX: 100, clientY: 0 },
      ],
    })
    fireEvent.touchMove(content, {
      touches: [
        { clientX: 0, clientY: 0 },
        { clientX: 200, clientY: 0 },
      ],
    })
    expect(image).toHaveAttribute('data-zoom', '2')
    fireEvent.touchEnd(content)
  })

  it('calls the injected like handler from the button and the "l" shortcut', async () => {
    const user = userEvent.setup()
    const onToggleLike = vi.fn()
    render(<Harness engagement={{ onToggleLike }} />)

    await user.click(screen.getByRole('button', { name: 'Like photo' }))
    expect(onToggleLike).toHaveBeenCalledWith('photo-1')

    fireEvent.keyDown(document, { key: 'l' })
    expect(onToggleLike).toHaveBeenCalledTimes(2)
  })

  it('renders the liked state and its count', () => {
    render(<Harness initialIndex={2} />)

    const unlike = screen.getByRole('button', { name: 'Unlike photo' })
    expect(unlike).toHaveClass('bg-rose-500')
    expect(within(unlike).getByText('3')).toBeInTheDocument()
  })

  it('triggers download and shows the frozen spinner while downloading', () => {
    const onDownload = vi.fn()
    const { rerender } = render(<Harness onDownload={onDownload} />)
    fireEvent.click(screen.getByRole('button', { name: 'Download photo' }))
    expect(onDownload).toHaveBeenCalledWith('photo-1')

    rerender(<Harness onDownload={onDownload} isDownloading />)
    const download = screen.getByRole('button', { name: 'Download photo' })
    expect(download).toBeDisabled()
    expect(download.querySelector('.animate-spin')).not.toBeNull()
  })

  it('opens the share modal, writes ?shared= and calls the share handler', async () => {
    const user = userEvent.setup()
    const onShare = vi.fn()
    const pushState = vi.spyOn(window.history, 'pushState')
    render(<Harness onShare={onShare} />)

    await user.click(screen.getByRole('button', { name: 'Share photo' }))
    expect(onShare).toHaveBeenCalledWith('photo-1')
    expect(pushState).toHaveBeenCalledWith(null, '', expect.stringContaining('shared=photo-1'))

    expect(screen.getByRole('dialog', { name: /Share/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close share dialog' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /Share/ })).not.toBeInTheDocument()
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Share photo' })).toHaveFocus())
  })

  it('opens and closes the print modal', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Order physical prints' }))
    expect(screen.getByRole('dialog', { name: /Order Prints/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close print dialog' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /Order Prints/ })).not.toBeInTheDocument()
    )
  })

  it('renders the details tab with faces, date and injected EXIF', () => {
    render(<Harness />)

    expect(screen.getByRole('button', { name: 'Details' })).toHaveClass('text-gold-400')
    expect(screen.getByText('People in this photo')).toBeInTheDocument()
    expect(screen.getByText('Austin Porada')).toBeInTheDocument()
    expect(screen.getByText('Saturday, May 10')).toBeInTheDocument()
    expect(screen.getByText('Canon EOS R5')).toBeInTheDocument()
    expect(screen.getByText('RF 50mm F1.2')).toBeInTheDocument()
    expect(screen.getByText('f/1.8')).toBeInTheDocument()
    expect(screen.getByText('1/250s')).toBeInTheDocument()
    expect(screen.getByText('ISO 100')).toBeInTheDocument()
  })

  it('shows the frozen "No metadata available" fallback and hides the panel', async () => {
    const user = userEvent.setup()
    render(<Harness initialIndex={1} />)

    expect(screen.getByText('No metadata available')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hide photo details' }))
    await waitFor(() => expect(screen.queryByText('No metadata available')).not.toBeInTheDocument())
  })

  it('filters hidden comments and persists the comment author on submit', async () => {
    const user = userEvent.setup()
    const onSubmitComment = vi.fn().mockResolvedValue(true)
    window.localStorage.setItem('wedding-gallery-comment-author', 'Alice')
    render(
      <Harness
        engagement={{ onSubmitComment }}
        photos={[
          makePhoto(1, {
            commentCount: 2,
            comments: [
              { id: 'c1', author: 'Alice', content: 'Beautiful', timestamp: 'May 10, 2:31 PM' },
              {
                id: 'c2',
                author: 'Spammer',
                content: 'Hidden spam',
                timestamp: 'May 10, 3:00 PM',
                is_hidden: true,
              },
            ],
          }),
        ]}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Comments (2)' }))
    expect(screen.getByText('Beautiful')).toBeInTheDocument()
    expect(screen.queryByText('Hidden spam')).not.toBeInTheDocument()

    const author = screen.getByPlaceholderText('Your name')
    const comment = screen.getByPlaceholderText('Add a comment...')
    expect(author).toHaveValue('Alice')

    await user.clear(author)
    await user.type(author, '  Bob  ')
    await user.type(comment, 'Congratulations!')
    const form = author.closest('form') as HTMLFormElement
    const submit = form.querySelector('button[type="submit"]') as HTMLButtonElement
    await user.click(submit)

    await waitFor(() =>
      expect(onSubmitComment).toHaveBeenCalledWith('photo-1', {
        author: '  Bob  ',
        content: 'Congratulations!',
      })
    )
    expect(window.localStorage.getItem('wedding-gallery-comment-author')).toBe('Bob')
    expect(comment).toHaveValue('')
  })

  it('keeps the comment text when the submit handler reports failure', async () => {
    const user = userEvent.setup()
    const onSubmitComment = vi.fn().mockResolvedValue(false)
    render(<Harness engagement={{ onSubmitComment }} />)

    await user.click(screen.getByRole('button', { name: 'Comments (0)' }))
    await user.type(screen.getByPlaceholderText('Your name'), 'Alice')
    await user.type(screen.getByPlaceholderText('Add a comment...'), 'Nice photo')
    const form = screen.getByPlaceholderText('Add a comment...').closest('form') as HTMLFormElement
    await user.click(form.querySelector('button[type="submit"]') as HTMLButtonElement)

    await waitFor(() => expect(onSubmitComment).toHaveBeenCalled())
    expect(screen.getByPlaceholderText('Add a comment...')).toHaveValue('Nice photo')
  })

  it('disables the comment submit while submitting', async () => {
    const user = userEvent.setup()
    render(<Harness engagement={{ isSubmittingComment: true }} />)

    await user.click(screen.getByRole('button', { name: 'Comments (0)' }))
    await user.type(screen.getByPlaceholderText('Add a comment...'), 'Nice photo')
    const form = screen.getByPlaceholderText('Add a comment...').closest('form') as HTMLFormElement
    const submit = form.querySelector('button[type="submit"]') as HTMLButtonElement

    expect(submit).toBeDisabled()
    expect(submit.querySelector('.animate-spin')).not.toBeNull()
  })

  it('shows face hotspots with verified badges on hover', () => {
    render(<Harness verifiedNames={['Austin Porada']} />)

    fireEvent.mouseEnter(screen.getByTestId('lightbox-image'))
    const austin = screen.getByRole('button', { name: 'Show tag for Austin Porada' })
    expect(screen.getByRole('button', { name: 'Show tag for Jordyn Porada' })).toBeInTheDocument()

    fireEvent.click(austin)
    const austinBadge = within(austin).getByText('Austin Porada')
    expect(austinBadge).toHaveClass('bg-gold-500')
    expect(austinBadge.querySelector('svg')).not.toBeNull()

    fireEvent.mouseEnter(screen.getByTestId('lightbox-image'))
    fireEvent.click(screen.getByRole('button', { name: 'Show tag for Jordyn Porada' }))
    expect(screen.getByText('Jordyn Porada', { selector: '.bg-charcoal-900' })).toBeInTheDocument()
  })

  it('toggles the frozen face hints', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Turn off face hints' }))
    fireEvent.mouseEnter(screen.getByTestId('lightbox-image'))
    expect(screen.queryByRole('button', { name: /Show tag for/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Turn on face hints' }))
    expect(screen.getByRole('button', { name: 'Show tag for Austin Porada' })).toBeInTheDocument()
  })

  it('highlights only the injected face name and always shows its hotspot', () => {
    render(<Harness highlightedFaceName='Jordyn Porada' />)

    expect(screen.getByRole('button', { name: 'Show tag for Jordyn Porada' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Show tag for Austin Porada/ })
    ).not.toBeInTheDocument()
    expect(screen.getByText('Jordyn Porada', { selector: '.rounded-full' })).toHaveClass(
      'bg-charcoal-900'
    )
  })
})
