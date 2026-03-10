import { useEffect } from 'react'

/**
 * Hook for registering keyboard shortcuts
 */
export const useKeyboardShortcuts = shortcuts => {
  useEffect(() => {
    const handleKeyDown = event => {
      const key = event.key.toLowerCase()
      const ctrl = event.ctrlKey || event.metaKey
      const shift = event.shiftKey
      const alt = event.altKey

      Object.entries(shortcuts).forEach(([shortcut, callback]) => {
        const parts = shortcut.toLowerCase().split('+')
        const shortcutKey = parts[parts.length - 1]
        const needsCtrl = parts.includes('ctrl') || parts.includes('cmd')
        const needsShift = parts.includes('shift')
        const needsAlt = parts.includes('alt')

        if (key === shortcutKey && ctrl === needsCtrl && shift === needsShift && alt === needsAlt) {
          event.preventDefault()
          callback(event)
        }
      })
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}

export default useKeyboardShortcuts
