# External Integrations

**Analysis Date:** 2026-04-23

## APIs & External Services

**Supabase (Primary Backend):**
- Purpose: PostgreSQL database, authentication, storage, realtime
- SDK: @supabase/supabase-js 2.99.0
- Auth: Auto-refresh tokens, persist session, detect session in URL
- Tables: photos, guest_uploads, guestbook_messages, site_editorial_features, moderation_audit_log, media_review_batches, media_review_clusters, media_review_faces, guest_face_tagging_batches

**Cloudflare R2 (Media Storage):**
- Purpose: Wedding photo/video storage
- SDK: @aws-sdk/client-s3, @aws-sdk/s3-request-presigner
- Auth: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
- Bucket: wedding-media
- Public URL: media.wedding.theporadas.com

## Data Storage

**PostgreSQL via Supabase:**
- Connection: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
- ORM: Direct Supabase JS client (no Prisma)

**File Storage:**
- Supabase Storage (wedding-gallery bucket) - For gallery images
- Cloudflare R2 - For wedding media assets
- Local /public directory - Fallback when VITE_MEDIA_BASE_URL unset

**Caching:**
- None explicitly configured

## Authentication & Identity

**Auth Provider:**
- Supabase Auth - Email/password authentication
- Implementation: Zustand store (authStore.ts) with AuthProvider context wrapper
- Admin role check: user.user_metadata.role === 'admin'

## Monitoring & Observability

**Error Tracking:**
- Sentry (@sentry/react 10.42.0) - Browser error tracking
- DSN: VITE_SENTRY_DSN
- Config: Console statements stripped from production bundles

**Analytics:**
- Google Analytics 4 - Page views and engagement
- ID: VITE_GA_ID
- Custom tracking: initAnalytics(), trackPageView() in AnalyticsService.ts

**Performance:**
- web-vitals 5.1.0 - Core Web Vitals
- Lighthouse CI - Performance budgets with 0.45 KO ratio

## CI/CD & Deployment

**Hosting:**
- Netlify - Static site hosting with edge functions
- Edge function: gallery-share for /gallery path
- Domain: www.theporadas.com

**CI Pipeline:**
- Netlify deploys: verify:env, lint, type-check, test:run, build, test:e2e:public

**Build:**
- npm run verify:env && npm run build
- Post-build: prune-local-media.js, copy-public-images.js, generate-sitemap.js

## Environment Configuration

**Required env vars:**
- VITE_SUPABASE_URL - Supabase project URL
- VITE_SUPABASE_ANON_KEY - Supabase anonymous key

**Optional env vars:**
- VITE_MEDIA_BASE_URL - CDN base for media
- VITE_SITE_URL - Canonical site URL for SEO
- VITE_GA_ID - Google Analytics ID
- VITE_SENTRY_DSN - Sentry error tracking
- VITE_APP_VERSION - Release label
- VITE_ENABLE_UPLOADS - Feature flag
- VITE_ENABLE_GUESTBOOK - Feature flag
- VITE_REQUIRE_UPLOAD_APPROVAL - Upload moderation

**Cloudflare R2 (scripts only):**
- R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY

## Webhooks & Callbacks

**Incoming:**
- None explicitly defined

**Outgoing:**
- Supabase Realtime - For live updates (10 events/sec limit)

---

*Integration audit: 2026-04-23*