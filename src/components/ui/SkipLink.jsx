import React from 'react'

const SkipLink = ({ href = '#main', children = 'Skip to main content' }) => {
  return (
    <a
      href={href}
      className='sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-pink-600 text-white px-4 py-2 rounded-md z-50 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2'
    >
      {children}
    </a>
  )
}

export default SkipLink
