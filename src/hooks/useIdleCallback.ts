import { useCallback, useEffect, useRef, useState } from 'react'

// Check if requestIdleCallback is available
const isRequestIdleCallbackAvailable =
  typeof window !== 'undefined' && 'requestIdleCallback' in window && 'cancelIdleCallback' in window

export const useIdleCallback = (callback: (deadline: any) => void, options: { timeout?: number } = {}) => {
  const callbackRef = useRef(callback)
  const timeoutRef = useRef<number | NodeJS.Timeout | null>(null)

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const scheduleTask = useCallback(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current as any)
    }

    const runTask = (deadline: any) => {
      try {
        callbackRef.current(deadline)
      } catch (error) {
        console.error('Error in idle callback:', error)
      }
    }

    if (isRequestIdleCallbackAvailable) {
      // Use requestIdleCallback if available
      const id = (window as any).requestIdleCallback(runTask, {
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
          (window as any).cancelIdleCallback(timeoutRef.current as number)
        } else {
          clearTimeout(timeoutRef.current as any)
        }
      }
    }
  }, [])

  return scheduleTask
}

export const useIdlePrefetch = (resources: string[] = []) => {
  const hasPrefetched = useRef<Set<string>>(new Set())

  const prefetchResource = useCallback((url: string) => {
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

export const useIdleLazyLoad = (importFn: () => Promise<any>, options: { timeout?: number } = {}) => {
  const [Component, setComponent] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const hasLoaded = useRef(false)

  const loadComponent = useIdleCallback(
    async () => {
      if (hasLoaded.current || loading) return

      setLoading(true)
      setError(null)

      try {
        const module = await importFn()
        setComponent(() => module.default || module)
        hasLoaded.current = true
      } catch (err: any) {
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
