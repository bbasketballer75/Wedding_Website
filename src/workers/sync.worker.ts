/**
 * Background Sync Web Worker
 * Handles offline data synchronization
 */

interface SyncItem {
  id: string
  type: 'guestbook' | 'memory' | 'photo' | 'like'
  data: unknown
  timestamp: number
  retries: number
}

interface SyncMessage {
  type: 'queue' | 'sync' | 'clear' | 'getQueue'
  item?: Omit<SyncItem, 'id' | 'timestamp' | 'retries'>
}

// Sync queue stored in IndexedDB
const DB_NAME = 'wedding-sync'
const STORE_NAME = 'sync-queue'
const MAX_RETRIES = 3

let db: IDBDatabase | null = null

// Initialize IndexedDB
async function initDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve()
    }

    request.onupgradeneeded = event => {
      const database = (event.target as IDBOpenDBRequest).result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

// Initialize on worker start
initDB().catch(console.error)

// Listen for messages
self.addEventListener('message', async (event: MessageEvent<SyncMessage>) => {
  const { type, item } = event.data

  try {
    let result: unknown

    switch (type) {
      case 'queue':
        if (item) {
          result = await queueItem(item)
        }
        break
      case 'sync':
        result = await syncQueue()
        break
      case 'clear':
        result = await clearQueue()
        break
      case 'getQueue':
        result = await getQueue()
        break
      default:
        result = { success: false, error: `Unknown operation: ${type}` }
    }

    self.postMessage({ type, success: true, data: result })
  } catch (error) {
    self.postMessage({
      type,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * Queue an item for sync
 */
async function queueItem(
  item: Omit<SyncItem, 'id' | 'timestamp' | 'retries'>
): Promise<{ queued: boolean; id: string }> {
  if (!db) await initDB()
  if (!db) throw new Error('Database not initialized')

  const syncItem: SyncItem = {
    id: `${item.type}-${Date.now()}-${Math.random()}`,
    type: item.type,
    data: item.data,
    timestamp: Date.now(),
    retries: 0,
  }

  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database not initialized'))

    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.add(syncItem)

    request.onsuccess = () => {
      resolve({ queued: true, id: syncItem.id })
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Sync all queued items
 */
async function syncQueue(): Promise<{ synced: number; failed: number }> {
  if (!db) await initDB()
  if (!db) throw new Error('Database not initialized')

  const items = await getAllItems()
  let synced = 0
  let failed = 0

  for (const item of items) {
    try {
      await syncItem(item)
      await removeItem(item.id)
      synced++
    } catch {
      // Sync error for item tracked

      // Increment retry count
      item.retries++

      if (item.retries >= MAX_RETRIES) {
        // Remove after max retries
        await removeItem(item.id)
        failed++
      } else {
        // Update retry count
        await updateItem(item)
      }
    }
  }

  return { synced, failed }
}

/**
 * Sync a single item
 */
async function syncItem(item: SyncItem): Promise<void> {
  void item

  // This would make actual API calls to sync data
  // For now, simulate with a delay
  await new Promise(resolve => setTimeout(resolve, 100))

  // In a real implementation:
  // - POST to appropriate endpoint based on item.type
  // - Handle authentication
  // - Handle errors and retries

  // Syncing item
}

/**
 * Get all items from queue
 */
async function getAllItems(): Promise<SyncItem[]> {
  if (!db) await initDB()
  if (!db) throw new Error('Database not initialized')

  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database not initialized'))

    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Update an item
 */
async function updateItem(item: SyncItem): Promise<void> {
  if (!db) await initDB()
  if (!db) throw new Error('Database not initialized')

  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database not initialized'))

    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(item)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Remove an item from queue
 */
async function removeItem(id: string): Promise<void> {
  if (!db) await initDB()
  if (!db) throw new Error('Database not initialized')

  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database not initialized'))

    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get current queue status
 */
async function getQueue(): Promise<{ items: SyncItem[]; count: number }> {
  const items = await getAllItems()
  return { items, count: items.length }
}

/**
 * Clear all items from queue
 */
async function clearQueue(): Promise<{ cleared: boolean }> {
  if (!db) await initDB()
  if (!db) throw new Error('Database not initialized')

  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('Database not initialized'))

    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.clear()

    request.onsuccess = () => resolve({ cleared: true })
    request.onerror = () => reject(request.error)
  })
}

// Auto-sync on network reconnection
self.addEventListener('online', () => {
  void syncQueue()
})

// Periodic sync every 5 minutes
setInterval(
  () => {
    if (navigator.onLine) {
      syncQueue()
    }
  },
  5 * 60 * 1000
)

export { queueItem, syncQueue, getQueue, clearQueue, getAllItems, initDB }
