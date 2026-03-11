/// <reference types="vite/client" />

// Global types for the wedding website

declare global {
  const __APP_VERSION__: string

  interface Window {
    // Service Worker
    serviceWorkerReady?: boolean

    // PWA install prompt
    deferredPWAInstallPrompt?: BeforeInstallPromptEvent

    // Analytics
    dataLayer?: unknown[][]
    gtag?: (command: string, ...args: unknown[]) => void

    // Custom properties
    __WEDDING_SITE__?: {
      version: string
      buildTime: string
    }
  }
}

// BeforeInstallPromptEvent for PWA
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

// API Response Types
export interface ApiResponse<T = unknown> {
  data: T
  message?: string
  error?: string
  status: number
}

// Guest Book Types
export interface GuestBookEntry {
  id: string
  name: string
  message: string
  timestamp: string
  approved: boolean
}

// Photo Types
export interface Photo {
  id: string
  url: string
  thumbnail: string
  caption?: string
  tags: string[]
  uploadedAt: string
}

// Wedding Party Member Types
export interface WeddingPartyMember {
  id: string
  name: string
  role: string
  bio: string
  photo: string
  side: 'bride' | 'groom'
}

// Timeline Event Types
export interface TimelineEvent {
  id: string
  date: string
  title: string
  description: string
  type: 'milestone' | 'story' | 'photo'
  images?: string[]
}

// Navigation Types
export interface NavLink {
  name: string
  target: string
  icon?: string
}

// Theme Types
export type Theme = 'light' | 'dark' | 'system'

// Toast Types
export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

// Gesture Types
export interface SwipeGesture {
  direction: 'left' | 'right' | 'up' | 'down'
  velocity: number
  distance: number
}

// Performance Types
export interface WebVitals {
  lcp: number
  fid: number
  cls: number
  ttfb: number
}

export {}
