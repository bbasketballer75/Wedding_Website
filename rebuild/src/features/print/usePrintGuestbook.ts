import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchGuestbookForPrint, type GuestbookPrintEntry } from '@/shared/data/guestbook'
import type {
  LoadPrintGuestbook,
  UsePrintGuestbookOptions,
  UsePrintGuestbookResult,
} from './printTypes'

/**
 * Guestbook keepsake data for `/print`.
 *
 * Frozen behaviour (`src/pages/Print.tsx:157-187`): one chronological read on
 * mount (`order('created_at', ascending)`, `id/name/content/created_at` only),
 * included by default, with its own loading flag for the inline spinner.
 *
 * Data binding: the default loader is the Wave-3 data layer
 * (`fetchGuestbookForPrint`). The loader is injectable for tests and for
 * parity/e2e fixtures.
 *
 * TODO(Wave4 Lead): no additional wiring is required for production data; keep
 * the seam if the route later needs a Query-cache-backed loader.
 */
const defaultLoadGuestbook: LoadPrintGuestbook = () => fetchGuestbookForPrint()

export function usePrintGuestbook(options: UsePrintGuestbookOptions = {}): UsePrintGuestbookResult {
  const loader = options.loadGuestbook ?? defaultLoadGuestbook

  // See `usePrintAlbums`: track the latest loader without re-running the read.
  const loaderRef = useRef(loader)
  useEffect(() => {
    loaderRef.current = loader
  }, [loader])

  const [messages, setMessages] = useState<readonly GuestbookPrintEntry[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [includeGuestbook, setIncludeGuestbook] = useState<boolean>(true)
  const mountedRef = useRef<boolean>(true)

  useEffect(() => {
    mountedRef.current = true

    // One-shot read; state updates happen only after the await boundary so the
    // effect never sets state synchronously.
    const load = async (): Promise<void> => {
      try {
        const entries = await loaderRef.current()
        if (mountedRef.current) setMessages(entries)
      } catch (error) {
        console.error('Print: could not load the guestbook.', error)
        if (mountedRef.current) setMessages([])
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    }

    void load()

    return () => {
      mountedRef.current = false
    }
  }, [])

  const toggleGuestbook = useCallback((): void => {
    setIncludeGuestbook(included => !included)
  }, [])

  return {
    messages,
    loading,
    includeGuestbook,
    setIncludeGuestbook,
    toggleGuestbook,
  }
}
