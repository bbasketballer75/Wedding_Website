/**
 * User Preferences Hook
 * Manages user settings and preferences
 */

import { useEffect, useState } from 'react'

export interface UserPreferences {
  // Display preferences
  theme: 'light' | 'dark' | 'auto'
  reducedMotion: boolean
  highContrast: boolean

  // Gallery preferences
  galleryView: 'grid' | 'masonry' | 'carousel'
  photosPerPage: number
  autoPlaySlideshow: boolean

  // Notification preferences
  showNotifications: boolean
  notificationSound: boolean

  // Privacy preferences
  analyticsEnabled: boolean
  saveHistory: boolean
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'light',
  reducedMotion: false,
  highContrast: false,
  galleryView: 'grid',
  photosPerPage: 12,
  autoPlaySlideshow: false,
  showNotifications: true,
  notificationSound: false,
  analyticsEnabled: true,
  saveHistory: true,
}

export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadPreferences()
  }, [])

  const loadPreferences = () => {
    try {
      const stored = localStorage.getItem('user_preferences')
      if (stored) {
        const parsed = JSON.parse(stored)
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsed })
      }
    } catch (error) {
      console.error('Load preferences error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const savePreferences = (newPreferences: Partial<UserPreferences>) => {
    const updated = { ...preferences, ...newPreferences }
    setPreferences(updated)
    localStorage.setItem('user_preferences', JSON.stringify(updated))
  }

  const resetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES)
    localStorage.removeItem('user_preferences')
  }

  return {
    preferences,
    isLoading,
    updatePreferences: savePreferences,
    resetPreferences,
  }
}

export default usePreferences
