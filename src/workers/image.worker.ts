/**
 * Image Processing Web Worker
 * Handles heavy image operations off the main thread
 */

interface ImageProcessingMessage {
  type: 'resize' | 'compress' | 'convert' | 'analyze' | 'thumbnail'
  imageData?: ImageData
  imageUrl?: string
  options?: {
    width?: number
    height?: number
    quality?: number
    format?: 'webp' | 'jpeg' | 'png'
    maxSize?: number
  }
}

interface ImageProcessingResult {
  type: string
  success: boolean
  data?: ImageData | string | {
    averageBrightness: number
    dominantColors: string[]
    width: number
    height: number
  }
  error?: string
}

// Listen for messages from main thread
self.addEventListener('message', async (event: MessageEvent<ImageProcessingMessage>) => {
  const { type, imageData, imageUrl, options = {} } = event.data

  try {
    let result: ImageProcessingResult
    const source = imageData ?? imageUrl

    switch (type) {
      case 'resize':
        if (!source) throw new Error('Missing input data')
        result = await resizeImage(source, options)
        break
      case 'compress':
        if (!source) throw new Error('Missing input data')
        result = await compressImage(source, options)
        break
      case 'convert':
        if (!source) throw new Error('Missing input data')
        result = await convertImage(source, options)
        break
      case 'thumbnail':
        if (!imageUrl) throw new Error('Missing image URL')
        result = await createThumbnail(imageUrl, options)
        break
      case 'analyze':
        if (!source) throw new Error('Missing input data')
        result = await analyzeImage(source)
        break
      default:
        result = {
          type,
          success: false,
          error: `Unknown operation: ${type}`,
        }
    }

    self.postMessage(result)
  } catch (error) {
    self.postMessage({
      type,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * Resize image
 */
async function resizeImage(
  input: ImageData | string,
  options: { width?: number; height?: number } = {}
): Promise<ImageProcessingResult> {
  const { width = 800, height = 600 } = options

  // Create offscreen canvas
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  
  if (!ctx) {
    throw new Error('Failed to get 2d context')
  }

  if (typeof input === 'string') {
    // Load image from URL
    const response = await fetch(input)
    const blob = await response.blob()
    const bitmap = await createImageBitmap(blob)
    ctx.drawImage(bitmap, 0, 0, width, height)
  } else {
    // Use provided ImageData
    ctx.putImageData(input, 0, 0)
  }

  const resizedData = ctx.getImageData(0, 0, width, height)

  return {
    type: 'resize',
    success: true,
    data: resizedData,
  }
}

/**
 * Compress image
 */
async function compressImage(
  input: ImageData | string,
  options: { quality?: number; format?: 'webp' | 'jpeg' | 'png' } = {}
): Promise<ImageProcessingResult> {
  const { quality = 0.8, format = 'webp' } = options

  const canvas = new OffscreenCanvas(
    typeof input === 'string' ? 800 : input.width,
    typeof input === 'string' ? 600 : input.height
  )
  const ctx = canvas.getContext('2d')
  
  if (!ctx) {
    throw new Error('Failed to get 2d context')
  }

  if (typeof input === 'string') {
    const response = await fetch(input)
    const blob = await response.blob()
    const bitmap = await createImageBitmap(blob)
    ctx.drawImage(bitmap, 0, 0)
  } else {
    ctx.putImageData(input, 0, 0)
  }

  const blob = await canvas.convertToBlob({
    type: `image/${format}`,
    quality,
  })

  // Convert blob to base64
  const reader = new FileReader()
  const base64 = await new Promise<string>(resolve => {
    reader.onloadend = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })

  return {
    type: 'compress',
    success: true,
    data: base64,
  }
}

/**
 * Convert image format
 */
async function convertImage(
  input: ImageData | string,
  options: { format?: 'webp' | 'jpeg' | 'png' } = {}
): Promise<ImageProcessingResult> {
  const { format = 'webp' } = options

  const canvas = new OffscreenCanvas(
    typeof input === 'string' ? 800 : input.width,
    typeof input === 'string' ? 600 : input.height
  )
  const ctx = canvas.getContext('2d')
  
  if (!ctx) {
    throw new Error('Failed to get 2d context')
  }

  if (typeof input === 'string') {
    const response = await fetch(input)
    const blob = await response.blob()
    const bitmap = await createImageBitmap(blob)
    ctx.drawImage(bitmap, 0, 0)
  } else {
    ctx.putImageData(input, 0, 0)
  }

  const blob = await canvas.convertToBlob({ type: `image/${format}` })
  const reader = new FileReader()
  const base64 = await new Promise<string>(resolve => {
    reader.onloadend = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })

  return {
    type: 'convert',
    success: true,
    data: base64,
  }
}

/**
 * Create thumbnail
 */
async function createThumbnail(
  imageUrl: string,
  options: { width?: number; height?: number } = {}
): Promise<ImageProcessingResult> {
  const { width = 200, height = 200 } = options

  const response = await fetch(imageUrl)
  const blob = await response.blob()
  const bitmap = await createImageBitmap(blob)

  // Calculate aspect ratio
  const aspectRatio = bitmap.width / bitmap.height
  let thumbnailWidth = width
  let thumbnailHeight = height

  if (aspectRatio > 1) {
    thumbnailHeight = width / aspectRatio
  } else {
    thumbnailWidth = height * aspectRatio
  }

  const canvas = new OffscreenCanvas(thumbnailWidth, thumbnailHeight)
  const ctx = canvas.getContext('2d')
  
  if (!ctx) {
    throw new Error('Failed to get 2d context')
  }
  
  ctx.drawImage(bitmap, 0, 0, thumbnailWidth, thumbnailHeight)

  const thumbnailBlob = await canvas.convertToBlob({
    type: 'image/webp',
    quality: 0.7,
  })

  const reader = new FileReader()
  const base64 = await new Promise<string>(resolve => {
    reader.onloadend = () => resolve(reader.result as string)
    reader.readAsDataURL(thumbnailBlob)
  })

  return {
    type: 'thumbnail',
    success: true,
    data: base64,
  }
}

/**
 * Analyze image (brightness, dominant colors, etc.)
 */
async function analyzeImage(input: ImageData | string): Promise<ImageProcessingResult> {
  const canvas = new OffscreenCanvas(
    typeof input === 'string' ? 800 : input.width,
    typeof input === 'string' ? 600 : input.height
  )
  const ctx = canvas.getContext('2d')
  
  if (!ctx) {
    throw new Error('Failed to get 2d context')
  }

  if (typeof input === 'string') {
    const response = await fetch(input)
    const blob = await response.blob()
    const bitmap = await createImageBitmap(blob)
    ctx.drawImage(bitmap, 0, 0)
  } else {
    ctx.putImageData(input, 0, 0)
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = imageData.data

  let totalBrightness = 0
  const colorMap = new Map<string, number>()

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]

    // Calculate brightness
    const brightness = (r + g + b) / 3
    totalBrightness += brightness

    // Track colors (rounded to nearest 32 for grouping)
    const colorKey = `${Math.round(r / 32) * 32},${Math.round(g / 32) * 32},${Math.round(b / 32) * 32}`
    colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1)
  }

  const avgBrightness = totalBrightness / (pixels.length / 4)

  // Get dominant colors
  const dominantColors = Array.from(colorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([color]) => `rgb(${color})`)

  return {
    type: 'analyze',
    success: true,
    data: {
      averageBrightness: avgBrightness,
      dominantColors,
      width: canvas.width,
      height: canvas.height,
    },
  }
}

export {
  resizeImage,
  compressImage,
  convertImage,
  createThumbnail,
  analyzeImage
}
