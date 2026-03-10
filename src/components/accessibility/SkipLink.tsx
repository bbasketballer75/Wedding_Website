import { useAccessibility } from '@/accessibility/AccessibilityProvider'

/**
 * SkipLink - WCAG 2.4.1 Bypass Blocks
 * 
 * Allows keyboard users to skip navigation and jump to main content.
 * Hidden until focused, then appears at top of page.
 */
export function SkipLink() {
  const { setSkipLinkTarget } = useAccessibility()

  const handleClick = () => {
    const mainContent = document.getElementById('main-content')
    if (mainContent) {
      mainContent.focus()
      mainContent.scrollIntoView({ behavior: 'smooth' })
      setSkipLinkTarget('main-content')
    }
  }

  return (
    <a
      href="#main-content"
      onClick={(e) => {
        e.preventDefault()
        handleClick()
      }}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 
                 focus:z-50 focus:px-4 focus:py-2 focus:bg-gold-500 focus:text-white 
                 focus:rounded-md focus:font-medium focus:shadow-lg
                 transition-all duration-200"
    >
      Skip to main content
    </a>
  )
}

export default SkipLink
