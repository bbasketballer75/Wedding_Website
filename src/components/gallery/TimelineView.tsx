import { motion } from 'framer-motion'
import { Clock, Heart } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TimelinePhoto {
  id: string
  url: string
  thumbnail: string
  caption?: string
  time?: string
  location?: string
  category: string
  likes?: number
}

interface TimelineViewProps {
  photos: TimelinePhoto[]
  onPhotoClick: (photo: TimelinePhoto, index: number) => void
}

const timeOrder = [
  'Getting Ready',
  'First Look',
  'Ceremony',
  'Cocktail Hour',
  'Portraits',
  'Reception',
  'First Dance',
  'Dancing',
  'Send Off'
]

export function TimelineView({ photos, onPhotoClick }: TimelineViewProps) {
  // Group photos by category/time
  const groupedPhotos = photos.reduce((acc, photo) => {
    const category = photo.category || 'Other'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(photo)
    return acc
  }, {} as Record<string, TimelinePhoto[]>)

  // Sort categories by typical wedding timeline
  const sortedCategories = Object.keys(groupedPhotos).sort((a, b) => {
    const indexA = timeOrder.indexOf(a)
    const indexB = timeOrder.indexOf(b)
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    return indexA - indexB
  })

  return (
    <div className="relative">
      {/* Timeline Line */}
      <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-gold-200" />

      {/* Timeline Sections */}
      <div className="space-y-12">
        {sortedCategories.map((category, categoryIndex) => (
          <div key={category} className="relative">
            {/* Category Header */}
            <motion.div
              initial={{ opacity: 0, x: categoryIndex % 2 === 0 ? -20 : 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className={cn(
                "flex items-center gap-4 mb-6",
                "md:justify-center"
              )}
            >
              {/* Timeline Dot */}
              <div className="absolute left-8 md:left-1/2 -translate-x-1/2 w-4 h-4 bg-gold-500 rounded-full border-4 border-cream-50 z-10" />
              
              <div className={cn(
                "ml-16 md:ml-0",
                categoryIndex % 2 === 0 ? "md:mr-[50%] md:pr-12" : "md:ml-[50%] md:pl-12"
              )}>
                <h3 className="font-display text-2xl text-charcoal-900">{category}</h3>
                <p className="text-charcoal-500 text-sm">{groupedPhotos[category].length} photos</p>
              </div>
            </motion.div>

            {/* Photos Grid for this category */}
            <div className={cn(
              "grid grid-cols-2 md:grid-cols-3 gap-4",
              "ml-16 md:ml-0",
              categoryIndex % 2 === 0 ? "md:mr-[50%] md:pr-12" : "md:ml-[50%] md:pl-12"
            )}>
              {groupedPhotos[category].map((photo, photoIndex) => (
                <motion.button
                  key={photo.id}
                  type="button"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: photoIndex * 0.1 }}
                  className="group relative aspect-square overflow-hidden rounded-xl bg-charcoal-200 cursor-pointer"
                  onClick={() => onPhotoClick(photo, photos.indexOf(photo))}
                  aria-label={photo.caption ? `Open photo: ${photo.caption}` : 'Open photo'}
                >
                  <img
                    src={photo.thumbnail || photo.url}
                    alt={photo.caption || 'Wedding photo'}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      {photo.caption && (
                        <p className="text-white text-sm line-clamp-2 mb-1">{photo.caption}</p>
                      )}
                      <div className="flex items-center gap-3 text-white/70 text-xs">
                        {photo.time && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {photo.time}
                          </span>
                        )}
                        {photo.likes !== undefined && (
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3" />
                            {photo.likes}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* End of Timeline */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="flex justify-center mt-12"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 bg-gold-500 rounded-full flex items-center justify-center">
            <Heart className="w-3 h-3 text-white fill-current" />
          </div>
          <span className="text-charcoal-500 text-sm font-medium">The End</span>
        </div>
      </motion.div>
    </div>
  )
}

export default TimelineView
