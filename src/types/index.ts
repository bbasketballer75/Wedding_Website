// Global types for the wedding website

export interface Memory {
  id: string
  name: string
  message?: string
  photo_url?: string
  altText?: string // New field for photo alt text
  type: 'message' | 'photo' | 'both'
  created_at: string
  source?: 'user' | 'admin'
  tags?: string[] // Added tags field
}

export interface GalleryImage {
  id: string
  src: string
  alt: string
  caption?: string
  type?: 'main' | 'filler' | 'gallery' | 'featured'
}

export interface WeddingPartyMember {
  id: string
  name: string
  role: string
  relationship: string
  bio?: string
  photo?: string
  side: 'bride' | 'groom'
}

export interface VideoChapter {
  label: string
  time: number
}

export interface GuestBookEntry {
  id: string
  name: string
  message: string
  photo_url?: string
  created_at: string
}

export interface MapPin {
  id: string
  name: string
  latitude: number
  longitude: number
  message?: string
}

export interface Theme {
  mode: 'light' | 'dark'
  colors: {
    primary: string
    secondary: string
    background: string
    surface: string
    text: string
  }
}

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

export interface LoadingState {
  isLoading: boolean
  message?: string
}

export interface ErrorState {
  hasError: boolean
  error?: Error
  errorInfo?: unknown
}

export interface PaginationState {
  page: number
  pageSize: number
  hasMore: boolean
  total?: number
}

export interface SearchFilters {
  query?: string
  category?: string
  tags?: string[]
  dateRange?: {
    start: string
    end: string
  }
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  musicEnabled: boolean
  animationsEnabled: boolean
  autoPlayVideos: boolean
}

export interface PerformanceMetrics {
  fcp: number // First Contentful Paint
  lcp: number // Largest Contentful Paint
  fid: number // First Input Delay
  cls: number // Cumulative Layout Shift
  ttfb: number // Time to First Byte
}

export interface AnalyticsEvent {
  name: string
  properties?: Record<string, unknown>
  timestamp: number
}

// Component Props
export interface LazyImageProps {
  src: string
  alt: string
  className?: string
  placeholder?: string
  onLoad?: () => void
  onError?: () => void
}

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  className?: string
}

// API Response types
export interface ApiResponse<T = unknown> {
  data: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    hasMore: boolean
  }
}

// Supabase types
export interface SupabaseMemory {
  id: string
  created_at: string
  name: string
  message: string | null
  photo_url: string | null
  alt_text: string | null // New field for photo alt text
  type: string
  tags: string[] | null // Added tags field
}

export interface SupabaseGalleryImage {
  id: string
  title: string
  description: string | null
  image_url: string
  thumbnail_url: string | null
  category: string
  tags: string[]
  sort_order: number
  is_featured: boolean
  created_at: string
  updated_at: string
}

// Utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}
