import { useCallback, useState } from 'react'

/** Frozen `useShareSite` (`src/pages/upload/useShareSite.ts`) with injectable seams. */
export interface UseShareSiteOptions {
  siteUrl?: string
  clipboard?: { writeText: (value: string) => Promise<void> }
  openWindow?: (url: string) => void
  schedule?: (callback: () => void, delayMs: number) => unknown
}

export interface UseShareSiteResult {
  siteShareUrl: string
  siteShareTitle: string
  siteShareDescription: string
  siteCopied: boolean
  handleCopyShareLink: () => Promise<void>
  openShareWindow: (url: string) => void
}

export function useShareSite({
  siteUrl,
  clipboard,
  openWindow,
  schedule = (callback, delayMs) => {
    if (typeof window === 'undefined') return undefined
    return window.setTimeout(callback, delayMs)
  },
}: UseShareSiteOptions = {}): UseShareSiteResult {
  const [siteCopied, setSiteCopied] = useState(false)

  const siteShareUrl =
    siteUrl ??
    (typeof window !== 'undefined'
      ? import.meta.env.VITE_SITE_URL || window.location.origin
      : import.meta.env.VITE_SITE_URL || '')
  const siteShareTitle = "Austin & Jordyn's Wedding"
  const siteShareDescription =
    'Watch the film, browse the gallery, read the guestbook, and share your side of the day.'

  const handleCopyShareLink = useCallback(async () => {
    const target = clipboard ?? (typeof navigator === 'undefined' ? undefined : navigator.clipboard)
    await target?.writeText(siteShareUrl)
    setSiteCopied(true)
    schedule(() => setSiteCopied(false), 1800)
  }, [clipboard, schedule, siteShareUrl])

  const openShareWindow = useCallback(
    (url: string) => {
      const target =
        openWindow ??
        ((shareUrl: string) => {
          if (typeof window !== 'undefined') window.open(shareUrl, '_blank', 'width=640,height=520')
        })
      target(url)
    },
    [openWindow]
  )

  return {
    siteShareUrl,
    siteShareTitle,
    siteShareDescription,
    siteCopied,
    handleCopyShareLink,
    openShareWindow,
  }
}
