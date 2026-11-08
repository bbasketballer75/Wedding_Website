import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OptimizedImage, ProgressiveImage, ResponsiveImage } from './OptimizedImage'

type IntersectionCallback = (entries: Array<{ isIntersecting: boolean; target: Element }>) => void

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []
  callback: IntersectionCallback
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  root = null
  rootMargin = ''
  thresholds: number[] = []

  constructor(callback: IntersectionCallback) {
    this.callback = callback
    MockIntersectionObserver.instances.push(this)
  }

  takeRecords() {
    return []
  }

  static trigger(index = 0) {
    const observer = MockIntersectionObserver.instances[index]
    if (!observer) throw new Error(`No IntersectionObserver at index ${index}`)
    act(() => {
      observer.callback([{ isIntersecting: true, target: document.body }])
    })
  }
}

beforeEach(() => {
  MockIntersectionObserver.instances = []
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('OptimizedImage', () => {
  it('lazily observes and then renders the WebP source with the frozen URL contract', async () => {
    render(<OptimizedImage src='/images/photo.jpg' alt='Photo' width={200} className='custom' />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(MockIntersectionObserver.instances).toHaveLength(1)

    MockIntersectionObserver.trigger()

    const image = await screen.findByRole('img', { name: 'Photo' })
    expect(image).toHaveAttribute('src', '/images/photo.webp?w=200&q=75')
    expect(image).toHaveClass('object-cover')
    expect((image.parentElement as HTMLElement).style.width).toBe('200px')
    expect((image.parentElement as HTMLElement).style.height).toBe('auto')
    expect(image.parentElement).toHaveClass('custom')
    expect(MockIntersectionObserver.instances[0]?.unobserve).toHaveBeenCalled()
  })

  it('renders priority images without waiting for intersection and reports load', async () => {
    const onLoad = vi.fn()
    const { container } = render(
      <OptimizedImage
        src='/images/hero.png'
        alt='Hero'
        width={100}
        height={50}
        priority
        onLoad={onLoad}
        aspectRatio={2}
      />
    )

    expect(container.querySelector('.animate-spin')).not.toBeNull()

    const image = await screen.findByRole('img', { name: 'Hero' })
    expect(image).toHaveAttribute('src', '/images/hero.webp?w=100&q=75')
    fireEvent.load(image)

    expect(onLoad).toHaveBeenCalledTimes(1)
    expect(image).toHaveClass('opacity-100')
    expect(container.querySelector('.animate-spin')).toBeNull()
    const wrapper = image.parentElement as HTMLElement
    expect(wrapper.style.height).toBe('50px')
    expect(wrapper.style.aspectRatio).toBe('2 / 1')
  })

  it('renders the frozen error state and forwards onError', async () => {
    const onError = vi.fn()
    render(<OptimizedImage src='/images/photo.jpg' alt='Photo' priority onError={onError} />)

    const image = await screen.findByRole('img', { name: 'Photo' })
    fireEvent.error(image)

    expect(onError).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Failed to load image')).toBeInTheDocument()
    expect(screen.getByText('Failed to load image')).toHaveClass('text-dark-700')
  })

  it('honours the empty placeholder while the lazy image has not loaded', () => {
    const { container } = render(
      <OptimizedImage src='/images/photo.jpg' alt='Photo' placeholder='empty' />
    )

    const placeholder = container.querySelector('.animate-pulse')
    expect(placeholder).not.toBeNull()
    expect(placeholder).toHaveClass('bg-cream-200')
  })

  it('applies the blur placeholder style from blurDataURL', () => {
    const { container } = render(
      <OptimizedImage src='/images/photo.jpg' alt='Photo' blurDataURL='data:image/png;base64,abc' />
    )

    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.backgroundImage).toContain('data:image/png;base64,abc')
    expect(wrapper.style.filter).toBe('blur(20px)')
    expect(wrapper.style.transform).toBe('scale(1.1)')
  })

  it('applies the frozen cream colour placeholder', () => {
    const { container } = render(
      <OptimizedImage src='/images/photo.jpg' alt='Photo' placeholder='color' />
    )

    expect(container.firstElementChild).toHaveStyle({
      backgroundColor: 'rgb(245, 242, 236)',
    })
  })

  it('skips the WebP source for an explicit format', async () => {
    render(
      <OptimizedImage
        src='/images/photo.jpg'
        alt='Photo'
        format='jpg'
        width={200}
        quality={60}
        priority
      />
    )

    const image = await screen.findByRole('img', { name: 'Photo' })
    expect(image).toHaveAttribute('src', '/images/photo.jpg?w=200&q=60')
  })
})

describe('ResponsiveImage', () => {
  it('renders art-directed sources for priority images', async () => {
    const { container } = render(
      <ResponsiveImage
        src='/images/photo.jpg'
        alt='Photo'
        priority
        breakpoints={{ sm: { w: 640, h: 480 }, lg: { w: 1024, h: 768 } }}
        sizes='50vw'
      />
    )

    const image = await screen.findByRole('img', { name: 'Photo' })
    expect(image).toHaveAttribute('src', '/images/photo.jpg')
    expect(image).toHaveAttribute('sizes', '50vw')

    const sources = container.querySelectorAll('source')
    expect(sources).toHaveLength(4)
    expect(sources[0]).toHaveAttribute('media', '(min-width: 640px)')
    expect(sources[0]).toHaveAttribute('srcset', '/images/photo.webp?w=640&h=480&q=75')
    expect(sources[0]).toHaveAttribute('type', 'image/webp')
    expect(sources[1]).toHaveAttribute('srcset', '/images/photo.jpg?w=640&h=480&q=75')
    expect(sources[2]).toHaveAttribute('media', '(min-width: 1024px)')
  })

  it('lazily loads the picture and shows a pulse placeholder first', async () => {
    const { container } = render(<ResponsiveImage src='/images/photo.jpg' alt='Photo' />)

    expect(container.querySelector('.animate-pulse')).not.toBeNull()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    MockIntersectionObserver.trigger()

    const image = await screen.findByRole('img', { name: 'Photo' })
    expect(image).toHaveAttribute('src', '/images/photo.jpg')
    expect(container.querySelector('.animate-pulse')).toBeNull()
    expect(MockIntersectionObserver.instances[0]?.unobserve).toHaveBeenCalled()
  })
})

describe('ProgressiveImage', () => {
  it('shows the decoded image over the frozen blur placeholder', async () => {
    class MockImage {
      onload: (() => void) | null = null
      private source = ''
      set src(value: string) {
        this.source = value
        queueMicrotask(() => this.onload?.())
      }
      get src() {
        return this.source
      }
    }
    vi.stubGlobal('Image', MockImage)

    const { container } = render(
      <ProgressiveImage src='/images/photo.jpg' alt='Photo' width={320} priority />
    )

    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.backgroundImage).toContain('data:image/jpeg;base64,')

    const image = await screen.findByRole('img', { name: 'Photo' })
    expect(image).toHaveAttribute('src', '/images/photo.webp?w=320&q=75')
    await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('alt', 'Photo'))
  })
})
