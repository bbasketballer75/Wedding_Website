import { createContext, useContext } from 'react'

/**
 * Accessibility context/hook kept in a non-component module so
 * `AccessibilityProvider.tsx` only exports components (react-refresh).
 */
export type Politeness = 'polite' | 'assertive'

export interface AccessibilityContextValue {
  announce: (message: string, politeness?: Politeness) => void
  message: string
  politeness: Politeness
}

export const AccessibilityContext = createContext<AccessibilityContextValue | null>(null)

export function useAccessibility(): AccessibilityContextValue {
  const context = useContext(AccessibilityContext)
  if (!context) throw new Error('useAccessibility must be used inside AccessibilityProvider')
  return context
}
