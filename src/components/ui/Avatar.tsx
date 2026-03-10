import * as React from 'react'
import { cn } from '@/lib/utils'

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  fallback?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size = 'md', ...props }, ref) => {
    const [error, setError] = React.useState(false)

    const sizeClasses = {
      sm: 'h-8 w-8 text-xs',
      md: 'h-10 w-10 text-sm',
      lg: 'h-14 w-14 text-base',
      xl: 'h-20 w-20 text-lg',
    }

    const getInitials = (name: string) => {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }

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
        {src && !error ? (
          <img
            src={src}
            alt={alt}
            className="h-full w-full object-cover"
            onError={() => setError(true)}
          />
        ) : (
          <span>{fallback ? getInitials(fallback) : '?'}</span>
        )}
      </div>
    )
  }
)
Avatar.displayName = 'Avatar'

export { Avatar }
