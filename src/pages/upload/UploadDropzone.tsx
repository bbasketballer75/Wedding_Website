import { motion } from 'framer-motion'
import { Image as ImageIcon, Upload, Video } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UploadDropzoneProps {
  isDragging: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function UploadDropzone({
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
}: UploadDropzoneProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-testid='upload-dropzone'
      className={cn(
        'relative overflow-hidden rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all sm:px-8 sm:py-10',
        isDragging
          ? 'border-gold-400 bg-gold-500/8 shadow-[0_0_60px_-20px_rgba(198,156,78,0.3)]'
          : 'border-gold-200/20 bg-white/4 hover:border-gold-400/40 hover:bg-white/6'
      )}
    >
      <input
        type='file'
        multiple
        accept='image/*,video/*'
        onChange={onFileSelect}
        aria-label='Select photos or videos to upload'
        className='absolute inset-0 h-full w-full cursor-pointer opacity-0'
      />

      <motion.div
        animate={isDragging ? { y: [0, -10, 0] } : { y: 0 }}
        transition={
          isDragging ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }
        }
        className='mx-auto flex h-18 w-18 items-center justify-center rounded-full border border-gold-400/20 bg-gold-500/10 sm:h-20 sm:w-20'
      >
        <Upload className='h-9 w-9 text-gold-400 sm:h-10 sm:w-10' />
      </motion.div>

      <h2 className='mt-6 text-4xl text-white sm:text-5xl'>
        {isDragging ? 'Drop them right here.' : 'Drop photos or videos to begin.'}
      </h2>

      <p className='mx-auto mt-4 max-w-2xl text-base text-white/55 sm:text-lg'>
        Click anywhere or drag your files in
      </p>

      <div className='mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-white/50'>
        <span className='rounded-full border border-white/12 bg-white/6 px-4 py-2'>
          <span className='inline-flex items-center gap-2'>
            <ImageIcon className='h-4 w-4 text-gold-400' />
            JPG, PNG, HEIC
          </span>
        </span>
        <span className='rounded-full border border-white/12 bg-white/6 px-4 py-2'>
          <span className='inline-flex items-center gap-2'>
            <Video className='h-4 w-4 text-gold-400' />
            MP4, MOV
          </span>
        </span>
        <span className='rounded-full border border-white/12 bg-white/6 px-4 py-2'>
          Up to 50 files, 500MB each
        </span>
      </div>
    </motion.section>
  )
}
