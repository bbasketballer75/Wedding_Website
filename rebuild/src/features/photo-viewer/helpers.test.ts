import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as viewer from './index'
import { getFocusableElements, handleTabTrap } from './useFocusTrap'
import { isVerifiedName, normalizeVerifiedNames, useVerifiedNames } from './useVerifiedNames'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('verified names helpers', () => {
  it('normalizes names with the frozen trim + lowercase contract', () => {
    expect(normalizeVerifiedNames(['  Austin Porada ', 'JORDYN'])).toEqual([
      'austin porada',
      'jordyn',
    ])
    expect(normalizeVerifiedNames(['', '   '])).toEqual([])
  })

  it('checks verification case-insensitively', () => {
    const names = ['austin porada']
    expect(isVerifiedName('  Austin Porada', names)).toBe(true)
    expect(isVerifiedName('Jordyn Porada', names)).toBe(false)
  })

  it('loads and normalizes names when the viewer opens', async () => {
    const load = vi.fn().mockResolvedValue([' Austin Porada '])
    const { result } = renderHook(() => useVerifiedNames(true, load))

    await waitFor(() => expect(result.current).toEqual(['austin porada']))
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('does not load while closed', () => {
    const load = vi.fn().mockResolvedValue([])
    renderHook(() => useVerifiedNames(false, load))
    expect(load).not.toHaveBeenCalled()
  })

  it('logs and falls back to an empty set when loading fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const load = vi.fn().mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useVerifiedNames(true, load))

    await waitFor(() => expect(consoleError).toHaveBeenCalled())
    expect(result.current).toEqual([])
  })
})

describe('focus trap helpers', () => {
  function buildContainer() {
    const container = document.createElement('div')
    container.innerHTML = `
      <a href="/first">first</a>
      <button type="button">second</button>
      <button type="button" disabled>disabled</button>
      <div tabindex="-1">negative</div>
      <div style="display: none"><button type="button">hidden</button></div>
      <input />
    `
    document.body.appendChild(container)
    return container
  }

  it('collects only visible focusable elements', () => {
    const container = buildContainer()
    const focusable = getFocusableElements(container)
    expect(focusable).toHaveLength(3)
    expect(focusable.map(element => element.textContent?.trim())).toEqual(['first', 'second', ''])
    container.remove()
  })

  it('wraps Tab and Shift+Tab inside the container', () => {
    const container = buildContainer()
    const focusable = getFocusableElements(container)
    const first = focusable[0] as HTMLElement
    const last = focusable[focusable.length - 1] as HTMLElement

    last.focus()
    handleTabTrap(new KeyboardEvent('keydown', { key: 'Tab' }), container)
    expect(first).toHaveFocus()

    handleTabTrap(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }), container)
    expect(last).toHaveFocus()
    container.remove()
  })
})

describe('photo-viewer barrel', () => {
  it('exports the documented public API', () => {
    expect(viewer.PhotoLightbox).toBeTypeOf('function')
    expect(viewer.ShareModal).toBeTypeOf('function')
    expect(viewer.PrintModal).toBeTypeOf('function')
    expect(viewer.useVerifiedNames).toBeTypeOf('function')
    expect(viewer.normalizeVerifiedNames).toBeTypeOf('function')
    expect(viewer.isVerifiedName).toBeTypeOf('function')
    expect(viewer.useFocusTrap).toBeTypeOf('function')
    expect(viewer.getFocusableElements).toBeTypeOf('function')
    expect(viewer.handleTabTrap).toBeTypeOf('function')
    expect(viewer.useTouchGestures).toBeTypeOf('function')
    expect(viewer.COMMENT_AUTHOR_STORAGE_KEY).toBe('wedding-gallery-comment-author')
  })
})
