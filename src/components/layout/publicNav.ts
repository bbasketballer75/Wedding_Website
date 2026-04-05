import { BookHeart, Camera, Heart, Images, Play, type LucideIcon } from 'lucide-react'

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
  { path: '/guest-photos', label: 'Memories', mobileLabel: 'Mem.', icon: Camera },
]
