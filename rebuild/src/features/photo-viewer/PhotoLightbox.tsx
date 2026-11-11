import { AnimatePresence, motion } from 'framer-motion'
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Heart,
  Loader2,
  MessageCircle,
  Printer,
  Send,
  Share2,
  ShieldCheck,
  Tag,
  User,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/shared/lib/cn'
import { Avatar, Button, Input } from '@/shared/ui'
import { PrintModal } from './PrintModal'
import { ShareModal } from './ShareModal'
import type { PhotoLightboxProps, ViewerFace } from './types'
import { useFocusTrap } from './useFocusTrap'
import { useTouchGestures } from './useTouchGestures'

/** Frozen comment-author storage key (`src/components/gallery/constants.ts`). */
export const COMMENT_AUTHOR_STORAGE_KEY = 'wedding-gallery-comment-author'

const ZOOM_MIN = 1
const ZOOM_MAX = 3
const ZOOM_STEP = 0.5
const DOUBLE_TAP_MS = 300
const DOUBLE_TAP_DISTANCE = 30

function clampZoom(zoom: number): number {
  return Math.min(Math.max(zoom, ZOOM_MIN), ZOOM_MAX)
}

function photoLikeCount(photo: { likeCount?: number; likes?: number }): number {
  return photo.likeCount ?? photo.likes ?? 0
}

/**
 * Frozen `src/components/photo-viewer/PhotoLightbox.tsx` port (773 lines).
 *
 * Preserved verbatim: portal dialog markup/classes, `role="dialog"` +
 * `aria-modal` + `aria-labelledby`, toolbar, face hotspots with verified-name
 * badge, caption slide-up, bottom toolbar (like/share/download/print/details),
 * Details & Comments tabs, comment form (author persisted under
 * `wedding-gallery-comment-author`), share modal trigger (also writes
 * `?shared=<id>`), print modal trigger, ←/→/Esc, `l` like shortcut, zoom
 * 1–3× via buttons / double-tap / pinch, and swipe-to-navigate at 1×.
 *
 * Contract deltas vs the frozen component (all required by the rebuild):
 * 1. Controlled props instead of the frozen Zustand store: `isOpen`,
 *    `photos`, `initialIndex`, `onClose`, and injected engagement handlers.
 * 2. EXIF is injected via `photo.exif` (frozen parsed it with `exifr`, a
 *    devDependency imported by shipped code; no new deps are allowed here).
 * 3. Local `useFocusTrap` replaces the frozen `focusManager` singleton
 *    (same Tab-wrap + focus-restore behavior).
 * 4. Comments flagged `is_hidden` are filtered out before render (moderation
 *    data, so the viewer never shows a hidden comment; the frozen data layer
 *    filtered them before they reached the component).
 * 5. `data-zoom` is exposed on the image transform wrapper so the zoom clamp
 *    is testable/e2e-checkable without asserting animation frames.
 */
function PhotoLightboxSession({
  isOpen,
  photos,
  initialIndex = 0,
  onClose,
  engagement = {},
  verifiedNames = [],
  onDownload,
  onShare,
  isDownloading = false,
  highlightedFaceName = null,
}: PhotoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.min(Math.max(initialIndex, 0), Math.max(photos.length - 1, 0))
  )
  const [showInfo, setShowInfo] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 1024
  )
  const [showFaces, setShowFaces] = useState(true)
  const [zoom, setZoom] = useState(ZOOM_MIN)
  const [commentAuthor, setCommentAuthor] = useState(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem(COMMENT_AUTHOR_STORAGE_KEY) || ''
  })
  const [newComment, setNewComment] = useState('')
  const [activeTab, setActiveTab] = useState<'info' | 'comments'>('info')
  const [selectedFace, setSelectedFace] = useState<string | null>(null)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [isImageHovered, setIsImageHovered] = useState(false)

  const lightboxRef = useRef<HTMLDivElement>(null)
  const lightboxContentRef = useRef<HTMLDivElement>(null)
  const doubleTapTimer = useRef<{ x: number; y: number; time: number } | null>(null)

  const currentPhoto = photos[currentIndex]
  const hasMultiplePhotos = photos.length > 1
  const normalizedVerifiedNames = useMemo(() => {
    return verifiedNames.map(name => name.trim().toLowerCase())
  }, [verifiedNames])

  const visibleFaces: ViewerFace[] = useMemo(
    () =>
      (currentPhoto?.faces ?? []).filter(face =>
        highlightedFaceName ? face.name === highlightedFaceName : true
      ),
    [currentPhoto?.faces, highlightedFaceName]
  )
  const shouldRenderFaceOverlay = showFaces && (isImageHovered || Boolean(highlightedFaceName))
  const defaultSelectedFaceId = highlightedFaceName
    ? ((currentPhoto?.faces ?? []).find(face => face.name === highlightedFaceName)?.id ?? null)
    : null
  const activeSelectedFaceId =
    selectedFace && (currentPhoto?.faces ?? []).some(face => face.id === selectedFace)
      ? selectedFace
      : defaultSelectedFaceId

  const visibleComments = useMemo(
    () => (currentPhoto?.comments ?? []).filter(comment => !comment.is_hidden),
    [currentPhoto?.comments]
  )

  // Reset navigation state whenever a new open session starts.
  // The expensive one-time work lives in the session wrapper below: one fresh
  // mounted session per open means the requested `initialIndex` is selected
  // without a setState-in-effect sync.

  const handlePrevious = useCallback(() => {
    setCurrentIndex(index => {
      if (index <= 0) return index
      setZoom(ZOOM_MIN)
      setSelectedFace(null)
      return index - 1
    })
  }, [])

  const handleNext = useCallback(() => {
    setCurrentIndex(index => {
      if (index >= photos.length - 1) return index
      setZoom(ZOOM_MIN)
      setSelectedFace(null)
      return index + 1
    })
  }, [photos.length])

  // Wire pinch-to-zoom (frozen: scale clamped to the same 1–3× range).
  useTouchGestures(lightboxContentRef, {
    onPinch: scale => {
      setZoom(current => clampZoom(current * scale))
    },
    onSwipeLeft: () => {
      if (zoom === ZOOM_MIN) handleNext()
    },
    onSwipeRight: () => {
      if (zoom === ZOOM_MIN) handlePrevious()
    },
  })

  // Focus trap + keyboard controls while open (frozen document-level contract).
  const trapActive = isOpen && Boolean(currentPhoto)
  useFocusTrap(lightboxRef, trapActive)

  useEffect(() => {
    if (!trapActive) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key === 'ArrowLeft') {
        handlePrevious()
        return
      }
      if (event.key === 'ArrowRight') {
        handleNext()
        return
      }
      if (event.key === 'l' && currentPhoto) {
        engagement.onToggleLike?.(currentPhoto.id)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [trapActive, onClose, handlePrevious, handleNext, currentPhoto, engagement])

  const handleSubmitComment = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newComment.trim() || !currentPhoto) return

    const didCreate = await engagement.onSubmitComment?.(currentPhoto.id, {
      author: commentAuthor,
      content: newComment,
    })

    if (didCreate !== false) {
      if (typeof window !== 'undefined' && commentAuthor.trim()) {
        window.localStorage.setItem(COMMENT_AUTHOR_STORAGE_KEY, commentAuthor.trim())
      }
      setNewComment('')
    }
  }

  if (!currentPhoto) return null

  const handleDoubleTapZoom = (clientX: number, clientY: number) => {
    const now = Date.now()
    const previous = doubleTapTimer.current
    if (previous) {
      const dx = clientX - previous.x
      const dy = clientY - previous.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < DOUBLE_TAP_DISTANCE && now - previous.time < DOUBLE_TAP_MS) {
        setZoom(current => (current === ZOOM_MIN ? 2 : ZOOM_MIN))
        doubleTapTimer.current = null
        return
      }
    }
    doubleTapTimer.current = { x: clientX, y: clientY, time: now }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className='fixed inset-0 z-50 flex bg-black/95'
        onClick={event => {
          if (event.target === event.currentTarget) {
            onClose()
          }
        }}
      >
        {/* Main Image Area */}
        <div
          ref={lightboxRef}
          role='dialog'
          aria-modal='true'
          aria-labelledby='lightbox-title'
          tabIndex={-1}
          className='flex-1 flex flex-col relative'
        >
          <span id='lightbox-title' className='sr-only'>
            Photo viewer — {currentPhoto.caption || `Photo ${currentIndex + 1} of ${photos.length}`}
          </span>
          {/* Toolbar */}
          <div className='absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/55 to-transparent p-2.5 sm:p-4'>
            <div className='flex items-center gap-2'>
              <span className='rounded-full bg-black/25 px-3 py-1 text-white/85 text-sm backdrop-blur-sm'>
                {currentIndex + 1} / {photos.length}
              </span>
              {currentPhoto.faces && currentPhoto.faces.length > 0 && (
                <button
                  onClick={event => {
                    event.stopPropagation()
                    setShowFaces(!showFaces)
                  }}
                  type='button'
                  aria-label={showFaces ? 'Turn off face hints' : 'Turn on face hints'}
                  className={cn(
                    'p-2.5 rounded-full transition-colors',
                    showFaces
                      ? 'bg-gold-500 text-white'
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                  )}
                >
                  <Tag className='w-4 h-4' />
                </button>
              )}
            </div>
            <div className='flex items-center gap-2'>
              <button
                onClick={event => {
                  event.stopPropagation()
                  setZoom(current => clampZoom(current + ZOOM_STEP))
                }}
                type='button'
                aria-label='Zoom in'
                className='rounded-full bg-white/10 p-2.5 text-white/80 transition-colors hover:bg-white/20'
              >
                <ZoomIn className='w-5 h-5' />
              </button>
              <button
                onClick={event => {
                  event.stopPropagation()
                  setZoom(current => clampZoom(current - ZOOM_STEP))
                }}
                type='button'
                aria-label='Zoom out'
                className='rounded-full bg-white/10 p-2.5 text-white/80 transition-colors hover:bg-white/20'
              >
                <ZoomOut className='w-5 h-5' />
              </button>
              <button
                onClick={event => {
                  event.stopPropagation()
                  onClose()
                }}
                type='button'
                aria-label='Close photo viewer'
                className='rounded-full bg-white/10 p-2.5 text-white/80 transition-colors hover:bg-white/20'
              >
                <X className='w-5 h-5' />
              </button>
            </div>
          </div>

          {/* Navigation Arrows */}
          {hasMultiplePhotos && (
            <>
              <button
                onClick={event => {
                  event.stopPropagation()
                  handlePrevious()
                }}
                type='button'
                aria-label='Previous photo'
                disabled={currentIndex === 0}
                className='absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30 sm:left-4 sm:p-3.5'
              >
                <ChevronLeft className='w-6 h-6' />
              </button>
              <button
                onClick={event => {
                  event.stopPropagation()
                  handleNext()
                }}
                type='button'
                aria-label='Next photo'
                disabled={currentIndex === photos.length - 1}
                className='absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30 sm:right-4 sm:p-3.5'
              >
                <ChevronRight className='w-6 h-6' />
              </button>
            </>
          )}

          {/* Image Container with Face Tags */}
          <motion.div
            ref={lightboxContentRef}
            data-testid='lightbox-content'
            className='flex flex-1 items-center justify-center overflow-hidden p-3 sm:p-8'
            drag={zoom === ZOOM_MIN ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            onDragEnd={(_, info) => {
              if (zoom > ZOOM_MIN) return
              if (info.offset.x < -50 && info.velocity.x < -80) handleNext()
              else if (info.offset.x > 50 && info.velocity.x > 80) handlePrevious()
            }}
          >
            <motion.div
              data-testid='lightbox-image'
              data-zoom={zoom}
              animate={{ scale: zoom }}
              transition={{ duration: 0.3 }}
              className='relative'
              onMouseEnter={() => setIsImageHovered(true)}
              onMouseLeave={() => {
                setIsImageHovered(false)
                if (!highlightedFaceName) {
                  setSelectedFace(null)
                }
              }}
            >
              <AnimatePresence mode='wait'>
                <motion.img
                  key={currentPhoto.id}
                  src={currentPhoto.url}
                  alt={currentPhoto.caption || 'Wedding photo'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className='max-h-[calc(100vh-11rem)] max-w-full rounded-lg object-contain sm:max-h-[80vh]'
                  onClick={event => {
                    event.stopPropagation()
                    handleDoubleTapZoom(event.clientX, event.clientY)
                  }}
                />
              </AnimatePresence>
              {/* Vignette overlay */}
              <div className='pointer-events-none absolute inset-0 rounded-lg bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.32)_100%)]' />

              {shouldRenderFaceOverlay &&
                visibleFaces.map(face => {
                  const isVerified = normalizedVerifiedNames.includes(
                    face.name.trim().toLowerCase()
                  )
                  return (
                    <button
                      key={face.id}
                      onClick={event => {
                        event.stopPropagation()
                        setSelectedFace(face.id)
                      }}
                      type='button'
                      aria-label={`Show tag for ${face.name}`}
                      className='absolute w-14 h-14 sm:w-12 sm:h-12 -translate-x-1/2 -translate-y-1/2'
                      style={{ left: `${face.x}%`, top: `${face.y}%` }}
                    >
                      <div
                        className={cn(
                          'w-full h-full rounded-full border-2 transition-all',
                          activeSelectedFaceId === face.id
                            ? 'border-gold-400 bg-gold-400/20'
                            : 'border-white/70 hover:border-gold-400 hover:bg-gold-400/10'
                        )}
                      />
                      {(activeSelectedFaceId === face.id || Boolean(highlightedFaceName)) && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            'absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1 text-sm rounded-full whitespace-nowrap shadow-md flex items-center gap-1.5 font-sans',
                            isVerified
                              ? 'bg-gold-500 text-white font-medium italic border border-gold-400/30'
                              : 'bg-charcoal-900 text-white'
                          )}
                        >
                          {isVerified && (
                            <ShieldCheck className='w-3.5 h-3.5 text-white flex-shrink-0' />
                          )}
                          {face.name}
                        </motion.div>
                      )}
                    </button>
                  )
                })}
            </motion.div>
          </motion.div>

          {/* Caption slide-up */}
          {currentPhoto.caption && (
            <motion.div
              key={`caption-${currentPhoto.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.12 }}
              className='absolute bottom-[4.5rem] left-0 right-0 px-6 pb-1 text-center sm:bottom-[5rem]'
            >
              <p className='font-display text-sm italic text-white/70 drop-shadow-sm'>
                {currentPhoto.caption}
              </p>
            </motion.div>
          )}

          {/* Bottom Toolbar */}
          <div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:p-4'>
            <div className='flex flex-wrap items-center justify-center gap-2 sm:gap-3'>
              <button
                onClick={event => {
                  event.stopPropagation()
                  engagement.onToggleLike?.(currentPhoto.id)
                }}
                type='button'
                aria-label={currentPhoto.liked ? 'Unlike photo' : 'Like photo'}
                className={cn(
                  'flex min-h-11 items-center gap-2 px-4 py-2 rounded-full transition-colors',
                  currentPhoto.liked
                    ? 'bg-rose-500 text-white'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                )}
              >
                <Heart className={cn('w-5 h-5', currentPhoto.liked && 'fill-current')} />
                <span>{photoLikeCount(currentPhoto)}</span>
              </button>
              <button
                onClick={event => {
                  event.stopPropagation()
                  onShare?.(currentPhoto.id)
                  // Update URL with ?shared= so copied link reflects the shared photo
                  const url = new URL(window.location.href)
                  url.searchParams.set('shared', currentPhoto.id)
                  window.history.pushState(null, '', url.toString())
                  setShareModalOpen(true)
                }}
                type='button'
                aria-label='Share photo'
                className='flex min-h-11 items-center gap-2 px-3 py-2 bg-white/10 text-white/80 rounded-full hover:bg-white/20 transition-colors'
              >
                <Share2 className='w-5 h-5' />
              </button>
              <button
                onClick={event => {
                  event.stopPropagation()
                  onDownload?.(currentPhoto.id)
                }}
                type='button'
                aria-label='Download photo'
                disabled={isDownloading}
                className='flex min-h-11 items-center gap-2 px-4 py-2 bg-white/10 text-white/80 rounded-full hover:bg-white/20 transition-colors disabled:opacity-50'
              >
                {isDownloading ? (
                  <Loader2 className='w-5 h-5 animate-spin' />
                ) : (
                  <Download className='w-5 h-5' />
                )}
                <span className='text-sm'>Download</span>
              </button>
              <button
                onClick={event => {
                  event.stopPropagation()
                  setPrintModalOpen(true)
                }}
                type='button'
                aria-label='Order physical prints'
                className='flex min-h-11 items-center gap-2 px-4 py-2 bg-white/10 text-white/80 rounded-full hover:bg-white/20 transition-colors'
              >
                <Printer className='w-5 h-5' />
                <span className='text-sm'>Order Prints</span>
              </button>
              <button
                onClick={event => {
                  event.stopPropagation()
                  setShowInfo(!showInfo)
                }}
                type='button'
                aria-label={showInfo ? 'Hide photo details' : 'Show photo details'}
                className={cn(
                  'flex min-h-11 items-center gap-2 px-4 py-2 rounded-full transition-colors',
                  showInfo
                    ? 'bg-gold-500 text-white'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                )}
              >
                <MessageCircle className='w-5 h-5' />
                <span className='text-sm'>
                  {currentPhoto.commentCount ?? currentPhoto.comments?.length ?? 0}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Info Panel */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{
                x: typeof window !== 'undefined' && window.innerWidth < 640 ? 0 : 300,
                y: typeof window !== 'undefined' && window.innerWidth < 640 ? 300 : 0,
                opacity: 0,
              }}
              animate={{ x: 0, y: 0, opacity: 1 }}
              exit={{
                x: typeof window !== 'undefined' && window.innerWidth < 640 ? 0 : 300,
                y: typeof window !== 'undefined' && window.innerWidth < 640 ? 300 : 0,
                opacity: 0,
              }}
              className='fixed inset-x-0 bottom-0 z-20 flex h-[min(72vh,34rem)] flex-col rounded-t-[1.5rem] border-t border-charcoal-800 bg-charcoal-900 landscape:h-[min(55vh,28rem)] sm:relative sm:inset-auto sm:h-auto sm:w-80 sm:rounded-none sm:border-l sm:border-t-0 sm:landscape:h-auto'
              onClick={event => event.stopPropagation()}
            >
              {/* Tabs */}
              <div className='flex border-b border-charcoal-800'>
                <button
                  onClick={() => setActiveTab('info')}
                  type='button'
                  className={cn(
                    'flex-1 py-3 text-sm font-medium transition-colors',
                    activeTab === 'info'
                      ? 'text-gold-400 border-b-2 border-gold-400'
                      : 'text-charcoal-400 hover:text-white'
                  )}
                >
                  Details
                </button>
                <button
                  onClick={() => setActiveTab('comments')}
                  type='button'
                  className={cn(
                    'flex-1 py-3 text-sm font-medium transition-colors',
                    activeTab === 'comments'
                      ? 'text-gold-400 border-b-2 border-gold-400'
                      : 'text-charcoal-400 hover:text-white'
                  )}
                >
                  Comments ({currentPhoto.commentCount ?? currentPhoto.comments?.length ?? 0})
                </button>
              </div>

              {/* Tab Content */}
              <div className='flex-1 overflow-y-auto p-4 pb-8 sm:pb-4'>
                {activeTab === 'info' ? (
                  <div className='space-y-4'>
                    {currentPhoto.caption && (
                      <div>
                        <h3 className='text-white font-medium mb-2'>{currentPhoto.caption}</h3>
                        <p className='text-sm leading-6 text-charcoal-400'>
                          Keep the focus on the image. Download, comment, or use the people list
                          only when you need the extra context.
                        </p>
                      </div>
                    )}

                    {(currentPhoto.time || currentPhoto.date) && (
                      <div className='flex items-center gap-2 text-charcoal-500 text-sm'>
                        <Clock className='w-4 h-4 text-gold-500' />
                        <span>
                          {currentPhoto.time && `${currentPhoto.time} • `}
                          {currentPhoto.date &&
                            new Date(currentPhoto.date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              month: 'long',
                              day: 'numeric',
                            })}
                        </span>
                      </div>
                    )}

                    {/* People in Photo */}
                    {currentPhoto.faces && currentPhoto.faces.length > 0 && (
                      <div>
                        <h4 className='text-charcoal-400 text-sm mb-2'>People in this photo</h4>
                        <div className='flex flex-wrap gap-2'>
                          {currentPhoto.faces.map(face => {
                            const isVerified = normalizedVerifiedNames.includes(
                              face.name.trim().toLowerCase()
                            )
                            return (
                              <div
                                key={face.id}
                                className={cn(
                                  'flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all',
                                  isVerified
                                    ? 'bg-gold-500/10 border-gold-500/30 text-gold-500'
                                    : 'bg-charcoal-800 border-charcoal-700 text-charcoal-300'
                                )}
                              >
                                {isVerified ? (
                                  <ShieldCheck className='w-3.5 h-3.5 text-gold-500' />
                                ) : (
                                  <User className='w-3.5 h-3.5 text-gold-500' />
                                )}
                                <span
                                  className={cn(
                                    'text-sm font-sans',
                                    isVerified
                                      ? 'font-medium italic text-gold-500'
                                      : 'text-charcoal-300'
                                  )}
                                >
                                  {face.name}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* EXIF Metadata (injected — frozen parsed it with exifr) */}
                    {currentPhoto.exif?.camera && (
                      <div className='flex items-center gap-2 text-charcoal-500 text-sm'>
                        <Camera className='w-4 h-4 text-gold-500' />
                        <span>{currentPhoto.exif.camera}</span>
                      </div>
                    )}
                    {currentPhoto.exif?.lens && (
                      <div className='text-charcoal-500 text-sm'>
                        <span>{currentPhoto.exif.lens}</span>
                      </div>
                    )}
                    {(currentPhoto.exif?.aperture ||
                      currentPhoto.exif?.shutterSpeed ||
                      currentPhoto.exif?.iso) && (
                      <div className='flex items-center gap-3 text-charcoal-500 text-sm'>
                        {currentPhoto.exif.aperture && <span>{currentPhoto.exif.aperture}</span>}
                        {currentPhoto.exif.shutterSpeed && (
                          <span>{currentPhoto.exif.shutterSpeed}</span>
                        )}
                        {currentPhoto.exif.iso && <span>{currentPhoto.exif.iso}</span>}
                      </div>
                    )}
                    {!currentPhoto.exif && (
                      <p className='text-sm text-charcoal-500'>No metadata available</p>
                    )}

                    {!currentPhoto.caption &&
                      !(currentPhoto.faces && currentPhoto.faces.length > 0) && (
                        <p className='text-sm leading-6 text-charcoal-400'>
                          Use the toolbar for download and comments. This panel stays intentionally
                          light unless the photo has people or a caption attached.
                        </p>
                      )}
                  </div>
                ) : (
                  /* Comments Tab */
                  <div className='space-y-4'>
                    {visibleComments.map(comment => (
                      <div key={comment.id} className='flex gap-3'>
                        <Avatar fallback={comment.author} size='sm' />
                        <div className='flex-1'>
                          <div className='flex items-center gap-2 mb-1'>
                            <span className='text-white font-medium text-sm'>{comment.author}</span>
                            <span className='text-charcoal-500 text-xs'>{comment.timestamp}</span>
                          </div>
                          <p className='text-charcoal-300 text-sm'>{comment.content}</p>
                        </div>
                      </div>
                    ))}

                    {/* Add Comment */}
                    <form
                      onSubmit={event => {
                        void handleSubmitComment(event)
                      }}
                      className='mt-4 space-y-3'
                    >
                      <Input
                        value={commentAuthor}
                        onChange={event => setCommentAuthor(event.target.value)}
                        placeholder='Your name'
                        maxLength={60}
                        className='bg-charcoal-800 border-charcoal-700 text-white placeholder:text-charcoal-500'
                      />
                      <div className='flex gap-2'>
                        <Input
                          value={newComment}
                          onChange={event => setNewComment(event.target.value)}
                          placeholder='Add a comment...'
                          className='flex-1 bg-charcoal-800 border-charcoal-700 text-white placeholder:text-charcoal-500'
                          maxLength={1000}
                        />
                        <Button
                          type='submit'
                          size='sm'
                          disabled={!newComment.trim() || Boolean(engagement.isSubmittingComment)}
                        >
                          {engagement.isSubmittingComment ? (
                            <Loader2 className='w-4 h-4 animate-spin' />
                          ) : (
                            <Send className='w-4 h-4' />
                          )}
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title={currentPhoto?.caption || 'Wedding Photo'}
        description="Check out this beautiful moment from Austin & Jordyn's wedding!"
        imageUrl={currentPhoto?.url}
      />

      {/* Print Modal */}
      <PrintModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        photoUrl={currentPhoto?.url || ''}
      />
    </>
  )
}

/**
 * Controlled lightbox wrapper.
 *
 * Mounts one fresh `PhotoLightboxSession` per open (keyed by `initialIndex` and
 * photo count) so the requested photo is always selected when the viewer opens
 * — the frozen behavior read that index from the Zustand store on every open.
 * `AnimatePresence` keeps the frozen enter/exit fade, and nothing renders when
 * there are no photos (frozen `if (!currentPhoto) return null`).
 */
export function PhotoLightbox(props: PhotoLightboxProps) {
  const { isOpen, photos, initialIndex = 0 } = props

  if (photos.length === 0) return null

  // The portal itself is mounted once and AnimatePresence lives *inside* it:
  // React portals are not valid AnimatePresence children (the children
  // utilities drop them), which would render nothing. Keeping the portal
  // mounted also preserves the frozen enter/exit fade: when `isOpen` flips to
  // false the retained session still runs its `exit` animation.
  return createPortal(
    <AnimatePresence>
      {isOpen && <PhotoLightboxSession key={`${initialIndex}:${photos.length}`} {...props} />}
    </AnimatePresence>,
    document.body
  )
}

export default PhotoLightbox
