const MAX_IMAGE_SIZE_MB = 2 // Maximum desired file size in MB
const MAX_IMAGE_WIDTH = 1920 // Maximum desired width in pixels
const JPEG_QUALITY = 0.7 // JPEG compression quality

/**
 * Compresses and resizes an image file.
 * @param {File} imageFile - The image file to compress.
 * @returns {Promise<File>} A promise that resolves with the compressed image file.
 */
export const compressImage = async (imageFile: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(imageFile)
    reader.onload = event => {
      const img = new Image()
      img.src = event.target?.result as string
      img.onload = () => {
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
          return reject(new Error('Could not get canvas context'))
        }
        ctx.drawImage(img, 0, 0, width, height)

        // Try to get Blob with desired quality and type
        canvas.toBlob(
          blob => {
            if (!blob) {
              return reject(new Error('Canvas toBlob failed'))
            }
            // Check if compressed size is still too large
            if (blob.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
              // If still too large, further reduce quality (or scale down more if needed)
              // For simplicity, we'll return the current blob, but a more advanced
              // implementation would iteratively reduce quality/size.
              console.warn('Image still too large after initial compression. Returning as is.')
            }

            const newFile = new File([blob], imageFile.name, {
              type: blob.type,
              lastModified: Date.now(),
            })
            resolve(newFile)
          },
          'image/jpeg',
          JPEG_QUALITY
        )
      }
      img.onerror = error => reject(error)
    }
    reader.onerror = error => reject(error)
  })
}

// Optional: Add a helper to convert Blob back to File if needed, though toBlob directly creates it
// export const blobToFile = (theBlob: Blob, fileName: string): File => {
//   const b: any = theBlob;
//   b.lastModifiedDate = new Date();
//   b.name = fileName;
//   return theBlob as File;
// };
