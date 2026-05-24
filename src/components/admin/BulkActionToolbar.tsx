import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PHOTO_ALBUMS, type PhotoAlbum } from '@/lib/supabase'

interface BulkActionToolbarProps {
  selectedCount: number
  onApproveAll?: () => void
  onRejectAll?: () => void
  onDeselectAll: () => void
  onPublishToGallery?: (album: PhotoAlbum) => Promise<void>
  isLoading?: boolean
}

export function BulkActionToolbar({
  selectedCount,
  onApproveAll,
  onRejectAll,
  onDeselectAll,
  onPublishToGallery,
  isLoading,
}: BulkActionToolbarProps) {
  const [publishAlbum, setPublishAlbum] = useState<PhotoAlbum | ''>('')
  const [publishing, setPublishing] = useState(false)

  if (selectedCount === 0) {
    return null
  }

  const handlePublish = async () => {
    if (!publishAlbum || !onPublishToGallery) return
    setPublishing(true)
    try {
      await onPublishToGallery(publishAlbum)
      setPublishAlbum('')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className='space-y-2'
    >
      <div className='flex items-center justify-between rounded-2xl border border-gold-300/60 bg-gradient-to-r from-cream-100/95 via-gold-50/95 to-cream-100/95 px-4 py-3 shadow-lg backdrop-blur-md'>
        <span className='text-sm font-medium text-charcoal-700'>
          {selectedCount} upload{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <div className='flex items-center gap-2'>
          <Button size='sm' variant='secondary' onClick={onDeselectAll} disabled={isLoading}>
            Deselect all
          </Button>
          {onApproveAll && (
            <Button
              size='sm'
              onClick={onApproveAll}
              disabled={isLoading}
              className='bg-gold-500 hover:bg-gold-600'
            >
              <CheckCircle2 className='mr-1.5 h-4 w-4' />
              Approve all
            </Button>
          )}
          {onRejectAll && (
            <Button
              size='sm'
              onClick={onRejectAll}
              disabled={isLoading}
              variant='danger'
              className='bg-rose-500 hover:bg-rose-600'
            >
              <XCircle className='mr-1.5 h-4 w-4' />
              Reject all
            </Button>
          )}
        </div>
      </div>

      {onPublishToGallery && (
        <div className='flex items-center gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/80 px-4 py-2.5'>
          <Upload className='h-4 w-4 flex-shrink-0 text-emerald-600' />
          <span className='text-xs font-medium text-emerald-800'>Publish to gallery</span>
          <select
            value={publishAlbum}
            onChange={e => setPublishAlbum(e.target.value as PhotoAlbum | '')}
            className='h-8 flex-1 rounded-full border border-emerald-200 bg-white px-3 text-xs text-charcoal-700 outline-none transition-colors hover:border-emerald-300 focus:border-emerald-400'
          >
            <option value=''>Choose album…</option>
            {PHOTO_ALBUMS.map(album => (
              <option key={album} value={album}>
                {album}
              </option>
            ))}
          </select>
          <Button
            size='sm'
            onClick={handlePublish}
            disabled={!publishAlbum || publishing || isLoading}
            className='bg-emerald-600 hover:bg-emerald-700 text-white'
          >
            {publishing ? 'Publishing…' : 'Publish'}
          </Button>
        </div>
      )}
    </motion.div>
  )
}
