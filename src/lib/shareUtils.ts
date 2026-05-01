/**
 * Share utility functions for guest shared links and print URL generation.
 */

import { supabase } from '@/lib/supabase'

export type PrintProvider = 'shutterfly' | 'artifact_uprising'

// Print URL construction
const PRINT_URLS: Record<PrintProvider, (photoUrl: string) => string> = {
  shutterfly: (url) => `https://www.shutterfly.com/photos/print?photo=${encodeURIComponent(url)}`,
  artifact_uprising: (url) => `https://www.artifactuprising.com/print?photo=${encodeURIComponent(url)}`,
}

/**
 * Build the print provider URL for a given photo.
 * Uses VITE_PRINT_PROVIDER env var ('shutterfly' | 'artifact_uprising').
 * Defaults to Shutterfly if not set or invalid.
 */
export function buildPrintUrl(photoUrl: string): string {
  const provider = (import.meta.env.VITE_PRINT_PROVIDER as PrintProvider) || 'shutterfly'
  const builder = PRINT_URLS[provider] ?? PRINT_URLS.shutterfly
  return builder(photoUrl)
}

/**
 * Get existing share token for a guest email, or null if none exists.
 */
export async function getShareToken(email: string): Promise<string | null> {
  const { data } = await supabase
    .from('guest_share_tokens')
    .select('token')
    .eq('guest_email', email)
    .maybeSingle()
  return data?.token ?? null
}

/**
 * Ensure a share token exists for the given email.
 * If one already exists, return it. If not, create a new one.
 * Called on first guest upload per SC-03 requirements.
 */
export async function ensureGuestShareToken(email: string): Promise<string> {
  // Check if token already exists
  const existing = await getShareToken(email)
  if (existing) return existing

  // Generate new UUID token
  const token = crypto.randomUUID()

  const { error } = await supabase
    .from('guest_share_tokens')
    .insert({ guest_email: email, token })

  if (error) throw new Error(`Failed to create share token: ${error.message}`)

  return token
}
