import { useEffect, useRef, useState } from 'react'

// Default options for intersection observer
const DEFAULT_OPTIONS = {
  root: null,
  rootMargin: '50px',
  threshold: 0.1,
}

/**
 * Hook for observing element visibility with Intersection Observer
 * @param {Object} options - Intersection Observer options
 * @returns {Array} - [ref, isIntersecting, entry]
 */
export const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [entry, setEntry] = useState(null)
  const ref = useRef(null)
  const observerRef = useRef(null)

  const observerOptions = { ...DEFAULT_OPTIONS, ...options }

  useEffect(() => {
    // Check if Intersection Observer is supported
    if (!window.IntersectionObserver) {
      console.warn('Intersection Observer is not supported in this browser')
      return
    }

    const element = ref.current
    if (!element) return

    observerRef.current = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting)
      setEntry(entry)
    }, observerOptions)

    observerRef.current.observe(element)

    return () => {
      if (observerRef.current) {
        observerRef.current.unobserve(element)
        observerRef.current.disconnect()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observerOptions.root, observerOptions.rootMargin, observerOptions.threshold])

  return [ref, isIntersecting, entry]
}

/**
 * Hook for lazy loading images with Intersection Observer
 * @param {string} src - Image source URL
 * @param {Object} options - Intersection Observer options
 * @returns {Array} - [ref, isLoaded, src, error]
 */
export const useLazyImage = (src, options = {}) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState(null)
  const [imageSrc, setImageSrc] = useState(null)
  const [ref, isIntersecting] = useIntersectionObserver({
    rootMargin: '100px',
    ...options,
  })

  useEffect(() => {
    if (isIntersecting && src && !imageSrc && !error) {
      const img = new Image()
      img.src = src

      img.onload = () => {
        setImageSrc(src)
        setIsLoaded(true)
      }

      img.onerror = () => {
        setError(new Error(`Failed to load image: ${src}`))
      }
    }
  }, [isIntersecting, src, imageSrc, error])

  return [ref, isLoaded, imageSrc, error]
}

/**
 * Hook for infinite scrolling with Intersection Observer
 * @param {Function} onLoadMore - Function to call when more items should be loaded
 * @param {Object} options - Intersection Observer options
 * @returns {Array} - [ref, isIntersecting]
 */
export const useInfiniteScroll = (onLoadMore, options = {}) => {
  const [ref, isIntersecting] = useIntersectionObserver({
    rootMargin: '200px',
    threshold: 0.1,
    ...options,
  })

  const isLoadingRef = useRef(false)

  useEffect(() => {
    if (isIntersecting && onLoadMore && !isLoadingRef.current) {
      isLoadingRef.current = true
      onLoadMore().finally(() => {
        isLoadingRef.current = false
      })
    }
  }, [isIntersecting, onLoadMore])

  return [ref, isIntersecting]
}

/**
 * Hook for animating elements when they come into view
 * @param {Object} options - Intersection Observer options
 * @returns {Array} - [ref, isVisible, entry]
 */
export const useAnimateOnScroll = (options = {}) => {
  const [ref, isVisible, entry] = useIntersectionObserver({
    threshold: 0.2,
    rootMargin: '0px',
    ...options,
  })

  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    if (isVisible && !hasAnimated) {
      setHasAnimated(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible])

  return [ref, isVisible && hasAnimated, entry]
}

/**
 * Hook for tracking scroll position and direction
 * @returns {Object} - Scroll position and direction info
 */
export const useScrollPosition = () => {
  const [scrollPosition, setScrollPosition] = useState({
    x: 0,
    y: 0,
    direction: 'down',
    lastY: 0,
  })

  const ticking = useRef(false)

  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          setScrollPosition(prev => {
            const currentY = window.pageYOffset
            const direction = currentY > prev.lastY ? 'down' : 'up'

            return {
              x: window.pageXOffset,
              y: currentY,
              direction,
              lastY: currentY,
            }
          })
          ticking.current = false
        })
        ticking.current = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return scrollPosition
}

/**
 * Hook for viewport size detection
 * @returns {Object} - Viewport dimensions
 */
export const useViewportSize = () => {
  const [viewportSize, setViewportSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  })

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener('resize', handleResize, { passive: true })
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return viewportSize
}

export default {
  useIntersectionObserver,
  useLazyImage,
  useInfiniteScroll,
  useAnimateOnScroll,
  useScrollPosition,
  useViewportSize,
}
