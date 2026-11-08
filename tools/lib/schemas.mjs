/**
 * zod schemas for every committed contract.
 *
 * `tools/verify-contracts.mjs` validates each contract against the schema
 * declared here, so a contract cannot silently drift into a shape the rebuild
 * cannot consume. Keep these in sync with the contract files: the schemas are
 * the interface, the JSON is the data.
 */
import { z } from 'zod'

const nonEmpty = z.string().min(1)

const routePath = z
  .string()
  .min(1)
  .refine(value => value.startsWith('/'), 'route paths must start with "/"')

const themeName = z.enum(['dark', 'light'])
const viewportName = z.enum(['desktop', 'mobile'])

export const routeSchema = z.object({
  id: nonEmpty,
  path: routePath,
  kind: z.enum(['public', 'admin', 'guest', 'dynamic', 'print', 'error']),
  auth: z.enum(['none', 'admin', 'guest-token']),
  query: z.array(nonEmpty).default([]),
  parity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  matrix: z.array(viewportName).min(1),
  themes: z.array(themeName).min(1),
  fixtures: z.array(nonEmpty).default([]),
  notes: z.string().default(''),
})

export const routesContractSchema = z.object({
  generatedFrom: z.array(nonEmpty).min(1),
  routes: z.array(routeSchema).min(1),
})

export const featureCheckSchema = z.object({
  type: z.enum(['parity', 'text', 'e2e', 'contract', 'unit']),
  ref: nonEmpty,
})

export const featureSchema = z.object({
  id: nonEmpty,
  routes: z.array(routePath).min(1),
  legacyFiles: z.array(nonEmpty).default([]),
  dataSources: z.array(nonEmpty).default([]),
  invariants: z.array(nonEmpty).min(1),
  checks: z.array(featureCheckSchema).default([]),
  risk: z.enum(['low', 'medium', 'high']),
})

export const featuresContractSchema = z.object({
  features: z.array(featureSchema).min(1),
})

const viewportSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})

export const uiContractSchema = z.object({
  themes: z.array(themeName).min(1),
  defaultTheme: themeName,
  reducedMotion: z.literal('reduce'),
  deviceScaleFactor: z.number().positive(),
  /**
   * The single deterministic instant (ISO 8601, UTC) every rendered-copy and
   * parity capture freezes the page clock to. Layouts that render "time since"
   * copy (the home anniversary countdown, the footer year) are only comparable
   * across runs if every harness uses one shared value; consumers must read it
   * from here instead of hardcoding their own.
   */
  fixedNow: z.string().optional(),
  viewports: z.object({
    desktop: viewportSchema,
    mobile: viewportSchema,
  }),
  fonts: z.array(nonEmpty).min(1),
  breakpoints: z.unknown().optional(),
})

export const seoPwaContractSchema = z.object({
  siteUrl: nonEmpty,
  routes: z
    .array(
      z.object({
        id: nonEmpty,
        title: nonEmpty,
        description: nonEmpty,
        canonicalPath: nonEmpty,
        ogImage: z.string().optional(),
        /**
         * Rendered robots meta content. Present only where the frozen app sets
         * it explicitly (SEOHead `noIndex`); an absent value means the static
         * index.html default (`index, follow`) applies.
         */
        robots: z.enum(['index,follow', 'noindex,nofollow']).optional(),
      })
    )
    .min(1),
  sitemap: z
    .array(
      z.object({
        path: nonEmpty,
        changefreq: nonEmpty,
        priority: z.number(),
      })
    )
    .min(1),
  manifest: z.object({
    name: nonEmpty,
    short_name: nonEmpty,
    display: nonEmpty,
    start_url: nonEmpty,
    theme_color: nonEmpty,
    background_color: nonEmpty,
    lang: nonEmpty,
  }),
  headers: z
    .array(
      z.object({
        pattern: nonEmpty,
        headers: z.unknown(),
      })
    )
    .min(1),
  edgeOg: z.object({
    path: nonEmpty,
    queryParam: nonEmpty,
    rewrites: z.array(nonEmpty).min(1),
  }),
})

export const parityAllowlistSchema = z.object({
  entries: z.array(
    z.object({
      route: nonEmpty,
      viewport: viewportName,
      theme: themeName,
      reason: nonEmpty,
      expiresAtWave: z.number().int().positive(),
      maxDiffPixelRatio: z.number().min(0).max(1),
    })
  ),
})

export const mediaManifestSchema = z.object({
  generatedAt: nonEmpty,
  media: z
    .array(
      z.object({
        path: nonEmpty,
        kind: z.enum(['image', 'video', 'audio', 'font', 'other']),
        referencedBy: z.array(nonEmpty),
        existsLocally: z.boolean(),
        source: z.enum(['public', 'remote', 'unknown']),
      })
    )
    .min(1),
})

export const mediaInventorySchema = z.object({
  capturedAt: nonEmpty,
  buckets: z.array(
    z.object({
      name: nonEmpty,
      host: nonEmpty,
      public: z.boolean(),
      pathPatterns: z.array(nonEmpty),
      notes: z.string().optional(),
    })
  ),
  localMedia: z
    .array(
      z.object({
        directory: nonEmpty,
        files: z.number().int().nonnegative(),
        bytes: z.number().int().nonnegative(),
        gitTracked: z.boolean(),
      })
    )
    .min(1),
})

export const baselineMetricsSchema = z.object({
  capturedAt: nonEmpty,
  commit: nonEmpty,
  gates: z.object({
    typecheck: z.unknown(),
    lint: z.unknown(),
    unit: z.unknown(),
  }),
  bundle: z.unknown().optional(),
  lighthouse: z.unknown().optional(),
  coverage: z.unknown().optional(),
  timings: z.unknown().optional(),
})

/** Contract files and the schema each one must satisfy. */
export const JSON_CONTRACTS = [
  { file: 'routes.json', schema: routesContractSchema, required: true },
  { file: 'features.json', schema: featuresContractSchema, required: true },
  { file: 'ui.json', schema: uiContractSchema, required: true },
  { file: 'seo-pwa.json', schema: seoPwaContractSchema, required: true },
  { file: 'parity-allowlist.json', schema: parityAllowlistSchema, required: true },
  { file: 'media/INVENTORY.json', schema: mediaInventorySchema, required: true },
  { file: 'content/MEDIA_MANIFEST.json', schema: mediaManifestSchema, required: true },
  { file: 'baseline/metrics.json', schema: baselineMetricsSchema, required: false },
]

/** API fixtures every parity/test consumer can rely on. */
export const REQUIRED_FIXTURES = [
  'photos.json',
  'guestbook.json',
  'guestUploads.json',
  'activity.json',
  'editorial.json',
  'claims.json',
  'guestTokens.json',
  'adminSession.json',
]

/** Structured content extracted from the frozen legacy app. */
export const REQUIRED_CONTENT = [
  'wedding.json',
  'film.json',
  'story.json',
  'timeline.json',
  'party.json',
  'music.json',
  'memory-trails.json',
  'curated-photos.json',
  'MEDIA_MANIFEST.json',
]

/** Schema artifacts generated from a clean local Supabase reset. */
export const REQUIRED_SCHEMA_FILES = [
  'schema.sql',
  'storage.sql',
  'database.types.ts',
  'policies.md',
  'rpc.md',
  'INVENTORY.md',
  'fixtures.sql',
]
