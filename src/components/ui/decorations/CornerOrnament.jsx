import React from 'react'

const CornerOrnament = ({ position }) => {
  const isTop = position.includes('top')
  const isLeft = position.includes('left')

  return (
    <div
      className={`absolute z-20 pointer-events-none ${isTop ? 'top-4' : 'bottom-4'} ${
        isLeft ? 'left-4' : 'right-4'
      } ${!isTop ? 'rotate-180' : ''} ${!isLeft ? 'scale-x-[-1]' : ''}`}
    >
      <svg
        width='40'
        height='40'
        viewBox='0 0 40 40'
        fill='none'
        className='text-(--color-gold) opacity-60'
      >
        <path d='M0 0 L40 0 L40 2 L2 2 L2 40 L0 40 Z' fill='currentColor' />
        <circle cx='4' cy='4' r='2' fill='currentColor' />
      </svg>
    </div>
  )
}

export default CornerOrnament
