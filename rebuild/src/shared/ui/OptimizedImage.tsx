import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ImgHTMLAttributes,
} from 'react'
import {
  blurhashToCssBackground,
  defaultMediaManifest,
  getResponsiveImageSources,
  resolveSizes,
  type MediaManifest,
  type ResponsiveImageSources,
} from '@/shared/media/responsive-image'

/**
 * Frozen `OptimizedImage` family port (`src/components/ui/OptimizedImage.tsx`)
 * with the Wave 8 W8-2 delivery upgrades:
 *
 * - Manifest-driven responsive `<picture>` (AVIF → WebP → JPEG srcset) for
 *   local `/images/**` rasters that the media pipeline has optimised.
 * - Graceful plain-`<img>` fallback for URLs the pipeline does not own: media
 *   CDN paths (`/media/**`), absolute R2 URLs and one-off static files keep
 *   their frozen onLoad/onError/loading behaviour without invented query
 *   params.
 * - CLS protection: fixed aspect ratio (and width/height attributes) from the
 *   manifest when the caller does not pass explicit dimensions.
 * - Placeholders: dominant colour from the manifest, inline blurhash CSS
 *   gradient (dependency-free decode) or the frozen blur/empty/color modes.
 * - Lazy strategy: `loading='lazy'` below the fold, `loading='eager'` +
 *   `fetchpriority='high'` for `priority` (LCP) images, `decoding='async'`.
 *
 * Backward compatibility: the frozen public API is unchanged (`src`, `alt`,
 * `width`, `height`, `priority`, `quality`, `format`, `sizes`, `onLoad`,
 * `onError`, `placeholder`, `blurDataURL`, `aspectRatio`); everything new is
 * optional.
 */

/** Frozen `designTokens.colors.cream[200]` (#f5f2ec), inlined. */
const PLACEHOLDER_CREAM_200 = '#f5f2ec'

/** Frozen 1x1 JPEG placeholder used by `ProgressiveImage`. */
const PROGRESSIVE_BLUR_PLACEHOLDER =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A'

export type ImageFetchPriority = 'high' | 'low' | 'auto'

export interface OptimizedImageProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'onError' | 'placeholder' | 'onLoad' | 'fetchPriority'
> {
  src: string
  alt?: string
  width?: number | string
  height?: number | string
  className?: string
  /** Above-the-fold/LCP image: eager load + `fetchpriority="high"`. */
  priority?: boolean
  quality?: number
  /** Legacy frozen single-format switch; ignored for manifest-responsive sources. */
  format?: 'auto' | 'webp' | 'jpg' | 'png'
  /** `sizes` attribute or one of the frozen layout presets (`galleryGrid`, ...). */
  sizes?: string
  onLoad?: () => void
  onError?: () => void | boolean
  placeholder?: 'blur' | 'empty' | 'color'
  blurDataURL?: string
  /** Inline blurhash placeholder (decoded to a tiny CSS gradient, no deps). */
  blurHash?: string
  /** Dominant colour override (defaults to the manifest colour). */
  dominantColor?: string
  aspectRatio?: string | number
  /** Manifest injection for tests/storybooks; defaults to the generated one. */
  manifest?: MediaManifest
  /** Force/disable the responsive `<picture>` path. */
  responsive?: boolean
  fetchPriority?: ImageFetchPriority
  decoding?: 'sync' | 'async' | 'auto'
}

function normalizeAspectRatio(
  value: string | number | undefined,
  fallback: number | undefined
): string | number | undefined {
  if (value !== undefined) return value
  return fallback
}

function buildPlaceholderStyle(input: {
  placeholder: 'blur' | 'empty' | 'color'
  blurDataURL: string | undefined
  blurHash: string | undefined
  dominantColor: string | undefined
}): CSSProperties {
  const { placeholder, blurDataURL, blurHash, dominantColor } = input

  if (placeholder === 'blur' && blurDataURL) {
    return {
      backgroundImage: `url(${blurDataURL})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      filter: 'blur(20px)',
      transform: 'scale(1.1)',
    }
  }

  if (placeholder === 'blur' && blurHash) {
    return { backgroundImage: blurhashToCssBackground(blurHash), backgroundSize: 'cover' }
  }

  if (dominantColor) {
    return { backgroundColor: dominantColor }
  }

  if (placeholder === 'color') {
    return { backgroundColor: PLACEHOLDER_CREAM_200 }
  }

  return {}
}

export const OptimizedImage = memo(
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
    blurHash,
    dominantColor,
    aspectRatio,
    manifest = defaultMediaManifest,
    responsive = true,
    fetchPriority,
    decoding = 'async',
    ...props
  }: OptimizedImageProps) => {
    const [isLoaded, setIsLoaded] = useState(false)
    const [hasError, setHasError] = useState(false)
    const [isRevealed, setIsRevealed] = useState(false)
    const [legacySrc, setLegacySrc] = useState<string | null>(null)
    const imgRef = useRef<HTMLDivElement>(null)
    const observerRef = useRef<IntersectionObserver | null>(null)

    const responsiveSources: ResponsiveImageSources | null = useMemo(
      () => (responsive ? getResponsiveImageSources(src, manifest) : null),
      [responsive, src, manifest]
    )
    const resolvedSizes = resolveSizes(sizes)

    // Frozen legacy source generation (WebP/original with the frozen `?w=&q=`
    // contract) — used only when the media pipeline does not own the URL and it
    // is a local raster. CDN/absolute URLs render untouched.
    const generateSources = useCallback(
      (originalSrc: string) => {
        const sources: Array<{ srcSet: string; type: string }> = []

        if (format === 'auto' || format === 'webp') {
          const webpSrc = originalSrc.replace(/\.(jpg|jpeg|png)$/i, '.webp')
          sources.push({
            srcSet: `${webpSrc}?w=${width}&q=${quality}`,
            type: 'image/webp',
          })
        }

        const extension = originalSrc.match(/\.(jpg|jpeg|png)$/i)?.[1] || 'jpg'
        sources.push({
          srcSet: `${originalSrc}?w=${width}&q=${quality}`,
          type: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
        })

        return sources
      },
      [width, quality, format]
    )

    // Frozen fallback: CDN/absolute/unmanaged URLs keep their own src (no
    // invented resize query params); local unoptimised rasters keep the frozen
    // `?w=&q=` behaviour for parity with the oracle component.
    const fallbackDisplaySrc = useCallback(
      (originalSrc: string) => {
        const isManagedOrRemote =
          /^https?:\/\//.test(originalSrc) || originalSrc.startsWith('/media/')
        if (isManagedOrRemote) return originalSrc
        return generateSources(originalSrc)[0]?.srcSet ?? originalSrc
      },
      [generateSources]
    )

    // Intersection Observer for lazy loading
    useEffect(() => {
      if (priority || !imgRef.current) return

      observerRef.current = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              if (responsiveSources) {
                setIsRevealed(true)
              } else {
                setLegacySrc(fallbackDisplaySrc(src))
              }
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
    }, [src, priority, responsiveSources, fallbackDisplaySrc])

    // Reveal priority images immediately (frozen behavior).
    useEffect(() => {
      if (!priority || !src) return
      const timer = setTimeout(() => {
        if (responsiveSources) {
          setIsRevealed(true)
        } else {
          setLegacySrc(fallbackDisplaySrc(src))
        }
      }, 0)
      return () => clearTimeout(timer)
    }, [src, priority, responsiveSources, fallbackDisplaySrc])

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

    const placeholderStyle = useMemo(
      () =>
        buildPlaceholderStyle({
          placeholder,
          blurDataURL,
          blurHash,
          dominantColor: dominantColor ?? responsiveSources?.dominantColor,
        }),
      [placeholder, blurDataURL, blurHash, dominantColor, responsiveSources]
    )

    const resolvedWidth = width ?? responsiveSources?.width
    const resolvedHeight = height ?? responsiveSources?.height
    const resolvedAspectRatio = normalizeAspectRatio(aspectRatio, responsiveSources?.aspectRatio)
    const loadingAttribute = priority ? 'eager' : 'lazy'
    const fetchPriorityAttribute = fetchPriority ?? (priority ? 'high' : 'auto')

    const showResponsivePicture = responsiveSources !== null && isRevealed
    const showLegacyImage = responsiveSources === null && legacySrc !== null

    return (
      <div
        ref={imgRef}
        className={`relative overflow-hidden ${className}`}
        style={{
          width: resolvedWidth ? `${resolvedWidth}px` : '100%',
          height: resolvedHeight ? `${resolvedHeight}px` : 'auto',
          aspectRatio: resolvedAspectRatio,
          ...placeholderStyle,
        }}
        {...props}
      >
        {showResponsivePicture && responsiveSources && (
          <picture>
            {responsiveSources.avif && (
              <source type='image/avif' srcSet={responsiveSources.avif} sizes={resolvedSizes} />
            )}
            {responsiveSources.webp && (
              <source type='image/webp' srcSet={responsiveSources.webp} sizes={resolvedSizes} />
            )}
            <img
              src={responsiveSources.fallbackSrc}
              srcSet={responsiveSources.jpg || undefined}
              sizes={resolvedSizes}
              alt={alt}
              width={resolvedWidth}
              height={resolvedHeight}
              loading={loadingAttribute}
              fetchPriority={fetchPriorityAttribute}
              decoding={decoding}
              onLoad={handleLoad}
              onError={handleError}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                isLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </picture>
        )}

        {showLegacyImage && (
          <img
            src={legacySrc}
            alt={alt}
            width={width}
            height={height}
            sizes={resolvedSizes}
            loading={loadingAttribute}
            fetchPriority={fetchPriorityAttribute}
            decoding={decoding}
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

OptimizedImage.displayName = 'OptimizedImage'

export interface ResponsiveImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt?: string
  className?: string
  breakpoints?: Record<string, { w: number; h: number }>
  priority?: boolean
  quality?: number
  /** Manifest injection for tests; defaults to the generated manifest. */
  manifest?: MediaManifest
  sizes?: string
}

// Responsive image component for art direction
export function ResponsiveImage({
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
  manifest = defaultMediaManifest,
  sizes = '100vw',
  ...props
}: ResponsiveImageProps) {
  const imgRef = useRef<HTMLPictureElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const [currentSrc, setCurrentSrc] = useState<string | null>(null)

  const manifestSources = useMemo(() => getResponsiveImageSources(src, manifest), [src, manifest])

  // Generate responsive sources (frozen breakpoint contract) when the media
  // pipeline does not own the URL.
  const generateResponsiveSources = useCallback(() => {
    const sources: Array<{ media: string; srcSet: string; type: string }> = []

    Object.entries(breakpoints).forEach(([key, { w, h }]) => {
      const minWidth = key === 'sm' ? 640 : key === 'md' ? 768 : key === 'lg' ? 1024 : 1280
      sources.push({
        media: `(min-width: ${minWidth}px)`,
        srcSet: `${src.replace(/\.(jpg|jpeg|png)$/i, '.webp')}?w=${w}&h=${h}&q=${quality}`,
        type: 'image/webp',
      })

      const extension = src.match(/\.(jpg|jpeg|png)$/i)?.[1] || 'jpg'
      sources.push({
        media: `(min-width: ${minWidth}px)`,
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
  const resolvedSizes = resolveSizes(sizes)

  return (
    <picture ref={imgRef} className={className}>
      {manifestSources ? (
        <>
          {manifestSources.avif && (
            <source type='image/avif' srcSet={manifestSources.avif} sizes={resolvedSizes} />
          )}
          {manifestSources.webp && (
            <source type='image/webp' srcSet={manifestSources.webp} sizes={resolvedSizes} />
          )}
        </>
      ) : (
        sources.map((source, index) => <source key={index} {...source} />)
      )}
      {currentSrc && (
        <img
          src={manifestSources?.fallbackSrc ?? currentSrc}
          srcSet={manifestSources?.jpg || undefined}
          sizes={resolvedSizes}
          alt={alt}
          width={manifestSources?.width}
          height={manifestSources?.height}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding='async'
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
export function ProgressiveImage({ src, alt, ...props }: OptimizedImageProps) {
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
      blurDataURL={PROGRESSIVE_BLUR_PLACEHOLDER}
      {...props}
    />
  )
}

export default OptimizedImage
