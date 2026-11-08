/**
 * `/guest/$token` page — parity port of the frozen `src/pages/GuestShare.tsx`
 * (549 lines; the frozen page was one component, here the composition lives in
 * this page while the frozen markup is split into tab/header/panel/state
 * components).
 *
 * Wave-6 scope:
 *  - token → guest album resolution with the frozen `invalid` vs `network` split
 *    ("Album Link Unresolved" / "Connection Trouble" + retry);
 *  - identity header (back link, eyebrow, `<h1>{name}'s Showcase`, stats,
 *    copy-link with Clipboard API + execCommand fallback + 2 s "copied" state);
 *  - photos tab (1/2/3-col grid, hover overlay, deduped photos) and guestbook-note
 *    tab, with the frozen auto-switch to the note tab when the album has notes
 *    but no photos;
 *  - lightbox trigger seam for the W5-2 `PhotoLightbox` (no second lightbox);
 *  - noindex metadata for every state (privacy improvement: the frozen page only
 *    set it after a successful load).
 *
 * The data seam (`GuestShareApi`) is the Lead's wiring point for
 * `shared/data/claims.fetchGuestContributionsByToken`.
 */
import { useCallback, useMemo, useState } from 'react'
import { usePageMeta } from '@/app/seo/usePageMeta'
import type { PhotoViewerEngagement } from '@/features/photo-viewer'
import { copyAlbumLink, createBrowserClipboardAdapter, type ClipboardAdapter } from './clipboard'
import { COPY_FEEDBACK_MS, GUEST_SHARE_COPY } from './constants'
import { useGuestShareAlbum } from './data'
import { GuestShareIdentityHeader } from './GuestShareIdentityHeader'
import { GuestShareLightboxSlot } from './GuestShareLightboxSlot'
import { GuestShareNotesPanel, GuestSharePhotosPanel } from './GuestSharePanels'
import { GuestShareErrorState, GuestShareLoadingState } from './GuestShareStates'
import { GuestShareTabs } from './GuestShareTabs'
import type { GuestShareApi } from './types'

export interface GuestSharePageProps {
  /** Route param (`/guest/$token`). Empty behaves like an unresolved link. */
  token: string | null | undefined
  /** Data seam (Lead swaps for the `shared/data/claims` adapter). */
  api?: GuestShareApi
  /** Clipboard seam (tests / older-browser simulation). */
  clipboard?: ClipboardAdapter
  /** URL copied by the share button (tests); defaults to `window.location.href`. */
  pageUrl?: string
  /** Notification seam (Wave 8 can wire the global toast here). */
  onNotify?: (message: string, kind: 'success' | 'warning') => void
  /** Scheduler seam for the 2 s "Copied Album Link" reset. */
  schedule?: (callback: () => void, delayMs: number) => unknown
  /** Lightbox engagement seams (wired to `shared/data` photos later). */
  onToggleLike?: (photoId: string) => void
  onSubmitComment?: PhotoViewerEngagement['onSubmitComment']
  isSubmittingComment?: boolean
}

export function GuestSharePage({
  token,
  api,
  clipboard,
  pageUrl,
  onNotify,
  schedule,
  onToggleLike,
  onSubmitComment,
  isSubmittingComment,
}: GuestSharePageProps) {
  const {
    status,
    guestName,
    photos,
    notes,
    photoCount,
    noteCount,
    errorKind,
    activeTab,
    setActiveTab,
    retry,
  } = useGuestShareAlbum(api === undefined ? { token } : { token, api })

  const [copied, setCopied] = useState(false)
  const [liveMessage, setLiveMessage] = useState('')
  const [openPhoto, setOpenPhoto] = useState<{ albumKey: string; index: number } | null>(null)

  // Derive the open lightbox index from the album identity so a token/album
  // change closes the viewer without a setState-in-effect.
  const albumKey = `${token ?? ''}:${guestName}:${photoCount}`
  const activePhotoIndex = openPhoto?.albumKey === albumKey ? openPhoto.index : null

  usePageMeta({
    title: guestName ? `${guestName}${GUEST_SHARE_COPY.metaTitleSuffix}` : 'Guest Album',
    description: guestName
      ? GUEST_SHARE_COPY.metaDescription(guestName)
      : 'Explore the photo uploads, photo claims, and handwritten guestbook notes contributed to our wedding archive.',
    noIndex: true,
  })

  const clipboardAdapter = useMemo(() => clipboard ?? createBrowserClipboardAdapter(), [clipboard])

  const handleCopy = useCallback(() => {
    const url = pageUrl ?? (typeof window === 'undefined' ? '' : window.location.href)
    void copyAlbumLink(url, clipboardAdapter).then(result => {
      if (result === 'copied') {
        setCopied(true)
        setLiveMessage(GUEST_SHARE_COPY.copySuccessMessage)
        onNotify?.(GUEST_SHARE_COPY.copySuccessMessage, 'success')
        const scheduler =
          schedule ??
          ((callback: () => void, delayMs: number) => {
            if (typeof window === 'undefined') return undefined
            return window.setTimeout(callback, delayMs)
          })
        scheduler(() => setCopied(false), COPY_FEEDBACK_MS)
        return
      }

      setLiveMessage(GUEST_SHARE_COPY.copyFailureMessage)
      onNotify?.(GUEST_SHARE_COPY.copyFailureMessage, 'warning')
    })
  }, [clipboardAdapter, onNotify, pageUrl, schedule])

  const engagement = useMemo<PhotoViewerEngagement>(
    () => ({
      ...(onToggleLike ? { onToggleLike } : {}),
      ...(onSubmitComment ? { onSubmitComment } : {}),
      ...(isSubmittingComment === undefined ? {} : { isSubmittingComment }),
    }),
    [isSubmittingComment, onSubmitComment, onToggleLike]
  )

  if (status === 'loading') return <GuestShareLoadingState />
  if (errorKind) return <GuestShareErrorState kind={errorKind} onRetry={retry} />

  return (
    <div className='min-h-screen bg-cream-50 pb-24 pt-28 sm:pt-32' data-testid='guest-share-page'>
      <div className='mx-auto max-w-5xl px-4 sm:px-6'>
        <GuestShareIdentityHeader
          guestName={guestName}
          photoCount={photoCount}
          noteCount={noteCount}
          copied={copied}
          onCopy={handleCopy}
        />

        <GuestShareTabs
          activeTab={activeTab}
          photoCount={photoCount}
          noteCount={noteCount}
          onChange={setActiveTab}
        />

        <div className='relative'>
          {activeTab === 'photos' ? (
            <GuestSharePhotosPanel
              photos={photos}
              onPhotoOpen={index => setOpenPhoto({ albumKey, index })}
            />
          ) : (
            <GuestShareNotesPanel notes={notes} />
          )}
        </div>
      </div>

      <GuestShareLightboxSlot
        photos={photos}
        isOpen={activePhotoIndex !== null}
        initialIndex={activePhotoIndex ?? 0}
        onClose={() => setOpenPhoto(null)}
        engagement={engagement}
      />

      <div role='status' aria-live='polite' className='sr-only'>
        {liveMessage}
      </div>
    </div>
  )
}

export default GuestSharePage
