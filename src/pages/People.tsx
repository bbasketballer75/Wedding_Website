import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Users, ArrowRight, ShieldCheck } from 'lucide-react'
import { fetchPhotosWithFaces } from '@/lib/supabase'
import type { Photo } from '@/lib/supabase'
import { getMediaPath } from '@/utils/media'
import { partyData } from '@/data/weddingParty'
import { PeopleSEO } from '@/components/seo/SEOHead'
import { cn } from '@/lib/utils'
import { useClaimStore } from '@/stores/claimStore'
import { ClaimModal } from '@/components/gallery/ClaimModal'

const ALL_PARTY = [...partyData.couple, ...partyData.parents, ...partyData.groomsmen, ...partyData.bridesmaids]

// Portrait photos curated for the couple, parents, and wedding party keyed by full name.
const CURATED_PORTRAITS: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const person of ALL_PARTY) {
    if (person.fullName && person.image) {
      map[person.fullName] = person.image
    }
  }
  return map
})()

// Maps first-name-only tags (e.g. "Austin") to full names (e.g. "Austin Porada")
// so duplicate cards aren't created when the same person is tagged both ways.
const NAME_ALIASES: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const person of ALL_PARTY) {
    if (person.name && person.fullName && person.name !== person.fullName) {
      map[person.name] = person.fullName
    }
  }
  return map
})()

const PROFESSIONAL_ALBUMS = ['Engagement', 'Bach+ette', 'Wedding Day']

interface PersonCard {
  name: string
  photoCount: number
  thumbnail: string
  faceX: number
  faceY: number
  faceBoxWidth: number | null
  curatedPortrait: string | null  // pre-selected portrait from weddingParty data
  collections: string[]
  professionalCount: number
  guestCount: number
}

// Returns CSS background-* styles that zoom the thumbnail to show just the face,
// centered in the circular avatar container.
function faceAvatarStyle(thumbnail: string, faceX: number, faceY: number, faceBoxWidth: number | null) {
  // Target: face box fills ~70% of the container — tight enough to isolate one face.
  const targetRatio = 0.7
  const rawScale = faceBoxWidth && faceBoxWidth > 0 ? targetRatio / faceBoxWidth : 4
  const scale = Math.min(Math.max(rawScale, 2), 8)

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

interface PersonAccum {
  photoCount: number
  collections: string[]
  professionalCount: number
  guestCount: number
  appearances: Array<{ thumbnail: string; faceX: number; faceY: number; boxWidth: number }>
}

function buildPeopleFromPhotos(photos: Photo[]): PersonCard[] {
  const map = new Map<string, PersonAccum>()

  for (const photo of photos) {
    if (!Array.isArray(photo.faces)) continue
    for (const face of photo.faces) {
      if (!face.name) continue
      const faceName = NAME_ALIASES[face.name] ?? face.name
      const isPro = photo.album ? PROFESSIONAL_ALBUMS.includes(photo.album) : false
      const isGuest = photo.album === 'Guest Uploads'

      const existing = map.get(faceName)
      if (existing) {
        existing.photoCount++
        if (isPro) existing.professionalCount++
        if (isGuest) existing.guestCount++
        if (photo.album && !existing.collections.includes(photo.album)) {
          existing.collections.push(photo.album)
        }
      } else {
        map.set(faceName, {
          photoCount: 1,
          collections: photo.album ? [photo.album] : [],
          professionalCount: isPro ? 1 : 0,
          guestCount: isGuest ? 1 : 0,
          appearances: [],
        })
      }

      // Record every face appearance for avatar selection below.
      // face.x / face.y are 0–100 percentage values; normalize to 0–1 here.
      if (face.box?.width) {
        map.get(faceName)!.appearances.push({
          thumbnail: getMediaPath(photo.thumbnail || photo.url),
          faceX: face.x / 100,
          faceY: face.y / 100,
          boxWidth: face.box.width / 100,
        })
      }
    }
  }

  const result: PersonCard[] = []
  for (const [name, accum] of map) {
    // Prefer the largest face box where the face is well-positioned:
    // not too close to horizontal edges, and in the upper 2/3 of the image (no feet shots)
    const candidates = accum.appearances
      .filter(a => a.faceX > 0.15 && a.faceX < 0.85 && a.faceY > 0.1 && a.faceY < 0.68)
      .sort((a, b) => b.boxWidth - a.boxWidth)

    const best = candidates[0] ?? accum.appearances.sort((a, b) => b.boxWidth - a.boxWidth)[0]

    result.push({
      name,
      photoCount: accum.photoCount,
      thumbnail: best?.thumbnail ?? '',
      faceX: best?.faceX ?? 0.5,
      faceY: best?.faceY ?? 0.4,
      faceBoxWidth: best?.boxWidth ?? null,
      curatedPortrait: CURATED_PORTRAITS[name] ?? null,
      collections: accum.collections,
      professionalCount: accum.professionalCount,
      guestCount: accum.guestCount,
    })
  }

  return result.sort((a, b) => b.photoCount - a.photoCount)
}

function SkeletonCard() {
  return (
    <div className="flex flex-col items-center gap-3 p-4 rounded-2xl border border-charcoal-200/40 bg-cream-100/60">
      <div className="skeleton-light h-20 w-20 rounded-full" />
      <div className="skeleton-light h-4 w-20 rounded" />
      <div className="skeleton-light h-3 w-12 rounded" />
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
    <div data-testid="people-page" className="min-h-screen bg-cream-50">
      <PeopleSEO />

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
            The people who made it beautiful.
          </h1>
          <p className="max-w-2xl text-charcoal-500 text-lg leading-relaxed">
            Tap anyone to browse every photo they appear in — together, they tell the whole story.
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
              <motion.div
                key={person.name}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.03 }}
                whileHover={{ y: -3 }}
                onClick={() => goToGallery(person.name)}
                className={cn(
                  'group relative flex flex-col items-center gap-3 p-5 rounded-2xl border border-charcoal-200/40 bg-white shadow-sm cursor-pointer',
                  'hover:border-gold-300/70 hover:shadow-lg transition-all duration-200 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400'
                )}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    goToGallery(person.name)
                  }
                }}
                aria-label={`Browse photos of ${person.name}`}
              >
                {/* Claim face trigger overlay */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    useClaimStore.getState().openWizard({
                      faceId: `simulated_face_${  person.name}`,
                      faceName: person.name
                    })
                  }}
                  title={`Is this you? Claim ${person.name}`}
                  className="absolute top-3 right-3 p-1.5 rounded-full border border-gold-500/20 bg-gold-500/5 text-gold-600 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-gold-500 hover:text-cream-50 transition-all duration-200 z-10 cursor-pointer"
                >
                  <ShieldCheck className="h-4 w-4" />
                </button>

                {/* Avatar — curated portrait if available, otherwise face-cropped thumbnail */}
                {person.curatedPortrait ? (
                  <img
                    src={person.curatedPortrait}
                    alt=""
                    className="h-20 w-20 rounded-full border-2 border-cream-200 object-cover shrink-0 transition-all duration-200 group-hover:scale-[1.08] group-hover:ring-2 group-hover:ring-gold-400/60 group-hover:ring-offset-2"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="h-20 w-20 rounded-full border-2 border-cream-200 shrink-0 transition-all duration-200 group-hover:scale-[1.08] group-hover:ring-2 group-hover:ring-gold-400/60 group-hover:ring-offset-2"
                    style={faceAvatarStyle(person.thumbnail, person.faceX, person.faceY, person.faceBoxWidth)}
                  />
                )}

                {/* Name */}
                <p className="font-display text-base text-charcoal-800 leading-tight">
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

                {/* Click affordance */}
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-gold-500/0 transition-all duration-200 group-hover:text-gold-500">
                  View photos <ArrowRight className="h-3 w-3" />
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <ClaimModal />
    </div>
  )
}
