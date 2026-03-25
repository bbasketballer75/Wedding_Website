# Skill: React + Vite + TypeScript Development

## Overview

This skill enables Codex to work effectively with the React 19, Vite 7, and TypeScript stack used in this wedding website project.

## Technology Stack

- **React 19** - Latest React with concurrent features
- **Vite 7** - Fast build tool and dev server
- **TypeScript 5.9** - Type-safe JavaScript
- **Tailwind CSS 4** - Utility-first CSS
- **Framer Motion** - Animation library

## Code Patterns

### Component Structure

```tsx
// File: src/components/features/PhotoCard.tsx
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

type PhotoCardProps = {
  src: string
  alt: string
  caption?: string
  className?: string
}

export function PhotoCard({ src, alt, caption, className }: PhotoCardProps) {
  return (
    <motion.figure
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('overflow-hidden rounded-lg', className)}
    >
      <img 
        src={src} 
        alt={alt}
        className="w-full h-auto object-cover"
        loading="lazy"
      />
      {caption && (
        <figcaption className="text-sm text-gray-600 mt-2">
          {caption}
        </figcaption>
      )}
    </motion.figure>
  )
}
```

### Custom Hooks

```tsx
// File: src/hooks/usePhotos.ts
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Photo } from '@/types'

export function usePhotos(category?: string) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function fetchPhotos() {
      try {
        let query = supabase
          .from('photos')
          .select('*')
          .order('created_at', { ascending: false })
        
        if (category) {
          query = query.eq('category', category)
        }
        
        const { data, error } = await query
        
        if (error) throw error
        setPhotos(data || [])
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch photos'))
      } finally {
        setLoading(false)
      }
    }

    fetchPhotos()
  }, [category])

  return { photos, loading, error }
}
```

### Page Components

```tsx
// File: src/pages/Gallery.tsx
import { usePhotos } from '@/hooks/usePhotos'
import { PhotoCard } from '@/components/features/PhotoCard'
import { PageLayout } from '@/components/layout/PageLayout'

export function Gallery() {
  const { photos, loading, error } = usePhotos()

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <PageLayout title="Photo Gallery">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {photos.map((photo) => (
          <PhotoCard
            key={photo.id}
            src={photo.url}
            alt={photo.caption || 'Wedding photo'}
            caption={photo.caption}
          />
        ))}
      </div>
    </PageLayout>
  )
}
```

## Styling Guidelines

### Tailwind CSS Conventions

1. **Use the `cn()` utility** for conditional classes:
```tsx
import { cn } from '@/lib/utils'

className={cn(
  'base-classes',
  isActive && 'active-classes',
  size === 'large' ? 'text-lg' : 'text-sm'
)}
```

2. **Responsive prefixes** (mobile-first):
```tsx
// Base = mobile, then larger screens
className="text-sm md:text-base lg:text-lg"
```

3. **Custom CSS variables** for theme:
```css
/* In global CSS or Tailwind config */
:root {
  --color-primary: #d4af37;
  --color-secondary: #08080a;
}
```

### Common Tailwind Patterns

```tsx
// Container
className="container mx-auto px-4 max-w-7xl"

// Flex center
className="flex items-center justify-center"

// Grid gallery
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"

// Card
className="bg-white rounded-lg shadow-md p-6"

// Button
className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
```

## Animation Patterns

### Framer Motion

```tsx
import { motion, AnimatePresence } from 'framer-motion'

// Fade in animation
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.3 }}
>
  Content
</motion.div>

// Stagger children
<motion.div
  initial="hidden"
  animate="visible"
  variants={{
    visible: {
      transition: { staggerChildren: 0.1 }
    }
  }}
>
  {items.map(item => (
    <motion.div
      key={item.id}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
      }}
    />
  ))}
</motion.div>

// Page transitions
<AnimatePresence mode="wait">
  <motion.div
    key={pathname}
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 20 }}
    transition={{ duration: 0.2 }}
  >
    {children}
  </motion.div>
</AnimatePresence>
```

## Routing

### React Router v7

```tsx
// File: src/App.tsx or router config
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Home } from './pages/Home'
import { Gallery } from './pages/Gallery'
import { Guestbook } from './pages/Guestbook'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/gallery',
    element: <Gallery />,
  },
  {
    path: '/guestbook',
    element: <Guestbook />,
  },
])

export function App() {
  return <RouterProvider router={router} />
}
```

### Navigation

```tsx
import { Link, useNavigate } from 'react-router-dom'

// Link component
<Link to="/gallery" className="nav-link">
  Gallery
</Link>

// Programmatic navigation
const navigate = useNavigate()
navigate('/gallery')
```

## Vite Configuration

### Path Aliases

The project uses `@/` as an alias for `./src/`:

```typescript
// vite.config.js
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Usage:
```typescript
import { Button } from '@/components/ui/Button'
import { usePhotos } from '@/hooks/usePhotos'
import type { Photo } from '@/types'
```

## Common Tasks

### Adding a New Page

1. Create file in `src/pages/NewPage.tsx`
2. Add route in router configuration
3. Add navigation link if needed

### Adding a New Component

1. Create file in appropriate subdirectory:
   - `src/components/ui/` - Reusable UI components
   - `src/components/features/` - Feature-specific components
   - `src/components/layout/` - Layout components
2. Export as named export
3. Use TypeScript for props

### Adding a New Hook

1. Create file in `src/hooks/useHookName.ts`
2. Export function with `use` prefix
3. Return typed values

### Environment Variables

Use `import.meta.env` for Vite env vars:

```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const isDev = import.meta.env.DEV
```

Note: Only variables prefixed with `VITE_` are exposed to client code.

## Error Handling

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Wrap components that might throw
<ErrorBoundary fallback={<ErrorMessage />}>
  <PhotoGallery />
</ErrorBoundary>
```

## Performance Tips

1. **Lazy load routes**:
```tsx
const Gallery = lazy(() => import('./pages/Gallery'))
```

2. **Use React.memo for expensive renders**:
```tsx
export const PhotoCard = memo(function PhotoCard({ photo }) {
  // ...
})
```

3. **Optimize images**:
```tsx
<img loading="lazy" decoding="async" />
```

4. **Use will-change sparingly**:
```tsx
className="will-change-transform"
```
