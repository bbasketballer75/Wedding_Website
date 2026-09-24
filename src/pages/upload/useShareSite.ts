import { useCallback, useState } from 'react'

export interface UseShareSiteResult {
  siteShareUrl: string
  siteShareTitle: string
  siteShareDescription: string
  siteCopied: boolean
  handleCopyShareLink: () => Promise<void>
  openShareWindow: (url: string) => void
}

export function useShareSite(): UseShareSiteResult {
  const [siteCopied, setSiteCopied] = useState(false)

  const siteShareUrl =
    typeof window !== 'undefined'
      ? import.meta.env.VITE_SITE_URL || window.location.origin
      : import.meta.env.VITE_SITE_URL || ''
  const siteShareTitle = "Austin & Jordyn's Wedding"
  const siteShareDescription =
    'Watch the film, browse the gallery, read the guestbook, and share your side of the day.'

  const handleCopyShareLink = useCallback(async () => {
    await navigator.clipboard.writeText(siteShareUrl)
    setSiteCopied(true)
    window.setTimeout(() => setSiteCopied(false), 1800)
  }, [siteShareUrl])

  const openShareWindow = useCallback((url: string) => {
    window.open(url, '_blank', 'width=640,height=520')
  }, [])

  return {
    siteShareUrl,
    siteShareTitle,
    siteShareDescription,
    siteCopied,
    handleCopyShareLink,
    openShareWindow,
  }
}
