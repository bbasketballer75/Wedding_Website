import { motion } from 'framer-motion'
import { useCallback, useMemo, useRef, useState, ReactNode, UIEvent, ChangeEvent } from 'react'

export interface VirtualScrollProps<T> {
  items: T[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number) => ReactNode
  overscan?: number
  className?: string
}

// Virtual scroll component for large lists
const VirtualScroll = <T extends any>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = '',
}: VirtualScrollProps<T>) => {
  const [scrollTop, setScrollTop] = useState(0)
  const scrollElementRef = useRef<HTMLDivElement>(null)

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )
    return { startIndex, endIndex }
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan])

  // Visible items
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1)
  }, [items, visibleRange])

  // Handle scroll
  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    setScrollTop((e.target as HTMLDivElement).scrollTop)
  }, [])

  // Total height of all items
  const totalHeight = items.length * itemHeight

  return (
    <div
      ref={scrollElementRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map((item, index) => {
          const actualIndex = visibleRange.startIndex + index
          const top = actualIndex * itemHeight

          return (
            <div
              key={actualIndex}
              style={{
                position: 'absolute',
                top,
                left: 0,
                right: 0,
                height: itemHeight,
              }}
            >
              {renderItem(item, actualIndex)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export interface VirtualGridProps<T> {
  items: T[]
  itemHeight: number
  itemWidth: number
  containerHeight: number
  containerWidth: number
  renderItem: (item: T, index: number) => ReactNode
  gap?: number
  overscan?: number
  className?: string
}

// Virtualized grid component
export const VirtualGrid = <T extends any>({
  items,
  itemHeight,
  itemWidth,
  containerHeight,
  containerWidth,
  renderItem,
  gap = 16,
  overscan = 2,
  className = '',
}: VirtualGridProps<T>) => {
  const [scrollTop, setScrollTop] = useState(0)
  const scrollElementRef = useRef<HTMLDivElement>(null)

  // Calculate items per row
  const itemsPerRow = Math.floor((containerWidth + gap) / (itemWidth + gap))

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const startRow = Math.max(0, Math.floor(scrollTop / (itemHeight + gap)) - overscan)
    const endRow = Math.min(
      Math.ceil(items.length / itemsPerRow) - 1,
      Math.ceil((scrollTop + containerHeight) / (itemHeight + gap)) + overscan
    )

    const startIndex = startRow * itemsPerRow
    const endIndex = Math.min(items.length - 1, (endRow + 1) * itemsPerRow - 1)

    return { startIndex, endIndex }
  }, [scrollTop, itemHeight, containerHeight, items.length, itemsPerRow, gap, overscan])

  // Visible items
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1)
  }, [items, visibleRange])

  // Handle scroll
  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    setScrollTop((e.target as HTMLDivElement).scrollTop)
  }, [])

  // Total rows
  const totalRows = Math.ceil(items.length / itemsPerRow)
  const totalHeight = totalRows * (itemHeight + gap) - gap

  return (
    <div
      ref={scrollElementRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight, width: containerWidth }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map((item, index) => {
          const actualIndex = visibleRange.startIndex + index
          const row = Math.floor(actualIndex / itemsPerRow)
          const col = actualIndex % itemsPerRow
          const top = row * (itemHeight + gap)
          const left = col * (itemWidth + gap)

          return (
            <motion.div
              key={actualIndex}
              style={{
                position: 'absolute',
                top,
                left,
                width: itemWidth,
                height: itemHeight,
              }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              {renderItem(item, actualIndex)}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

export interface OptimizedListProps<T> {
  items: T[]
  filterFn?: (item: T, filterTerm: string) => boolean
  searchFn?: (item: T, searchTerm: string) => boolean
  itemHeight?: number
  containerHeight?: number
  renderItem: (item: T, index: number) => ReactNode
  className?: string
}

// Optimized list component with search and filter
export const OptimizedList = <T extends any>({
  items,
  filterFn,
  searchFn,
  itemHeight = 60,
  containerHeight = 400,
  renderItem,
  className = '',
}: OptimizedListProps<T>) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')

  // Filtered items
  const filteredItems = useMemo(() => {
    let result = items

    if (filter && filterFn) {
      result = result.filter(item => filterFn(item, filter))
    }

    if (searchTerm && searchFn) {
      result = result.filter(item => searchFn(item, searchTerm))
    }

    return result
  }, [items, filter, searchTerm, filterFn, searchFn])

  return (
    <div className={`optimized-list ${className}`}>
      {/* Search and filter controls */}
      <div className='mb-4 space-y-2'>
        <input
          type='text'
          placeholder='Search...'
          value={searchTerm}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
          className='w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
        />
        {filterFn && (
          <select
            value={filter}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilter(e.target.value)}
            className='w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
          >
            <option value=''>All</option>
            {/* Add filter options based on your data */}
          </select>
        )}
      </div>

      {/* Virtual scroll list */}
      <VirtualScroll
        items={filteredItems}
        itemHeight={itemHeight}
        containerHeight={containerHeight}
        renderItem={renderItem}
      />

      {/* Results count */}
      <div className='mt-2 text-sm text-gray-600 dark:text-gray-400'>
        Showing {filteredItems.length} of {items.length} items
      </div>
    </div>
  )
}

export default VirtualScroll
