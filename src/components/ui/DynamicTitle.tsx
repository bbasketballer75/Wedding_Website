import { useEffect, useRef } from 'react'

const DynamicTitle = () => {
  const originalTitle = useRef(document.title)

  useEffect(() => {
    const originalTitleContent = originalTitle.current

    const handleVisibilityChange = () => {
      if (document.hidden) {
        document.title = 'We miss you! ❤️'
      } else {
        document.title = originalTitleContent
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.title = originalTitleContent // Restore on unmount
    }
  }, [])

  return null // Headless component
}

export default DynamicTitle
