import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VideoPlayer } from './VideoPlayer'

// Mock DOM APIs not available in JSDOM (framer-motion, matchMedia, and
// HTMLMediaElement play/pause are already mocked globally in src/setupTests.tsx)
window.HTMLElement.prototype.scrollIntoView = vi.fn()
window.HTMLMediaElement.prototype.load = vi.fn()

// Fire `loadedmetadata` on the main video so the component leaves its loading
// state — JSDOM never fires media events, and the play overlay is gated on
// `isLoading`. fireEvent wraps the dispatch in act() so the state update flushes.
function simulateVideoReady(container: HTMLElement) {
  const videos = container.querySelectorAll('video')
  const mainVideo = videos[videos.length - 1]
  if (mainVideo) {
    fireEvent(mainVideo, new Event('loadedmetadata'))
  }
}

const TEST_SRC = 'https://example.com/video/main.mp4'
const TEST_CHAPTERS = [
  { time: 0, label: 'Opening' },
  { time: 60, label: 'Vows' },
  { time: 180, label: 'First Dance' },
]

function renderPlayer() {
  const utils = render(<VideoPlayer src={TEST_SRC} title='Wedding Film' chapters={TEST_CHAPTERS} />)
  simulateVideoReady(utils.container)
  return utils
}

describe('VideoPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the play overlay with the film title', () => {
    renderPlayer()
    expect(screen.getByLabelText('Play Wedding Film')).toBeInTheDocument()
  })

  it('starts playback when the overlay is clicked', () => {
    // The global setup defines play as a plain function; spy on it to assert the call
    const playSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'play')
    renderPlayer()
    fireEvent.click(screen.getByLabelText('Play Wedding Film'))
    expect(playSpy).toHaveBeenCalled()
    playSpy.mockRestore()
  })

  it('renders the seek slider and control bar play button', () => {
    renderPlayer()
    expect(screen.getByLabelText('Seek through the wedding film')).toBeInTheDocument()
    expect(screen.getByLabelText('Play film')).toBeInTheDocument()
  })

  it('opens the chapter menu and jumps to a chapter', () => {
    renderPlayer()
    fireEvent.click(screen.getByLabelText('Show chapters'))
    // Menu items render the chapter label as text (no aria-label)
    fireEvent.click(screen.getByRole('button', { name: /^Vows/ }))
    // Chapter menu closes after a jump
    expect(document.getElementById('video-chapter-menu')).toBeNull()
  })
})
