# Skill: Progressive Web App (PWA)

## Overview

This skill enables Codex to work with the PWA features of the wedding website, including service workers, offline support, and app manifest.

## PWA Configuration

### Vite PWA Plugin

Configured in `vite.config.js`:

```javascript
import { VitePWA } from 'vite-plugin-pwa'

VitePWA({
  registerType: 'autoUpdate',
  devOptions: {
    enabled: false,  // Disabled in dev
  },
  manifestFilename: 'manifest.webmanifest',
  includeAssets: [
    'favicon-custom.svg',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'apple-touch-icon.png',
    'browserconfig.xml',
    'robots.txt',
    'offline.html',
  ],
  manifest: {
    name: "Austin & Jordyn's Wedding",
    short_name: 'A&J Wedding',
    description: 'Join us in celebrating our wedding...',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#08080a',
    theme_color: '#d4af37',
    icons: [
      { src: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
      { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcuts: [
      {
        name: 'View Gallery',
        short_name: 'Gallery',
        url: '/gallery',
        icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }],
      },
      {
        name: 'Guest Book',
        short_name: 'Guest Book',
        url: '/guestbook',
        icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }],
      },
    ],
  },
})
```

## PWA Components

### Service Worker Registration

```typescript
// src/pwa/register.ts
export function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('SW registered:', registration)
        })
        .catch(error => {
          console.log('SW registration failed:', error)
        })
    })
  }
}
```

### usePWA Hook

```typescript
// src/hooks/usePWA.ts
import { useState, useEffect } from 'react'

interface PWAState {
  isInstallable: boolean
  isInstalled: boolean
  isOffline: boolean
  install: () => Promise<void>
}

export function usePWA(): PWAState {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    // Track install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    // Track installation
    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setIsInstalled(true)
    }

    // Track online/offline
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const install = async () => {
    if (!deferredPrompt) return
    
    // Show install prompt
    const promptEvent = deferredPrompt as any
    promptEvent.prompt()
    
    // Wait for user choice
    const { outcome } = await promptEvent.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isOffline,
    install,
  }
}
```

### Install Prompt Component

```tsx
// src/components/pwa/InstallPrompt.tsx
import { usePWA } from '@/hooks/usePWA'
import { Button } from '@/components/ui/Button'

export function InstallPrompt() {
  const { isInstallable, isInstalled, install } = usePWA()

  if (!isInstallable || isInstalled) return null

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-sm">
      <p className="text-sm mb-3">
        Install our wedding app for quick access!
      </p>
      <div className="flex gap-2">
        <Button variant="primary" onClick={install}>
          Install
        </Button>
        <Button variant="ghost" onClick={() => localStorage.setItem('pwa-dismissed', 'true')}>
          Later
        </Button>
      </div>
    </div>
  )
}
```

### Offline Indicator

```tsx
// src/components/pwa/OfflineIndicator.tsx
import { usePWA } from '@/hooks/usePWA'

export function OfflineIndicator() {
  const { isOffline } = usePWA()

  if (!isOffline) return null

  return (
    <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-center py-2 text-sm">
      You're offline. Some features may be limited.
    </div>
  )
}
```

## Offline Support

### Offline Page

Create `public/offline.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offline - Austin & Jordyn's Wedding</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      text-align: center;
    }
    .container {
      padding: 2rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>You're Offline</h1>
    <p>Please check your internet connection and try again.</p>
    <button onclick="location.reload()">Retry</button>
  </div>
</body>
</html>
```

### Cache Strategies

The Vite PWA plugin handles caching automatically:

```javascript
// vite.config.js - Workbox configuration
VitePWA({
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/media\.wedding\.theporadas\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'wedding-media',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          },
        },
      },
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 5 * 60, // 5 minutes
          },
        },
      },
    ],
  },
})
```

## App Icons

Required icon sizes in `public/icons/`:

| Size | Purpose |
|------|---------|
| 72x72 | Android launcher |
| 96x96 | Android launcher |
| 128x128 | Chrome Web Store |
| 144x144 | iOS/Android |
| 152x152 | iPad |
| 192x192 | Android splash |
| 384x384 | PWA splash |
| 512x512 | PWA install prompt |

Generate with:

```bash
# Using sharp
npx sharp input.png -resize 192x192 icons/icon-192x192.png
```

## Testing PWA

### Lighthouse Audit

1. Open Chrome DevTools
2. Go to Lighthouse tab
3. Select "PWA" category
4. Run audit

### DevTools Testing

```
Application → Service Workers
- Check registration status
- Test offline by checking "Offline"
- Unregister to test fresh install

Application → Manifest
- Verify manifest values
- Test "Add to home screen"
```

### Real Device Testing

**Android:**
1. Visit site in Chrome
2. Tap menu → "Add to Home screen"
3. Check standalone mode (no browser chrome)

**iOS:**
1. Visit site in Safari
2. Tap share → "Add to Home Screen"
3. Check fullscreen mode

## PWA Best Practices

### Do's

- Provide `theme-color` meta tag
- Include all icon sizes
- Implement offline page
- Cache critical assets
- Use service worker for background sync
- Test on real devices

### Don'ts

- Don't cache user-specific data
- Don't make service worker too large
- Don't block install prompt immediately
- Don't forget iOS splash screens

### Performance

```typescript
// Preload critical resources
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>

// Prefetch likely next pages
<link rel="prefetch" href="/gallery">
```

## Background Sync

```typescript
// Register sync when offline
if ('serviceWorker' in navigator && 'SyncManager' in window) {
  navigator.serviceWorker.ready.then(registration => {
    registration.sync.register('sync-guestbook')
  })
}

// Handle in service worker
self.addEventListener('sync', event => {
  if (event.tag === 'sync-guestbook') {
    event.waitUntil(syncGuestbookEntries())
  }
})
```

## Push Notifications (Optional)

```typescript
// Request permission
async function subscribeToPush() {
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })
  
  // Send subscription to server
  await fetch('/api/push-subscription', {
    method: 'POST',
    body: JSON.stringify(subscription),
  })
}
```

## Common Issues

### Manifest not detected
- Check `manifest.webmanifest` is served with correct MIME type
- Verify link tag: `<link rel="manifest" href="/manifest.webmanifest">`

### Service worker not updating
- Use `workbox-window` for updates
- Implement refresh prompt for new versions

### Icons not showing
- Ensure all sizes are provided
- Check paths are absolute (`/icons/...` not `icons/...`)

### iOS splash screen missing
- Add `apple-touch-startup-image` meta tags
- Generate splash screens for each device size
