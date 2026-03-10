import DOMPurify from 'dompurify'

// Default configuration for sanitization
const DEFAULT_CONFIG = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'em',
    'u',
    'i',
    'b',
    'a',
    'ul',
    'ol',
    'li',
    'blockquote',
    'code',
    'pre',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  ALLOW_DATA_ATTR: false,
}

// Configure DOMPurify
DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  // Allow external links to open in new tab
  if (data.attrName === 'href' && node.tagName === 'A') {
    const href = data.attrValue
    if (href && (href.startsWith('http') || href.startsWith('//'))) {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
  }
})

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param dirty - The dirty HTML string
 * @param config - Optional custom configuration
 * @returns Sanitized HTML string
 */
export const sanitizeHTML = (dirty: string, config = DEFAULT_CONFIG): string => {
  if (typeof dirty !== 'string') {
    return ''
  }

  return DOMPurify.sanitize(dirty, config)
}

/**
 * Sanitize text content (strip all HTML)
 * @param dirty - The dirty string
 * @returns Plain text string
 */
export const sanitizeText = (dirty: string): string => {
  if (typeof dirty !== 'string') {
    return ''
  }

  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] })
}

/**
 * Sanitize URL to prevent XSS
 * @param url - The URL to sanitize
 * @returns Sanitized URL
 */
export const sanitizeURL = (url: string): string => {
  if (typeof url !== 'string') {
    return ''
  }

  try {
    const parsed = new URL(url, window.location.origin)

    // Only allow http, https, and mailto protocols
    const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:']
    if (!allowedProtocols.includes(parsed.protocol)) {
      return ''
    }

    return parsed.toString()
  } catch {
    return ''
  }
}

/**
 * Sanitize user input for names and simple text fields
 * @param input - The user input
 * @returns Sanitized string
 */
export const sanitizeUserInput = (input: string): string => {
  if (typeof input !== 'string') {
    return ''
  }

  // Remove HTML tags and extra whitespace
  return input
    .replace(/<[^>]*>/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Validate and sanitize email addresses
 * @param email - The email to validate
 * @returns Valid email or empty string
 */
export const sanitizeEmail = (email: string): string => {
  if (typeof email !== 'string') {
    return ''
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const sanitized = sanitizeUserInput(email.toLowerCase())

  return emailRegex.test(sanitized) ? sanitized : ''
}

/**
 * Sanitize and validate phone numbers
 * @param phone - The phone number to sanitize
 * @returns Sanitized phone number
 */
export const sanitizePhone = (phone: string): string => {
  if (typeof phone !== 'string') {
    return ''
  }

  // Remove all non-digit characters except +, -, (, )
  return phone.replace(/[^\d+()-\s]/g, '').trim()
}

/**
 * Sanitize file names
 * @param filename - The file name to sanitize
 * @returns Sanitized file name
 */
export const sanitizeFileName = (filename: string): string => {
  if (typeof filename !== 'string') {
    return ''
  }

  // Remove path traversal attempts and special characters
  return filename
    .replace(/\.\./g, '')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/^\.+/, '')
    .trim()
}

/**
 * Create a safe HTML string with line breaks
 * @param text - The text to convert
 * @returns HTML string with <br> tags
 */
export const textToHTML = (text: string): string => {
  const sanitized = sanitizeText(text)
  return sanitized.replace(/\n/g, '<br>')
}

/**
 * Sanitize and truncate text for display
 * @param text - The text to sanitize and truncate
 * @param maxLength - Maximum length
 * @returns Truncated and sanitized text
 */
export const sanitizeAndTruncate = (text: string, maxLength: number): string => {
  const sanitized = sanitizeUserInput(text)
  if (sanitized.length <= maxLength) {
    return sanitized
  }

  return `${sanitized.substring(0, maxLength).trim()}...`
}

/**
 * Create a safe HTML string for display (React dangerouslySetInnerHTML format)
 * @param html - The HTML string to make safe
 * @returns Object with __html property
 */
export const createSafeHTML = (html: string): { __html: string } => {
  return { __html: sanitizeHTML(html) }
}

/**
 * Sanitize user input for guest book entries
 * @param entry - The guest book entry object
 * @returns The sanitized entry object
 */
export const sanitizeGuestBookEntry = (entry: any): any => {
  return {
    ...entry,
    name: sanitizeText(entry.name || ''),
    message: sanitizeHTML(entry.message || ''),
    // Allow line breaks in messages
    messageWithBreaks: textToHTML(entry.message || ''),
  }
}

// Export default object for backward compatibility if needed
export default {
  sanitizeHTML,
  sanitizeText,
  sanitizeGuestBookEntry,
  createSafeHTML,
  sanitizeURL,
  sanitizeUserInput,
  sanitizeEmail,
  sanitizePhone,
  sanitizeFileName,
  textToHTML,
  sanitizeAndTruncate,
}

// Export default configuration for customization
export { DEFAULT_CONFIG }
