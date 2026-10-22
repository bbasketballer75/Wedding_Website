/* global process */
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
// React Compiler: automatic memoization plugin
// eslint-disable-next-line @typescript-eslint/no-require-imports
import reactCompiler from 'babel-plugin-react-compiler'
import { visualizer } from 'rollup-plugin-visualizer'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import packageJson from './package.json' with { type: 'json' }
import { sentryVitePlugin } from '@sentry/vite-plugin'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEFAULT_SITE_URL = 'https://www.theporadas.com'

// Sentry release identity.
//
// The release MUST change on every deploy: it is the key that ties a stack frame
// in Sentry to the source map artifacts uploaded for that build. A static label
// (the previous behaviour: `VITE_APP_VERSION="2026-04-14-launch"` set once in
// Netlify) meant every deploy shared one release, so artifacts could never be
// associated per deploy and regressions could not be attributed to a commit.
//
// Netlify exposes the deploy commit as COMMIT_REF; local builds fall back to the
// optional VITE_APP_VERSION label and finally to the package version.
const commitRef = (process.env.COMMIT_REF || '').trim()
const releaseVersion = commitRef || process.env.VITE_APP_VERSION || packageJson.version

// Source maps are only emitted when they can be uploaded and then deleted from
// the published output. Without credentials we would either ship readable maps
// publicly or ship none at all — so we ship none.
const sentryUploadEnabled = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
)

function getNodeModulePackage(id) {
  const normalized = id.replace(/\\/g, '/')
  const nodeModulesIndex = normalized.lastIndexOf('/node_modules/')

  if (nodeModulesIndex === -1) {
    return null
  }

  const packagePath = normalized.slice(nodeModulesIndex + '/node_modules/'.length)
  const segments = packagePath.split('/')

  if (segments[0]?.startsWith('@')) {
    return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : segments[0]
  }

  return segments[0] || null
}

function getVendorChunkName(id) {
  if (!id.includes('node_modules')) {
    return undefined
  }

  const packageName = getNodeModulePackage(id)

  if (!packageName) {
    return undefined
  }

  if (packageName === 'react' || packageName === 'react-dom' || packageName === 'scheduler') {
    return 'vendor-react'
  }

  if (packageName === 'react-router-dom') {
    return 'vendor-router'
  }

  if (packageName === '@supabase/supabase-js') {
    return 'vendor-supabase'
  }

  if (packageName === 'framer-motion') {
    return 'vendor-motion'
  }

  if (packageName === 'lucide-react' || packageName === '@heroicons/react') {
    return 'vendor-icons'
  }

  if (packageName.startsWith('@radix-ui/')) {
    return 'vendor-radix'
  }

  return undefined
}

const pwaIcons = [
  {
    src: '/icons/icon-72x72.png',
    sizes: '72x72',
    type: 'image/png',
    purpose: 'maskable any',
  },
  {
    src: '/icons/icon-96x96.png',
    sizes: '96x96',
    type: 'image/png',
    purpose: 'maskable any',
  },
  {
    src: '/icons/icon-128x128.png',
    sizes: '128x128',
    type: 'image/png',
    purpose: 'maskable any',
  },
  {
    src: '/icons/icon-144x144.png',
    sizes: '144x144',
    type: 'image/png',
    purpose: 'maskable any',
  },
  {
    src: '/icons/icon-152x152.png',
    sizes: '152x152',
    type: 'image/png',
    purpose: 'maskable any',
  },
  {
    src: '/icons/icon-192x192.png',
    sizes: '192x192',
    type: 'image/png',
    purpose: 'maskable any',
  },
  {
    src: '/icons/icon-384x384.png',
    sizes: '384x384',
    type: 'image/png',
    purpose: 'maskable any',
  },
  {
    src: '/icons/icon-512x512.png',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'maskable any',
  },
]

const pwaManifest = {
  name: 'Austin & Jordyn | Wedding Archive',
  short_name: 'A&J Archive',
  description:
    'A permanent digital archive of our wedding day. Relive our story, browse the films, and view the galleries.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait-primary',
  background_color: '#08080a',
  theme_color: '#d4af37',
  lang: 'en',
  categories: ['lifestyle', 'events'],
  icons: pwaIcons,
  shortcuts: [
    {
      name: 'View Gallery',
      short_name: 'Gallery',
      description: 'Explore the full wedding collection',
      url: '/gallery',
      icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' }],
    },
    {
      name: 'Guest Book',
      short_name: 'Guest Book',
      description: 'Leave a message for us',
      url: '/guestbook',
      icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' }],
    },
  ],
  prefer_related_applications: false,
  related_applications: [],
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = (env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '')
  const mediaBaseUrl = (env.VITE_MEDIA_BASE_URL || '').replace(/\/+$/, '')

  return {
    base: '/',
    plugins: [
      react({
        // Enable fast refresh for TypeScript
        fastRefresh: true,
        // React Compiler: automatic memoization (replaces manual useCallback/
        // useMemo). Off by default in @vitejs/plugin-react@6.1.0 — opt in
        // here. babel-plugin-react-compiler is already installed as a devDep.
        babel: {
          plugins: [[reactCompiler, { target: '19' }]],
        },
      }),
      tailwindcss(),
      {
        name: 'inject-site-url-fallback-metadata',
        transformIndexHtml(html) {
          return html.replaceAll('__SITE_URL__', siteUrl)
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: false,
        },
        manifestFilename: 'manifest.webmanifest',
        includeAssets: [
          'favicon-custom.svg',
          'favicon-16x16.png',
          'favicon-32x32.png',
          'apple-touch-icon.png',
          'browserconfig.xml',
          'robots.txt',
          'offline.html',
        ],
        manifest: pwaManifest,
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: /^https?:\/\/.*\/media\/_thumbs\/.*/i,
              handler: 'CacheFirst',
              options: {
                // v2: cache names are bumped because the v1 caches were
                // populated with opaque (status 0) responses, which the
                // lightbox's CORS fetch() cannot consume. See statuses below.
                cacheName: 'gallery-images-v2',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                },
                // Statuses is deliberately [200] only — NOT [0, 200].
                //
                // Allowing status 0 lets the workbox strategy store opaque
                // responses. Gallery <img> tags load in no-cors mode, so their
                // responses ARE opaque, and they got cached under the same URL
                // the lightbox later reads with a CORS-mode fetch(). Serving a
                // cached opaque response to a non-no-cors request is rejected
                // by the browser ("an opaque response was used for a request
                // whose type is not no-cors"), which surfaced as
                // `net::ERR_FAILED` / "TypeError: Failed to fetch" whenever a
                // photo was opened.
                cacheableResponse: {
                  statuses: [200],
                },
              },
            },
            {
              urlPattern: /^https?:\/\/.*\/media\/(?!_thumbs).*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gallery-direct-media-v2',
                expiration: {
                  maxEntries: 300,
                  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                },
                // See the _thumbs route above for why 0 is excluded.
                cacheableResponse: {
                  statuses: [200],
                },
              },
            },
          ],
        },
      }),
      process.env.ANALYZE &&
        visualizer({
          filename: 'dist/stats.html',
          open: true,
          gzipSize: true,
          brotliSize: true,
        }),
      // Upload source maps for this exact release, then delete them from dist so
      // they are never served publicly. Injects debug IDs into the bundle, which
      // lets Sentry symbolicate even if the release label ever drifts.
      sentryUploadEnabled &&
        sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          telemetry: false,
          // Fail the build instead of warning. A deploy that silently ships
          // without symbolication is exactly the failure this configuration
          // exists to prevent; unset SENTRY_AUTH_TOKEN to skip upload entirely.
          errorHandler: error => {
            throw error
          },
          release: {
            name: releaseVersion,
          },
          sourcemaps: {
            assets: ['./dist/**'],
            filesToDeleteAfterUpload: ['./dist/**/*.map'],
          },
        }),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const vendorChunk = getVendorChunkName(id)
            if (vendorChunk) return vendorChunk

            // Force app-level supabase wrapper into a dedicated chunk so that
            // PHOTO_ALBUMS and other constants are always co-located with the
            // functions that reference them, preventing live-binding split errors.
            if (id.includes('src/lib/supabase')) return 'app-supabase'

            return undefined
          },
          chunkFileNames: 'assets/[name]-[hash].js',
        },
        onwarn: (warning, warn) => {
          // Suppress warnings about dynamic imports
          if (warning.code === 'DYNAMIC_IMPORT') return
          if (warning.code === 'INEFFECTIVE_DYNAMIC_IMPORT') return
          if (warning.code === 'PLUGIN_TIMINGS') return
          // Warn about large chunks
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
          warn(warning)
        },
      },
      chunkSizeWarningLimit: 500,
      assetsInlineLimit: 4096,
      reportCompressedSize: true,
      // Use Terser for minification so we can reliably drop console/debugger
      // statements in production bundles. Sentry captures errors in production;
      // browser console output is not needed.
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production',
        },
      },
      // 'hidden' keeps the maps out of the bundle's sourceMappingURL comment; the
      // Sentry plugin uploads them and removes them from dist. Only enabled when
      // upload credentials exist — see sentryUploadEnabled above.
      sourcemap: sentryUploadEnabled ? 'hidden' : false,
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: mediaBaseUrl
        ? {
            '/__media_proxy': {
              target: mediaBaseUrl,
              changeOrigin: true,
              rewrite: requestPath => requestPath.replace(/^\/__media_proxy/, ''),
            },
          }
        : undefined,
    },
    preview: {
      port: 4173,
      strictPort: true,
      proxy: mediaBaseUrl
        ? {
            '/__media_proxy': {
              target: mediaBaseUrl,
              changeOrigin: true,
              rewrite: requestPath => requestPath.replace(/^\/__media_proxy/, ''),
            },
            '/media': {
              target: mediaBaseUrl,
              changeOrigin: true,
              rewrite: requestPath => requestPath.replace(/^\/media/, ''),
            },
          }
        : undefined,
    },
    define: {
      __DEV__: process.env.NODE_ENV === 'development',
      // Consumed by ErrorLoggingService as the Sentry release.
      __APP_VERSION__: JSON.stringify(releaseVersion),
    },
  }
})
