/* eslint-disable react-hooks/purity */
import { useCallback, useEffect, useMemo, useRef } from 'react'

/**
 * Advanced memoization utilities for React performance optimization
 */

/**
 * Deep comparison for useMemo/useCallback dependencies
 */
export function useDeepMemo<T>(factory: () => T, deps: React.DependencyList): T {
  const ref = useRef<{ deps: React.DependencyList; value: T } | null>(null)

  if (!ref.current || !deepEqual(ref.current.deps, deps)) {
    ref.current = {
      deps,
      value: factory(),
    }
  }

  const current = ref.current
  return current ? current.value : factory()
}

/**
 * Deep comparison utility
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (typeof a !== typeof b) return false

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const objA = a as Record<string, unknown>
    const objB = b as Record<string, unknown>
    const keysA = Object.keys(objA)
    const keysB = Object.keys(objB)
    if (keysA.length !== keysB.length) return false
    return keysA.every(key => deepEqual(objA[key], objB[key]))
  }

  return false
}

/**
 * Stable callback that won't cause re-renders
 */
export function useStableCallback<T extends (...args: unknown[]) => unknown>(callback: T): T {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  })

  return useCallback((...args: unknown[]) => {
    return callbackRef.current(...args)
  }, []) as T
}

/**
 * Memoize expensive computations with custom equality
 */
export function useMemoCompare<T>(
  factory: () => T,
  deps: React.DependencyList,
  compare: (a: React.DependencyList, b: React.DependencyList) => boolean
): T {
  const ref = useRef<{ deps: React.DependencyList; value: T } | null>(null)

  if (!ref.current || !compare(ref.current.deps, deps)) {
    ref.current = {
      deps,
      value: factory(),
    }
  }

  const current = ref.current
  return current ? current.value : factory()
}

/**
 * Memoize with timeout - auto-invalidate cache after duration
 */
export function useMemoTimeout<T>(
  factory: () => T,
  deps: React.DependencyList,
  timeout: number = 5000
): T {
  const ref = useRef<{ deps: React.DependencyList; value: T; timestamp: number } | null>(null)
  const now = Date.now()

  const needsUpdate =
    !ref.current || !deepEqual(ref.current.deps, deps) || now - ref.current.timestamp > timeout

  if (needsUpdate) {
    ref.current = {
      deps,
      value: factory(),
      timestamp: now,
    }
  }

  const current = ref.current
  return current ? current.value : factory()
}

/**
 * Shallow comparison for object dependencies
 */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object') return false
  if (a == null || b == null) return false

  const objA = a as Record<string, unknown>
  const objB = b as Record<string, unknown>

  const keysA = Object.keys(objA)
  const keysB = Object.keys(objB)

  if (keysA.length !== keysB.length) return false

  return keysA.every(key => objA[key] === objB[key])
}

/**
 * Memoize with shallow comparison
 */
export function useMemoShallow<T>(factory: () => T, deps: React.DependencyList): T {
  return useMemoCompare(factory, deps, (a, b) => {
    if (a.length !== b.length) return false
    return a.every((item, index) => shallowEqual(item, b[index]))
  })
}

/**
 * Cache function results
 */
export function memoize<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  getCacheKey?: (...args: TArgs) => string
): (...args: TArgs) => TResult {
  const cache = new Map<string, TResult>()

  return (...args: TArgs): TResult => {
    const key = getCacheKey ? getCacheKey(...args) : JSON.stringify(args)

    if (cache.has(key)) {
      const cached = cache.get(key)
      if (cached !== undefined || cache.has(key)) {
        return cached as TResult
      }
    }

    const result = fn(...args)
    cache.set(key, result)
    return result
  }
}

/**
 * LRU Cache implementation
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>
  private maxSize: number

  constructor(maxSize: number = 100) {
    this.cache = new Map()
    this.maxSize = maxSize
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined

    // Move to end (most recently used)
    const value = this.cache.get(key)
    if (value === undefined) {
      return undefined
    }
    this.cache.delete(key)
    this.cache.set(key, value)
    return value
  }

  set(key: K, value: V): void {
    // Delete if exists to update position
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // Add to end
    this.cache.set(key, value)

    // Evict oldest if over size
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}

/**
 * Hook for LRU cache
 */
export function useLRUCache<K, V>(maxSize: number = 100): LRUCache<K, V> {
  return useMemo(() => new LRUCache<K, V>(maxSize), [maxSize])
}

export default {
  useDeepMemo,
  useStableCallback,
  useMemoCompare,
  useMemoTimeout,
  useMemoShallow,
  shallowEqual,
  deepEqual,
  memoize,
  LRUCache,
  useLRUCache,
}
