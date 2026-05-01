import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, Loader2, Share2, Printer, Image as ImageIcon } from 'lucide-react'
import { fetchGuestShareToken, fetchGuestUploadsByEmail, fetchGuestbookByEmail, type GuestShareToken, type GuestUpload, type GuestbookMessage } from '@/lib/supabase'
import { buildPrintUrl } from '@/lib/shareUtils'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

interface SharedData {
  token: GuestShareToken
  uploads: GuestUpload[]
  guestbook: GuestbookMessage[]
}

function GuestSharedError({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,rgba(12,8,5,1),rgba(22,14,6,1))] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md text-center"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-rose-400/25 bg-rose-500/10">
          <AlertCircle className="h-8 w-8 text-rose-400" />
        </div>
        <h1 className="mt-6 text-3xl text-white">Link not found</h1>
        <p className="mt-4 text-white/55">{message}</p>
        <Button to="/upload" variant="secondary" size="lg" className="mt-8">
          Upload your own photos
        </Button>
      </motion.div>
    </div>
  )
}

function GuestSharedLoading() {
  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,rgba(12,8,5,1),rgba(22,14,6,1))] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
    </div>
  )
}

export default function GuestShared() {
  const { token: tokenParam } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<SharedData | null>(null)

  useEffect(() => {
    if (!tokenParam) {
      setError('This link is invalid or has expired.')
      setLoading(false)
      return
    }

    async function loadSharedData() {
      try {
        // Lookup token -> email
        const tokenData = await fetchGuestShareToken(tokenParam)
        if (!tokenData) {
          setError('This link is invalid or has expired.')
          setLoading(false)
          return
        }

        // Fetch uploads and guestbook in parallel
        const [uploads, guestbook] = await Promise.all([
          fetchGuestUploadsByEmail(tokenData.guest_email),
          fetchGuestbookByEmail(tokenData.guest_email),
        ])

        setData({ token: tokenData, uploads, guestbook })
      } catch {
        setError('Something went wrong loading this shared album.')
      } finally {
        setLoading(false)
      }
    }

    void loadSharedData()
  }, [tokenParam])

  if (loading) return <GuestSharedLoading />
  if (error || !data) return <GuestSharedError message={error || 'This link is invalid or has expired.' } />

  const { token, uploads, guestbook } = data
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/guest/${token.token}` : ''
  const [copied, setCopied] = useState(false)

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  // Get all photo URLs from uploads (photo_urls is an array)
  const allPhotoUrls = uploads.flatMap(u => u.photo_urls || [])

  return (
    <div className="min-h-screen bg-[linear-gradient(to_bottom,rgba(12,8,5,1),rgba(22,14,6,1))] pb-20">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-gold-500/4 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-gold-400/3 blur-[100px]" />
      </div>

      {/* Header */}
      <div className="relative px-4 pt-12 pb-8 sm:pt-16 sm:pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-4xl text-center"
        >
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-gold-400">
            <Share2 className="h-3.5 w-3.5" />
            Shared Album
          </span>
          <h1 className="mt-6 text-4xl text-white sm:text-5xl">
            {token.guest_email.split('@')[0]}'s moments
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/55 sm:text-lg">
            A collection of photos and guestbook entries shared by this guest.
          </p>

          {/* Share link button */}
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-2 rounded-full border border-gold-400/30 bg-gold-500/10 px-5 py-2.5 text-sm text-gold-300 transition-all hover:border-gold-400/50 hover:bg-gold-500/15"
            >
              {copied ? (
                <>
                  <Share2 className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" />
                  Copy share link
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Photos Grid */}
      <div className="relative px-4">
        <div className="mx-auto max-w-6xl">
          {allPhotoUrls.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {allPhotoUrls.map((url, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="relative group aspect-square overflow-hidden rounded-xl bg-white/5"
                >
                  <img
                    src={url}
                    alt={`Shared photo ${idx + 1}`}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                  {/* Order Prints overlay button */}
                  <button
                    type="button"
                    onClick={() => window.open(buildPrintUrl(url), '_blank')}
                    className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/70 group-hover:opacity-100"
                    aria-label="Order prints"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print
                  </button>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ImageIcon className="h-12 w-12 text-white/20" />
              <p className="mt-4 text-white/40">No approved photos yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Guestbook Messages */}
      {guestbook.length > 0 && (
        <div className="relative mt-16 px-4">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-8 text-center text-2xl text-white">
              Guestbook Messages
            </h2>
            <div className="space-y-4">
              {guestbook.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-white/10 bg-white/5 px-6 py-5"
                >
                  <p className="text-white/90 leading-relaxed">{msg.content}</p>
                  <p className="mt-3 text-sm text-gold-400">{msg.name}</p>
                  <p className="mt-1 text-xs text-white/40">
                    {new Date(msg.created_at).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
