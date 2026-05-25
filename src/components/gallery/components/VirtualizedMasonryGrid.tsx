import React from 'react'
import { useVirtualizedMasonry, MASONRY_COLUMNS } from '../hooks/useVirtualizedMasonry'

interface PhotoMinimal {
  id: string
  aspectRatio?: number
}

interface VirtualizedMasonryGridProps<T extends PhotoMinimal> {
  photos: T[]
  rowHeight?: number
  gap?: number
  children: (photo: T, globalIndex: number) => React.ReactNode
  onVisibleRangeChange?: (startIndex: number, endIndex: number) => void
}

export function VirtualizedMasonryGrid<T extends PhotoMinimal>({
  photos,
  rowHeight = 280,
  gap = 8,
  children,
  onVisibleRangeChange,
}: VirtualizedMasonryGridProps<T>) {
  const { scrollRef, virtualizer, rows, measureRow } = useVirtualizedMasonry({
    photos,
    rowHeight,
    gap,
    onVisibleRangeChange,
  })

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div ref={scrollRef} className='h-full w-full overflow-auto' style={{ contain: 'content' }}>
      <div
        className='relative w-full'
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualItems.map(virtualRow => {
          const row = rows[virtualRow.index]
          if (!row) return null

          return (
            <div
              key={virtualRow.key}
              ref={el => measureRow(virtualRow.index, el)}
              className='absolute left-0 top-0 flex gap-2'
              style={{
                transform: `translateY(${virtualRow.start}px)`,
                width: '100%',
                height: `${virtualRow.size - gap}px`,
              }}
            >
              {row.photos.map((photo, photoIndex) => {
                const globalIndex = row.startIndex + photoIndex
                return (
                  <div key={photo.id} className='flex-shrink-0' style={{ height: '100%' }}>
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
