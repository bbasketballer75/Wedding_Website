/**
 * Safe storage utilities that handle localStorage errors
 * and provide fallbacks for private browsing mode
 */
import logger from './logger'

const isStorageAvailable = (type = 'localStorage') => {
  try {
    const storage = window[type]
    const test = '__storage_test__'
    storage.setItem(test, test)
    storage.removeItem(test)
    return true
  } catch {
    return false
  }
}

const storage = {
  // Check if localStorage is available
  isAvailable: isStorageAvailable(),

  // Get item from localStorage with fallback
  getItem(key, defaultValue = null) {
    try {
      if (!this.isAvailable) return defaultValue
      const item = window.localStorage.getItem(key)
      return item !== null ? item : defaultValue
    } catch (err) {
      logger.warn('localStorage getItem error:', err)
      return defaultValue
    }
  },

  // Set item in localStorage with fallback
  setItem(key, value) {
    try {
      if (!this.isAvailable) return false
      window.localStorage.setItem(key, value)
      return true
    } catch (err) {
      logger.warn('localStorage setItem error:', err)
      return false
    }
  },

  // Remove item from localStorage
  removeItem(key) {
    try {
      if (!this.isAvailable) return false
      window.localStorage.removeItem(key)
      return true
    } catch (err) {
      logger.warn('localStorage removeItem error:', err)
      return false
    }
  },

  // Clear all localStorage
  clear() {
    try {
      if (!this.isAvailable) return false
      window.localStorage.clear()
      return true
    } catch (err) {
      logger.warn('localStorage clear error:', err)
      return false
    }
  },

  // Get JSON object with fallback
  getJSON(key, defaultValue = null) {
    try {
      const item = this.getItem(key)
      if (item === null) return defaultValue
      return JSON.parse(item)
    } catch (err) {
      logger.warn('localStorage getJSON error:', err)
      return defaultValue
    }
  },

  // Set JSON object with fallback
  setJSON(key, value) {
    try {
      return this.setItem(key, JSON.stringify(value))
    } catch (err) {
      logger.warn('localStorage setJSON error:', err)
      return false
    }
  },
}

export default storage
