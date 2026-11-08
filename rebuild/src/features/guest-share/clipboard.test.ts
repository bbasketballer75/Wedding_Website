import { describe, expect, it, vi } from 'vitest'
import { copyAlbumLink, createBrowserClipboardAdapter, type ClipboardAdapter } from './clipboard'

describe('copyAlbumLink', () => {
  it('uses the Clipboard API when available', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve())
    const adapter: ClipboardAdapter = { writeText }

    await expect(copyAlbumLink('https://example.com/guest/token', adapter)).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith('https://example.com/guest/token')
  })

  it('reports a failed copy when the Clipboard API rejects (frozen behavior)', async () => {
    const writeText = vi.fn(() => Promise.reject(new Error('denied')))
    await expect(copyAlbumLink('https://example.com', { writeText })).resolves.toBe('failed')
  })

  it('falls back to execCommand when the Clipboard API is absent', async () => {
    const fallbackCopy = vi.fn(() => true)
    await expect(copyAlbumLink('https://example.com', { fallbackCopy })).resolves.toBe('copied')
    expect(fallbackCopy).toHaveBeenCalledWith('https://example.com')
  })

  it('reports failure when the fallback returns false or throws', async () => {
    await expect(copyAlbumLink('https://example.com', { fallbackCopy: () => false })).resolves.toBe(
      'failed'
    )
    await expect(
      copyAlbumLink('https://example.com', {
        fallbackCopy: () => {
          throw new Error('DOM exploded')
        },
      })
    ).resolves.toBe('failed')
  })

  it('reports unsupported when neither path exists', async () => {
    await expect(copyAlbumLink('https://example.com', {})).resolves.toBe('unsupported')
  })
})

describe('createBrowserClipboardAdapter', () => {
  it('prefers navigator.clipboard.writeText and forwards the text', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    const adapter = createBrowserClipboardAdapter()
    await copyAlbumLink('https://example.com/guest/token', adapter)

    expect(writeText).toHaveBeenCalledWith('https://example.com/guest/token')
    // Clean up the jsdom navigator override for later tests.
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
  })

  it('falls back to a hidden textarea + document.execCommand copy', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    const execCommand = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })

    const adapter = createBrowserClipboardAdapter()
    await expect(copyAlbumLink('https://example.com', adapter)).resolves.toBe('copied')
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()

    Reflect.deleteProperty(document, 'execCommand')
  })

  it('returns an empty adapter when neither API exists', () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })

    expect(createBrowserClipboardAdapter()).toEqual({})

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
  })
})
