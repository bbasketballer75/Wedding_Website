import { useCallback, useMemo, useState } from 'react'

export interface PaginationState {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface UsePaginationOptions {
  initialPage?: number
  pageSize?: number
  total?: number
}

export interface UsePaginationResult extends PaginationState {
  nextPage: () => void
  previousPage: () => void
  goToPage: (page: number) => void
  setPageSize: (size: number) => void
  setTotal: (total: number) => void
  reset: () => void
  getOffset: () => number
  getLimit: () => number
}

/**
 * Hook for managing pagination state
 */
export function usePagination(options: UsePaginationOptions = {}): UsePaginationResult {
  const { initialPage = 1, pageSize: initialPageSize = 10, total: initialTotal = 0 } = options

  const [page, setPage] = useState(initialPage)
  const [pageSize, setPageSizeState] = useState(initialPageSize)
  const [total, setTotal] = useState(initialTotal)

  const totalPages = useMemo(() => {
    return Math.ceil(total / pageSize) || 1
  }, [total, pageSize])

  const hasNextPage = useMemo(() => {
    return page < totalPages
  }, [page, totalPages])

  const hasPreviousPage = useMemo(() => {
    return page > 1
  }, [page])

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setPage(prev => prev + 1)
    }
  }, [hasNextPage])

  const previousPage = useCallback(() => {
    if (hasPreviousPage) {
      setPage(prev => prev - 1)
    }
  }, [hasPreviousPage])

  const goToPage = useCallback(
    (newPage: number) => {
      const clampedPage = Math.max(1, Math.min(newPage, totalPages))
      setPage(clampedPage)
    },
    [totalPages]
  )

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size)
    setPage(1) // Reset to first page when page size changes
  }, [])

  const reset = useCallback(() => {
    setPage(initialPage)
    setPageSizeState(initialPageSize)
    setTotal(initialTotal)
  }, [initialPage, initialPageSize, initialTotal])

  const getOffset = useCallback(() => {
    return (page - 1) * pageSize
  }, [page, pageSize])

  const getLimit = useCallback(() => {
    return pageSize
  }, [pageSize])

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    nextPage,
    previousPage,
    goToPage,
    setPageSize,
    setTotal,
    reset,
    getOffset,
    getLimit,
  }
}

export default usePagination
