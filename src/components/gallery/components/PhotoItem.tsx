import { motion } from 'framer-motion'
import React from 'react'
import type { Photo } from '@/lib/supabase'
import OptimizedImage from '@/components/ui/OptimizedImage'
import { useBlurHash } from '@/hooks/useBlurHash'

interface PhotoItemProps {
  photo: Photo
  index: number
  viewMode: 'masonry' | 'grid' | 'carousel'
  onSelect: (photo: Photo) => void
  onLike: (id: string) => void
}

const PhotoItem: React.FC<PhotoItemProps> = ({ photo, index, viewMode, onSelect, onLike }) => {
  const blurDataURL = useBlurHash(photo.blurHash)

  if (viewMode === 'carousel') {
    return (
      <motion.div
        key={photo.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
        whileHover={{ scale: 1.05 }}
        className='relative w-80 h-60 flex-shrink-0 cursor-pointer overflow-hidden rounded-lg'
        onClick={() => onSelect(photo)}
      >
        <OptimizedImage
          src={photo.url}
          alt={photo.caption || ''}
          className='w-full h-full'
          placeholder={blurDataURL ? 'blur' : 'color'}
          blurDataURL={blurDataURL ?? undefined}
        />
      </motion.div>
    )
  }

  return (
    <motion.div
      key={photo.id}
      data-testid='photo-item'
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={viewMode === 'masonry' ? { y: -5 } : { scale: 1.05 }}
      className={`relative group cursor-pointer ${
        viewMode === 'grid' ? 'aspect-square overflow-hidden rounded-lg' : ''
      }`}
      onClick={() => onSelect(photo)}
    >
      <OptimizedImage
        src={viewMode === 'masonry' ? photo.thumbnail : photo.url}
        alt={photo.caption || ''}
        className={`w-full ${
          viewMode === 'masonry'
            ? 'rounded-lg shadow-md group-hover:shadow-xl'
            : 'h-full object-cover'
        }`}
        placeholder={blurDataURL ? 'blur' : 'color'}
        blurDataURL={blurDataURL ?? undefined}
      />

      {/* Overlay with Like Button */}
      <div className='absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg flex items-start justify-end p-2'>
        <button
          onClick={e => {
            e.stopPropagation()
            onLike(photo.id)
          }}
          aria-label='Like photo'
          className={`p-2 rounded-full backdrop-blur-md transition-colors ${
            photo.liked ? 'bg-red-500 text-white' : 'bg-white/20 text-white hover:bg-white/40'
          }`}
        >
          <svg
            className='w-5 h-5'
            fill={photo.liked ? 'currentColor' : 'none'}
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z'
            />
          </svg>
        </button>
      </div>
    </motion.div>
  )
}

export default PhotoItem
