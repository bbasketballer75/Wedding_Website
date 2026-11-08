import { useCallback, type MouseEvent } from 'react'

/**
 * WCAG 2.4.1 bypass block. Hidden until focused, then focuses `#main-content`.
 * Class names mirror the frozen app so shell parity holds when focused.
 */
export function SkipLink() {
  const handleClick = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    const mainContent = document.getElementById('main-content')
    if (!mainContent) return
    mainContent.focus()
    mainContent.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return (
    <a
      href='#main-content'
      onClick={handleClick}
      className='sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50
                 focus:rounded-md focus:bg-gold-500 focus:px-4 focus:py-2 focus:font-medium
                 focus:text-white focus:shadow-lg focus:transition-all focus:duration-200'
    >
      Skip to main content
    </a>
  )
}
