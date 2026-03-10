import React from 'react'
import { HelmetProvider } from 'react-helmet-async'
import { ToastProvider } from '../context/ToastContext'

/**
 * Main application providers wrapper
 * Wraps the app with the providers used by the current shipping routes.
 */
export interface AppProvidersProps {
  children: React.ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <HelmetProvider>
      <ToastProvider>{children}</ToastProvider>
    </HelmetProvider>
  )
}

export default AppProviders
