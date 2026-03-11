import React from 'react'
import { ToastProvider } from '../context/ToastContext'

/**
 * Main application providers wrapper
 * Wraps the app with the providers used by the current shipping routes.
 */
export interface AppProvidersProps {
  children: React.ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return <ToastProvider>{children}</ToastProvider>
}

export default AppProviders
