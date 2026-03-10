/**
 * Security Middleware
 * Implements Content Security Policy, security headers, and request validation
 * 
 * NOTE ON CSRF PROTECTION:
 * This file previously contained client-side CSRF token generation and validation.
 * Client-side CSRF tokens stored in sessionStorage do NOT provide actual CSRF protection
 * because an attacker can still read/write sessionStorage from the same origin.
 * 
 * CSRF protection is properly handled by:
 * 1. Supabase authentication tokens (using secure, httpOnly cookies with SameSite=Lax/Strict)
 * 2. The Authorization header pattern used in Supabase API calls
 * 3. Browser CORS policies
 * 4. SameSite cookie attributes set by Supabase
 * 
 * For more information, see: https://supabase.com/docs/guides/auth/security
 */

export interface SecurityConfig {
  enableCSP: boolean
  enableHSTS: boolean
  enableXFrameOptions: boolean
  enableXContentTypeOptions: boolean
  enableReferrerPolicy: boolean
}

export const defaultSecurityConfig: SecurityConfig = {
  enableCSP: true,
  enableHSTS: true,
  enableXFrameOptions: true,
  enableXContentTypeOptions: true,
  enableReferrerPolicy: true,
}

/**
 * Content Security Policy configuration
 */
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Required for Vite in dev
    "'unsafe-eval'", // Required for Vite in dev
    'https://cdn.jsdelivr.net',
    'https://*.supabase.co',
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for styled components
    'https://fonts.googleapis.com',
  ],
  'img-src': ["'self'", 'data:', 'blob:', 'https:', 'https://*.supabase.co'],
  'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
  'connect-src': ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'],
  'media-src': ["'self'", 'https://*.supabase.co'],
  'object-src': ["'none'"],
  'frame-src': ["'self'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'upgrade-insecure-requests': [],
}

/**
 * Build CSP header string
 */
export function buildCSPHeader(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([directive, sources]) => {
      if (sources.length === 0) return directive
      return `${directive} ${sources.join(' ')}`
    })
    .join('; ')
}

/**
 * Security headers configuration
 */
export const SECURITY_HEADERS = {
  // HSTS - Force HTTPS
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // Prevent clickjacking
  'X-Frame-Options': 'DENY',

  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // XSS Protection (legacy but still useful)
  'X-XSS-Protection': '1; mode=block',

  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions policy
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
}

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(
  headers: Record<string, string>,
  config: SecurityConfig = defaultSecurityConfig
): Record<string, string> {
  const secureHeaders = { ...headers }

  if (config.enableCSP) {
    secureHeaders['Content-Security-Policy'] = buildCSPHeader()
  }

  if (config.enableHSTS) {
    secureHeaders['Strict-Transport-Security'] = SECURITY_HEADERS['Strict-Transport-Security']
  }

  if (config.enableXFrameOptions) {
    secureHeaders['X-Frame-Options'] = SECURITY_HEADERS['X-Frame-Options']
  }

  if (config.enableXContentTypeOptions) {
    secureHeaders['X-Content-Type-Options'] = SECURITY_HEADERS['X-Content-Type-Options']
  }

  if (config.enableReferrerPolicy) {
    secureHeaders['Referrer-Policy'] = SECURITY_HEADERS['Referrer-Policy']
  }

  // Always apply these
  secureHeaders['X-XSS-Protection'] = SECURITY_HEADERS['X-XSS-Protection']
  secureHeaders['Permissions-Policy'] = SECURITY_HEADERS['Permissions-Policy']

  return secureHeaders
}

/**
 * Validate request origin
 */
export function validateOrigin(origin: string): boolean {
  const allowedOrigins = [
    window.location.origin,
    'https://theporadas.com',
    'https://www.theporadas.com',
  ]

  return allowedOrigins.includes(origin)
}

/**
 * DEPRECATED: Client-side CSRF token generation
 * 
 * This function is kept for backwards compatibility but should NOT be used
 * for security purposes. Client-side CSRF tokens stored in sessionStorage
 * do not provide actual CSRF protection.
 * 
 * CSRF protection is handled by Supabase's secure authentication system.
 * 
 * @deprecated Use Supabase authentication tokens instead
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * DEPRECATED: Store CSRF token
 * @deprecated No longer needed with Supabase auth
 */
export function storeCSRFToken(token: string): void {
  sessionStorage.setItem('csrf_token', token)
}

/**
 * DEPRECATED: Get CSRF token
 * @deprecated No longer needed with Supabase auth
 */
export function getCSRFToken(): string | null {
  return sessionStorage.getItem('csrf_token')
}

/**
 * DEPRECATED: Validate CSRF token
 * 
 * This function is kept for backwards compatibility but provides no actual
 * security benefit as client-side storage is accessible to same-origin scripts.
 * 
 * @deprecated Use Supabase's built-in CSRF protection instead
 */
export function validateCSRFToken(token: string): boolean {
  console.warn('validateCSRFToken is deprecated. Supabase auth tokens provide CSRF protection.')
  const storedToken = getCSRFToken()
  return storedToken === token
}

/**
 * DEPRECATED: Initialize CSRF protection
 * @deprecated No longer needed with Supabase auth
 */
export function initializeCSRFProtection(): string {
  console.warn('initializeCSRFProtection is deprecated. Supabase auth handles CSRF protection.')
  let token = getCSRFToken()

  if (!token) {
    token = generateCSRFToken()
    storeCSRFToken(token)
  }

  return token
}

/**
 * Sanitize URL to prevent open redirect
 */
export function sanitizeRedirectUrl(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin)

    // Only allow same-origin redirects
    if (parsed.origin !== window.location.origin) {
      return '/'
    }

    return parsed.pathname + parsed.search + parsed.hash
  } catch {
    return '/'
  }
}

/**
 * Rate limiting store
 * Note: This is client-side rate limiting for UX purposes only.
 * Server-side rate limiting should be implemented on the backend for security.
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map()

  /**
   * Check if request should be rate limited
   */
  isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now()
    const requests = this.requests.get(key) || []

    // Remove old requests outside the window
    const recentRequests = requests.filter(time => now - time < windowMs)

    if (recentRequests.length >= maxRequests) {
      return true
    }

    // Add current request
    recentRequests.push(now)
    this.requests.set(key, recentRequests)

    return false
  }

  /**
   * Clear rate limit for key
   */
  clear(key: string): void {
    this.requests.delete(key)
  }
}

export const rateLimiter = new RateLimiter()

/**
 * Check rate limit for API calls
 * Note: Client-side only - server-side rate limiting is still required
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): boolean {
  return rateLimiter.isRateLimited(identifier, maxRequests, windowMs)
}

export default {
  applySecurityHeaders,
  buildCSPHeader,
  validateOrigin,
  // Deprecated CSRF functions - kept for backwards compatibility
  initializeCSRFProtection,
  validateCSRFToken,
  sanitizeRedirectUrl,
  checkRateLimit,
}
