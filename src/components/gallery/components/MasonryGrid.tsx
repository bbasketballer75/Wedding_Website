import React from 'react'

interface MasonryGridProps {
  columns: Record<string, number>
  children: React.ReactNode
}

const MasonryGrid: React.FC<MasonryGridProps> = ({ columns, children }) => {
  const childrenArray = React.Children.toArray(children)
  const columnCount = columns.lg || 4

  return (
    <div className='flex gap-2'>
      {Array.from({ length: columnCount }).map((_, columnIndex) => (
        <div key={columnIndex} className='flex-1 flex flex-col gap-2'>
          {childrenArray.filter((_, index) => index % columnCount === columnIndex)}
        </div>
      ))}
    </div>
  )
}

export default MasonryGrid
