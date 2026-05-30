import React, { useEffect, useState } from 'react'

interface MasonryGridProps {
  columns: {
    base?: number
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
  children: React.ReactNode
}

function getColumnCount(columns: MasonryGridProps['columns']): number {
  const w = window.innerWidth
  if (w >= 1280 && columns.xl != null) return columns.xl
  if (w >= 1024 && columns.lg != null) return columns.lg
  if (w >= 768 && columns.md != null) return columns.md
  if (w >= 640 && columns.sm != null) return columns.sm
  return columns.base ?? 1
}

const MasonryGrid: React.FC<MasonryGridProps> = ({ columns, children }) => {
  const [columnCount, setColumnCount] = useState(() => getColumnCount(columns))

  useEffect(() => {
    const update = () => setColumnCount(getColumnCount(columns))
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [columns])

  const childrenArray = React.Children.toArray(children)

  return (
    <div className='flex gap-2 [&>div]:content-visibility-auto'>
      {Array.from({ length: columnCount }).map((_, colIndex) => (
        <div key={colIndex} className='flex flex-1 flex-col gap-2'>
          {childrenArray.filter((_, i) => i % columnCount === colIndex)}
        </div>
      ))}
    </div>
  )
}

export default MasonryGrid
