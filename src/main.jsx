import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'
import { AuthProvider } from './providers/AuthProvider'
import { AppProviders } from './providers/AppProviders'
import { initAnalytics } from './services/AnalyticsService'
import { initErrorTracking } from './services/ErrorLoggingService'

// Initialize error tracking (Sentry) in production
initErrorTracking()
initAnalytics()

// Register service worker via vite-plugin-pwa
registerSW({
  onNeedRefresh() {
    // Show prompt to user
  },
  onOfflineReady() {
    // App is offline ready - PWA registered
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppProviders>
          <App />
        </AppProviders>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
