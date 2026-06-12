const MAX_IMAGE_WIDTH = 1920 // Maximum desired width in pixels
const WEBP_QUALITY = 0.8 // WebP compression quality

/**
 * Compresses and resizes an image file, converting it to WebP.
 * Falls back to the original file if compression fails or format is unsupported.
 * @param {File} imageFile - The image file to compress.
 * @returns {Promise<File>} A promise that resolves with the compressed image file or original file.
 */
export const compressImage = async (imageFile: File): Promise<File> => {
  // If the file is not an image, return it immediately
  if (!imageFile.type.startsWith('image/')) {
    return imageFile
  }

  return new Promise(resolve => {
    const reader = new FileReader()
    reader.readAsDataURL(imageFile)
    reader.onload = event => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height

          // Calculate new dimensions to fit within MAX_IMAGE_WIDTH
          if (width > MAX_IMAGE_WIDTH) {
            height = Math.round((height * MAX_IMAGE_WIDTH) / width)
            width = MAX_IMAGE_WIDTH
          }

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            console.warn('Could not get canvas context, falling back to original file.')
            return resolve(imageFile)
          }
          ctx.drawImage(img, 0, 0, width, height)

          // Try to get Blob with desired quality and WebP type
          canvas.toBlob(
            blob => {
              if (!blob) {
                console.warn('Canvas toBlob failed, falling back to original file.')
                return resolve(imageFile)
              }

              // Create new webp filename
              const originalName = imageFile.name
              const webpName = `${originalName.replace(/\.[^/.]+$/, '')}.webp`

              const newFile = new File([blob], webpName, {
                type: 'image/webp',
                lastModified: Date.now(),
              })
              resolve(newFile)
            },
            'image/webp',
            WEBP_QUALITY
          )
        } catch (e) {
          console.warn('Error during image compression, falling back to original file:', e)
          resolve(imageFile)
        }
      }
      img.onerror = () => {
        console.warn('Image load error, falling back to original file.')
        resolve(imageFile)
      }
    }
    reader.onerror = () => {
      console.warn('FileReader error, falling back to original file.')
      resolve(imageFile)
    }
  })
}
