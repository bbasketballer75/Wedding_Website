# Technology Stack

**Analysis Date:** 2026-04-23

## Languages

**Primary:**
- TypeScript 5.9.3 - Core development language, strict mode enabled
- JavaScript (JSX/TSX) - React components

**Secondary:**
- CSS/Tailwind CSS 4.1.18 - Styling via Tailwind Vite plugin

## Runtime

**Environment:**
- Node.js 20.19.0 (production), development builds on same
- Package Manager: npm 11.11.0

**Build Tool:**
- Vite 7.3.2 - Frontend build tooling with React plugin

## Frameworks

**Core:**
- React 19.2.4 - UI framework
- React Router DOM 7.13.1 - Client-side routing
- Zustand 5.0.11 - State management with devtools middleware

**Styling:**
- Tailwind CSS 4.1.18 via @tailwindcss/vite plugin
- Framer Motion 12.35.2 - Animations
- Radix UI (various packages) - Accessible UI primitives

**UI Components:**
- Lucide React 0.577.0 - Icons
- Class Variance Authority 0.7.1 - Component variants
- Tailwind Merge 3.5.0 - Class merging

**State & Data:**
- Zustand 5.0.11 - Lightweight state with persistence
- @supabase/supabase-js 2.99.0 - Backend client

## Build & Dev Tools

**Bundler:**
- Vite 7.3.2 with manual chunk splitting (vendor-react, vendor-supabase, vendor-motion, etc.)

**Testing:**
- Vitest 4.0.18 - Unit testing with V8 coverage
- Playwright 1.58.2 - E2E testing
- @axe-core/playwright 4.11.1 - Accessibility testing

**Code Quality:**
- ESLint 9.39.4 with TypeScript support
- Prettier 3.8.1 - Formatting
- lint-staged 16.3.2 - Pre-commit linting

**Performance:**
- Lighthouse CI (lhci/cli 0.15.1) - Performance budgets
- vite-plugin-pwa 1.2.0 - Service worker/PWA support

## Key Dependencies

**Backend/Storage:**
- @supabase/supabase-js 2.99.0 - Database, auth, storage
- @aws-sdk/client-s3 3.1029.0 - Cloudflare R2 storage
- @aws-sdk/s3-request-presigner 3.1029.0 - Presigned URLs

**Media Processing:**
- Sharp 0.34.5 - Image optimization
- exifr 7.1.3 - EXIF parsing
- @vladmandic/human 3.3.6 - Face recognition

**Monitoring:**
- Sentry Browser/React 10.42.0 - Error tracking
- web-vitals 5.1.0 - Performance metrics

**Validation:**
- Zod 4.3.6 - Schema validation

## Configuration

**Build:**
- `vite.config.js` - Vite bundler with PWA, chunk splitting, media proxy
- `tsconfig.json` - Strict TypeScript, path aliases (@ -> src)
- `.env.example` - Environment variable documentation

**Environment:**
- VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY - Supabase credentials
- VITE_SITE_URL - Canonical URL for SEO
- VITE_MEDIA_BASE_URL - Optional CDN for media
- VITE_GA_ID - Google Analytics
- VITE_SENTRY_DSN - Error tracking

**CI/Deployment:**
- `netlify.toml` - Netlify deployment config
- Playwright config for E2E testing

## Platform Requirements

**Development:**
- Node.js >=20.19.0
- npm 11.11.0

**Production:**
- Netlify - Static hosting with edge functions
- Node.js 20.19.0 for build step

---

*Stack analysis: 2026-04-23*