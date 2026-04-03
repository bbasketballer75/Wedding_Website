import { motion, HTMLMotionProps } from 'framer-motion'
import React from 'react'
import OptimizedImage from './OptimizedImage'

export interface LazyImageProps extends HTMLMotionProps<'div'> {
  src: string;
  alt?: string;
  priority?: boolean;
  quality?: number;
}

const LazyImage = React.memo<LazyImageProps>(
  ({ src, alt, className = '', priority = false, quality = 75, ...props }) => {
    return (
      <motion.div
        className={`relative overflow-hidden ${className}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 300 }}
        {...props}
      >
        <OptimizedImage
          src={src}
          alt={alt}
          className='w-full h-full object-cover'
          priority={priority}
          quality={quality}
          format='auto'
          placeholder='blur'
          onError={() => {
            // Handle error with fallback
            return false
          }}
        />
      </motion.div>
    )
  }
)

export default LazyImage
