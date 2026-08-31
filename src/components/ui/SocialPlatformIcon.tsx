import { cn } from '@/lib/utils'

type SocialPlatform = 'facebook' | 'twitter'

interface SocialPlatformIconProps {
  platform: SocialPlatform
  className?: string
}

const socialPlatformGlyph: Record<SocialPlatform, string> = {
  facebook: 'f',
  twitter: '𝕏',
}

/**
 * Lucide intentionally does not ship trademarked brand icons in v1.
 * Keep the social-share controls recognizable without coupling them to a
 * separate icon package.
 */
export function SocialPlatformIcon({ platform, className }: SocialPlatformIconProps) {
  return (
    <span
      aria-hidden='true'
      className={cn(
        'inline-flex items-center justify-center font-sans text-[1.1em] font-bold leading-none',
        className
      )}
    >
      {socialPlatformGlyph[platform]}
    </span>
  )
}
