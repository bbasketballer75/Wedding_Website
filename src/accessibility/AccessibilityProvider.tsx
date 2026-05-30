import React, { createContext, useContext, useState, useCallback } from 'react'

interface AccessibilityContextValue {
  // Focus management
  focusableElements: HTMLElement[]
  registerFocusable: (element: HTMLElement) => void
  unregisterFocusable: (element: HTMLElement) => void
  trapFocus: (container: HTMLElement) => void
  releaseFocus: () => void

  // Announcements for screen readers
  announce: (message: string, priority?: 'polite' | 'assertive') => void

  // Skip link
  skipLinkTarget: string | null
  setSkipLinkTarget: (target: string | null) => void
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null)

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [focusableElements, setFocusableElements] = useState<HTMLElement[]>([])
  const [skipLinkTarget, setSkipLinkTarget] = useState<string | null>(null)
  const [lastFocusedElement, setLastFocusedElement] = useState<HTMLElement | null>(null)

  const registerFocusable = useCallback((element: HTMLElement) => {
    setFocusableElements(prev => [...prev, element])
  }, [])

  const unregisterFocusable = useCallback((element: HTMLElement) => {
    setFocusableElements(prev => prev.filter(el => el !== element))
  }, [])

  const trapFocus = useCallback((container: HTMLElement) => {
    setLastFocusedElement(document.activeElement as HTMLElement)

    // Focus first focusable element
    const focusables = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusables.length > 0) {
      focusables[0].focus()
    }
  }, [])

  const releaseFocus = useCallback(() => {
    // Restore focus
    if (lastFocusedElement) {
      lastFocusedElement.focus()
    }
  }, [lastFocusedElement])

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div')
    announcement.setAttribute('role', 'status')
    announcement.setAttribute('aria-live', priority)
    announcement.setAttribute('aria-atomic', 'true')
    announcement.className = 'sr-only'
    announcement.textContent = message

    document.body.appendChild(announcement)

    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement)
    }, 1000)
  }, [])

  return (
    <AccessibilityContext.Provider
      value={{
        focusableElements,
        registerFocusable,
        unregisterFocusable,
        trapFocus,
        releaseFocus,
        announce,
        skipLinkTarget,
        setSkipLinkTarget,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAccessibility() {
  const context = useContext(AccessibilityContext)
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider')
  }
  return context
}
