# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wedding archive website for Austin & Jordyn (theporadas.com). Built as a React SPA with Supabase backend, serving as a post-wedding digital archive with gallery, guestbook, and admin features.

## Build Commands

```bash
npm run dev          # Start development server (port 5173)
npm run build        # Production build with postbuild scripts
npm run lint         # ESLint check
npm run lint:fix     # ESLint fix
npm run format       # Prettier format
npm run format:check # Check formatting
npm run test         # Vitest unit tests
npm run test:run     # Vitest run once
npm run test:e2e     # Playwright e2e tests
npm run test:e2e:public  # Public-facing e2e tests only
npm run test:ui      # Vitest UI
npm run preview      # Preview production build
```

## Architecture

### Frontend Stack
- **React 19** with TypeScript, **Vite 7** bundler
- **Tailwind CSS v4** via Vite plugin (not configured in tailwind.config)
- **Zustand** for state management (3 stores: auth, gallery, ui)
- **Framer Motion** for page transitions and animations
- **React Router v7** with lazy-loaded routes

### Backend (Supabase)
- **Auth**: Email/password via Supabase Auth
- **Database**: PostgreSQL with comprehensive schema for photos, guest uploads, guestbook, editorial features, face recognition, moderation
- **Storage**: S3-backed storage for media assets
- **Edge Functions**: guest-face-tagging-admin
- **RLS Policies**: Row-level security on all tables

Key Supabase tables: `photos`, `guest_uploads`, `guestbook_messages`, `site_editorial_features`, `media_review_batches/clusters/faces`, `moderation_audit_log`

### Routing Structure
```
/ → Home
/film → Wedding Film (chaptered video player)
/gallery → Photo Gallery (albums: Engagement, Bach+ette, Wedding Day, Guest Uploads)
/upload → Guest Memory Upload
/guestbook → Guestbook Messages
/people → Face-tagged People Gallery
/admin/* → Admin Dashboard (protected)
/admin/login → Admin Login
```

### State Management
- `src/stores/authStore.ts` - Authentication state
- `src/stores/galleryStore.ts` - Gallery images, filters, pagination, selection, modal state
- `src/stores/uiStore.ts` - UI preferences (theme, modals)

### Key Patterns

**Lazy Loading**: All pages use `lazy()` with `Suspense` and `PageTransition` wrapper for code splitting.

**Design Tokens**: Single source of truth in `src/tokens/designTokens.ts` - used by CSS via `@layer` directives.

**Component Organization**:
- `components/ui/` - Reusable primitives (Button, Card, Input, etc.)
- `components/layout/` - Header, Footer, BackgroundMusic, CustomCursor
- `components/gallery/` - Gallery grid, masonry, lightbox, map view
- `components/sections/` - Page sections (EngagementSection, StoryTimeline, etc.)
- `components/admin/` - Admin-specific components
- `components/accessibility/` - SkipLink, KeyboardShortcutsModal, AccessibilityProvider

**Workers**: Located in `src/workers/` - image processing, search, sync operations.

**Supabase Client**: Single instance exported from `src/lib/supabase.ts` with typed database functions. Custom RPC functions handle complex operations (likes, comments, album organization, face tagging).

**Vendors Chunked Separately**: react, react-dom → vendor-react; react-router-dom → vendor-router; @supabase/supabase-js → vendor-supabase; framer-motion → vendor-motion; lucide-react → vendor-icons; @radix-ui/* → vendor-radix

### Environment Variables

```bash
VITE_SUPABASE_URL        # Supabase project URL
VITE_SUPABASE_ANON_KEY   # Supabase anon key (public)
VITE_SITE_URL            # Production site URL (default: https://www.theporadas.com)
VITE_MEDIA_BASE_URL      # Optional media proxy target
```

### Supabase Management
```bash
npm run supabase:start     # Start local Supabase
npm run supabase:stop      # Stop local Supabase
npm run supabase:status    # Check Supabase status
npm run supabase:db:push   # Push schema to linked project
npm run supabase:types     # Generate TypeScript types from schema
```

### Media Batch Operations
```bash
npm run media:batch:optimize   # Optimize photos
npm run media:batch:organize   # Organize photos
npm run media:batch:catalog    # Catalog photos
npm run media:batch:analyze    # Analyze faces in photos
npm run media:batch:faces       # Face enrichment batch
npm run media:guest:tag:sync    # Sync guest face metadata
```

### Database Migrations
Located in `supabase/migrations/`. Migrations are timestamped and include: schema init, storage buckets, guestbook, rate limiting, moderation system, editorial features, face review system, photo albums, and delete tools.
