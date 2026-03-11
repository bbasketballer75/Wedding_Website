/**
 * Render Optimization Utilities
 */

/**
 * Check if component should update (for class components or custom logic)
 */
export function shouldComponentUpdate<T extends Record<string, unknown>>(
  prevProps: T,
  nextProps: T,
  shallowCompare: boolean = true
): boolean {
  const prevKeys = Object.keys(prevProps)
  const nextKeys = Object.keys(nextProps)

  if (prevKeys.length !== nextKeys.length) {
    return true
  }

  for (const key of prevKeys) {
    if (shallowCompare) {
      if (prevProps[key] !== nextProps[key]) {
        return true
      }
    } else {
      if (JSON.stringify(prevProps[key]) !== JSON.stringify(nextProps[key])) {
        return true
      }
    }
  }

  return false
}

/**
 * Batch DOM reads to avoid layout thrashing
 */
export class DOMBatcher {
  private readQueue: Array<() => void> = []
  private writeQueue: Array<() => void> = []
  private scheduled: boolean = false

  read(fn: () => void): void {
    this.readQueue.push(fn)
    this.schedule()
  }

  write(fn: () => void): void {
    this.writeQueue.push(fn)
    this.schedule()
  }

  private schedule(): void {
    if (this.scheduled) return
    this.scheduled = true

    requestAnimationFrame(() => {
      // Execute all reads first
      while (this.readQueue.length > 0) {
        const read = this.readQueue.shift()
        read?.()
      }

      // Then execute all writes
      while (this.writeQueue.length > 0) {
        const write = this.writeQueue.shift()
        write?.()
      }

      this.scheduled = false
    })
  }
}

export const domBatcher = new DOMBatcher()

/**
 * Virtualization helper for large lists
 */
export interface VirtualizationConfig {
  itemHeight: number
  containerHeight: number
  overscan?: number
}

export function calculateVisibleRange(
  scrollTop: number,
  config: VirtualizationConfig
): { start: number; end: number } {
  const { itemHeight, containerHeight, overscan = 3 } = config

  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const visibleCount = Math.ceil(containerHeight / itemHeight)
  const end = start + visibleCount + overscan * 2

  return { start, end }
}

/**
 * Debounce renders
 */
export function debounceRender<T extends (...args: unknown[]) => void>(fn: T, delay: number = 16): T {
  let timeoutId: number | undefined

  return ((...args: unknown[]) => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }

    timeoutId = window.setTimeout(() => {
      fn(...args)
    }, delay)
  }) as T
}

/**
 * Throttle renders
 */
export function throttleRender<T extends (...args: unknown[]) => void>(fn: T, delay: number = 16): T {
  let lastRun = 0
  let timeoutId: number | undefined

  return ((...args: unknown[]) => {
    const now = Date.now()

    if (now - lastRun >= delay) {
      lastRun = now
      fn(...args)
    } else {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }

      timeoutId = window.setTimeout(
        () => {
          lastRun = Date.now()
          fn(...args)
        },
        delay - (now - lastRun)
      )
    }
  }) as T
}

/**
 * Request animation frame wrapper
 */
export function scheduleRender(callback: () => void): () => void {
  const rafId = requestAnimationFrame(callback)
  return () => cancelAnimationFrame(rafId)
}

/**
 * Request idle callback wrapper
 */
export function scheduleIdleWork(callback: () => void, options?: IdleRequestOptions): () => void {
  if ('requestIdleCallback' in window) {
    const id = requestIdleCallback(callback, options)
    return () => cancelIdleCallback(id)
  } else {
    const timeoutId = setTimeout(callback, 1)
    return () => clearTimeout(timeoutId)
  }
}

/**
 * Measure render performance
 */
export function measureRender(componentName: string, fn: () => void): void {
  const startMark = `${componentName}-start`
  const endMark = `${componentName}-end`
  const measureName = `${componentName}-render`

  performance.mark(startMark)
  fn()
  performance.mark(endMark)

  performance.measure(measureName, startMark, endMark)

  const measure = performance.getEntriesByName(measureName)[0]
  if (measure && measure.duration > 16) {
    console.warn(`Slow render detected in ${componentName}: ${measure.duration.toFixed(2)}ms`)
  }

  performance.clearMarks(startMark)
  performance.clearMarks(endMark)
  performance.clearMeasures(measureName)
}

/**
 * Check if element is in viewport
 */
export function isInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  )
}

/**
 * Lazy load component when in viewport
 */
export function observeElement(
  element: HTMLElement,
  callback: () => void,
  options?: IntersectionObserverInit
): () => void {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        callback()
        observer.disconnect()
      }
    })
  }, options)

  observer.observe(element)

  return () => observer.disconnect()
}

export default {
  shouldComponentUpdate,
  DOMBatcher,
  domBatcher,
  calculateVisibleRange,
  debounceRender,
  throttleRender,
  scheduleRender,
  scheduleIdleWork,
  measureRender,
  isInViewport,
  observeElement,
}
