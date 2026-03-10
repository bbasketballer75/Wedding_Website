import React from 'react'
import ErrorBoundary from './ErrorBoundary'

// Custom hook for error handling
export const useErrorHandler = () => {
  return React.useCallback((error, errorInfo) => {
    // Log error to service
    console.error('Error caught by handler:', error, errorInfo)

    // You can integrate with error reporting services here
    // e.g., Sentry, LogRocket, etc.
  }, [])
}

// HOC for wrapping components with error boundary
export const withErrorBoundary = (Component, boundaryProps = {}) => {
  const WrappedComponent = props => (
    <ErrorBoundary {...boundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}
