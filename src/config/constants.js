/**
 * Centralized configuration and constants for the wedding website
 */

// Animation durations (in milliseconds)
export const ANIMATION_DURATIONS = {
  fast: 200,
  normal: 300,
  slow: 500,
  pageTransition: 1000,
  scrollDuration: 1400,
}

// Timing thresholds
export const TIMING = {
  castTipDelay: 5000, // 5 seconds
  debounceDelay: 300,
  throttleDelay: 100,
  mapRecenterDelay: 1000,
}

// Breakpoints for responsive design
export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1280,
  wide: 1536,
}

// Map configuration
export const MAP_CONFIG = {
  defaultCenter: [39.8283, -98.5795], // Center of USA
  defaultZoom: 4,
  padding: [50, 50],
  rootMargin: '50px',
}

// Gallery configuration
export const GALLERY_CONFIG = {
  imagesPerRow: {
    mobile: 2,
    tablet: 3,
    desktop: 4,
  },
  lazyLoadThreshold: 0.1,
  lightboxMaxWidth: '80vh',
}

// Video configuration
export const VIDEO_CONFIG = {
  castTipStorageKey: 'hasSeenCastTip',
  guestPinStorageKey: 'my_guest_pin_id',
}

// Validation rules
export const VALIDATION = {
  guestBook: {
    nameMinLength: 2,
    nameMaxLength: 50,
    messageMinLength: 10,
    messageMaxLength: 500,
  },
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
}

// API endpoints
export const API = {
  supabase: {
    tables: {
      guestBook: 'guest_book',
      guestPins: 'guest_pins',
      memories: 'memories',
    },
  },
}

// Error messages
export const ERROR_MESSAGES = {
  generic: 'Something went wrong. Please try again.',
  network: 'Network error. Please check your connection.',
  storage: 'Unable to save data. Please check your browser settings.',
  map: 'Failed to load map. Please refresh the page.',
  video: 'Video failed to load. Please try again.',
}

// Success messages
export const SUCCESS_MESSAGES = {
  guestBook: 'Thank you for your message!',
  pinAdded: 'Your pin has been added to the map!',
  pinRemoved: 'Your pin has been removed.',
}

// Theme colors (for dynamic theming if needed)
export const THEME = {
  primary: {
    50: '#fdf2f8',
    500: '#ec4899',
    600: '#db2777',
    700: '#be185d',
  },
  secondary: {
    50: '#faf5ff',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7c3aed',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    500: '#6b7280',
    700: '#374151',
    900: '#111827',
  },
}

// Feature flags
export const FEATURES = {
  debugMode: import.meta.env.DEV,
  analytics: import.meta.env.PROD,
  errorTracking: import.meta.env.PROD,
}
