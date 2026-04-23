# Codebase Structure

**Analysis Date:** 2026-04-23

## Directory Layout

```
Wedding_Website_Clean/
├── src/
│   ├── accessibility/     # A11y provider and utilities
│   ├── assets/           # Static images (gallery, hero)
│   ├── components/        # React components (organized by domain)
│   ├── composables/      # Vue-style reusable logic (if used)
│   ├── config/            # App configuration
│   ├── context/          # React context providers
│   ├── data/             # Static data (constants, seed data)
│   ├── design-system/    # Design tokens and primitives
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Core libraries (supabase client, utils)
│   ├── pages/             # Route-level page components
│   ├── providers/         # Context providers (Auth, App)
│   ├── routes/           # Route definitions
│   ├── services/         # Business logic services
│   ├── stores/           # Zustand state stores
│   ├── styles/           # Global styles
│   ├── themes/           # Theme definitions
│   ├── tokens/           # Design tokens
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   ├── validators/       # Zod validation schemas
│   ├── workers/          # Web workers
│   └── main.tsx          # Application entry point
├── public/               # Static assets served directly
├── netlify/              # Netlify edge functions
│   └── functions/        # Serverless functions
├── scripts/              # Build and deployment scripts
├── tests/                # Test utilities
├── e2e/                  # Playwright E2E tests
└── supabase/             # Supabase migration files
```

## Directory Purposes

**src/components/:**
- Purpose: Reusable UI components organized by domain
- Contains: ui/, layout/, gallery/, sections/, admin/, timeline/, etc.
- Key files: `ui/index.ts` (barrel export), `layout/Layout.tsx`

**src/pages/:**
- Purpose: Route-level page components
- Contains: Home.tsx, Film.tsx, Gallery.tsx, Upload.tsx, Guestbook.tsx, Admin.tsx, People.tsx
- Pattern: Lazy-loaded from App.tsx

**src/stores/:**
- Purpose: Zustand state management
- Contains: authStore.ts, galleryStore.ts, uiStore.ts
- Pattern: Devtools middleware, typed state interfaces

**src/lib/:**
- Purpose: Core library code
- Contains: supabase.ts (client), utils.ts (cn, formatTime, debounce, etc.)

**src/services/:**
- Purpose: Business logic and external integrations
- Contains: AnalyticsService.ts, galleryService.ts, ErrorLoggingService.ts

**src/providers/:**
- Purpose: React context providers
- Contains: AuthProvider.tsx, AppProviders.tsx

**src/types/:**
- Purpose: TypeScript type definitions
- Contains: supabase.generated.ts (generated types), custom types

**netlify/functions/:**
- Purpose: Serverless functions
- Contains: download-pack.ts, guest-upload-url.ts

## Key File Locations

**Entry Points:**
- `src/main.tsx` - React app bootstrap
- `src/App.tsx` - Root component with routing

**Configuration:**
- `vite.config.js` - Build configuration, PWA, chunk splitting
- `tsconfig.json` - TypeScript with path aliases (@ -> src)
- `netlify.toml` - Deployment and redirect rules

**Core Logic:**
- `src/lib/supabase.ts` - Supabase client and database types
- `src/stores/authStore.ts` - Authentication state
- `src/services/AnalyticsService.ts` - Google Analytics wrapper

**Testing:**
- `src/App.test.tsx` - App unit tests
- `vitest.config.js` - Vitest configuration
- `playwright.config.ts` - Playwright E2E configuration
- `tests/e2e/` - Playwright test suite

## Naming Conventions

**Files:**
- Components: PascalCase.tsx (e.g., GalleryHeader.tsx, AlbumOrganizer.tsx)
- Utilities: camelCase.ts (e.g., utils.ts, logger.ts)
- Stores: camelCase.ts (e.g., authStore.ts)
- Services: camelCase.ts (e.g., galleryService.ts)

**Directories:**
- Components: kebab-case (e.g., gallery/, admin/, face-recognition/)
- Pages: PascalCase (e.g., pages/Home.tsx)
- Hooks: camelCase (e.g., hooks/useGallery.ts)

## Where to Add New Code

**New Feature/Page:**
- Primary code: `src/pages/NewFeature.tsx`
- Tests: `src/components/NewFeature.test.tsx`
- Add route in `src/App.tsx`

**New UI Component:**
- Implementation: `src/components/ui/NewComponent.tsx`
- Export from: `src/components/ui/index.ts`
- Story (if needed): `.storybook/` directory

**New Store:**
- Implementation: `src/stores/newStore.ts`
- Pattern: Zustand with devtools, typed interface

**New Service:**
- Implementation: `src/services/newService.ts`
- Usage: Imported by stores or components

**New Utility:**
- Implementation: `src/lib/utils.ts` (add function) or `src/utils/newUtility.ts`
- Utility barrel: `src/lib/utils.ts` re-exports

## Special Directories

**.storybook/:**
- Purpose: Component Storybook stories
- Generated: No
- Committed: Yes (if exists)

**netlify/functions/:**
- Purpose: Serverless edge functions
- Generated: No
- Committed: Yes

**supabase/:**
- Purpose: Database migration files
- Generated: Via `supabase db push`
- Committed: Yes

---

*Structure analysis: 2026-04-23*