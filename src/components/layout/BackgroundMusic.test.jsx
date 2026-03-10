import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import BackgroundMusic from './BackgroundMusic'
import { HalloweenProvider } from '../../context/HalloweenContext'

// Mock Audio
class AudioMock {
  constructor(src) {
    this.src = src
    this.volume = 1.0
    this.loop = false
    this.events = {}
  }
  play() {
    return Promise.resolve()
  }
  pause() {}
  addEventListener(event, cb) {
    this.events[event] = cb
  }
  removeEventListener(event) {
    delete this.events[event]
  }
  dispatchEvent(event) {
    if (this.events[event.type]) {
      this.events[event.type](event)
    }
  }
}

// Mock HTMLAudioElement
globalThis.Audio = AudioMock

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
globalThis.localStorage = localStorageMock

describe('BackgroundMusic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders without crashing', () => {
    render(
      <HalloweenProvider>
        <BackgroundMusic />
      </HalloweenProvider>
    )
  })

  it('toggles play/pause when clicked', async () => {
    render(
      <HalloweenProvider>
        <BackgroundMusic />
      </HalloweenProvider>
    )

    const musicButton = screen.getByRole('button')
    expect(musicButton).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(musicButton)
    })
  })

  it('shows nudge prompt after delay', async () => {
    vi.useFakeTimers()

    render(
      <HalloweenProvider>
        <BackgroundMusic />
      </HalloweenProvider>
    )

    // Fast-forward 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    // Check if nudge appears
    await vi.waitFor(() => {
      expect(screen.getByText(/music/i)).toBeInTheDocument()
    })

    vi.useRealTimers()
  })
})
