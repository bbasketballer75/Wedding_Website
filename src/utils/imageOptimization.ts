// Image optimization utilities

// Check WebP support
export const checkWebPSupport = () => {
  return new Promise(resolve => {
    const webP = new Image()
    webP.onload = webP.onerror = () => {
      resolve(webP.height === 2)
    }
    webP.src =
      'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA'
  })
}

// Generate responsive image URLs
export const generateImageSrcSet = (
  baseUrl: string,
  sizes: number[] = [640, 768, 1024, 1280, 1536],
  quality: number = 75
) => {
  return sizes.map(size => `${baseUrl}?w=${size}&q=${quality} ${size}w`).join(', ')
}

// Generate WebP and fallback sources
export const generatePictureSources = (
  baseUrl: string,
  sizes: number[] = [640, 768, 1024, 1280],
  quality: number = 75
) => {
  const sources: Array<{ srcSet: string; type: string; media: string }> = []

  sizes.forEach(size => {
    // WebP source
    sources.push({
      srcSet: `${baseUrl.replace(/\.(jpg|jpeg|png)$/i, '.webp')}?w=${size}&q=${quality}`,
      type: 'image/webp',
      media: `(min-width: ${size}px)`,
    })

    // Original format fallback
    const extension = baseUrl.match(/\.(jpg|jpeg|png)$/i)?.[1] || 'jpg'
    sources.push({
      srcSet: `${baseUrl}?w=${size}&q=${quality}`,
      type: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
      media: `(min-width: ${size}px)`,
    })
  })

  return sources
}

// Calculate optimal image size based on container
export const calculateOptimalSize = (
  containerWidth: number,
  containerHeight: number,
  aspectRatio?: number
) => {
  const devicePixelRatio = window.devicePixelRatio || 1
  const maxWidth = containerWidth * devicePixelRatio
  const maxHeight = containerHeight * devicePixelRatio

  if (aspectRatio) {
    if (maxWidth / aspectRatio <= maxHeight) {
      return Math.ceil(maxWidth)
    } else {
      return Math.ceil(maxHeight * aspectRatio)
    }
  }

  return Math.ceil(maxWidth)
}

// Generate blur placeholder data URL
export const generateBlurPlaceholder = (width = 10, height = 10) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  // Create gradient placeholder
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#e5e7eb')
  gradient.addColorStop(1, '#f3f4f6')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  return canvas.toDataURL()
}

// Preload critical images
export const preloadImage = (src: string, priority: string = 'high') => {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = src
    link.onload = resolve
    link.onerror = reject

    if (priority) {
      link.setAttribute('importance', priority)
    }

    document.head.appendChild(link)
  })
}

// Lazy load images with Intersection Observer
export const lazyLoadImages = (
  selector = '[data-lazy]',
  options: IntersectionObserverInit = {}
) => {
  const defaultOptions = {
    root: null,
    rootMargin: '50px',
    threshold: 0.1,
    ...options,
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement
        const src = img.dataset.lazy

        if (src) {
          img.src = src
          img.classList.remove('lazy')
          img.removeAttribute('data-lazy')
          observer.unobserve(img)
        }
      }
    })
  }, defaultOptions)

  document.querySelectorAll(selector).forEach(img => {
    observer.observe(img)
  })

  return observer
}

// Image compression utility (using canvas)
export const compressImage = (file: File, quality = 0.7, maxWidth = 1920, maxHeight = 1080) => {
  return new Promise<Blob | null>(resolve => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img

      if (width > maxWidth) {
        height = (maxWidth / width) * height
        width = maxWidth
      }

      if (height > maxHeight) {
        width = (maxHeight / height) * width
        height = maxHeight
      }

      canvas.width = width
      canvas.height = height

      // Draw and compress
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height)
      }

      canvas.toBlob(resolve, 'image/jpeg', quality)
    }

    img.src = URL.createObjectURL(file)
  })
}

// Format bytes to human readable size
export const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

// Get image dimensions from file
export const getImageDimensions = (file: File) => {
  return new Promise<{ width: number; height: number }>(resolve => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.width, height: img.height })
    }
    img.src = URL.createObjectURL(file)
  })
}

export interface ImageOptions {
  width?: number
  height?: number
  quality?: number
  format?: string
  crop?: string
  gravity?: string
}

// Create image CDN URL with transformations
export const createImageURL = (baseUrl: string, options: ImageOptions = {}) => {
  const {
    width,
    height,
    quality = 75,
    format = 'auto',
    crop = 'smart',
    gravity = 'center',
  } = options

  const params = new URLSearchParams()

  if (width) params.append('w', width.toString())
  if (height) params.append('h', height.toString())
  if (quality !== 75) params.append('q', quality.toString())
  if (format !== 'auto') params.append('f', format)
  if (crop !== 'smart') params.append('c', crop)
  if (gravity !== 'center') params.append('g', gravity)

  const queryString = params.toString()
  return queryString ? `${baseUrl}?${queryString}` : baseUrl
}

// Image optimization configuration
export const IMAGE_CONFIG = {
  // Default quality for different image types
  quality: {
    thumbnail: 60,
    banner: 75,
    gallery: 80,
    hero: 85,
  },

  // Default sizes
  sizes: {
    thumbnail: { width: 150, height: 150 },
    card: { width: 300, height: 200 },
    banner: { width: 1200, height: 400 },
    gallery: { width: 800, height: 600 },
    hero: { width: 1920, height: 1080 },
  },

  // Supported formats
  formats: ['webp', 'jpg', 'png'],

  // Lazy loading options
  lazy: {
    threshold: 0.1,
    rootMargin: '50px',
  },
}
