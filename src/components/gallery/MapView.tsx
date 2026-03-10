import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, X, Heart, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MapPhoto {
  id: string
  url: string
  thumbnail: string
  caption?: string
  x: number // percentage position on map
  y: number // percentage position on map
  location: string
  likes?: number
}

interface MapViewProps {
  photos: MapPhoto[]
  onPhotoClick: (photo: MapPhoto, index: number) => void
}

// Wedding venue map locations with coordinates (simulated)
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

  // Group photos by location
  const photosByLocation = photos.reduce((acc, photo) => {
    if (!acc[photo.location]) {
      acc[photo.location] = []
    }
    acc[photo.location].push(photo)
    return acc
  }, {} as Record<string, MapPhoto[]>)

  const selectedPhotos = selectedLocation ? photosByLocation[selectedLocation] || [] : []

  // Store pin delays - generated once on mount
  const [pinDelays] = useState<number[]>(() =>
    venueLocations.map((_, i) => (i * 0.08) % 0.5)
  )

  return (
    <div className="relative">
      {/* Map Container */}
      <div className="relative aspect-[16/10] bg-gradient-to-br from-green-50 via-cream-50 to-blue-50 rounded-2xl overflow-hidden border-2 border-gold-100">
        {/* Decorative Map Elements */}
        <div className="absolute inset-0 opacity-30">
          {/* Trees */}
          <div className="absolute top-[10%] left-[5%] text-4xl">🌲</div>
          <div className="absolute top-[15%] left-[10%] text-3xl">🌳</div>
          <div className="absolute top-[8%] right-[15%] text-4xl">🌲</div>
          <div className="absolute bottom-[20%] left-[8%] text-3xl">🌳</div>
          {/* Lake */}
          <div className="absolute bottom-[10%] right-[5%] w-32 h-24 bg-blue-200 rounded-full opacity-50" />
          {/* Paths */}
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M 15% 20% Q 30% 35% 50% 30%"
              stroke="#d4c4b0"
              strokeWidth="3"
              fill="none"
              strokeDasharray="5,5"
            />
            <path
              d="M 50% 30% Q 60% 40% 60% 60%"
              stroke="#d4c4b0"
              strokeWidth="3"
              fill="none"
              strokeDasharray="5,5"
            />
            <path
              d="M 50% 30% Q 65% 28% 75% 25%"
              stroke="#d4c4b0"
              strokeWidth="3"
              fill="none"
              strokeDasharray="5,5"
            />
          </svg>
        </div>

        {/* Location Pins */}
        {venueLocations.map((location, index) => {
          const locationPhotos = photosByLocation[location.name] || []
          const photoCount = locationPhotos.length

          return (
            <motion.button
              key={location.name}
              type="button"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: pinDelays[index] }}
              onClick={() => setSelectedLocation(location.name)}
              aria-pressed={selectedLocation === location.name}
              aria-label={`Show photos from ${location.name}`}
              className={cn(
                "absolute transform -translate-x-1/2 -translate-y-1/2",
                "flex flex-col items-center group"
              )}
              style={{ left: `${location.x}%`, top: `${location.y}%` }}
            >
              {/* Pin */}
              <div
                className={cn(
                  "relative w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg transition-transform group-hover:scale-110",
                  selectedLocation === location.name
                    ? "bg-gold-500 ring-4 ring-gold-200"
                    : "bg-white ring-2 ring-gold-300"
                )}
              >
                {location.icon}
                {/* Photo count badge */}
                {photoCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {photoCount}
                  </span>
                )}
              </div>
              {/* Label */}
              <span
                className={cn(
                  "mt-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap",
                  selectedLocation === location.name
                    ? "bg-gold-500 text-white"
                    : "bg-white/90 text-charcoal-700"
                )}
              >
                {location.name}
              </span>
            </motion.button>
          )
        })}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-xl p-3 shadow-lg">
          <p className="text-xs font-medium text-charcoal-600 mb-2">Click a location to view photos</p>
          <div className="flex items-center gap-4 text-xs text-charcoal-500">
            <span className="flex items-center gap-1">
              <Camera className="w-3 h-3" />
              {photos.length} photos
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {venueLocations.length} locations
            </span>
          </div>
        </div>
      </div>

      {/* Photo Drawer */}
      <AnimatePresence>
        {selectedLocation && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setSelectedLocation(null)}
            />

            {/* Drawer */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 max-h-[60vh]"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1 bg-charcoal-200 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-6 pb-4 border-b border-gold-100">
                <div>
                  <h3 className="font-display text-2xl text-charcoal-900">{selectedLocation}</h3>
                  <p className="text-charcoal-500 text-sm">{selectedPhotos.length} photos</p>
                </div>
                <button
                  onClick={() => setSelectedLocation(null)}
                  type="button"
                  aria-label="Close location drawer"
                  className="p-2 hover:bg-cream-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-charcoal-400" />
                </button>
              </div>

              {/* Photos Grid */}
              <div className="p-6 overflow-y-auto">
                {selectedPhotos.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {selectedPhotos.map((photo, index) => (
                      <motion.button
                        key={photo.id}
                        type="button"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="group relative aspect-square overflow-hidden rounded-xl bg-charcoal-200 cursor-pointer"
                        onClick={() => onPhotoClick(photo, photos.indexOf(photo))}
                        aria-label={photo.caption ? `Open photo: ${photo.caption}` : 'Open photo'}
                      >
                        <img
                          src={photo.thumbnail || photo.url}
                          alt={photo.caption || ''}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            {photo.caption && (
                              <p className="text-white text-sm line-clamp-2 mb-1">{photo.caption}</p>
                            )}
                            {photo.likes !== undefined && (
                              <span className="flex items-center gap-1 text-white/80 text-xs">
                                <Heart className="w-3 h-3" />
                                {photo.likes}
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Camera className="w-12 h-12 text-gold-300 mx-auto mb-3" />
                    <p className="text-charcoal-500">No photos from this location yet</p>
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
