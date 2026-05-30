import { useEffect, useRef, useState } from 'react'

// Default options for intersection observer
const DEFAULT_OPTIONS: IntersectionObserverInit = {
  root: null,
  rootMargin: '50px',
  threshold: 0.1,
}

export const useIntersectionObserver = (options: IntersectionObserverInit = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null)
  const ref = useRef<any>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

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

  return [ref, isIntersecting, entry] as const
}

export const useLazyImage = (src: string, options: IntersectionObserverInit = {}) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
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

  return [ref, isLoaded, imageSrc, error] as const
}

export const useInfiniteScroll = (
  onLoadMore: () => Promise<any>,
  options: IntersectionObserverInit = {}
) => {
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

  return [ref, isIntersecting] as const
}

export const useAnimateOnScroll = (options: IntersectionObserverInit = {}) => {
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

  return [ref, isVisible && hasAnimated, entry] as const
}

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

export const useViewportSize = () => {
  const [viewportSize, setViewportSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  })

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize, { passive: true })
      return () => window.removeEventListener('resize', handleResize)
    }
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
