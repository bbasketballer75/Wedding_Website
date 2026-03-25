/**
 * Keyboard Shortcuts System
 * Provides accessible keyboard navigation
 */

export interface KeyboardShortcut {
  key: string
  modifiers?: ('ctrl' | 'alt' | 'shift' | 'meta')[]
  description: string
  action: () => void
  category?: string
}

export class KeyboardShortcutManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map()
  private enabled: boolean = true

  constructor() {
    this.initialize()
  }

  /**
   * Initialize keyboard shortcuts
   */
  private initialize(): void {
    window.addEventListener('keydown', this.handleKeyDown)
  }

  /**
   * Register a keyboard shortcut
   */
  register(shortcut: KeyboardShortcut): void {
    const key = this.getShortcutKey(shortcut)
    this.shortcuts.set(key, shortcut)
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregister(key: string, modifiers?: ('ctrl' | 'alt' | 'shift' | 'meta')[]): void {
    const shortcutKey = this.buildKey(key, modifiers)
    this.shortcuts.delete(shortcutKey)
  }

  /**
   * Enable shortcuts
   */
  enable(): void {
    this.enabled = true
  }

  /**
   * Disable shortcuts
   */
  disable(): void {
    this.enabled = false
  }

  /**
   * Get all registered shortcuts
   */
  getAllShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values())
  }

  /**
   * Get shortcuts by category
   */
  getShortcutsByCategory(category: string): KeyboardShortcut[] {
    return this.getAllShortcuts().filter(s => s.category === category)
  }

  /**
   * Handle keydown event
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled) return

    // Don't trigger shortcuts when typing in input fields
    if (this.isInputElement(event.target as HTMLElement)) return

    const key = event.key.toLowerCase()
    const modifiers: ('ctrl' | 'alt' | 'shift' | 'meta')[] = []

    if (event.ctrlKey) modifiers.push('ctrl')
    if (event.altKey) modifiers.push('alt')
    if (event.shiftKey) modifiers.push('shift')
    if (event.metaKey) modifiers.push('meta')

    const shortcutKey = this.buildKey(key, modifiers)
    const shortcut = this.shortcuts.get(shortcutKey)

    if (shortcut) {
      event.preventDefault()
      shortcut.action()
    }
  }

  /**
   * Check if element is an input
   */
  private isInputElement(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase()
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      element.isContentEditable
    )
  }

  /**
   * Build shortcut key string
   */
  private buildKey(key: string, modifiers?: ('ctrl' | 'alt' | 'shift' | 'meta')[]): string {
    const parts: string[] = []

    if (modifiers) {
      if (modifiers.includes('ctrl')) parts.push('ctrl')
      if (modifiers.includes('alt')) parts.push('alt')
      if (modifiers.includes('shift')) parts.push('shift')
      if (modifiers.includes('meta')) parts.push('meta')
    }

    parts.push(key.toLowerCase())

    return parts.join('+')
  }

  /**
   * Get shortcut key from shortcut object
   */
  private getShortcutKey(shortcut: KeyboardShortcut): string {
    return this.buildKey(shortcut.key, shortcut.modifiers)
  }

  /**
   * Cleanup
   */
  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown)
    this.shortcuts.clear()
  }
}

// Singleton instance
export const keyboardShortcutManager = new KeyboardShortcutManager()

/**
 * Default keyboard shortcuts for the wedding website
 */
export const defaultShortcuts: KeyboardShortcut[] = [
  // Navigation
  {
    key: 'h',
    description: 'Go to home page',
    category: 'Navigation',
    action: () => (window.location.href = '/'),
  },
  {
    key: 'g',
    description: 'Go to gallery',
    category: 'Navigation',
    action: () => (window.location.href = '/gallery'),
  },
  {
    key: 'b',
    description: 'Go to guestbook',
    category: 'Navigation',
    action: () => (window.location.href = '/guestbook'),
  },
  {
    key: 's',
    description: 'Go to share page',
    category: 'Navigation',
    action: () => (window.location.href = '/upload'),
  },

  // Search
  {
    key: 'k',
    modifiers: ['ctrl'],
    description: 'Open search',
    category: 'Search',
    action: () => {
      const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement
      searchInput?.focus()
    },
  },

  // Accessibility
  {
    key: '?',
    modifiers: ['shift'],
    description: 'Show keyboard shortcuts',
    category: 'Help',
    action: () => {
      window.dispatchEvent(new CustomEvent('show-keyboard-shortcuts'))
    },
  },
  {
    key: 't',
    modifiers: ['ctrl'],
    description: 'Toggle theme',
    category: 'Appearance',
    action: () => {
      const event = new CustomEvent('toggle-theme')
      window.dispatchEvent(event)
    },
  },

  // Gallery
  {
    key: 'arrowleft',
    description: 'Previous photo',
    category: 'Gallery',
    action: () => {
      const event = new CustomEvent('gallery-previous')
      window.dispatchEvent(event)
    },
  },
  {
    key: 'arrowright',
    description: 'Next photo',
    category: 'Gallery',
    action: () => {
      const event = new CustomEvent('gallery-next')
      window.dispatchEvent(event)
    },
  },
  {
    key: 'escape',
    description: 'Close photo viewer',
    category: 'Gallery',
    action: () => {
      const event = new CustomEvent('gallery-close')
      window.dispatchEvent(event)
    },
  },
  {
    key: 'l',
    description: 'Like photo',
    category: 'Gallery',
    action: () => {
      const event = new CustomEvent('gallery-like')
      window.dispatchEvent(event)
    },
  },
]

/**
 * Initialize default shortcuts
 */
export function initializeDefaultShortcuts(): void {
  defaultShortcuts.forEach(shortcut => {
    keyboardShortcutManager.register(shortcut)
  })
}

export default keyboardShortcutManager
