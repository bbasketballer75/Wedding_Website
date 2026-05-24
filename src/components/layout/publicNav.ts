import { BookHeart, Heart, Images, Play, Printer, type LucideIcon } from 'lucide-react'

export interface PublicNavItem {
  path: string
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
