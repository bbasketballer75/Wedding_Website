import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type Politeness = 'polite' | 'assertive'

interface AccessibilityContextValue {
  announce: (message: string, politeness?: Politeness) => void
  message: string
  politeness: Politeness
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null)

/**
 * Screen-reader announcement surface. Wave 1 renders one polite live region;
 * later waves add the full keyboard-shortcut and focus-management contract.
 */
export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('')
  const [politeness, setPoliteness] = useState<Politeness>('polite')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

export function useAccessibility() {
  const context = useContext(AccessibilityContext)
  if (!context) {
    throw new Error('useAccessibility must be used inside AccessibilityProvider')
  }
  return context
}
