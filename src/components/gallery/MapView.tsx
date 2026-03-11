import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Compass, Heart, MapPin, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MapPhoto {
  id: string
  url: string
  thumbnail: string
  caption?: string
  x: number
  y: number
  location: string
  likes?: number
}

interface MapViewProps {
  photos: MapPhoto[]
  onPhotoClick: (photo: MapPhoto, index: number) => void
}

const venueLocations = [
  { name: 'Getting Ready', x: 15, y: 20, icon: '👰' },
  { name: 'Ceremony Garden', x: 50, y: 30, icon: '💒' },
  { name: 'Cocktail Area', x: 75, y: 25, icon: '🍸' },
  { name: 'Reception Hall', x: 60, y: 60, icon: '🎉' },
  { name: 'Photo Spot', x: 30, y: 50, icon: '📸' },
  { name: 'Lake View', x: 85, y: 70, icon: '🌅' },
]

export function MapView({ photos, onPhotoClick }: MapViewProps) {
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)

  const photosByLocation = useMemo(
    () =>
      photos.reduce((acc, photo) => {
        if (!acc[photo.location]) {
          acc[photo.location] = []
        }
        acc[photo.location].push(photo)
        return acc
      }, {} as Record<string, MapPhoto[]>),
    [photos]
  )

  const selectedPhotos = selectedLocation ? photosByLocation[selectedLocation] || [] : []

  const [pinDelays] = useState<number[]>(() =>
    venueLocations.map((_, index) => (index * 0.08) % 0.5)
  )

  const activeLocationMeta = venueLocations.find((location) => location.name === selectedLocation)

  return (
    <div className="space-y-5">
      <div className="rounded-[2rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.84),rgba(247,241,232,0.96))] p-4 shadow-[0_28px_70px_-48px_rgba(46,33,13,0.4)] sm:p-5">
        <div className="relative aspect-[16/10] overflow-hidden rounded-[1.6rem] border border-gold-200/70 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.94),rgba(249,245,238,0.98)_44%,rgba(241,232,214,0.92))]">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.45),transparent_38%,rgba(255,255,255,0.24)_62%,transparent)]" />
            <div className="absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_top_left,rgba(201,160,92,0.12),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(233,203,160,0.16),transparent_34%)]" />

            <div className="absolute left-[6%] top-[9%] h-20 w-20 rounded-full bg-white/32 blur-2xl" />
            <div className="absolute right-[10%] top-[16%] h-24 w-24 rounded-full bg-gold-100/50 blur-2xl" />
            <div className="absolute bottom-[14%] right-[8%] h-28 w-36 rounded-full bg-sky-100/70 blur-xl" />

            <div className="absolute left-[8%] top-[12%] text-3xl opacity-75">🌿</div>
            <div className="absolute left-[16%] top-[17%] text-2xl opacity-70">🌿</div>
            <div className="absolute right-[12%] top-[12%] text-3xl opacity-75">🌿</div>
            <div className="absolute bottom-[18%] left-[9%] text-2xl opacity-70">🌿</div>

            <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M 15% 20% Q 30% 35% 50% 30%"
                stroke="#d2b178"
                strokeWidth="3"
                fill="none"
                strokeDasharray="6,8"
                opacity="0.9"
              />
              <path
                d="M 50% 30% Q 60% 40% 60% 60%"
                stroke="#d2b178"
                strokeWidth="3"
                fill="none"
                strokeDasharray="6,8"
                opacity="0.9"
              />
              <path
                d="M 50% 30% Q 65% 28% 75% 25%"
                stroke="#d2b178"
                strokeWidth="3"
                fill="none"
                strokeDasharray="6,8"
                opacity="0.9"
              />
            </svg>
          </div>

          <div className="absolute left-4 top-4 max-w-[15rem] rounded-[1.3rem] border border-white/70 bg-white/82 p-4 shadow-[0_18px_45px_-32px_rgba(46,33,13,0.36)] backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-[0.32em] text-gold-700">
              Venue map
            </p>
            <p className="mt-2 text-sm leading-6 text-charcoal-600">
              Choose a location to see the moments captured there, from quiet prep corners to the last song.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-charcoal-500">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-50 px-3 py-1.5">
                <Camera className="h-3.5 w-3.5 text-gold-500" />
                {photos.length} photos
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-50 px-3 py-1.5">
                <MapPin className="h-3.5 w-3.5 text-gold-500" />
                {venueLocations.length} locations
              </span>
            </div>
          </div>

          <div className="absolute bottom-4 right-4 rounded-[1.25rem] border border-white/70 bg-white/80 px-4 py-3 text-xs text-charcoal-500 shadow-[0_18px_40px_-32px_rgba(46,33,13,0.36)] backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-gold-500" />
              Tap a pin to open its gallery
            </div>
          </div>

          {venueLocations.map((location, index) => {
            const locationPhotos = photosByLocation[location.name] || []
            const photoCount = locationPhotos.length
            const isSelected = selectedLocation === location.name

            return (
              <motion.button
                key={location.name}
                type="button"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: pinDelays[index], duration: 0.28 }}
                onClick={() => setSelectedLocation(location.name)}
                aria-pressed={isSelected}
                aria-label={`Show photos from ${location.name}`}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${location.x}%`, top: `${location.y}%` }}
              >
                <div
                  className={cn(
                    'group relative min-w-[7.25rem] rounded-[1.35rem] border px-3 py-3 text-left shadow-[0_22px_50px_-34px_rgba(46,33,13,0.45)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1',
                    isSelected
                      ? 'border-charcoal-900/20 bg-charcoal-900 text-white'
                      : 'border-white/75 bg-white/82 text-charcoal-700'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-100 text-xl shadow-sm">
                      {location.icon}
                    </div>

                    {photoCount > 0 ? (
                      <span
                        className={cn(
                          'inline-flex min-w-7 items-center justify-center rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]',
                          isSelected ? 'bg-white/14 text-gold-200' : 'bg-gold-500 text-white'
                        )}
                      >
                        {photoCount}
                      </span>
                    ) : (
                      <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-charcoal-900/6 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-charcoal-400">
                        0
                      </span>
                    )}
                  </div>

                  <p
                    className={cn(
                      'mt-3 text-xs uppercase tracking-[0.26em]',
                      isSelected ? 'text-gold-200/90' : 'text-gold-700'
                    )}
                  >
                    {location.name}
                  </p>
                  <p
                    className={cn(
                      'mt-1 text-sm',
                      isSelected ? 'text-white/68' : 'text-charcoal-500'
                    )}
                  >
                    {photoCount > 0 ? 'Open the local photo set' : 'No photos added yet'}
                  </p>
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedLocation && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-charcoal-900/45 backdrop-blur-[2px]"
              onClick={() => setSelectedLocation(null)}
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 210 }}
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] rounded-t-[2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,241,232,0.98))] shadow-[0_-30px_90px_-50px_rgba(46,33,13,0.5)]"
            >
              <div className="flex justify-center pb-2 pt-3">
                <div className="h-1.5 w-14 rounded-full bg-gold-200" />
              </div>

              <div className="flex items-start justify-between gap-4 border-b border-charcoal-900/8 px-5 pb-5 pt-1 sm:px-6">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.32em] text-gold-700">
                    Location gallery
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <h3 className="font-display text-3xl text-charcoal-900">
                      {selectedLocation}
                    </h3>
                    {activeLocationMeta && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-white/80 px-3 py-1.5 text-sm text-charcoal-500">
                        <Sparkles className="h-4 w-4 text-gold-500" />
                        {activeLocationMeta.icon}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-charcoal-500">
                    {selectedPhotos.length} photo{selectedPhotos.length === 1 ? '' : 's'} from this part of the venue.
                    Tap any card to open it in the full gallery lightbox.
                  </p>
                </div>

                <button
                  onClick={() => setSelectedLocation(null)}
                  type="button"
                  aria-label="Close location drawer"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-charcoal-900/8 bg-white/82 text-charcoal-500 transition-colors hover:text-charcoal-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="overflow-y-auto px-5 py-5 sm:px-6">
                {selectedPhotos.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {selectedPhotos.map((photo, index) => (
                      <motion.button
                        key={photo.id}
                        type="button"
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.04, duration: 0.28 }}
                        className="group overflow-hidden rounded-[1.6rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(247,241,232,0.96))] p-2 text-left shadow-[0_20px_55px_-42px_rgba(46,33,13,0.34)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-42px_rgba(46,33,13,0.45)]"
                        onClick={() => onPhotoClick(photo, photos.indexOf(photo))}
                        aria-label={photo.caption ? `Open photo: ${photo.caption}` : 'Open photo'}
                      >
                        <div className="relative aspect-square overflow-hidden rounded-[1.25rem] bg-charcoal-200">
                          <img
                            src={photo.thumbnail || photo.url}
                            alt={photo.caption || 'Wedding photo'}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                          />

                          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(27,22,16,0.04),rgba(27,22,16,0.08)_44%,rgba(27,22,16,0.54))]" />

                          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/82 px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-charcoal-600 shadow-sm">
                            <MapPin className="h-3.5 w-3.5 text-gold-500" />
                            {selectedLocation}
                          </div>
                        </div>

                        <div className="px-1 pb-1 pt-4">
                          <p className="text-[10px] uppercase tracking-[0.32em] text-gold-700">
                            On location
                          </p>
                          <p className="mt-2 line-clamp-2 text-base leading-7 text-charcoal-900">
                            {photo.caption || 'A location-based candid from the celebration.'}
                          </p>
                          <div className="mt-3 flex items-center justify-between gap-3">
                            {photo.likes !== undefined ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-charcoal-500">
                                <Heart className="h-3.5 w-3.5 text-gold-500" />
                                {photo.likes}
                              </span>
                            ) : (
                              <span className="text-xs uppercase tracking-[0.24em] text-charcoal-400">
                                Tap to open
                              </span>
                            )}
                            <span className="text-xs uppercase tracking-[0.24em] text-charcoal-400">
                              View
                            </span>
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-[16rem] flex-col items-center justify-center rounded-[1.8rem] border border-dashed border-gold-200 bg-white/78 px-6 py-12 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-100 text-gold-600">
                      <Camera className="h-6 w-6" />
                    </div>
                    <p className="mt-5 font-display text-2xl text-charcoal-900">
                      No photos from {selectedLocation} yet
                    </p>
                    <p className="mt-2 max-w-md text-sm leading-6 text-charcoal-500">
                      This spot is ready for memories, but nothing has been uploaded for it just yet.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default MapView
