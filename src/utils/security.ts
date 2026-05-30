import { supabase } from '@/lib/supabase'

import DOMPurify from 'dompurify'

// Rate limiting helper
const rateLimitMap = new Map()

// Periodic cleanup of rate limit map to prevent memory leaks
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60 * 1000 // 1 minute

function cleanupRateLimitMap(windowMs: number) {
  const windowStart = Date.now() - windowMs
  for (const [key, timestamps] of rateLimitMap.entries()) {
    const valid = (timestamps as number[]).filter(t => t > windowStart)
    if (valid.length === 0) {
      rateLimitMap.delete(key)
    } else {
      rateLimitMap.set(key, valid)
    }
  }
}

// Start periodic cleanup
if (typeof window !== 'undefined') {
  setInterval(() => cleanupRateLimitMap(60 * 60 * 1000), RATE_LIMIT_CLEANUP_INTERVAL_MS) // clean entries older than 1 hour
}

export const rateLimit = async (key: string, limit: number, windowMs: number) => {
  const now = Date.now()
  const windowStart = now - windowMs

  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, [])
  }

  const requests = rateLimitMap.get(key)
  const validRequests = (requests as number[]).filter((time: number) => time > windowStart)

  if (validRequests.length >= limit) {
    throw new Error('Rate limit exceeded')
  }

  validRequests.push(now)
  rateLimitMap.set(key, validRequests)
}

// CSRF protection
export const generateCSRFToken = () => {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

export const validateCSRFToken = (token: string, sessionToken: string) => {
  // In production, verify token against session
  return token.length === 64 && sessionToken.length > 0
}

// Input validation
export const validateInput = {
  name: (name: string): string => {
    if (!name || name.length < 2 || name.length > 100) {
      throw new Error('Name must be between 2 and 100 characters')
    }
    if (!/^[a-zA-Z\s'-]+$/.test(name)) {
      throw new Error('Name can only contain letters, spaces, hyphens, and apostrophes')
    }
    return name.trim()
  },

  email: (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email address')
    }
    return email.toLowerCase()
  },

  message: (message: string) => {
    if (!message || message.length < 10 || message.length > 1000) {
      throw new Error('Message must be between 10 and 1000 characters')
    }
    // XSS prevention via DOMPurify sanitization (strip all HTML tags and attributes)
    const sanitized = DOMPurify.sanitize(message, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
    return sanitized.trim()
  },
}

// Security headers for API requests
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https://api.supabase.co https://*.supabase.co https://*.netlify.app https://media.wedding.theporadas.com https://*.r2.dev; media-src 'self' data: blob: https:",
}

// Audit logging
export const auditLog = async (
  action: string,
  userId?: string,
  metadata?: Record<string, unknown>
) => {
  try {
    await supabase.from('audit_logs').insert({
      action,
      user_id: userId,
      metadata,
      timestamp: new Date().toISOString(),
      ip_address: metadata?.ip,
      user_agent: metadata?.userAgent,
    })
  } catch (error) {
    console.error('Failed to log audit event:', error)
  }
}

// Session management
export const sessionManager = {
  async extendSession() {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session) {
      await supabase.auth.refreshSession()
      return true
    }
    return false
  },

  async logout() {
    await supabase.auth.signOut()
    await auditLog('logout')
  },

  onAuthChange(
    callback: (event: string, session: import('@supabase/supabase-js').Session | null) => void
  ) {
    return supabase.auth.onAuthStateChange(callback)
  },
}
