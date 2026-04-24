import { useState, useEffect } from 'react'
import { decode } from 'blurhash'

/**
 * Decodes a blur hash string to a data URL for use as a CSS background-image.
 * Used for LQIP (Low-Quality Image Placeholders) with progressive image loading.
 *
 * @param hash - The blur hash string to decode, or null/undefined to skip
 * @param width - Output canvas width (default 32)
 * @param height - Output canvas height (default 32)
 * @returns A base64 data URL, or null if decoding fails or hash is empty
 */
export function useBlurHash(
  hash: string | null | undefined,
  width = 32,
  height = 32
): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!hash) {
      setDataUrl(null)
      return
    }

    try {
      const pixels = decode(hash, width, height)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setDataUrl(null)
        return
      }

      const imageData = ctx.createImageData(width, height)
      imageData.data.set(pixels)
      ctx.putImageData(imageData, 0, 0)

      setDataUrl(canvas.toDataURL())
    } catch {
      setDataUrl(null)
    }
  }, [hash, width, height])

  return dataUrl
}
