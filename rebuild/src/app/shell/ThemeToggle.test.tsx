import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { AccessibilityProvider } from './AccessibilityProvider'
import { ThemeProvider } from './ThemeProvider'
import { ThemeToggle } from './ThemeToggle'

function renderToggle(props: { label?: boolean } = {}) {
  return render(
    <AccessibilityProvider>
      <ThemeProvider>
        <ThemeToggle {...props} />
      </ThemeProvider>
    </AccessibilityProvider>
  )
}

function persistedTheme(theme: 'dark' | 'light') {
  return JSON.stringify({ state: { currentTheme: theme }, version: 0 })
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('offers the opposite theme and flips the document theme on click', async () => {
    const user = userEvent.setup()
    renderToggle()

    const toggle = screen.getByRole('button', { name: 'Switch to Light theme' })
    expect(toggle).toHaveAttribute('title', 'Switch to Light theme')

    // Default persisted theme is dark (frozen contract).
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark-theme')).toBe(true)

    await user.click(toggle)

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.classList.contains('light-theme')).toBe(true)
    expect(document.documentElement.classList.contains('dark-theme')).toBe(false)
    expect(screen.getByRole('button', { name: 'Switch to Dark theme' })).toBeInTheDocument()
  })

  it('reads the persisted theme contract and shows the visible label when asked', () => {
    window.localStorage.setItem('ui-store', persistedTheme('light'))
    renderToggle({ label: true })

    const toggle = screen.getByRole('button', { name: 'Switch to Dark theme' })
    expect(toggle).toHaveTextContent('Light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('is also toggleable from the keyboard shortcut event the shell dispatches', () => {
    renderToggle()

    expect(document.documentElement.dataset.theme).toBe('dark')
    act(() => {
      window.dispatchEvent(new CustomEvent('toggle-theme'))
    })

    expect(screen.getByRole('button', { name: 'Switch to Dark theme' })).toBeInTheDocument()
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
