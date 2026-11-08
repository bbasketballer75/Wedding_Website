/**
 * Copy-link helper for the guest album header.
 *
 * Frozen behaviour (`src/pages/GuestShare.tsx:115-146`): prefer the async
 * Clipboard API; when it is unavailable (older Safari, insecure context) fall
 * back to a hidden textarea + `document.execCommand('copy')`; any failure is
 * reported so the page can show the frozen warning copy instead of pretending
 * the link was copied.
 *
 * The adapter is injectable so tests can pin each branch deterministically.
 */

export type CopyResult = 'copied' | 'failed' | 'unsupported'

export interface ClipboardAdapter {
  /** Async Clipboard API (`navigator.clipboard.writeText`), when available. */
  writeText?: (text: string) => Promise<void>
  /** Synchronous fallback (`document.execCommand('copy')`), returns success. */
  fallbackCopy?: (text: string) => boolean
}

/** Apply the frozen preference order and map every outcome to a result. */
export async function copyAlbumLink(url: string, adapter: ClipboardAdapter): Promise<CopyResult> {
  if (adapter.writeText) {
    try {
      await adapter.writeText(url)
      return 'copied'
    } catch {
      // Frozen behaviour: the Clipboard API failing is a copy failure (the
      // execCommand fallback is only used when the API is absent).
      return 'failed'
    }
  }

  if (adapter.fallbackCopy) {
    try {
      return adapter.fallbackCopy(url) ? 'copied' : 'failed'
    } catch {
      return 'failed'
    }
  }

  return 'unsupported'
}

/** Browser adapter: real Clipboard API + hidden-textarea fallback. */
export function createBrowserClipboardAdapter(): ClipboardAdapter {
  const clipboard =
    typeof navigator === 'undefined' ? undefined : (navigator.clipboard as Clipboard | undefined)

  if (clipboard?.writeText) {
    return { writeText: (text: string) => clipboard.writeText(text) }
  }

  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') {
    return {}
  }

  return {
    fallbackCopy: (text: string) => {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'absolute'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()

      try {
        return document.execCommand('copy')
      } finally {
        document.body.removeChild(textarea)
      }
    },
  }
}
