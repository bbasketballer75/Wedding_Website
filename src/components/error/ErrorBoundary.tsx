import { useUIStore } from '@/stores'
import { logError } from '@/services/ErrorLoggingService'
import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

const ErrorFallback: React.FC<{ error: Error | null; resetError: () => void }> = ({
  error,
  resetError,
}) => {
  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4'>
      <div className='text-center max-w-md'>
        <div className='mb-8'>
          <h1 className='text-6xl font-bold text-gray-900 dark:text-white mb-4'>Oops!</h1>
          <div className='w-16 h-1 bg-(--color-gold) mx-auto mb-6'></div>
        </div>

        <h2
          className='text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4'
          data-testid='error-message'
        >
          Something went wrong
        </h2>

        <p className='text-gray-600 dark:text-gray-400 mb-8'>
          We apologize for the inconvenience. An unexpected error occurred.
        </p>

        {import.meta.env.DEV && error && (
          <details className='text-left mb-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg'>
            <summary className='cursor-pointer font-mono text-sm text-gray-700 dark:text-gray-300 mb-2'>
              Error Details
            </summary>
            <pre className='text-xs text-red-600 dark:text-red-400 overflow-auto'>
              {error.toString()}
              {error.stack}
            </pre>
          </details>
        )}

        <div className='flex flex-col sm:flex-row gap-4 justify-center'>
          <button
            onClick={resetError}
            className='px-6 py-3 bg-(--color-gold) text-white rounded-md hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-(--color-gold) transition-colors'
          >
            Try Again
          </button>
          <a
            href='/'
            className='px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors no-underline'
          >
            Go Home
          </a>
        </div>

        <p className='mt-8 text-sm text-gray-500 dark:text-gray-400'>
          If this problem persists, please contact us.
        </p>
      </div>
    </div>
  )
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo })

    // Log error using the error logging service
    logError(error, 'ErrorBoundary', {
      componentStack: errorInfo.componentStack ?? undefined,
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Show toast notification
    try {
      const { addToast } = useUIStore.getState()
      addToast({
        type: 'error',
        title: 'An error occurred',
        message: 'Something went wrong. Please try again.',
      })
    } catch (e) {
      // Fallback if store is not available - keep error log
      console.error('Could not show error toast:', e)
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return <ErrorFallback error={this.state.error} resetError={this.resetError} />
    }

    return this.props.children
  }
}

// Specialized error boundaries for different sections
export const RouteErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary>{children}</ErrorBoundary>
)

export const ComponentErrorBoundary: React.FC<{ children: ReactNode; componentName?: string }> = ({
  children,
  componentName,
}) => (
  <ErrorBoundary
    fallback={
      <div className='p-8 text-center bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700'>
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-2'>
          {componentName || 'Component'} Failed to Load
        </h3>
        <p className='text-sm text-gray-600 dark:text-gray-400 mb-4'>
          Something went wrong while rendering this section.
        </p>
        <button
          onClick={() => window.location.reload()}
          className='text-gold hover:underline text-sm font-medium'
        >
          Refresh Page
        </button>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
)

export const APIErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary>{children}</ErrorBoundary>
)

export default ErrorBoundary
