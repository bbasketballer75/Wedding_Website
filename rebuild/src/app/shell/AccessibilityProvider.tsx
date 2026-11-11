import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AccessibilityContext, type Politeness } from './accessibility-context'

/**
 * Screen-reader announcement surface. Wave 1 renders one polite live region;
 * later waves add the full keyboard-shortcut and focus-management contract.
 * The context/hook live in `./accessibility-context` so this module only
 * exports a component (react-refresh fast-refresh contract).
 */
export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('')
  const [politeness, setPoliteness] = useState<Politeness>('polite')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear the auto-dismiss timer on unmount: a timer that fires after the test
  // environment (or a route) tears down triggers setState on an unmounted tree
  // and, under jsdom teardown, an unhandled window is not defined error.
  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    },
    []
  )

  const announce = useCallback((nextMessage: string, nextPoliteness: Politeness = 'polite') => {
    setMessage(nextMessage)
    setPoliteness(nextPoliteness)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setMessage(''), 1000)
  }, [])

  const value = useMemo(() => ({ announce, message, politeness }), [announce, message, politeness])

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
      <div role='status' aria-live={politeness} aria-atomic='true' className='sr-only'>
        {message}
      </div>
    </AccessibilityContext.Provider>
  )
}
