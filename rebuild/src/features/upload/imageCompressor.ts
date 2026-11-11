/**
 * Client-side image compression — port of `src/utils/imageCompressor.ts`.
 * Resizes to max 1920 px wide and re-encodes as WebP at quality 0.8, falling
 * back to the original file on any failure (unsupported formats, no canvas in
 * jsdom, decode errors). Never throws.
 */

const MAX_IMAGE_WIDTH = 1920
const WEBP_QUALITY = 0.8

export async function compressImage(imageFile: File): Promise<File> {
  if (!imageFile.type.startsWith('image/')) return imageFile
  if (typeof document === 'undefined' || typeof FileReader === 'undefined') return imageFile

  return new Promise(resolve => {
    try {
      const reader = new FileReader()
      reader.readAsDataURL(imageFile)
      reader.onload = event => {
        try {
          const result = event.target?.result
          if (typeof result !== 'string') {
            resolve(imageFile)
            return
          }
          const image = new Image()
          image.src = result
          image.onload = () => {
            try {
              const canvas = document.createElement('canvas')
              let width = image.width
              let height = image.height
              if (width > MAX_IMAGE_WIDTH) {
                height = Math.round((height * MAX_IMAGE_WIDTH) / width)
                width = MAX_IMAGE_WIDTH
              }
              canvas.width = width
              canvas.height = height
              const context = canvas.getContext('2d')
              if (!context) {
                resolve(imageFile)
                return
              }
              context.drawImage(image, 0, 0, width, height)
              canvas.toBlob(
                blob => {
                  if (!blob) {
                    resolve(imageFile)
                    return
                  }
                  const webpName = `${imageFile.name.replace(/\.[^/.]+$/, '')}.webp`
                  resolve(
                    new File([blob], webpName, {
                      type: 'image/webp',
                      lastModified: Date.now(),
                    })
                  )
                },
                'image/webp',
                WEBP_QUALITY
              )
            } catch {
              resolve(imageFile)
            }
          }
          image.onerror = () => resolve(imageFile)
        } catch {
          resolve(imageFile)
        }
      }
      reader.onerror = () => resolve(imageFile)
    } catch {
      resolve(imageFile)
    }
  })
}
