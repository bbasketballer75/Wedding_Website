import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
} from 'react'
import { cn } from '@/shared/lib/cn'

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  fallback?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  imgClassName?: string
  imgStyle?: CSSProperties
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-lg',
} as const

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Frozen `Avatar` port (`src/components/ui/Avatar.tsx`): initials fallback,
 * one automatic retry with a cache-busting `?retry=` token on load error, and
 * reset-on-src-change. Class strings and markup are the oracle's.
 */
export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, imgClassName, imgStyle, src, alt, fallback, size = 'md', ...props }, ref) => {
    const [error, setError] = useState(false)
    const [retryToken, setRetryToken] = useState(0)
    const hasRetriedRef = useRef(false)

    useEffect(() => {
      setError(false)
      setRetryToken(0)
      hasRetriedRef.current = false
    }, [src])

    const resolvedSrc = useMemo(() => {
      if (!src || retryToken === 0) {
        return src
      }

      const separator = src.includes('?') ? '&' : '?'
      return `${src}${separator}retry=${retryToken}`
    }, [src, retryToken])

    return (
      <div
        ref={ref}
        className={cn(
          'relative inline-flex items-center justify-center rounded-full overflow-hidden',
          'bg-gradient-to-br from-gold-100 to-gold-200 text-gold-800 font-medium',
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {resolvedSrc && !error ? (
          <img
            src={resolvedSrc}
            alt={alt}
            className={cn('h-full w-full object-cover object-center', imgClassName)}
            style={imgStyle}
            onLoad={() => setError(false)}
            onError={() => {
              if (src && !hasRetriedRef.current) {
                hasRetriedRef.current = true
                setRetryToken(Date.now())
                return
              }

              setError(true)
            }}
          />
        ) : (
          <span>{fallback ? getInitials(fallback) : '?'}</span>
        )}
      </div>
    )
  }
)
Avatar.displayName = 'Avatar'
