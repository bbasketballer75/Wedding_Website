import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Camera, Heart, Upload } from 'lucide-react'
import { fetchApprovedGuestUploads } from '@/lib/supabase'
import type { GuestUpload } from '@/lib/supabase'
import { PhotoLightbox } from '@/components/photo-viewer/PhotoLightbox'
import { Button } from '@/components/ui/Button'
import { SEOHead } from '@/components/seo/SEOHead'
import { cn } from '@/lib/utils'

interface FlatPhoto {
  id: string
  url: string
  caption?: string
  uploadIndex: number
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-charcoal-200/40 bg-cream-100/60">
      <div className="grid grid-cols-3 gap-0.5 bg-charcoal-200/20">
        {[0, 1, 2].map((i) => (
          <div key={i} className="aspect-square bg-charcoal-200/40" />
        ))}
      </div>
      <div className="p-4 space-y-2">
        <div className="h-4 w-1/2 rounded bg-charcoal-200/40" />
        <div className="h-3 w-3/4 rounded bg-charcoal-200/30" />
      </div>
    </div>
  )
}

export default function GuestMemories() {
  const [uploads, setUploads] = useState<GuestUpload[]>([])
  const [loading, setLoading] = useState(true)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const data = await fetchApprovedGuestUploads()
        if (mounted) setUploads(data)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [])

  // Build a flat list of all photos across all uploads for lightbox navigation
  const flatPhotos: FlatPhoto[] = uploads.flatMap((upload, uploadIndex) =>
    upload.photo_urls.map((url, photoIndex) => ({
      id: `${upload.id}-${photoIndex}`,
      url,
      caption: upload.message ?? undefined,
      uploadIndex,
    }))
  )

  // Map each upload to its starting index in flatPhotos
  const uploadStartIndex: number[] = []
  let cursor = 0
  for (const upload of uploads) {
    uploadStartIndex.push(cursor)
    cursor += upload.photo_urls.length
  }

  function openLightbox(uploadIndex: number, photoIndex: number) {
    setLightboxIndex(uploadStartIndex[uploadIndex] + photoIndex)
    setLightboxOpen(true)
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <SEOHead
        title="Guest Memories — Austin & Jordyn's Wedding"
        description="Browse photos shared by our guests — candid moments, phone shots, and side-of-the-day captures from the people who were there."
        canonical="https://www.theporadas.com/guest-photos"
      />

      <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:pt-14">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10 sm:mb-14"
        >
          <div className="flex items-center gap-2 mb-4">
            <Camera className="h-4 w-4 text-gold-500" />
            <span className="text-xs font-medium uppercase tracking-[0.22em] text-gold-600">
              Guest Memories
            </span>
          </div>
          <h1 className="font-display text-4xl text-charcoal-900 sm:text-5xl mb-4">
            Your side of the day.
          </h1>
          <p className="max-w-2xl text-charcoal-500 text-lg leading-relaxed">
            Phone shots, candid moments, and quiet details from the people who were there.
          </p>
          <div className="mt-6">
            <Link to="/upload">
              <Button variant="secondary" size="sm" className="gap-2">
                <Upload className="h-4 w-4" />
                Share your photos
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : uploads.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-24 text-center"
          >
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-gold-200/60 bg-gold-50">
              <Heart className="h-7 w-7 text-gold-400" />
            </div>
            <h2 className="font-display text-2xl text-charcoal-800 mb-3">
              No guest memories yet
            </h2>
            <p className="text-charcoal-500 mb-8 max-w-sm mx-auto">
              Be the first to share your photos from the day.
            </p>
            <Link to="/upload">
              <Button size="lg" className="gap-2">
                <Upload className="h-4 w-4" />
                Share your photos
              </Button>
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {uploads.map((upload, uploadIndex) => (
              <motion.div
                key={upload.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: uploadIndex * 0.04 }}
                className="overflow-hidden rounded-2xl border border-charcoal-200/40 bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Photo thumbnails */}
                {upload.photo_urls.length > 0 && (
                  <div
                    className={cn(
                      'grid gap-0.5',
                      upload.photo_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-3'
                    )}
                  >
                    {upload.photo_urls.slice(0, 3).map((url, photoIndex) => (
                      <button
                        key={photoIndex}
                        type="button"
                        onClick={() => openLightbox(uploadIndex, photoIndex)}
                        className={cn(
                          'relative overflow-hidden bg-charcoal-100 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400',
                          upload.photo_urls.length === 1 ? 'aspect-[4/3]' : 'aspect-square'
                        )}
                        aria-label={`View photo ${photoIndex + 1} from ${upload.guest_name}`}
                      >
                        <img
                          src={url}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                        {photoIndex === 2 && upload.photo_urls.length > 3 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-medium text-sm">
                            +{upload.photo_urls.length - 3} more
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Card footer */}
                <div className="px-4 py-3">
                  <p className="font-medium text-charcoal-800 text-sm truncate">{upload.guest_name}</p>
                  {upload.message && (
                    <p className="text-charcoal-500 text-xs mt-0.5 line-clamp-2 leading-relaxed">
                      {upload.message}
                    </p>
                  )}
                  <p className="text-charcoal-400 text-xs mt-1.5">
                    {formatDate(upload.created_at)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {flatPhotos.length > 0 && (
        <PhotoLightbox
          photos={flatPhotos.map((p) => ({ id: p.id, url: p.url, caption: p.caption }))}
          currentIndex={lightboxIndex}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  )
}
