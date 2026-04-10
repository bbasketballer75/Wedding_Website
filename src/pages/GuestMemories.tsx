import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Camera, Upload } from 'lucide-react'
import { fetchApprovedGuestUploads } from '@/lib/supabase'
import type { GuestUpload } from '@/lib/supabase'
import { PhotoGrid } from '@/components/gallery/PhotoGrid'
import { PhotoLightbox } from '@/components/photo-viewer/PhotoLightbox'
import { Button } from '@/components/ui/Button'
import { GuestMemoriesSEO } from '@/components/seo/SEOHead'

interface FlatPhoto {
  id: string
  url: string
  thumbnail: string
  caption?: string
  photographer?: string
  source: 'guest'
}

function flattenUploads(uploads: GuestUpload[]): FlatPhoto[] {
  return uploads.flatMap((upload) =>
    upload.photo_urls.map((url, i) => ({
      id: `${upload.id}-${i}`,
      url,
      thumbnail: url,
      caption: upload.message ?? undefined,
      photographer: upload.guest_name,
      source: 'guest' as const,
    }))
  )
}

export default function GuestMemories() {
  const [uploads, setUploads] = useState<GuestUpload[]>([])
  const [loading, setLoading] = useState(true)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

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
    return () => { mounted = false }
  }, [])

  const photos = flattenUploads(uploads)

  function handlePhotoClick(_photo: unknown, index: number) {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  return (
    <div data-testid="guest-memories-page" className="min-h-screen bg-cream-50">
      <GuestMemoriesSEO />

      <div className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:pt-14">
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
          <div className="mt-6 flex items-center gap-3">
            {!loading && photos.length > 0 && (
              <span className="text-sm text-charcoal-400">
                {photos.length} photo{photos.length === 1 ? '' : 's'}
              </span>
            )}
            <Link to="/upload">
              <Button variant="secondary" size="sm" className="gap-2">
                <Upload className="h-4 w-4" />
                Share your photos
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Gallery */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-[1.8rem] bg-charcoal-100/60" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-24 text-center"
          >
            <p className="text-charcoal-500 mb-8 max-w-sm mx-auto">
              No guest photos yet. Be the first to share a moment from the day.
            </p>
            <Link to="/upload">
              <Button size="lg" className="gap-2">
                <Upload className="h-4 w-4" />
                Share your photos
              </Button>
            </Link>
          </motion.div>
        ) : (
          <PhotoGrid
            photos={photos}
            onPhotoClick={handlePhotoClick}
          />
        )}
      </div>

      <PhotoLightbox
        photos={photos}
        currentIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setLightboxIndex}
      />
    </div>
  )
}
