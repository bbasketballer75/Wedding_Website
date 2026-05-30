import { useEffect, useRef, useState } from 'react'
import type { WorkerPool } from '../utils/workerPool'
import {
  createImageWorkerPool,
  createSearchWorkerPool,
  createSyncWorker,
} from '../utils/workerPool'

/**
 * Hook to manage web workers
 */
export function useWorkers() {
  const imagePoolRef = useRef<WorkerPool | null>(null)
  const searchPoolRef = useRef<WorkerPool | null>(null)
  const syncWorkerRef = useRef<Worker | null>(null)

  useEffect(() => {
    // Initialize worker pools on mount
    imagePoolRef.current = createImageWorkerPool(2)
    searchPoolRef.current = createSearchWorkerPool(1)
    syncWorkerRef.current = createSyncWorker()

    // Worker pools initialized

    // Cleanup on unmount
    return () => {
      imagePoolRef.current?.terminate()
      searchPoolRef.current?.terminate()
      syncWorkerRef.current?.terminate()
    }
  }, [])

  const processImage = async (type: string, data: any) => {
    if (!imagePoolRef.current) throw new Error('Image worker pool not initialized')
    return imagePoolRef.current.execute(type, data)
  }

  const searchIndex = async (type: string, data: any) => {
    if (!searchPoolRef.current) throw new Error('Search worker pool not initialized')
    return searchPoolRef.current.execute(type, data)
  }

  const queueSync = (data: any) => {
    if (!syncWorkerRef.current) throw new Error('Sync worker not initialized')
    syncWorkerRef.current.postMessage({ type: 'queue', item: data })
  }

  return {
    processImage,
    searchIndex,
    queueSync,
  }
}

/**
 * Hook for image processing with worker
 */
export function useImageProcessor() {
  const { processImage } = useWorkers()
  const [isProcessing, setIsProcessing] = useState(false)

  const resize = async (imageUrl: string, width: number, height: number) => {
    setIsProcessing(true)
    try {
      const result = await processImage('resize', { imageUrl, options: { width, height } })
      return result
    } finally {
      setIsProcessing(false)
    }
  }

  const compress = async (imageUrl: string, quality: number = 0.8) => {
    setIsProcessing(true)
    try {
      const result = await processImage('compress', { imageUrl, options: { quality } })
      return result
    } finally {
      setIsProcessing(false)
    }
  }

  const createThumbnail = async (imageUrl: string, size: number = 200) => {
    setIsProcessing(true)
    try {
      const result = await processImage('thumbnail', {
        imageUrl,
        options: { width: size, height: size },
      })
      return result
    } finally {
      setIsProcessing(false)
    }
  }

  return {
    resize,
    compress,
    createThumbnail,
    isProcessing,
  }
}

export default useWorkers
