// Service Worker utility for Push Notifications and Status
// Note: Registration is handled by vite-plugin-pwa in main.jsx

export class ServiceWorkerManager {
  constructor() {
    this.isOnline = navigator.onLine
    this.listeners = new Map()

    // Listen for messages from SW
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', event => {
        this.handleMessage(event)
      })
    }
  }

  // Handle messages from service worker
  handleMessage(event) {
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
  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)
  }

  // Remove event listener
  removeListener(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event)
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  // Notify all listeners
  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
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
    this.isOnline = navigator.onLine
    this.notifyListeners('connection-change', { online: this.isOnline })
    return this.isOnline
  }

  // Subscribe to push notifications
  async subscribeToPush() {
    if (!('PushManager' in window)) {
      throw new Error('Push notifications not supported')
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
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
  urlBase64ToUint8Array(base64String) {
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
window.addEventListener('online', () => swManager.checkConnection())
window.addEventListener('offline', () => swManager.checkConnection())

// Export default for convenience
export default swManager
