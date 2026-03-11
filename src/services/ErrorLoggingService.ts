/**
 * Error Logging Service
 * 
 * Provides structured error logging for production and development environments.
 * Sends errors to Sentry in production, console in development.
 */

import * as Sentry from '@sentry/react'

export interface ErrorLogEntry {
  /** Error message */
  message: string
  /** Full stack trace */
  stack?: string
  /** Name of the component where error occurred */
  componentName?: string
  /** ISO timestamp when error occurred */
  timestamp: string
  /** Additional error info from React ErrorBoundary */
  errorInfo?: string
  /** Environment information */
  environment: 'production' | 'development' | 'test'
  /** URL where error occurred */
  url: string
  /** User agent string */
  userAgent: string
  /** User ID if available */
  userId?: string
  /** Additional context */
  context?: Record<string, unknown>
}

/**
 * Initialize Sentry for error tracking
 * Call this once in your app entry point (main.tsx)
 */
export function initErrorTracking(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  
  if (!dsn) {
    // Sentry not configured - log once in development
    if (import.meta.env.DEV) {
      // Silently skip in development if not configured
    }
    return
  }

  Sentry.init({
    dsn,
    environment: getEnvironment(),
    release: import.meta.env.VITE_APP_VERSION || __APP_VERSION__ || 'development',
    enabled: import.meta.env.PROD,
    sendDefaultPii: false,
    
    // Performance monitoring (optional)
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    
    // Replay sampling (optional, for session replay)
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    // Before sending, filter out sensitive data
    beforeSend(event) {
      // Filter out PII from URLs
      if (event.request?.url) {
        event.request.url = event.request.url.replace(
          /(token|password|secret|key)=([^&]+)/gi,
          '$1=[FILTERED]'
        )
      }
      return event
    },
  })
}

/**
 * Log an error with structured format
 * 
 * @param error - The Error object
 * @param componentName - Name of the component where error occurred
 * @param errorInfo - React ErrorInfo object (optional)
 * @param context - Additional context data
 */
export function logError(
  error: Error,
  componentName?: string,
  errorInfo?: { componentStack?: string },
  context?: Record<string, unknown>
): void {
  const entry: ErrorLogEntry = {
    message: error.message,
    stack: error.stack,
    componentName,
    timestamp: new Date().toISOString(),
    errorInfo: errorInfo?.componentStack,
    environment: getEnvironment(),
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    context,
  }

  // Always log to console for development debugging
  if (entry.environment === 'development') {
    logToConsole(entry)
  }

  // Send to Sentry in production
  if (entry.environment === 'production') {
    sendToSentry(error, entry)
  }
}

/**
 * Send error to Sentry
 */
function sendToSentry(error: Error, entry: ErrorLogEntry): void {
  Sentry.withScope((scope) => {
    // Set tags
    scope.setTag('component', entry.componentName || 'unknown')
    scope.setTag('environment', entry.environment)
    
    // Set extra context
    if (entry.context) {
      Object.entries(entry.context).forEach(([key, value]) => {
        scope.setExtra(key, value)
      })
    }
    
    // Set user context if available
    if (entry.userId) {
      scope.setUser({ id: entry.userId })
    }
    
    // Capture the exception
    Sentry.captureException(error)
  })
}

/**
 * Get the current environment
 */
function getEnvironment(): 'production' | 'development' | 'test' {
  if (import.meta.env.PROD) return 'production'
  if (import.meta.env.DEV) return 'development'
  return 'test'
}

/**
 * Log error entry to console in structured format
 */
function logToConsole(entry: ErrorLogEntry): void {
  const logPrefix = `[ERROR_LOG] ${entry.timestamp}`
  
  console.group(logPrefix)
  console.log('Message:', entry.message)
  
  if (entry.componentName) {
    console.log('Component:', entry.componentName)
  }
  
  if (entry.stack) {
    console.log('Stack Trace:', entry.stack)
  }
  
  if (entry.errorInfo) {
    console.log('Component Stack:', entry.errorInfo)
  }
  
  if (entry.context) {
    console.log('Context:', entry.context)
  }
  
  console.log('Environment:', entry.environment)
  console.log('URL:', entry.url)
  console.groupEnd()
}

/**
 * Log a warning (for non-critical issues)
 * 
 * @param message - Warning message
 * @param context - Additional context
 */
export function logWarning(message: string, context?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString()
  
  if (import.meta.env.DEV) {
    console.warn(`[WARNING] ${timestamp}:`, message, context || '')
  }
  
  // Send to Sentry in production as a message
  if (import.meta.env.PROD) {
    Sentry.withScope((scope) => {
      scope.setLevel('warning')
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          scope.setExtra(key, value)
        })
      }
      Sentry.captureMessage(message, 'warning')
    })
  }
}

/**
 * Log an informational message
 * 
 * @param message - Info message
 * @param context - Additional context
 */
export function logInfo(message: string, context?: Record<string, unknown>): void {
  // Only log in development
  if (import.meta.env.DEV) {
    const timestamp = new Date().toISOString()
    console.info(`[INFO] ${timestamp}:`, message, context || '')
  }
}

/**
 * Set user context for error tracking
 * Call this when user logs in/out
 */
export function setErrorTrackingUser(userId: string | null, email?: string): void {
  if (userId) {
    Sentry.setUser({ id: userId, email: email || undefined })
  } else {
    Sentry.setUser(null)
  }
}

/**
 * Error Logging Service class for dependency injection
 */
export class ErrorLoggingService {
  /**
   * Log an error
   */
  log(error: Error, componentName?: string, errorInfo?: { componentStack?: string }, context?: Record<string, unknown>): void {
    logError(error, componentName, errorInfo, context)
  }

  /**
   * Log a warning
   */
  warn(message: string, context?: Record<string, unknown>): void {
    logWarning(message, context)
  }

  /**
   * Log info
   */
  info(message: string, context?: Record<string, unknown>): void {
    logInfo(message, context)
  }

  /**
   * Set user context
   */
  setUser(userId: string | null, email?: string): void {
    setErrorTrackingUser(userId, email)
  }
}

export default ErrorLoggingService
