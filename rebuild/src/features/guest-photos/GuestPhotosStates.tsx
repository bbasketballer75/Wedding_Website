/**
 * Frozen loading / empty / error states (`src/pages/GuestPhotos.tsx:158-189`).
 *
 * The skeleton keeps the oracle's `role='status'` + `aria-label='Loading guest
 * photos'` and its six placeholder cards. The panel state is shared by the error
 * and empty variants (the frozen page passed different title/body strings).
 */
import { Image as ImageIcon } from 'lucide-react'
import { GUEST_PHOTOS_COPY } from './constants'

export function GuestPhotosSkeleton() {
  return (
    <div
      className='grid gap-5 sm:grid-cols-2 lg:grid-cols-3'
      role='status'
      aria-label={GUEST_PHOTOS_COPY.loadingLabel}
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className='theme-panel overflow-hidden rounded-[1.15rem]'>
          <div className='theme-skeleton aspect-[4/3]' />
          <div className='space-y-3 p-5'>
            <div className='theme-skeleton h-7 w-2/3 rounded-full' />
            <div className='theme-skeleton h-4 w-32 rounded-full' />
            <div className='theme-skeleton h-4 w-full rounded-full' />
            <div className='theme-skeleton h-4 w-4/5 rounded-full' />
          </div>
        </div>
      ))}
      <span className='sr-only'>{GUEST_PHOTOS_COPY.loadingSrText}</span>
    </div>
  )
}

export function GuestPhotosPanelState({ title, message }: { title: string; message: string }) {
  return (
    <div className='theme-panel rounded-[1.25rem] px-6 py-16 text-center'>
      <ImageIcon className='mx-auto h-10 w-10 text-[color:var(--ui-accent)]' aria-hidden='true' />
      <h2 className='mt-5 font-display text-2xl font-semibold'>{title}</h2>
      <p className='theme-muted mx-auto mt-3 max-w-md text-sm leading-7'>{message}</p>
    </div>
  )
}

export function GuestPhotosErrorState() {
  return (
    <GuestPhotosPanelState
      title={GUEST_PHOTOS_COPY.errorTitle}
      message={GUEST_PHOTOS_COPY.errorBody}
    />
  )
}

export function GuestPhotosEmptyState() {
  return (
    <GuestPhotosPanelState
      title={GUEST_PHOTOS_COPY.emptyTitle}
      message={GUEST_PHOTOS_COPY.emptyBody}
    />
  )
}
