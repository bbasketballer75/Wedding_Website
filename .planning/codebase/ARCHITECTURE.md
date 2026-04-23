# Architecture

**Analysis Date:** 2026-04-23

## Pattern Overview

**Overall:** React SPA with centralized state, lazy-loaded pages, and Supabase backend

**Key Characteristics:**
- Client-side routing with React Router DOM
- Zustand stores for state management (auth, gallery, UI)
- Supabase for database, auth, storage, realtime
- Lazy-loaded route components for code splitting
- Error boundary wrapping each route

## Layers

**UI Layer (React Components):**
- Location: `src/components/`, `src/pages/`
- Contains: UI components, page components, layout components
- Depends on: Zustand stores, services, hooks
- Used by: React Router

**State Management Layer (Zustand):**
- Location: `src/stores/`
- Contains: authStore.ts, galleryStore.ts, uiStore.ts
- Depends on: Supabase client
- Used by: Components via hooks

**Service Layer:**
- Location: `src/services/`, `src/lib/`
- Contains: AnalyticsService.ts, galleryService.ts, supabase.ts
- Depends on: Supabase client
- Used by: Stores, components

**Data Access Layer (Supabase Client):**
- Location: `src/lib/supabase.ts`
- Contains: Database queries, storage operations, auth
- Depends on: Supabase JS SDK
- Used by: Stores, services

## Data Flow

**Page Render Flow:**

1. User navigates to route (/)
2. React Router matches route
3. LazyPage wraps component in Suspense + PageTransition
4. Page component mounts and may call Zustand store actions
5. Store actions call Supabase client
6. Supabase returns data to store
7. Store updates state
8. Components re-render with new data

**Authentication Flow:**

1. App mounts -> AuthProvider initializes
2. AuthProvider calls authStore.initializeAuth()
3. Store calls supabase.auth.getSession()
4. Session found -> set user state, check admin status
5. AppContent reads auth state for conditional rendering

**Gallery Data Flow:**

1. Gallery page loads -> galleryStore.setLoading(true)
2. fetchAlbumPhotos() called via supabase
3. Photos returned and stored
4. galleryStore.applyFilters() processes client-side
5. MasonryGrid renders filtered photos

## Key Abstractions

**Supabase Client (src/lib/supabase.ts):**
- Purpose: Single client instance for all database operations
- Examples: `supabase.from('photos').select()`, `supabase.storage.from('wedding-gallery')`
- Pattern: Direct query functions (not repository pattern)

**Auth Store (src/stores/authStore.ts):**
- Purpose: Authentication state and actions
- Examples: signIn, signOut, initializeAuth, checkAdminStatus
- Pattern: Zustand with devtools middleware

**Lazy Loading Pattern (src/App.tsx):**
- Purpose: Code-split pages for faster initial load
- Examples: const Home = lazy(() => import('@/pages/Home'))
- Pattern: React.lazy + Suspense with fallback

**Error Boundary Pattern:**
- Purpose: Catch errors at route level
- Examples: RouteErrorBoundary wrapping each LazyPage
- Location: src/components/error/ErrorBoundary.tsx

## Entry Points

**App Entry (src/main.tsx):**
- Triggers: DOMContentLoaded
- Responsibilities: Render App with AppProviders

**App Component (src/App.tsx):**
- Triggers: main.tsx render
- Responsibilities: Routing, layout wrapping, auth provider

**Page Components:**
- Home: Hero video, timeline, featured sections
- Film: Video player and chapters
- Gallery: Photo grid with filtering
- Upload: Guest upload form
- Guestbook: Message submission
- Admin: Dashboard with moderation tools

## Error Handling

**Strategy:** Layered error boundaries with graceful fallbacks

**Patterns:**
- RouteErrorBoundary: Wraps each route, renders ErrorBoundary component
- ErrorBoundary: Catches render errors, shows error state
- Service-level: try/catch in store actions, logs errors
- Console stripping: console.* removed from production bundles via esbuild drop

## Cross-Cutting Concerns

**Logging:** Custom logger utility in src/utils/logger.ts, Sentry for production errors

**Validation:** Zod schemas in src/validators/ for form validation

**Performance:**
- Lazy loading for all page components
- Route-level code splitting
- Manual chunk bundling for vendors
- Image lazy loading and optimization components

**Accessibility:**
- AccessibilityProvider for focus management
- SkipLink, KeyboardShortcutsModal
- ARIA landmarks in layout components
- Reduced motion support via useReducedMotion

---

*Architecture analysis: 2026-04-23*