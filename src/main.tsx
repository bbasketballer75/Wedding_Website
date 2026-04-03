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
import { swManager } from './utils/serviceWorker'

// Initialize error tracking (Sentry) in production
initErrorTracking()
initAnalytics()

// Register service worker via vite-plugin-pwa
const updateSW = registerSW({
  onNeedRefresh() {
    swManager.signalUpdateAvailable()
  },
  onOfflineReady() {
    // App is offline ready - PWA registered
  },
})

if (typeof updateSW === 'function') {
  swManager.setUpdateHandler(updateSW)
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Failed to find the root element')
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppProviders>
          <App />
        </AppProviders>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
