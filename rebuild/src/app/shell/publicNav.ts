import { BookHeart, Heart, Images, Play, Printer, type LucideIcon } from 'lucide-react'

/**
 * Public navigation, ported verbatim from the frozen `src/components/layout/publicNav.ts`
 * so the header/footer DOM text, icon choice and ordering stay identical.
 */
export type PublicNavPath = '/' | '/film' | '/gallery' | '/guestbook' | '/upload' | '/print'

export interface PublicNavItem {
  path: PublicNavPath
  label: string
  mobileLabel: string
  icon: LucideIcon
  isPrimary?: boolean
}

export const publicNavLinks: PublicNavItem[] = [
  { path: '/film', label: 'Watch Film', mobileLabel: 'Film', icon: Play, isPrimary: true },
  { path: '/gallery', label: 'Gallery', mobileLabel: 'Photos', icon: Images },
  { path: '/guestbook', label: 'Guestbook', mobileLabel: 'Guests', icon: BookHeart },
  { path: '/upload', label: 'Share', mobileLabel: 'Share', icon: Heart },
  { path: '/print', label: 'Memory Book', mobileLabel: 'Print', icon: Printer },
]
