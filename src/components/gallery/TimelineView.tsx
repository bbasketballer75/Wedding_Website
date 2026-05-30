import { motion } from 'framer-motion'
import { Clock, Heart, Images, MapPin } from 'lucide-react'
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
  'Send Off',
]

export function TimelineView({ photos, onPhotoClick }: TimelineViewProps) {
  const groupedPhotos = photos.reduce(
    (acc, photo) => {
      const category = photo.category || 'Other'
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(photo)
      return acc
    },
    {} as Record<string, TimelinePhoto[]>
  )

  const sortedCategories = Object.keys(groupedPhotos).sort((a, b) => {
    const indexA = timeOrder.indexOf(a)
    const indexB = timeOrder.indexOf(b)
    if (indexA === -1) return 1
    if (indexB === -1) return -1
    return indexA - indexB
  })

  if (sortedCategories.length === 0) {
    return (
      <div className='flex min-h-[20rem] flex-col items-center justify-center rounded-[1.9rem] border border-dashed border-gold-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(247,241,232,0.92))] px-6 py-14 text-center'>
        <div className='flex h-16 w-16 items-center justify-center rounded-full bg-gold-100 text-gold-600 shadow-sm'>
          <Images className='h-7 w-7' />
        </div>
        <p className='mt-6 font-display text-2xl text-charcoal-900'>No timeline moments yet</p>
        <p className='mt-2 max-w-md text-sm leading-6 text-charcoal-500'>
          Once the gallery has more photos, this view will stitch them into a full story arc.
        </p>
      </div>
    )
  }

  return (
    <div className='relative'>
      <div className='absolute bottom-24 left-[1.15rem] top-5 w-px bg-gradient-to-b from-gold-200 via-gold-500/70 to-gold-200 md:left-1/2 md:-translate-x-1/2' />

      <div className='space-y-10 md:space-y-12'>
        {sortedCategories.map((category, categoryIndex) => {
          const isEven = categoryIndex % 2 === 0
          const categoryPhotos = groupedPhotos[category]

          return (
            <div key={category} className='relative'>
              <div className='absolute left-[1.15rem] top-7 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-gold-200 bg-white shadow-[0_12px_25px_-18px_rgba(46,33,13,0.5)] md:left-1/2'>
                <Heart className='h-3.5 w-3.5 text-gold-500' />
              </div>

              <div
                className={cn(
                  'ml-10 md:ml-0',
                  isEven ? 'md:mr-[50%] md:pr-12' : 'md:ml-[50%] md:pl-12'
                )}
              >
                <motion.div
                  initial={{ opacity: 0, x: isEven ? -24 : 24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.45 }}
                  className='rounded-[1.7rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(247,241,232,0.95))] p-5 shadow-[0_24px_60px_-46px_rgba(46,33,13,0.38)]'
                >
                  <p className='text-[10px] uppercase tracking-[0.32em] text-gold-700'>
                    Chapter {categoryIndex + 1}
                  </p>
                  <div className='mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
                    <div>
                      <h3 className='font-display text-3xl text-charcoal-900'>{category}</h3>
                      <p className='mt-2 max-w-xl text-sm leading-6 text-charcoal-500'>
                        A cluster of moments from this part of the day, gathered into one editorial
                        chapter.
                      </p>
                    </div>
                    <div className='inline-flex items-center gap-2 rounded-full border border-gold-200/70 bg-white/80 px-4 py-2 text-sm text-charcoal-500'>
                      <Clock className='h-4 w-4 text-gold-500' />
                      {categoryPhotos.length} photo{categoryPhotos.length === 1 ? '' : 's'}
                    </div>
                  </div>
                </motion.div>

                <div className='mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
                  {categoryPhotos.map((photo, photoIndex) => (
                    <motion.button
                      key={photo.id}
                      type='button'
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.15 }}
                      transition={{ delay: photoIndex * 0.06, duration: 0.35 }}
                      className='group overflow-hidden rounded-[1.6rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(247,241,232,0.96))] p-2 text-left shadow-[0_22px_55px_-42px_rgba(46,33,13,0.34)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-42px_rgba(46,33,13,0.45)]'
                      onClick={() => onPhotoClick(photo, photos.indexOf(photo))}
                      aria-label={photo.caption ? `Open photo: ${photo.caption}` : 'Open photo'}
                    >
                      <div className='relative aspect-square overflow-hidden rounded-[1.25rem] bg-charcoal-200'>
                        <img
                          src={photo.thumbnail || photo.url}
                          alt={photo.caption || 'Wedding photo'}
                          className='h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]'
                        />

                        <div className='pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(27,22,16,0.04),rgba(27,22,16,0.1)_42%,rgba(27,22,16,0.54))]' />

                        <div className='absolute left-3 top-3 flex flex-wrap gap-2'>
                          {photo.time && (
                            <span className='inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/78 px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-charcoal-600 shadow-sm'>
                              <Clock className='h-3.5 w-3.5 text-gold-500' />
                              {photo.time}
                            </span>
                          )}
                          {photo.location && (
                            <span className='inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/18 px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-white/82 backdrop-blur-sm'>
                              <MapPin className='h-3.5 w-3.5 text-gold-200' />
                              {photo.location}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className='px-1 pb-1 pt-4'>
                        <p className='text-[10px] uppercase tracking-[0.32em] text-gold-700'>
                          Timeline note
                        </p>
                        <p className='mt-2 line-clamp-2 text-base leading-7 text-charcoal-900'>
                          {photo.caption || 'A candid frame from this chapter of the day.'}
                        </p>
                        <div className='mt-3 flex items-center justify-between gap-3'>
                          <div className='flex flex-wrap items-center gap-3 text-xs text-charcoal-500'>
                            {photo.likes !== undefined && (
                              <span className='inline-flex items-center gap-1.5'>
                                <Heart className='h-3.5 w-3.5 text-gold-500' />
                                {photo.likes}
                              </span>
                            )}
                            {!photo.likes && (
                              <span className='text-xs uppercase tracking-[0.24em] text-charcoal-400'>
                                Tap to open
                              </span>
                            )}
                          </div>
                          <span className='text-xs uppercase tracking-[0.24em] text-charcoal-400'>
                            View
                          </span>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35 }}
        className='mt-12 flex justify-center'
      >
        <div className='rounded-full border border-gold-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(247,241,232,0.92))] px-5 py-3 text-center shadow-[0_20px_48px_-38px_rgba(46,33,13,0.4)]'>
          <div className='mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gold-500 text-white'>
            <Heart className='h-4 w-4 fill-current' />
          </div>
          <p className='mt-3 text-[10px] uppercase tracking-[0.3em] text-gold-700'>Final frame</p>
          <p className='mt-1 text-sm text-charcoal-500'>The story continues in every new upload.</p>
        </div>
      </motion.div>
    </div>
  )
}

export default TimelineView
