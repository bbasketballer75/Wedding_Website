/**
 * GallerySelectionActionsBar — sticky action bar that appears below the
 * control panel when the user has photos selected.
 *
 * Extracted from src/pages/Gallery.tsx on 2026-09-14 as part of the
 * Gallery.tsx 1356 -> <500 line reduction.
 *
 * Pure presentation + click handlers. The parent decides *when* to render
 * this bar (it gates on `selectMode && selectedCount > 0`), so the
 * component itself never returns null.
 */
import { motion } from 'framer-motion'
import { Download, Loader2, Share2 } from 'lucide-react'

export interface GallerySelectionActionsBarProps {
  selectedCount: number
  isDownloadingPack: boolean
  onShare: () => void
  onDownload: () => void | Promise<void>
}

export function GallerySelectionActionsBar({
  selectedCount,
  isDownloadingPack,
  onShare,
  onDownload,
}: GallerySelectionActionsBarProps) {
  return (
    <div className='sticky top-20 z-40 px-4 pb-2'>
      <div className='mx-auto max-w-7xl'>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className='flex items-center justify-between rounded-2xl border border-gold-300/60 bg-gradient-to-r from-cream-100/95 via-gold-50/95 to-cream-100/95 px-4 py-3 shadow-lg backdrop-blur-md'
        >
          <span className='text-sm font-medium text-charcoal-700'>
            {selectedCount} photo{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={onShare}
              className='inline-flex items-center gap-1.5 rounded-full border border-gold-200/80 bg-white/80 px-4 py-2 text-sm text-charcoal-600 transition-colors hover:text-charcoal-800'
            >
              <Share2 className='h-3.5 w-3.5' />
              Copy link
            </button>
            <button
              type='button'
              onClick={() => void onDownload()}
              disabled={isDownloadingPack}
              className='inline-flex items-center gap-1.5 rounded-full bg-gold-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gold-600 disabled:opacity-60'
            >
              {isDownloadingPack ? (
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
              ) : (
                <Download className='h-3.5 w-3.5' />
              )}
              Download zip
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
