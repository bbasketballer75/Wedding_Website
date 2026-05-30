import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-lg bg-gold-100/50', className)} {...props} />
}

// Photo skeleton for gallery
function PhotoSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      <Skeleton className='h-48 w-full rounded-xl' />
      <div className='flex gap-2'>
        <Skeleton className='h-3 w-20' />
        <Skeleton className='h-3 w-12' />
      </div>
    </div>
  )
}

// Gallery grid skeleton
function GallerySkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'>
      {Array.from({ length: count }).map((_, i) => (
        <PhotoSkeleton key={i} />
      ))}
    </div>
  )
}

// Text skeleton
function TextSkeleton({ lines = 3 }: { lines?: number }) {
  // Use deterministic widths based on index to avoid Math.random in render
  const widths = [85, 72, 90, 65, 78, 88, 70, 82, 95, 68]
  return (
    <div className='space-y-2'>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className='h-4 w-full'
          style={{ width: `${widths[i % widths.length]}%` }}
        />
      ))}
    </div>
  )
}

// Card skeleton
function CardSkeleton() {
  return (
    <div className='rounded-2xl bg-cream-100 p-6 space-y-4'>
      <Skeleton className='h-6 w-3/4' />
      <TextSkeleton lines={3} />
      <Skeleton className='h-10 w-32' />
    </div>
  )
}

function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className='space-y-3'>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className='flex items-center gap-3'>
          <Skeleton className='h-12 w-12 rounded-lg' />
          <div className='flex-1 space-y-2'>
            <Skeleton className='h-4 w-3/4' />
            <Skeleton className='h-3 w-1/2' />
          </div>
        </div>
      ))}
    </div>
  )
}

export { Skeleton, PhotoSkeleton, GallerySkeleton, TextSkeleton, CardSkeleton, ListSkeleton }
