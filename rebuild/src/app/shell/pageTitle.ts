/**
 * Page labels for the main landmark / route announcements. Mirrors the frozen
 * `getPageTitle` in `src/App.tsx`: the titles map is exact-path only, and only
 * guest albums get a prefix rule (so `/admin/albums` intentionally has no label
 * and falls back to "Page content", exactly like the frozen shell).
 *
 * Kept out of `RootLayout.tsx` so that file only exports components
 * (react-refresh).
 */
const PAGE_TITLES: Record<string, string> = {
  '/': 'Home',
  '/film': 'Wedding Film',
  '/gallery': 'Photo Gallery',
  '/upload': 'Share Memories',
  '/guestbook': 'Guestbook',
  '/guest-photos': 'Guest Memories',
  '/activity': 'Activity',
  '/admin/login': 'Admin Login',
  '/admin': 'Admin Dashboard',
  '/print': 'Memory Book',
}

export function pageTitle(pathname: string): string | undefined {
  if (pathname.startsWith('/guest/')) return 'Guest Album'
  return PAGE_TITLES[pathname]
}
