import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Users } from 'lucide-react'
import { fetchPhotosWithFaces } from '@/lib/supabase'
import type { Photo } from '@/lib/supabase'
import { getMediaPath } from '@/utils/media'
import { SEOHead } from '@/components/seo/SEOHead'
import { cn } from '@/lib/utils'

const PROFESSIONAL_ALBUMS = ['Engagement', 'Bach+ette', 'Wedding Day']

interface PersonCard {
  name: string
  photoCount: number
  thumbnail: string
  faceX: number
  faceY: number
  faceBoxWidth: number | null
  collections: string[]
  professionalCount: number
  guestCount: number
}

// Returns CSS background-* styles that zoom the thumbnail to show just the face,
// centered in the circular avatar container.
function faceAvatarStyle(thumbnail: string, faceX: number, faceY: number, faceBoxWidth: number | null) {
  // Target: face should occupy ~40% of the container height.
  const targetRatio = 0.4
  const rawScale = faceBoxWidth && faceBoxWidth > 0 ? targetRatio / faceBoxWidth : 3
  const scale = Math.min(Math.max(rawScale, 1.5), 8)

  // To center the face in the container:
  // posX = (faceX * scale - 0.5) / (scale - 1)  (clamped 0–1)
  const posX = Math.min(Math.max((faceX * scale - 0.5) / (scale - 1), 0), 1)
  const posY = Math.min(Math.max((faceY * scale - 0.5) / (scale - 1), 0), 1)

  return {
    backgroundImage: `url(${thumbnail})`,
    backgroundSize: `${scale * 100}%`,
    backgroundPosition: `${posX * 100}% ${posY * 100}%`,
    backgroundRepeat: 'no-repeat' as const,
  }
}

function buildPeopleFromPhotos(photos: Photo[]): PersonCard[] {
  const map = new Map<string, PersonCard>()

  for (const photo of photos) {
    if (!Array.isArray(photo.faces)) continue
    for (const face of photo.faces) {
      if (!face.name) continue
      const existing = map.get(face.name)
      const isPro = photo.album ? PROFESSIONAL_ALBUMS.includes(photo.album) : false
      const isGuest = photo.album === 'Guest Uploads'

      if (existing) {
        existing.photoCount++
        if (isPro) existing.professionalCount++
        if (isGuest) existing.guestCount++
        if (photo.album && !existing.collections.includes(photo.album)) {
          existing.collections.push(photo.album)
        }
      } else {
        map.set(face.name, {
          name: face.name,
          photoCount: 1,
          thumbnail: getMediaPath(photo.thumbnail || photo.url),
          faceX: face.x,
          faceY: face.y,
          faceBoxWidth: face.box?.width ?? null,
          collections: photo.album ? [photo.album] : [],
          professionalCount: isPro ? 1 : 0,
          guestCount: isGuest ? 1 : 0,
        })
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.photoCount - a.photoCount)
}

function SkeletonCard() {
  return (
    <div className="animate-pulse flex flex-col items-center gap-3 p-4 rounded-2xl border border-charcoal-200/40 bg-cream-100/60">
      <div className="h-20 w-20 rounded-full bg-charcoal-200/40" />
      <div className="h-4 w-20 rounded bg-charcoal-200/40" />
      <div className="h-3 w-12 rounded bg-charcoal-200/30" />
    </div>
  )
}

export default function People() {
  const navigate = useNavigate()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const data = await fetchPhotosWithFaces()
        if (mounted) setPhotos(data)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [])

  const people = useMemo(() => buildPeopleFromPhotos(photos), [photos])

  function goToGallery(name: string) {
    navigate(`/gallery?person=${encodeURIComponent(name)}`)
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <SEOHead
        title="People — Austin & Jordyn's Wedding"
        description="Browse photos by person. See who appeared in the engagement session, wedding day, and guest uploads."
        canonical="https://www.theporadas.com/people"
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
            <Users className="h-4 w-4 text-gold-500" />
            <span className="text-xs font-medium uppercase tracking-[0.22em] text-gold-600">
              People
            </span>
          </div>
          <h1 className="font-display text-4xl text-charcoal-900 sm:text-5xl mb-4">
            Everyone in the frame.
          </h1>
          <p className="max-w-2xl text-charcoal-500 text-lg leading-relaxed">
            Click anyone to browse all their photos in the gallery.
          </p>
        </motion.div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : people.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-24 text-center"
          >
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-gold-200/60 bg-gold-50">
              <Users className="h-7 w-7 text-gold-400" />
            </div>
            <h2 className="font-display text-2xl text-charcoal-800 mb-3">
              No tagged photos yet
            </h2>
            <p className="text-charcoal-500 max-w-sm mx-auto">
              Once photos are tagged with names, they'll appear here.
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {people.map((person, i) => (
              <motion.button
                key={person.name}
                type="button"
                onClick={() => goToGallery(person.name)}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.03 }}
                whileHover={{ y: -2 }}
                className={cn(
                  'flex flex-col items-center gap-3 p-5 rounded-2xl border border-charcoal-200/40 bg-white shadow-sm',
                  'hover:border-gold-300/60 hover:shadow-md transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400'
                )}
                aria-label={`Browse photos of ${person.name}`}
              >
                {/* Avatar — zoomed to show just the named face */}
                <div
                  className="h-20 w-20 rounded-full border-2 border-cream-200 shrink-0"
                  style={faceAvatarStyle(person.thumbnail, person.faceX, person.faceY, person.faceBoxWidth)}
                />

                {/* Name */}
                <p className="font-display text-base text-charcoal-800 text-center leading-tight">
                  {person.name}
                </p>

                {/* Photo count */}
                <span className="text-xs text-charcoal-500">
                  {person.photoCount} {person.photoCount === 1 ? 'photo' : 'photos'}
                </span>

                {/* Collection pills */}
                {person.collections.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1">
                    {person.collections.slice(0, 2).map((col) => (
                      <span
                        key={col}
                        className="rounded-full bg-cream-100 border border-cream-300 px-2 py-0.5 text-[10px] text-charcoal-500"
                      >
                        {col}
                      </span>
                    ))}
                    {person.collections.length > 2 && (
                      <span className="rounded-full bg-cream-100 border border-cream-300 px-2 py-0.5 text-[10px] text-charcoal-500">
                        +{person.collections.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
