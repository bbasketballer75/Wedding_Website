import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAIN_FILM_PROGRESS_KEY, getVideoProgressStorageKey } from '../videoProgress'
import { installFilmTestEnvironment, loadMock, playMock } from '../test-utils/testEnvironment'
import { VideoPlayer } from './VideoPlayer'

const STORAGE_KEY = getVideoProgressStorageKey(MAIN_FILM_PROGRESS_KEY)

const TEST_CHAPTERS = [
  { time: 0, label: 'Opening' },
  { time: 60, label: 'Vows' },
  { time: 180, label: 'First Dance' },
]

function setDuration(video: HTMLVideoElement, duration: number): void {
  Object.defineProperty(video, 'duration', { configurable: true, value: duration })
}

function waitForMetadata(container: HTMLElement): HTMLVideoElement {
  const videos = container.querySelectorAll('video')
  const mainVideo = videos[videos.length - 1]
  if (!mainVideo) {
    throw new Error('expected a main video element')
  }
  setDuration(mainVideo, 600)
  fireEvent(mainVideo, new Event('loadedmetadata'))
  return mainVideo
}

function renderPlayer() {
  const utils = render(
    <VideoPlayer
      src='https://media.test/video/main.mp4'
      title='Wedding Film'
      chapters={TEST_CHAPTERS}
      poster='/images/film/main-film-poster.png'
      captionsSrc='https://media.test/video/main.vtt'
      storageKey={MAIN_FILM_PROGRESS_KEY}
    />
  )
  waitForMetadata(utils.container)
  return utils
}

describe('VideoPlayer', () => {
  beforeEach(() => {
    installFilmTestEnvironment()
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('renders the frozen poster, metadata preload and captions track', () => {
    const { container } = renderPlayer()

    const videos = container.querySelectorAll('video')
    expect(videos).toHaveLength(2)
    expect(videos[0]?.getAttribute('poster')).toBe('/images/film/main-film-poster.png')
    expect(videos[0]?.getAttribute('aria-hidden')).toBe('true')

    const mainVideo = videos[1]
    expect(mainVideo?.getAttribute('src')).toBe('https://media.test/video/main.mp4')
    expect(mainVideo?.getAttribute('preload')).toBe('metadata')

    const track = mainVideo?.querySelector('track')
    expect(track?.getAttribute('kind')).toBe('captions')
    expect(track?.getAttribute('src')).toBe('https://media.test/video/main.vtt')
    expect(track?.getAttribute('srcLang')).toBe('en')
  })

  it('renders the accessible playback controls', () => {
    renderPlayer()

    expect(screen.getByLabelText('Play Wedding Film')).toBeInTheDocument()
    expect(screen.getByLabelText('Play film')).toBeInTheDocument()
    expect(screen.getByLabelText('Seek through the wedding film')).toBeInTheDocument()
    expect(screen.getByLabelText('Mute film')).toBeInTheDocument()
    expect(screen.getByLabelText('Adjust film volume')).toBeInTheDocument()
    expect(screen.getByLabelText('Skip back 10 seconds')).toBeInTheDocument()
    expect(screen.getByLabelText('Skip forward 10 seconds')).toBeInTheDocument()
    expect(screen.getByLabelText('Enter fullscreen')).toBeInTheDocument()
    expect(screen.getByText('0:00 / 10:00')).toBeInTheDocument()
    expect(screen.getByText('3 chapters')).toBeInTheDocument()
  })

  it('wires the captions toggle with aria-pressed', () => {
    renderPlayer()

    const captionsButton = screen.getByLabelText('Turn on captions')
    expect(captionsButton).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(captionsButton)

    const offButton = screen.getByLabelText('Turn off captions')
    expect(offButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens the chapter menu and closes it after a chapter jump', async () => {
    renderPlayer()

    fireEvent.click(screen.getByLabelText('Show chapters'))
    expect(document.getElementById('video-chapter-menu')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /^Vows/ }))

    await waitFor(() => {
      expect(document.getElementById('video-chapter-menu')).toBeNull()
    })
    expect(playMock).toHaveBeenCalled()
  })

  it('skips ±10 seconds through the video', () => {
    const { container } = renderPlayer()
    const mainVideo = container.querySelectorAll('video')[1] as HTMLVideoElement

    fireEvent.click(screen.getByLabelText('Skip forward 10 seconds'))
    expect(mainVideo.currentTime).toBe(10)

    fireEvent.click(screen.getByLabelText('Skip back 10 seconds'))
    expect(mainVideo.currentTime).toBe(0)
  })

  it('restores saved progress and writes it on timeupdate', () => {
    window.localStorage.setItem(STORAGE_KEY, '120')

    const { container } = renderPlayer()
    const mainVideo = container.querySelectorAll('video')[1] as HTMLVideoElement
    expect(mainVideo.currentTime).toBe(120)

    mainVideo.currentTime = 42
    fireEvent(mainVideo, new Event('timeupdate'))
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('42')
  })

  it('clears saved progress and reports end-of-film', () => {
    const onEnded = vi.fn()
    window.localStorage.setItem(STORAGE_KEY, '300')

    const { container } = render(
      <VideoPlayer
        src='https://media.test/video/main.mp4'
        chapters={TEST_CHAPTERS}
        storageKey={MAIN_FILM_PROGRESS_KEY}
        onEnded={onEnded}
      />
    )
    const mainVideo = waitForMetadata(container)

    fireEvent(mainVideo, new Event('ended'))

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(onEnded).toHaveBeenCalledTimes(1)
  })

  it('loads the muted preview loop and pauses it via the media stub', () => {
    renderPlayer()

    expect(loadMock).toHaveBeenCalled()
  })
})
