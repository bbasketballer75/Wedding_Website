/**
 * Temporary page body for routes whose features land in later waves. Keeping
 * the route tree complete now means the shell, chrome rules, and parity harness
 * can be exercised against real URLs from day one.
 */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className='mx-auto max-w-3xl px-6 py-24'>
      <h1 className='font-display text-4xl'>{title}</h1>
      <p className='mt-4 opacity-70'>
        Wave 1 placeholder — this feature is ported in a later wave.
      </p>
    </div>
  )
}
