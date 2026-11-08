import { cn } from '@/shared/lib/cn'

export type SocialPlatform = 'facebook' | 'twitter'

export interface SocialPlatformIconProps {
  platform: SocialPlatform
  className?: string
}

const socialPlatformGlyph: Record<SocialPlatform, string> = {
  facebook: 'f',
  twitter: '𝕏',
}

/**
 * Frozen `SocialPlatformIcon` port (`src/components/ui/SocialPlatformIcon.tsx`).
 * Lucide intentionally does not ship trademarked brand icons in v1, so the
 * frozen app renders text glyphs — reproduced verbatim.
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
