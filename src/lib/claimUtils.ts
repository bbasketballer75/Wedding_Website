import { supabase } from './supabase'
import type { ClaimablePhoto } from '@/stores/claimStore'

/**
 * Find claimable uploads by email address
 * Only returns approved uploads that match the given email
 */
export async function findClaimableUploadsByEmail(email: string): Promise<ClaimablePhoto[]> {
  const { data, error } = await supabase
    .from('guest_uploads')
    .select('id, guest_name, guest_email, photo_urls, created_at')
    .eq('guest_email', email.toLowerCase())
    .eq('status', 'approved')

  if (error) {
    console.error('Error finding claimable uploads:', error)
    return []
  }

  return (data || []).map((upload) => ({
    id: upload.id,
    guest_name: upload.guest_name,
    guest_email: upload.guest_email,
    photo_urls: upload.photo_urls || [],
    created_at: upload.created_at || '',
  }))
}

/**
 * Generate a 6-digit verification code (100000-999999)
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Store verification code in database with 10-minute expiry
 */
export async function storeVerificationCode(email: string, code: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error } = await supabase.from('verification_codes').insert({
    email: email.toLowerCase(),
    code,
    expires_at: expiresAt,
    used: false,
    attempt_count: 0,
  })

  if (error) {
    console.error('Error storing verification code:', error)
    throw new Error('Failed to store verification code')
  }
}

/**
 * Validate a verification code
 * Returns true if code is valid, not expired, and not used
 * Marks code as used if valid
 */
export async function validateVerificationCode(email: string, code: string): Promise<boolean> {
  // First, find the code record
  const { data, error } = await supabase
    .from('verification_codes')
    .select('id, attempt_count')
    .eq('email', email.toLowerCase())
    .eq('code', code)
    .eq('used', false)
    .gte('expires_at', new Date().toISOString())
    .single()

  if (error || !data) {
    // Increment attempt count even on failure to track brute force attempts
    if (!error) {
      await supabase
        .from('verification_codes')
        .update({ attempt_count: (data?.attempt_count || 0) + 1 })
        .eq('email', email.toLowerCase())
        .eq('code', code)
    }
    return false
  }

  // Check attempt count (rate limit - 3 attempts max)
  if (data.attempt_count >= 3) {
    // Invalidate the code after 3 failed attempts
    await supabase.from('verification_codes').update({ used: true }).eq('id', data.id)
    return false
  }

  // Mark code as used
  const { error: updateError } = await supabase
    .from('verification_codes')
    .update({ used: true })
    .eq('id', data.id)

  if (updateError) {
    console.error('Error marking code as used:', updateError)
    return false
  }

  return true
}

/**
 * Create or update guest identity for the given email
 * Returns the guest identity ID
 */
export async function createGuestIdentity(
  email: string,
  displayName?: string
): Promise<string> {
  const { data, error } = await supabase
    .from('guest_identities')
    .upsert(
      {
        email: email.toLowerCase(),
        display_name: displayName || null,
        session_id: null, // Will be set if needed for admin linking
      },
      { onConflict: 'email' }
    )
    .select('id')
    .single()

  if (error) {
    console.error('Error creating guest identity:', error)
    throw new Error('Failed to create guest identity')
  }

  return data.id
}

/**
 * Link all approved guest uploads for an email to a guest identity
 * Creates photo_claims entries for each upload
 */
export async function linkGuestUploadsToIdentity(
  identityId: string,
  email: string
): Promise<void> {
  // Get all approved uploads for this email that aren't already claimed
  const { data: uploads, error } = await supabase
    .from('guest_uploads')
    .select('id')
    .eq('guest_email', email.toLowerCase())
    .eq('status', 'approved')

  if (error) {
    console.error('Error fetching uploads for linking:', error)
    throw new Error('Failed to fetch uploads for linking')
  }

  if (!uploads || uploads.length === 0) {
    return
  }

  // Create photo_claims for each upload
  const claims = uploads.map((upload) => ({
    photo_id: upload.id,
    guest_identity_id: identityId,
  }))

  const { error: insertError } = await supabase.from('photo_claims').upsert(claims, {
    onConflict: 'photo_id,guest_identity_id',
  })

  if (insertError) {
    console.error('Error linking uploads to identity:', insertError)
    throw new Error('Failed to link uploads to identity')
  }
}

/**
 * Send magic link via Supabase Otp
 * Redirect URL will be /verify
 */
export async function sendMagicLink(email: string): Promise<void> {
  const redirectTo = `${window.location.origin}/verify`

  const { error } = await supabase.auth.signInWithOtp({
    email: email.toLowerCase(),
    options: {
      emailRedirectTo: redirectTo,
    },
  })

  if (error) {
    console.error('Error sending magic link:', error)
    throw new Error('Failed to send magic link')
  }
}

/**
 * Complete the photo claiming flow for an email
 * 1. Create guest identity
 * 2. Link all approved uploads to identity
 * Returns the identity ID
 */
export async function claimPhotosWithEmail(
  email: string,
  displayName?: string
): Promise<string> {
  // Create or update guest identity
  const identityId = await createGuestIdentity(email, displayName)

  // Link all approved uploads to the identity
  await linkGuestUploadsToIdentity(identityId, email)

  return identityId
}
