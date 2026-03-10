import { useCallback, useEffect, useRef, useState } from 'react'

// Check if requestIdleCallback is available
const isRequestIdleCallbackAvailable =
  'requestIdleCallback' in window && 'cancelIdleCallback' in window

/**
 * Hook for running tasks during browser idle periods
 * @param {Function} callback - The function to run during idle time
 * @param {Object} options - Options for the hook
 * @returns {Function} - Function to schedule the task
 */
export const useIdleCallback = (callback, options = {}) => {
  const callbackRef = useRef(callback)
  const timeoutRef = useRef(null)

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const scheduleTask = useCallback(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    const runTask = deadline => {
      try {
        callbackRef.current(deadline)
      } catch (error) {
        console.error('Error in idle callback:', error)
      }
    }

    if (isRequestIdleCallbackAvailable) {
      // Use requestIdleCallback if available
      const id = requestIdleCallback(runTask, {
        timeout: options.timeout || 2000, // Default 2s timeout
      })
      timeoutRef.current = id
    } else {
      // Fallback to setTimeout with low priority
      timeoutRef.current = setTimeout(() => {
        runTask({ timeRemaining: () => 50, didTimeout: false })
      }, 1)
    }
  }, [options.timeout])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        if (isRequestIdleCallbackAvailable) {
          cancelIdleCallback(timeoutRef.current)
        } else {
          clearTimeout(timeoutRef.current)
        }
      }
    }
  }, [])

  return scheduleTask
}

/**
 * Hook for prefetching resources during idle time
 * @param {Array} resources - Array of resource URLs to prefetch
 */
export const useIdlePrefetch = (resources = []) => {
  const hasPrefetched = useRef(new Set())

  const prefetchResource = useCallback(url => {
    if (hasPrefetched.current.has(url)) return

    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = url
    document.head.appendChild(link)

    hasPrefetched.current.add(url)

    // Remove after 10 seconds to keep DOM clean
    setTimeout(() => {
      if (document.head.contains(link)) {
        document.head.removeChild(link)
      }
    }, 10000)
  }, [])

  const schedulePrefetch = useIdleCallback(
    () => {
      resources.forEach(url => {
        if (url && !hasPrefetched.current.has(url)) {
          prefetchResource(url)
        }
      })
    },
    { timeout: 5000 }
  )

  useEffect(() => {
    if (resources.length > 0) {
      schedulePrefetch()
    }
  }, [resources, schedulePrefetch])
}

/**
 * Hook for lazy loading non-critical components
 * @param {Function} importFn - Dynamic import function
 * @param {Object} options - Options
 * @returns {Array} - [Component, loading, error]
 */
export const useIdleLazyLoad = (importFn, options = {}) => {
  const [Component, setComponent] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const hasLoaded = useRef(false)

  const loadComponent = useIdleCallback(
    async () => {
      if (hasLoaded.current || loading) return

      setLoading(true)
      setError(null)

      try {
        const module = await importFn()
        setComponent(module.default || module)
        hasLoaded.current = true
      } catch (err) {
        setError(err)
        console.error('Failed to lazy load component:', err)
      } finally {
        setLoading(false)
      }
    },
    { timeout: options.timeout || 3000 }
  )

  useEffect(() => {
    if (!hasLoaded.current && !loading && !error) {
      loadComponent()
    }
  }, [loadComponent, loading, error])

  return [Component, loading, error]
}

export default {
  useIdleCallback,
  useIdlePrefetch,
  useIdleLazyLoad,
}
