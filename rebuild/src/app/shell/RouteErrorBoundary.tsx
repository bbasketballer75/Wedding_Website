import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  error: Error | null
}

/**
 * Route-level error boundary: a broken page must not unmount the shell.
 * Logging is deliberately console-only in Wave 1; Sentry is wired in Wave 8.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Route render failed', error, info.componentStack)
  }

  override render() {
    if (this.state.error) {
      return (
        <div role='alert' className='mx-auto max-w-xl px-4 py-24 text-center'>
          <h1 className='font-display text-3xl'>Something went wrong</h1>
          <p className='mt-4 opacity-80'>
            {this.props.fallbackTitle ?? 'This page could not be displayed.'}
          </p>
        </div>
      )
    }

    return this.props.children
  }
}
