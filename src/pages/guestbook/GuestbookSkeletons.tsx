export function GuestbookSkeletons() {
  return (
    <div className='grid gap-5 xl:grid-cols-2'>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className='relative overflow-hidden rounded-2xl border border-white/8 bg-white/5 px-5 py-5 sm:px-6 sm:py-6'
          style={{ animationDelay: `${i * 0.06}s` }}
          aria-hidden='true'
        >
          {/* Avatar + name row */}
          <div className='flex items-center gap-3'>
            <div className='skeleton-dark h-11 w-11 shrink-0 rounded-full' />
            <div className='flex-1 space-y-2'>
              <div
                className='skeleton-dark h-4 w-2/5 rounded-full'
                style={{ animationDelay: `${i * 0.06 + 0.05}s` }}
              />
              <div
                className='skeleton-dark h-3 w-1/4 rounded-full'
                style={{ animationDelay: `${i * 0.06 + 0.1}s` }}
              />
            </div>
          </div>
          {/* Message body */}
          <div className='mt-5 space-y-2 rounded-xl bg-white/4 px-4 py-4'>
            <div
              className='skeleton-dark h-3 w-full rounded-full'
              style={{ animationDelay: `${i * 0.06 + 0.12}s` }}
            />
            <div
              className='skeleton-dark h-3 w-full rounded-full'
              style={{ animationDelay: `${i * 0.06 + 0.16}s` }}
            />
            <div
              className='skeleton-dark h-3 w-3/5 rounded-full'
              style={{ animationDelay: `${i * 0.06 + 0.2}s` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
