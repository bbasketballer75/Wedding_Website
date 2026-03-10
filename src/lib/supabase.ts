import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.'
  )
}

/**
 * Single Supabase client instance for the entire application.
 * 
 * Configuration:
 * - Auth: Auto-refresh tokens, persist session, detect session in URL
 * - Realtime: Limited to 10 events per second to prevent flooding
 * - All auth changes are handled by AuthProvider (see providers/AuthProvider.tsx)
 */
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Types for our database tables
export interface Photo {
  id: string
  url: string
  thumbnail: string
  caption?: string
  category?: string
  location?: string
  date?: string
  likes: number
  photographer?: string
  is_professional: boolean
  tags: string[]
  faces: any[]
  created_at: string
}

export interface GuestUpload {
  id: string
  guest_name: string
  guest_email: string
  message?: string
  photo_urls: string[]
  video_urls: string[]
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export interface GuestbookMessage {
  id: string
  name: string
  email: string
  content: string
  type: 'text' | 'voice' | 'video'
  media_url?: string
  reactions: Record<string, number>
  created_at: string
}
