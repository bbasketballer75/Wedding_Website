import React, { startTransition, useDeferredValue, useTransition } from 'react'

/**
 * Concurrent React utilities for better performance
 */

/**
 * Wrap non-urgent updates in startTransition
 */
export function deferUpdate(callback: () => void): void {
  startTransition(() => {
    callback()
  })
}

/**
 * Batch multiple state updates with startTransition
 */
export function batchUpdates(updates: Array<() => void>): void {
  startTransition(() => {
    updates.forEach(update => update())
  })
}

/**
 * Hook for managing transitions
 */
export function useTransitionState(): {
  isPending: boolean
  startTransition: (callback: () => void) => void
} {
  const [isPending, startTransitionFn] = useTransition()

  return {
    isPending,
    startTransition: startTransitionFn,
  }
}

/**
 * Hook for deferred values (keeps UI responsive during heavy updates)
 */
export function useDeferredState<T>(value: T): T {
  return useDeferredValue(value)
}

/**
 * Debounce with startTransition for search inputs
 */
export function useTransitionDebounce<T>(value: T, delay: number = 300): [T, boolean] {
  const [deferredValue, setDeferredValue] = React.useState(value)
  const [isPending, startTransition] = useTransition()

  React.useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        setDeferredValue(value)
      })
    }, delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return [deferredValue, isPending]
}

/**
 * Priority levels for updates
 */
export enum UpdatePriority {
  Immediate = 'immediate',
  Normal = 'normal',
  Low = 'low',
}

/**
 * Schedule update based on priority
 */
export function scheduleUpdate(
  callback: () => void,
  priority: UpdatePriority = UpdatePriority.Normal
): void {
  switch (priority) {
    case UpdatePriority.Immediate:
      // Run immediately
      callback()
      break

    case UpdatePriority.Normal:
      // Use startTransition for normal priority
      startTransition(() => {
        callback()
      })
      break

    case UpdatePriority.Low:
      // Use requestIdleCallback for low priority
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          callback()
        })
      } else {
        setTimeout(callback, 0)
      }
      break
  }
}

/**
 * Hook for managing update priorities
 */
export function usePriorityUpdate(): {
  immediate: (callback: () => void) => void
  normal: (callback: () => void) => void
  low: (callback: () => void) => void
} {
  return {
    immediate: callback => scheduleUpdate(callback, UpdatePriority.Immediate),
    normal: callback => scheduleUpdate(callback, UpdatePriority.Normal),
    low: callback => scheduleUpdate(callback, UpdatePriority.Low),
  }
}

export default {
  deferUpdate,
  batchUpdates,
  useTransitionState,
  useDeferredState,
  useTransitionDebounce,
  scheduleUpdate,
  usePriorityUpdate,
  UpdatePriority,
}
