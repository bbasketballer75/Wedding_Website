/// <reference types="vite/client" />

/**
 * Typed public environment surface. Vite's default `ImportMetaEnv` has an
 * `any` index signature; declaring the variables the app actually consumes
 * removes unsafe-any lint findings and documents the contract in one place.
 */
interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_MEDIA_BASE_URL?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_GA_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
