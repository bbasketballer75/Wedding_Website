import { supabase } from '@/lib/supabase'

const isDevelopment = import.meta.env.DEV

interface ErrorLogData {
  message: string
  stack?: string
  url: string
  user_agent: string
  extra: unknown[]
}

interface Logger {
  log: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
  group: (label: string, fn: () => void) => void
  time: (label: string) => void
  timeEnd: (label: string) => void
}

const logger: Logger = {
  log: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args)
    }
  },

  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.info(...args)
    }
  },

  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn(...args)
    }
  },

  error: (...args: unknown[]) => {
    // Always show errors, even in production
    console.error(...args)

    // In production, send errors to a service
    if (!isDevelopment) {
      const firstArg = args[0]
      const message = firstArg instanceof Error ? firstArg.message : String(firstArg)
      const stack = firstArg instanceof Error ? firstArg.stack : new Error().stack

      // Simple redaction for PII
      const redact = (obj: unknown): unknown => {
        if (!obj || typeof obj !== 'object') return obj
        if (Array.isArray(obj)) return obj.map(redact)
        
        const redacted = { ...(obj as Record<string, unknown>) }
        const sensitiveKeys = ['email', 'password', 'token', 'phone', 'address', 'key']
        
        for (const key in redacted) {
          if (Object.prototype.hasOwnProperty.call(redacted, key)) {
            if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
              redacted[key] = '[REDACTED]'
            } else if (typeof redacted[key] === 'object') {
              redacted[key] = redact(redacted[key])
            }
          }
        }
        return redacted
      }

      const errorData: ErrorLogData = {
        message,
        stack,
        url: window.location.href,
        user_agent: navigator.userAgent,
        extra: args.slice(1).map(redact),
      }

      // Log error to Supabase
      supabase
        .from('error_logs')
        .insert([errorData])
        .then(({ error }) => {
          if (error) console.warn('Failed to log error to Supabase:', error)
        })

      console.warn('Production Error tracked:', errorData)
    }
  },
  debug: (...args: unknown[]) => {
    if (isDevelopment) {
      console.debug(...args)
    }
  },

  // Group logs for better organization
  group: (label: string, fn: () => void) => {
    if (isDevelopment) {
      console.group(label)
      fn()
      console.groupEnd()
    }
  },

  // Time performance
  time: (label: string) => {
    if (isDevelopment) {
      console.time(label)
    }
  },

  timeEnd: (label: string) => {
    if (isDevelopment) {
      console.timeEnd(label)
    }
  },
}

export default logger