/**
 * Share utility functions for guest shared links and print URL generation.
 * These are stubs that will be implemented in Wave 1.
 */

// Mock print provider - actual implementation in Wave 1
const PRINT_PROVIDER_URLS = {
  shutterfly: 'https://www.shutterfly.com/photos/photo_gift/create',
  artifact_uprising: 'https://www.artifactuprising.com/photo-print',
} as const

type PrintProvider = keyof typeof PRINT_PROVIDER_URLS

/**
 * Builds a print URL for the given photo URL using the configured provider.
 * @param photoUrl - The URL of the photo to print
 * @returns The print provider URL with photo parameter
 */
export function buildPrintUrl(photoUrl: string): string {
  const provider = (import.meta.env.VITE_PRINT_PROVIDER || 'shutterfly') as PrintProvider
  const baseUrl = PRINT_PROVIDER_URLS[provider] || PRINT_PROVIDER_URLS.shutterfly
  return `${baseUrl}?photo=${encodeURIComponent(photoUrl)}`
}

/**
 * Generates a UUID v4 share token.
 * @returns A unique share token
 */
export function getShareToken(): string {
  return crypto.randomUUID()
}

/**
 * Ensures a guest has a share token, creating one if needed.
 * @param email - The guest's email
 * @returns The share token for the guest
 */
export async function ensureGuestShareToken(email: string): Promise<string> {
  const { supabase } = await import('@/lib/supabase')

  // Check if token exists
  const { data } = await supabase
    .from('guest_uploads')
    .select('share_token')
    .eq('email', email)
    .not('share_token', 'is', null)
    .single()

  if (data?.share_token) {
    return data.share_token
  }

  // Create new token
  const newToken = getShareToken()
  await supabase
    .from('guest_uploads')
    .insert({ email, share_token: newToken })

  return newToken
}
