import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { preloadInitialRoute } from './app/route-loaders'
import { router } from './app/router'
import './app/styles/global.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Missing #root element in index.html')
}

// Resolve the initial route before the first paint:
// 1. preload its feature/data module (the route component then renders sync),
// 2. let the router match the URL and settle its state.
// Without this the shell paints empty, then a tall route mounts and the footer
// jumps thousands of pixels (measured CLS 0.64–1.03).
// Kick the route chunk + router match off in parallel with the shell paint; the
// footer is gated on real content height, so this does not re-introduce CLS.
void preloadInitialRoute(window.location.pathname)
void router.load()

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
