/**
 * Focus Management System
 * Manages focus for accessibility and keyboard navigation
 */

export class FocusManager {
  private focusHistory: HTMLElement[] = []
  private focusTrapStack: HTMLElement[] = []

  /**
   * Set focus to element
   */
  focus(element: HTMLElement | null): void {
    if (!element) return

    // Save current focus
    if (document.activeElement instanceof HTMLElement) {
      this.focusHistory.push(document.activeElement)
    }

    element.focus()
  }

  /**
   * Return focus to previous element
   */
  returnFocus(): void {
    const previous = this.focusHistory.pop()
    if (previous) {
      previous.focus()
    }
  }

  /**
   * Trap focus within element (for modals, dialogs)
   */
  trapFocus(element: HTMLElement): () => void {
    this.focusTrapStack.push(element)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      const focusableElements = this.getFocusableElements(element)
      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey) {
        // Shift+Tab: going backwards
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab: going forwards
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    element.addEventListener('keydown', handleKeyDown)

    // Focus first element
    const focusableElements = this.getFocusableElements(element)
    if (focusableElements.length > 0) {
      focusableElements[0].focus()
    }

    // Return cleanup function
    return () => {
      element.removeEventListener('keydown', handleKeyDown)
      this.focusTrapStack = this.focusTrapStack.filter(el => el !== element)
      this.returnFocus()
    }
  }

  /**
   * Get all focusable elements within container
   */
  getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ')

    return Array.from(container.querySelectorAll(selector)).filter(
      el => el instanceof HTMLElement && this.isVisible(el)
    ) as HTMLElement[]
  }

  /**
   * Check if element is visible
   */
  private isVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element)
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
  }

  /**
   * Focus first focusable element
   */
  focusFirstElement(container: HTMLElement): void {
    const elements = this.getFocusableElements(container)
    if (elements.length > 0) {
      this.focus(elements[0])
    }
  }

  /**
   * Focus last focusable element
   */
  focusLastElement(container: HTMLElement): void {
    const elements = this.getFocusableElements(container)
    if (elements.length > 0) {
      this.focus(elements[elements.length - 1])
    }
  }

  /**
   * Get next focusable element
   */
  getNextFocusable(current: HTMLElement): HTMLElement | null {
    const all = this.getFocusableElements(document.body)
    const currentIndex = all.indexOf(current)

    if (currentIndex === -1) return null
    if (currentIndex === all.length - 1) return all[0] // Wrap to first

    return all[currentIndex + 1]
  }

  /**
   * Get previous focusable element
   */
  getPreviousFocusable(current: HTMLElement): HTMLElement | null {
    const all = this.getFocusableElements(document.body)
    const currentIndex = all.indexOf(current)

    if (currentIndex === -1) return null
    if (currentIndex === 0) return all[all.length - 1] // Wrap to last

    return all[currentIndex - 1]
  }

  /**
   * Clear focus history
   */
  clearHistory(): void {
    this.focusHistory = []
  }

  /**
   * Check if element has focus trap
   */
  hasFocusTrap(element: HTMLElement): boolean {
    return this.focusTrapStack.includes(element)
  }
}

export const focusManager = new FocusManager()

/**
 * Focus visible helper (for :focus-visible polyfill)
 */
export class FocusVisibleManager {
  private isKeyboardUser = false

  constructor() {
    this.initialize()
  }

  private initialize(): void {
    // Detect keyboard usage
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('mousedown', this.handleMouseDown)
    window.addEventListener('touchstart', this.handleTouchStart)
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Tab') {
      this.isKeyboardUser = true
      document.body.classList.add('keyboard-user')
    }
  }

  private handleMouseDown = (): void => {
    this.isKeyboardUser = false
    document.body.classList.remove('keyboard-user')
  }

  private handleTouchStart = (): void => {
    this.isKeyboardUser = false
    document.body.classList.remove('keyboard-user')
  }

  isUsingKeyboard(): boolean {
    return this.isKeyboardUser
  }
}

export const focusVisibleManager = new FocusVisibleManager()

export default {
  focusManager,
  focusVisibleManager,
}
