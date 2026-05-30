import { colors } from '@/tokens/designTokens'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Optimized image component with WebP support and lazy loading
export interface OptimizedImageProps extends Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  'onError' | 'placeholder' | 'onLoad'
> {
  src: string
  alt?: string
  width?: number | string
  height?: number | string
  className?: string
  priority?: boolean
  quality?: number
  format?: 'auto' | 'webp' | 'jpg' | 'png'
  sizes?: string
  onLoad?: () => void
  onError?: () => void | boolean
  placeholder?: 'blur' | 'empty' | 'color'
  blurDataURL?: string
  aspectRatio?: string | number
}

const OptimizedImage = React.memo<OptimizedImageProps>(
  ({
    src,
    alt,
    width,
    height,
    className = '',
    priority = false, // High priority images (above the fold)
    quality = 75,
    format = 'auto', // 'auto', 'webp', 'jpg', 'png'
    sizes = '100vw',
    onLoad,
    onError,
    placeholder = 'blur', // 'blur', 'empty', 'color'
    blurDataURL,
    aspectRatio,
    ...props
  }) => {
    const [isLoaded, setIsLoaded] = useState(false)
    const [hasError, setHasError] = useState(false)
    const [currentSrc, setCurrentSrc] = useState<string | null>(null)
    const imgRef = useRef<HTMLDivElement>(null)
    const observerRef = useRef<IntersectionObserver | null>(null)

    // Generate WebP and fallback sources
    const generateSources = useCallback(
      (originalSrc: string) => {
        const sources: Array<{ srcSet: string; type: string }> = []

        if (format === 'auto' || format === 'webp') {
          // Add WebP source
          const webpSrc = originalSrc.replace(/\.(jpg|jpeg|png)$/i, '.webp')
          sources.push({
            srcSet: `${webpSrc}?w=${width}&q=${quality}`,
            type: 'image/webp',
          })
        }

        // Add original format as fallback
        const extension = originalSrc.match(/\.(jpg|jpeg|png)$/i)?.[1] || 'jpg'
        sources.push({
          srcSet: `${originalSrc}?w=${width}&q=${quality}`,
          type: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
        })

        return sources
      },
      [width, quality, format]
    )

    // Intersection Observer for lazy loading
    useEffect(() => {
      if (priority || !imgRef.current) return

      observerRef.current = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const sources = generateSources(src)
              setCurrentSrc(sources[0].srcSet)
              observerRef.current?.unobserve(entry.target)
            }
          })
        },
        { threshold: 0.1 }
      )

      observerRef.current.observe(imgRef.current)

      return () => {
        observerRef.current?.disconnect()
      }
    }, [src, priority, generateSources])

    // Set current src for priority images
    useEffect(() => {
      if (priority && src) {
        const timer = setTimeout(() => {
          const sources = generateSources(src)
          setCurrentSrc(sources[0].srcSet)
        }, 0)
        return () => clearTimeout(timer)
      }
    }, [src, priority, generateSources])

    // Handle image load
    const handleLoad = useCallback(() => {
      setIsLoaded(true)
      onLoad?.()
    }, [onLoad])

    // Handle image error
    const handleError = useCallback(() => {
      setHasError(true)
      onError?.()
    }, [onError])

    // Generate placeholder style
    const placeholderStyle = useMemo(() => {
      if (placeholder === 'blur' && blurDataURL) {
        return {
          backgroundImage: `url(${blurDataURL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(20px)',
          transform: 'scale(1.1)',
        }
      }

      if (placeholder === 'color') {
        return {
          backgroundColor: colors.cream[200],
        }
      }

      return {}
    }, [placeholder, blurDataURL])

    return (
      <div
        ref={imgRef}
        className={`relative overflow-hidden ${className}`}
        style={{
          width: width ? `${width}px` : '100%',
          height: height ? `${height}px` : 'auto',
          aspectRatio,
          ...placeholderStyle,
        }}
        {...props}
      >
        {currentSrc && (
          <img
            src={currentSrc}
            alt={alt}
            width={width}
            height={height}
            sizes={sizes}
            onLoad={handleLoad}
            onError={handleError}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Loading skeleton */}
        {!isLoaded && !hasError && placeholder === 'empty' && (
          <div className='absolute inset-0 bg-cream-200 animate-pulse' />
        )}

        {/* Error state */}
        {hasError && (
          <div className='absolute inset-0 flex items-center justify-center bg-cream-100'>
            <span className='text-dark-700 font-body text-sm'>Failed to load image</span>
          </div>
        )}

        {/* Priority loading indicator */}
        {priority && !isLoaded && !hasError && (
          <div className='absolute inset-0 flex items-center justify-center'>
            <div className='w-8 h-8 border-2 border-gold-200 border-t-gold-500 rounded-full animate-spin' />
          </div>
        )}
      </div>
    )
  }
)

// Responsive image component for art direction
export interface ResponsiveImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt?: string
  className?: string
  breakpoints?: Record<string, { w: number; h: number }>
  priority?: boolean
  quality?: number
}

export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  src,
  alt,
  className = '',
  breakpoints = {
    sm: { w: 640, h: 480 },
    md: { w: 768, h: 576 },
    lg: { w: 1024, h: 768 },
    xl: { w: 1280, h: 960 },
  },
  priority = false,
  quality = 75,
  ...props
}) => {
  const imgRef = useRef<HTMLPictureElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const [currentSrc, setCurrentSrc] = useState<string | null>(null)

  // Generate responsive sources
  const generateResponsiveSources = useCallback(() => {
    const sources: Array<{ media: string; srcSet: string; type: string }> = []

    Object.entries(breakpoints).forEach(([key, { w, h }]) => {
      // WebP version
      sources.push({
        media: `(min-width: ${key === 'sm' ? 640 : key === 'md' ? 768 : key === 'lg' ? 1024 : 1280}px)`,
        srcSet: `${src.replace(/\.(jpg|jpeg|png)$/i, '.webp')}?w=${w}&h=${h}&q=${quality}`,
        type: 'image/webp',
      })

      // Fallback version
      const extension = src.match(/\.(jpg|jpeg|png)$/i)?.[1] || 'jpg'
      sources.push({
        media: `(min-width: ${key === 'sm' ? 640 : key === 'md' ? 768 : key === 'lg' ? 1024 : 1280}px)`,
        srcSet: `${src}?w=${w}&h=${h}&q=${quality}`,
        type: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
      })
    })

    return sources
  }, [src, breakpoints, quality])

  // Lazy loading with Intersection Observer
  useEffect(() => {
    if (priority || !imgRef.current) return

    observerRef.current = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setCurrentSrc(src)
            observerRef.current?.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1 }
    )

    observerRef.current.observe(imgRef.current)

    return () => {
      observerRef.current?.disconnect()
    }
  }, [src, priority])

  // Set current src for priority images
  useEffect(() => {
    if (priority && src) {
      const timer = setTimeout(() => {
        setCurrentSrc(src)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [src, priority])

  const sources = generateResponsiveSources()

  return (
    <picture ref={imgRef} className={className}>
      {sources.map((source, index) => (
        <source key={index} {...source} />
      ))}
      {currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          className='w-full h-full object-cover transition-opacity duration-300'
          onLoad={() => {}}
          {...props}
        />
      )}
      {!currentSrc && <div className='w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse' />}
    </picture>
  )
}

// Progressive image loader with blur effect
export const ProgressiveImage: React.FC<OptimizedImageProps> = ({ src, alt, ...props }) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null)

  useEffect(() => {
    const img = new Image()
    img.src = src
    img.onload = () => {
      setImgSrc(src)
    }
  }, [src])

  return (
    <OptimizedImage
      src={imgSrc || src}
      alt={alt}
      placeholder='blur'
      blurDataURL={`data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A`}
      {...props}
    />
  )
}

export default OptimizedImage
