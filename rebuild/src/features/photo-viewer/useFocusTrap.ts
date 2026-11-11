/**
 * Local port of the frozen `src/accessibility/focusManagement.ts` focus trap
 * (the only part the lightbox/share/print modals used), implemented without any
 * dependency.
 *
 * Behavior copied from the frozen `FocusManager.trapFocus`:
 *  - keydown listener on the dialog element; Tab from the last focusable wraps
 *    to the first, Shift+Tab from the first wraps to the last;
 *  - the first focusable element receives focus when the trap activates;
 *  - deactivation restores focus to the element that was focused before.
 */
import { useEffect, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function isVisible(element: HTMLElement): boolean {
  // Frozen visibility check on the element itself (display/visibility/opacity).
  const style = window.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false
  }

  // Also reject controls hidden by an ancestor's display/visibility. Opacity is
  // deliberately not inherited here: framer-motion animates the dialog's opacity
  // from 0, which is transient and must not make the trap think it is empty.
  let ancestor = element.parentElement
  while (ancestor && ancestor !== document.body) {
    const ancestorStyle = window.getComputedStyle(ancestor)
    if (ancestorStyle.display === 'none' || ancestorStyle.visibility === 'hidden') {
      return false
    }
    ancestor = ancestor.parentElement
  }

  return true
}

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element): element is HTMLElement => element instanceof HTMLElement && isVisible(element)
  )
}

export function handleTabTrap(event: KeyboardEvent, container: HTMLElement): void {
  if (event.key !== 'Tab') return

  const focusable = getFocusableElements(container)
  if (focusable.length === 0) return

  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (event.shiftKey) {
    if (document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    }
  } else if (document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}

/**
 * Trap focus inside `containerRef` while `isActive`, and restore the previous
 * focus on deactivation.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, isActive: boolean): void {
  useEffect(() => {
    if (!isActive) return
    const container = containerRef.current
    if (!container) return

    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const onKeyDown = (event: KeyboardEvent) => {
      handleTabTrap(event, container)
    }
    container.addEventListener('keydown', onKeyDown)

    const focusable = getFocusableElements(container)
    if (focusable.length > 0) {
      focusable[0]?.focus()
    } else {
      container.focus()
    }

    return () => {
      container.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus()
    }
  }, [containerRef, isActive])
}
