/**
 * Guest shared data fetching functions.
 * These are stubs that will be implemented in Wave 1.
 */

import { supabase } from '@/lib/supabase'

export interface GuestShareTokenData {
  email: string
  share_token: string
}

export interface GuestSharedData {
  uploads: unknown[]
  guestbook: unknown[]
}

/**
 * Fetches guest data by share token.
 * @param token - The share token
 * @returns The guest email and token, or null if not found
 */
export async function fetchGuestShareToken(token: string): Promise<GuestShareTokenData | null> {
  const { data } = await supabase
    .from('guest_uploads')
    .select('email, share_token')
    .eq('share_token', token)
    .single()

  return data
}

/**
 * Fetches all uploads and guestbook entries for a guest by email.
 * @param email - The guest's email
 * @returns Combined uploads and guestbook data, or null if none found
 */
export async function fetchGuestSharedData(email: string): Promise<GuestSharedData | null> {
  const [uploadsResult, guestbookResult] = await Promise.all([
    supabase
      .from('guest_uploads')
      .select('*')
      .eq('email', email),
    supabase
      .from('guestbook_messages')
      .select('*')
      .eq('email', email),
  ])

  if (!uploadsResult.data?.length && !guestbookResult.data?.length) {
    return null
  }

  return {
    uploads: uploadsResult.data || [],
    guestbook: guestbookResult.data || [],
  }
}
