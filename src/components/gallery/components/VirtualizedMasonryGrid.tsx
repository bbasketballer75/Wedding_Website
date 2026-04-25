import React, { useRef, useEffect, useMemo, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

const MASONRY_COLUMNS = { base: 1, sm: 2, md: 3, lg: 4 } as const

type Breakpoint = keyof typeof MASONRY_COLUMNS

function getBreakpointColumnCount(columns: typeof MASONRY_COLUMNS): number {
  const w = window.innerWidth
  if (w >= 1024) return columns.lg
  if (w >= 768) return columns.md
  if (w >= 640) return columns.sm
  return columns.base
}

interface Photo {
  id: string
  url: string
  thumbnail?: string
  alt?: string
  aspectRatio?: number
}

interface VirtualizedMasonryGridProps {
  photos: Photo[]
  rowHeight?: number
  gap?: number
  children: (photo: Photo, globalIndex: number) => React.ReactNode
  onVisibleRangeChange?: (startIndex: number, endIndex: number) => void
}

interface RowMeasurement {
  startIndex: number
  endIndex: number
  measuredHeight: number
  estimated: boolean
}

export function useVirtualizedMasonry({
  photos,
  rowHeight = 280,
  gap = 8,
}: {
  photos: Photo[]
  rowHeight?: number
  gap?: number
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const measurementMapRef = useRef<Map<number, number>>(new Map())
  const rowContainerRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  const estimateSize = rowHeight + gap

  // Calculate which photos go in each row based on aspect ratios and target row height
  const { rows, estimatedTotalRows } = useMemo(() => {
    const cols = getBreakpointColumnCount(MASONRY_COLUMNS)
    const photoRows: { startIndex: number; endIndex: number; photos: Photo[] }[] = []

    let currentRow: { startIndex: number; endIndex: number; photos: Photo[] } = {
      startIndex: 0,
      endIndex: 0,
      photos: [],
    }
    let currentWidth = 0
    const targetRowWidth = window.innerWidth - 32 // Account for padding

    photos.forEach((photo, index) => {
      const aspectRatio = photo.aspectRatio || 1.5 // Default 3:2 aspect ratio
      const scaledHeight = rowHeight
      const scaledWidth = scaledHeight * aspectRatio

      // If adding this photo would exceed target width, start a new row
      if (currentRow.photos.length > 0 && currentWidth + scaledWidth > targetRowWidth) {
        photoRows.push(currentRow)
        currentRow = { startIndex: index, endIndex: index, photos: [] }
        currentWidth = 0
      }

      currentRow.photos.push(photo)
      currentRow.endIndex = index
      currentWidth += scaledWidth

      // Also start a new row if we've reached column count
      if (currentRow.photos.length >= cols) {
        photoRows.push(currentRow)
        currentRow = { startIndex: index + 1, endIndex: index + 1, photos: [] }
        currentWidth = 0
      }
    })

    // Push last row if it has photos
    if (currentRow.photos.length > 0) {
      photoRows.push(currentRow)
    }

    return {
      rows: photoRows,
      estimatedTotalRows: photoRows.length || 1,
    }
  }, [photos, rowHeight])

  const virtualizer = useVirtualizer({
    count: estimatedTotalRows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    hasFixedSize: false,
    overscan: 5,
  })

  const measureRow = useCallback((rowIndex: number, element: HTMLDivElement | null) => {
    if (element) {
      rowContainerRefs.current.set(rowIndex, element)
      const height = element.getBoundingClientRect().height
      if (height > 0) {
        measurementMapRef.current.set(rowIndex, height)
        virtualizer.measure()
      }
    }
  }, [virtualizer])

  // Re-measure rows on resize
  useEffect(() => {
    const handleResize = () => {
      measurementMapRef.current.clear()
      virtualizer.measure()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [virtualizer])

  return {
    scrollRef,
    virtualizer,
    rows,
    measurementMapRef,
    measureRow,
    getRowMeasurements: () => measurementMapRef.current,
  }
}

export function VirtualizedMasonryGrid({
  photos,
  rowHeight = 280,
  gap = 8,
  children,
}: VirtualizedMasonryGridProps) {
  const { scrollRef, virtualizer, rows, measureRow } = useVirtualizedMasonry({
    photos,
    rowHeight,
    gap,
  })

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div
      ref={scrollRef}
      className="h-full w-full overflow-auto"
      style={{ contain: 'strict' }}
    >
      <div
        className="relative w-full"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualItems.map((virtualRow) => {
          const row = rows[virtualRow.index]
          if (!row) return null

          return (
            <div
              key={virtualRow.key}
              ref={(el) => measureRow(virtualRow.index, el)}
              className="absolute left-0 top-0 flex gap-2"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                width: '100%',
                height: `${virtualRow.size - gap}px`,
              }}
            >
              {row.photos.map((photo, photoIndex) => {
                const globalIndex = row.startIndex + photoIndex
                return (
                  <div key={photo.id} className="flex-shrink-0" style={{ height: '100%' }}>
                    {children(photo, globalIndex)}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { MASONRY_COLUMNS }
