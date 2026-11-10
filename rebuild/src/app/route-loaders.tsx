/**
 * Preload-aware route components.
 *
 * `React.lazy` always suspends on its first render, even when the module is
 * already cached, so the shell paints the fallback for one frame and a tall
 * route then pushes the footer down (measured CLS 0.64–1.03). These components
 * throw their import promise only when the module is NOT loaded yet; the entry
 * module awaits `preloadInitialRoute()` before the first render, so the initial
 * route paints at its real height while every other route still loads lazily.
 */
import type { ComponentType } from 'react'

type RouteModule = Record<string, unknown>

export interface RouteComponent {
  /** Suspense-compatible component: throws the import promise until loaded. */
  component: ComponentType<Record<string, never>>
  /** Resolve the module (idempotent). */
  ensure: () => Promise<void>
}

function defineRoute<M extends RouteModule>(
  load: () => Promise<M>,
  exportName: string
): RouteComponent {
  let resolved: ComponentType<Record<string, never>> | null = null
  let pending: Promise<void> | null = null

  const ensure = (): Promise<void> => {
    if (!pending) {
      pending = load().then(module => {
        const candidate = module[exportName]
        if (typeof candidate !== 'function') {
          throw new Error(`Route module did not export component "${exportName}"`)
        }
        resolved = candidate as ComponentType<Record<string, never>>
      })
    }
    return pending
  }

  const Component = (props: Record<string, never>) => {
    if (!resolved) {
      // Throwing the import promise is the Suspense contract; the lint rule only
      // understands Error objects.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw ensure()
    }
    const Resolved = resolved
    return <Resolved {...props} />
  }
  Component.displayName = `LazyRoute(${exportName})`

  return { component: Component as RouteComponent['component'], ensure }
}

export const routeComponents = {
  home: defineRoute(() => import('@/features/home'), 'HomePage'),
  film: defineRoute(() => import('@/features/film'), 'FilmPage'),
  gallery: defineRoute(() => import('./routes/gallery-route'), 'GalleryRoute'),
  upload: defineRoute(() => import('@/features/upload/UploadPage'), 'UploadPage'),
  guestbook: defineRoute(() => import('./routes/guestbook-route'), 'GuestbookRoute'),
  guestPhotos: defineRoute(() => import('@/features/guest-photos'), 'GuestPhotosPage'),
  guestShare: defineRoute(() => import('@/features/guest-share'), 'GuestSharePage'),
  activity: defineRoute(() => import('./routes/activity-route'), 'ActivityRoute'),
  print: defineRoute(() => import('@/features/print/PrintPage'), 'PrintPage'),
  adminLogin: defineRoute(() => import('./routes/admin-routes'), 'AdminLoginPageRoute'),
  admin: defineRoute(() => import('./routes/admin-routes'), 'AdminPageRoute'),
} as const

export type RouteComponentKey = keyof typeof routeComponents

const preloadMatchers: ReadonlyArray<{ pattern: RegExp; key: RouteComponentKey }> = [
  { pattern: /^\/$/, key: 'home' },
  { pattern: /^\/film\/?$/, key: 'film' },
  { pattern: /^\/gallery\/?$/, key: 'gallery' },
  { pattern: /^\/upload\/?$/, key: 'upload' },
  { pattern: /^\/guestbook\/?$/, key: 'guestbook' },
  { pattern: /^\/guest-photos\/?$/, key: 'guestPhotos' },
  { pattern: /^\/guest\//, key: 'guestShare' },
  { pattern: /^\/activity\/?$/, key: 'activity' },
  { pattern: /^\/print\/?$/, key: 'print' },
  { pattern: /^\/admin\/login/, key: 'adminLogin' },
  { pattern: /^\/admin/, key: 'admin' },
]

/** Await the initial route's module so the first render has the real height. */
export async function preloadInitialRoute(pathname: string): Promise<void> {
  const match = preloadMatchers.find(candidate => candidate.pattern.test(pathname))
  if (!match) return
  try {
    await routeComponents[match.key].ensure()
  } catch {
    // A failed preload must never block the app; the route's Suspense boundary
    // reports the real error when it renders.
  }
}
