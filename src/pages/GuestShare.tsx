import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Heart,
  MessageSquare,
  Copy,
  Check,
  Image as ImageIcon,
  BookOpen,
  ArrowLeft,
  Calendar,
  Loader2,
  AlertCircle,
  Eye,
  Share2,
} from 'lucide-react'
import {
  fetchGuestContributionsByToken,
  fetchPhotosByUrls,
  togglePhotoLike,
  addPhotoComment,
  type Photo,
} from '@/lib/supabase'
import { PhotoLightbox } from '@/components/photo-viewer/PhotoLightbox'
import { useGalleryStore } from '@/stores/galleryStore'
import { SEOHead } from '@/components/seo/SEOHead'
import { useToast } from '@/context/ToastContext'

const PHOTO_ENGAGEMENT_SESSION_KEY = 'wedding-gallery-engagement-session'

const getPhotoSessionId = () => {
  if (typeof window === 'undefined') {
    return 'server-preview-session'
  }
  const existing = window.localStorage.getItem(PHOTO_ENGAGEMENT_SESSION_KEY)
  if (existing) return existing
  const generated =
    typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  window.localStorage.setItem(PHOTO_ENGAGEMENT_SESSION_KEY, generated)
  return generated
}

export default function GuestShare() {
  const { token } = useParams<{ token: string }>()
  const { addToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [guestbook, setGuestbook] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'photos' | 'guestbook'>('photos')
  const [copied, setCopied] = useState(false)
  const [submittingCommentId, setSubmittingCommentId] = useState<string | null>(null)
  const [engagementSessionId] = useState(getPhotoSessionId)

  useEffect(() => {
    async function loadContributions() {
      if (!token) return
      setLoading(true)
      setError(false)
      try {
        const res = await fetchGuestContributionsByToken(token)
        if (!res) {
          setError(true)
          return
        }

        setGuestName(res.guestName)
        setGuestbook(res.guestbook || [])

        // Compile and fetch full Photo objects for the lightbox
        const uploadUrls = (res.uploads || []).flatMap(u => u.photo_urls || [])
        let uploadPhotos: Photo[] = []
        if (uploadUrls.length > 0) {
          uploadPhotos = await fetchPhotosByUrls(uploadUrls)
        }

        // Deduplicate between uploaded photos and claimed photos
        const seenIds = new Set<string>()
        const combinedPhotos: Photo[] = []

        for (const p of [...uploadPhotos, ...(res.claimedPhotos || [])]) {
          if (p && p.id && !seenIds.has(p.id)) {
            seenIds.add(p.id)
            combinedPhotos.push(p)
          }
        }

        setPhotos(combinedPhotos)

        // Auto-switch to guestbook if guest only wrote notes but has no photos
        if (combinedPhotos.length === 0 && (res.guestbook || []).length > 0) {
          setActiveTab('guestbook')
        }
      } catch (err) {
        console.error('Failed to load guest album:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    void loadContributions()
  }, [token])

  const handleCopyLink = () => {
    const url = window.location.href
    void navigator.clipboard?.writeText(url)
    setCopied(true)
    addToast('Album link copied to clipboard!', 'success')
    window.setTimeout(() => setCopied(false), 2000)
  }

  const handleLike = (photoId: string) => {
    void (async () => {
      try {
        const { data } = await togglePhotoLike(photoId, engagementSessionId)
        if (!data) return

        setPhotos(prev =>
          prev.map(photo =>
            photo.id === photoId
              ? {
                  ...photo,
                  likes: data.likes_count,
                }
              : photo
          )
        )
      } catch (err) {
        console.error('Failed to like photo:', err)
      }
    })()
  }

  const handleAddComment = async (
    photoId: string,
    payload: { author: string; content: string }
  ) => {
    const content = payload.content.trim()
    const author = payload.author.trim() || 'Guest'
    if (!content) return false

    setSubmittingCommentId(photoId)
    try {
      const { data, error } = await addPhotoComment(photoId, content, author, engagementSessionId)
      if (error || !data) {
        addToast("Couldn't post comment, please try again.", 'error')
        return false
      }

      const newComment = {
        id: data.id,
        author: data.author,
        content: data.content,
        timestamp: new Date(data.created_at).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }),
      }

      setPhotos(prev =>
        prev.map(photo =>
          photo.id === photoId
            ? {
                ...photo,
                comments: [...(photo.comments || []), newComment],
              }
            : photo
        )
      )
      addToast('Comment posted successfully!', 'success')
      return true
    } catch (err) {
      console.error('Failed to add comment:', err)
      addToast("Couldn't post comment, please try again.", 'error')
      return false
    } finally {
      setSubmittingCommentId(null)
    }
  }

  if (loading) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center bg-cream-50 pb-20 pt-28'>
        <Loader2 className='h-10 w-10 text-gold-500 animate-spin' />
        <p className='mt-4 text-sm text-charcoal-500 font-sans'>Curating guest memories...</p>
      </div>
    )
  }

  if (error || !token) {
    return (
      <div className='flex min-h-screen flex-col items-center justify-center bg-cream-50 px-4 pb-20 pt-28'>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className='w-full max-w-md border border-gold-200 bg-white/90 p-8 rounded-2xl shadow-md text-center'
        >
          <div className='mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 border border-rose-200 text-rose-500 mb-6'>
            <AlertCircle className='h-6 w-6' />
          </div>
          <h2 className='font-serif text-2xl font-semibold text-charcoal-900 mb-3'>
            Album Link Unresolved
          </h2>
          <p className='text-sm text-charcoal-500 font-sans mb-8 leading-relaxed'>
            This showcase album token is invalid, expired, or the guest contributions are not
            public. Please double-check the URL or return to the main gallery.
          </p>
          <Link
            to='/gallery'
            className='inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold-600 hover:bg-gold-700 text-white font-medium text-sm py-3 transition duration-200 shadow-sm'
          >
            <ArrowLeft className='h-4 w-4' />
            Back to Gallery
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-cream-50 pb-24 pt-28 sm:pt-32'>
      <SEOHead
        title={`${guestName}'s Album`}
        description={`Explore the photo uploads, photo claims, and handwritten guestbook notes contributed by ${guestName} to our wedding archive.`}
        noIndex
      />

      <div className='mx-auto max-w-5xl px-4 sm:px-6'>
        {/* Navigation back link */}
        <Link
          to='/gallery'
          className='inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-charcoal-500 hover:text-gold-600 transition-colors mb-6 font-sans group'
        >
          <ArrowLeft className='h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform' />
          Back to Gallery
        </Link>

        {/* Top Header Card - Gorgeous Glassmorphism */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className='relative overflow-hidden rounded-2xl border border-gold-200/40 bg-white/80 p-6 sm:p-8 shadow-sm backdrop-blur-md mb-8'
        >
          <div className='absolute -right-20 -top-20 h-48 w-48 rounded-full bg-gold-500/5 blur-2xl pointer-events-none' />

          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 relative z-10'>
            <div className='space-y-2'>
              <span className='flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-gold-600 font-semibold font-sans'>
                <Share2 className='h-3.5 w-3.5' /> Guest Memory Album
              </span>
              <h1 className='font-serif text-3xl sm:text-4xl font-semibold text-charcoal-900'>
                {guestName}'s Showcase
              </h1>
              <div className='flex flex-wrap gap-x-4 gap-y-1 text-xs text-charcoal-500 font-sans'>
                <span className='font-medium'>
                  {photos.length} {photos.length === 1 ? 'Photo' : 'Photos'} Shared
                </span>
                <span className='text-gold-400'>•</span>
                <span className='font-medium'>
                  {guestbook.length} {guestbook.length === 1 ? 'Message' : 'Messages'} Written
                </span>
              </div>
            </div>

            <div className='flex flex-wrap items-center gap-3'>
              <button
                onClick={handleCopyLink}
                className='inline-flex items-center justify-center gap-2 rounded-full bg-white border border-gold-200 hover:bg-gold-50 text-gold-800 font-medium text-xs px-4 py-2.5 transition-colors shadow-sm'
              >
                {copied ? (
                  <>
                    <Check className='h-3.5 w-3.5 text-emerald-500' />
                    Copied Album Link
                  </>
                ) : (
                  <>
                    <Copy className='h-3.5 w-3.5' />
                    Share This Album
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Dual Tab System - Gorgeous Layout */}
        <div className='flex border-b border-gold-500/10 pb-px mb-8'>
          <div className='flex gap-6'>
            <button
              onClick={() => setActiveTab('photos')}
              className={`relative py-3 px-1 text-sm font-semibold tracking-wide font-sans transition-colors ${
                activeTab === 'photos'
                  ? 'text-gold-700 font-bold'
                  : 'text-charcoal-500 hover:text-charcoal-800'
              }`}
            >
              <span className='flex items-center gap-2'>
                <ImageIcon className='h-4 w-4' />
                Photos ({photos.length})
              </span>
              {activeTab === 'photos' && (
                <motion.div
                  layoutId='activeGuestShareTab'
                  className='absolute bottom-0 left-0 right-0 h-0.5 bg-gold-500'
                />
              )}
            </button>

            <button
              onClick={() => setActiveTab('guestbook')}
              className={`relative py-3 px-1 text-sm font-semibold tracking-wide font-sans transition-colors ${
                activeTab === 'guestbook'
                  ? 'text-gold-700 font-bold'
                  : 'text-charcoal-500 hover:text-charcoal-800'
              }`}
            >
              <span className='flex items-center gap-2'>
                <BookOpen className='h-4 w-4' />
                Guestbook Note ({guestbook.length})
              </span>
              {activeTab === 'guestbook' && (
                <motion.div
                  layoutId='activeGuestShareTab'
                  className='absolute bottom-0 left-0 right-0 h-0.5 bg-gold-500'
                />
              )}
            </button>
          </div>
        </div>

        {/* Dynamic Tab Contents */}
        <div className='relative'>
          {/* Gallery Tab */}
          {activeTab === 'photos' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='space-y-6'
            >
              {photos.length === 0 ? (
                <div className='text-center py-20 bg-white/40 backdrop-blur-md rounded-2xl border border-gold-200/20 px-4'>
                  <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cream-100 border border-gold-200/20 text-gold-600 mb-4'>
                    <ImageIcon className='h-5 w-5' />
                  </div>
                  <h3 className='font-serif text-lg font-semibold text-charcoal-800'>
                    No photos shared yet
                  </h3>
                  <p className='mt-2 text-sm text-charcoal-500 max-w-sm mx-auto font-sans leading-relaxed'>
                    Photos uploaded by this guest, or claimed in the gallery, will appear here once
                    approved by the administrators.
                  </p>
                </div>
              ) : (
                <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6'>
                  {photos.map((photo, index) => (
                    <motion.div
                      key={photo.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3) }}
                      className='group relative cursor-pointer overflow-hidden rounded-xl border border-gold-200/10 bg-white shadow-sm hover:shadow-md hover:border-gold-300/40 transition-all duration-300 flex flex-col'
                      onClick={() => useGalleryStore.getState().openImageModal(index)}
                    >
                      <div className='aspect-[4/3] w-full overflow-hidden bg-cream-50 relative'>
                        <img
                          src={photo.thumbnail || photo.url}
                          alt={photo.caption || 'Guest photo contribution'}
                          className='h-full w-full object-cover transition-transform duration-500 group-hover:scale-105'
                          loading='lazy'
                        />
                        <div className='absolute inset-0 bg-charcoal-950/10 opacity-100 transition-opacity duration-300' />

                        {/* Hover Overlay */}
                        <div className='absolute inset-0 bg-gradient-to-t from-charcoal-900/60 via-charcoal-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 text-white'>
                          <span className='absolute top-3 right-3 bg-white/20 backdrop-blur-md rounded-full p-2 text-white hover:bg-white/35 transition-colors'>
                            <Eye className='h-4 w-4' />
                          </span>

                          {photo.caption && (
                            <p className='text-sm font-sans truncate mb-1.5 font-medium'>
                              {photo.caption}
                            </p>
                          )}
                          <div className='flex items-center gap-4 text-xs'>
                            <span className='flex items-center gap-1'>
                              <Heart className='h-3.5 w-3.5 fill-current text-white' />
                              {photo.likes || 0}
                            </span>
                            {photo.comments && photo.comments.length > 0 && (
                              <span className='flex items-center gap-1'>
                                <MessageSquare className='h-3.5 w-3.5 fill-current text-white' />
                                {photo.comments.length}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Guestbook Tab */}
          {activeTab === 'guestbook' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='space-y-6'
            >
              {guestbook.length === 0 ? (
                <div className='text-center py-20 bg-white/40 backdrop-blur-md rounded-2xl border border-gold-200/20 px-4'>
                  <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cream-100 border border-gold-200/20 text-gold-600 mb-4'>
                    <BookOpen className='h-5 w-5' />
                  </div>
                  <h3 className='font-serif text-lg font-semibold text-charcoal-800'>
                    No guestbook messages yet
                  </h3>
                  <p className='mt-2 text-sm text-charcoal-500 max-w-sm mx-auto font-sans leading-relaxed'>
                    Personalized handwritten notes or well-wishes submitted to the guestbook will
                    appear here once approved.
                  </p>
                </div>
              ) : (
                <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                  {guestbook.map((msg, index) => (
                    <motion.article
                      key={msg.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.4) }}
                      className='relative flex flex-col justify-between overflow-hidden rounded-2xl border border-gold-200/30 bg-[#FAF7F2] p-6 sm:p-8 shadow-sm hover:shadow-md transition-all duration-300'
                      style={{
                        backgroundImage:
                          'linear-gradient(rgba(212, 175, 55, 0.07) 1px, transparent 1px)',
                        backgroundSize: '100% 2.25rem',
                        lineHeight: '2.25rem',
                      }}
                    >
                      {/* Note Header Card Details */}
                      <div
                        className='flex items-center justify-between border-b border-gold-500/10 pb-3 mb-6'
                        style={{ lineHeight: 'normal' }}
                      >
                        <span className='text-[10px] font-semibold uppercase tracking-[0.15em] text-gold-600 font-sans flex items-center gap-1.5'>
                          <Calendar className='h-3.5 w-3.5 text-gold-500' />
                          {new Date(msg.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <span className='h-2 w-2 rounded-full bg-gold-400' />
                      </div>

                      {/* Handwritten content */}
                      <div className='flex-1 my-2' style={{ lineHeight: '2.25rem' }}>
                        <p className='font-serif italic text-charcoal-800 text-lg md:text-[19px] leading-9 whitespace-pre-wrap'>
                          {msg.content}
                        </p>
                      </div>

                      {/* Signature signature style */}
                      <div
                        className='mt-8 flex flex-col items-end border-t border-gold-500/10 pt-4'
                        style={{ lineHeight: 'normal' }}
                      >
                        <span className='font-script text-4xl sm:text-5xl text-gold-700 tracking-wide rotate-[-1.5deg] my-1'>
                          {msg.name}
                        </span>
                        <span className='text-[9px] text-charcoal-400 uppercase tracking-widest font-sans font-medium mt-1'>
                          With Love
                        </span>
                      </div>
                    </motion.article>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Lightbox Integration mount */}
      {photos.length > 0 && (
        <PhotoLightbox
          photos={photos}
          onLike={handleLike}
          onAddComment={handleAddComment}
          isSubmittingComment={submittingCommentId !== null}
        />
      )}
    </div>
  )
}
