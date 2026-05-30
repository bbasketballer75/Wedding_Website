// Service Worker utility for Push Notifications and Status
// Note: Registration is handled by vite-plugin-pwa in main.jsx

export class ServiceWorkerManager {
  public isOnline: boolean
  public listeners: Map<string, Function[]>
  public updateHandler: ((hasUpdate: boolean) => Promise<void>) | null
  private wb: any = null
  private pendingSW: ServiceWorker | null = null

  constructor() {
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    this.listeners = new Map()
    this.updateHandler = null

    // Listen for messages from SW
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
        this.handleMessage(event)
      })
    }

    // Initialize workbox-window for proper SW update handling
    this.initWorkboxWindow()
  }

  // Initialize workbox-window for proper SW update handling
  private async initWorkboxWindow() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    try {
      const { Workbox } = await import('workbox-window')
      this.wb = new Workbox('/sw.js')

      this.wb.addEventListener('waiting', (event: any) => {
        this.pendingSW = event.detail.serviceWorker
        this.notifyListeners('update-available', { hasUpdate: true, pendingSW: this.pendingSW })
      })

      this.wb.addEventListener('controlling', () => {
        window.location.reload()
      })

      this.wb.addEventListener('activated', (event: any) => {
        if (event.detail && !event.detail.isUpdate) {
          // First install, no notification needed
        }
      })

      await this.wb.register()
    } catch {
      // workbox-window not available, fall back to basic SW handling
    }
  }

  // Handle messages from service worker
  handleMessage(event: MessageEvent) {
    if (!event.data) return
    const { type, data } = event.data

    switch (type) {
      case 'CACHE_UPDATED':
        this.notifyListeners('cache-updated', data)
        break
      case 'SYNC_COMPLETE':
        this.notifyListeners('sync-complete', data)
        break
      default:
      // Unknown service worker message
    }
  }

  // Add event listener
  addListener(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)?.push(callback)
  }

  // Remove event listener
  removeListener(event: string, callback: Function) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event)
      if (callbacks) {
        const index = callbacks.indexOf(callback)
        if (index > -1) {
          callbacks.splice(index, 1)
        }
      }
    }
  }

  // Notify all listeners
  notifyListeners(event: string, data?: any) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)?.forEach(callback => {
        try {
          callback(data)
        } catch {
          // Service worker listener error
        }
      })
    }
  }

  // Check for connection status
  checkConnection() {
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    this.notifyListeners('connection-change', { online: this.isOnline })
    return this.isOnline
  }

  setUpdateHandler(handler: (hasUpdate: boolean) => Promise<void>) {
    this.updateHandler = typeof handler === 'function' ? handler : null
  }

  signalUpdateAvailable() {
    this.notifyListeners('update-available', { hasUpdate: true })
  }

  // Replace skipWaiting to use workbox's skipWaiting mechanism
  async skipWaiting() {
    if (this.wb && this.pendingSW) {
      this.wb.messageSkipWaiting()
      this.pendingSW = null
      return
    }
    // Fallback for environments without workbox-window
    if (typeof window !== 'undefined') window.location.reload()
  }

  // Subscribe to push notifications
  async subscribeToPush() {
    if (typeof window === 'undefined' || !('PushManager' in window)) {
      throw new Error('Push notifications not supported')
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          import.meta.env.VITE_VAPID_PUBLIC_KEY as string
        ),
      })

      // Send subscription to server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      })

      return subscription
    } catch (error) {
      console.error('Push subscription failed:', error)
      throw error
    }
  }

  // Convert VAPID key
  urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }
}

// Create singleton instance
export const swManager = new ServiceWorkerManager()

// Connection status monitoring
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => swManager.checkConnection())
  window.addEventListener('offline', () => swManager.checkConnection())
}

// Export default for convenience
export default swManager
