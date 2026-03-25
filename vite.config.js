/* global process */
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import packageJson from './package.json' with { type: 'json' }

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEFAULT_SITE_URL = 'https://www.theporadas.com'

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

  if (packageName === 'leaflet' || packageName === 'react-leaflet') {
    return 'vendor-map'
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
  name: "Austin & Jordyn's Wedding",
  short_name: 'A&J Wedding',
  description: 'Join us in celebrating our wedding. View our story, photos, and share your memories.',
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
      description: 'Browse our wedding photos',
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
        },
      }),
      process.env.ANALYZE &&
        visualizer({
          filename: 'dist/stats.html',
          open: true,
          gzipSize: true,
          brotliSize: true,
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
            return getVendorChunkName(id)
          },
          chunkFileNames: 'assets/[name]-[hash].js',
        },
        onwarn: (warning, warn) => {
          // Suppress warnings about dynamic imports
          if (warning.code === 'DYNAMIC_IMPORT') return
          // Warn about large chunks
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
          warn(warning)
        },
      },
      chunkSizeWarningLimit: 500,
      assetsInlineLimit: 4096,
      reportCompressedSize: true,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false,
          drop_debugger: true,
        },
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: mediaBaseUrl
        ? {
            '/__media_proxy': {
              target: mediaBaseUrl,
              changeOrigin: true,
              rewrite: (requestPath) => requestPath.replace(/^\/__media_proxy/, ''),
            },
          }
        : undefined,
    },
    define: {
      __DEV__: process.env.NODE_ENV === 'development',
      __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || packageJson.version),
    },
  }
})
