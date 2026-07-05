# Site Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overhaul theporadas.com with Figma MCP integration, checklist.design-compliant component rebuilds (public + admin), and three new post-wedding features (anniversary countdown, guest highlight reel, download/share packs).

**Architecture:** Code-first (Option B) — components overhauled directly in code using checklist.design as the quality standard, Figma MCP configured alongside as a living documentation layer. New features are built on the cleaned-up component system after Phase 3 completes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, CVA, Radix UI, Framer Motion, Supabase, Netlify Functions, JSZip (new), @figma/devmode-mcp (new)

---

## Phase 1: Figma MCP Setup

### Task 1: Add Figma MCP to Claude Code settings

**Files:**

- Modify: `C:\Users\bbask\.claude\settings.json`

**Step 1: Read the current settings.json** (already done — file is at `C:\Users\bbask\.claude\settings.json`)

**Step 2: Add `mcpServers` key**

Add this block alongside the existing `permissions` and `enabledPlugins` keys:

```json
"mcpServers": {
  "figma": {
    "command": "npx",
    "args": ["-y", "figma-developer-mcp", "--stdio"],
    "env": {
      "FIGMA_ACCESS_TOKEN": "<paste-your-figma-personal-access-token-here>"
    }
  }
}
```

> **User action required before this step:** Generate a Figma Personal Access Token at
> Figma → Settings → Security → Personal Access Tokens. Paste it in place of `<paste-your-figma-personal-access-token-here>`.

**Step 3: Verify connection**

Restart Claude Code, then in a new session run:

```
Can you read the Figma file at <your-figma-file-url>?
```

Expected: The Figma MCP tool responds with file metadata, no errors.

---

### Task 2: Document Figma integration in CODEX.md

**Files:**

- Modify: `CODEX.md`

**Step 1: Add Figma Integration section**

Append under a `## Figma Integration` heading:

```markdown
## Figma Integration

Figma Dev Mode MCP is configured in `~/.claude/settings.json` under `mcpServers.figma`.
This allows Claude Code to read Figma files directly for design reference.

**Setup:** Requires a Figma Personal Access Token in the `FIGMA_ACCESS_TOKEN` env var.
**Usage:** In any Claude Code session, share a Figma file URL and the MCP will read component specs, variables, and annotations.
**Design system mapping:** Figma variable names should match keys in `src/tokens/designTokens.ts`.
```

**Step 2: Commit**

```bash
git add C:/Users/bbask/.claude/settings.json CODEX.md
git commit -m "chore: configure Figma Dev Mode MCP integration"
```

---

## Phase 2: Architecture & Design System

### Task 3: Expand design tokens

**Files:**

- Modify: `src/tokens/designTokens.ts`

**Step 1: Add shadow, radius, and focus ring tokens**

The existing file has `colors`, `typography`, `spacing`, `components`. Add:

```typescript
export const shadows = {
  soft: '0 2px 8px rgba(46,33,13,0.08)',
  glass: '0 8px 32px rgba(46,33,13,0.12)',
  gold: '0 4px 14px rgba(201,160,92,0.4)',
  goldHover: '0 8px 25px rgba(201,160,92,0.5)',
} as const

export const radii = {
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.5rem',
  full: '9999px',
} as const

export const focus = {
  ring: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2',
  ringInset:
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold-500',
} as const
```

Update the default export to include these new tokens.

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 3: Commit**

```bash
git add src/tokens/designTokens.ts
git commit -m "feat(tokens): add shadow, radius, and focus ring tokens"
```

---

### Task 4: Fix MobileMenu — use publicNavLinks + deduplicate nav

**Files:**

- Modify: `src/components/layout/MobileMenu.jsx`

**Problem:** `MobileMenu.jsx` hardcodes `navLinks` internally instead of importing from `publicNavLinks`. When a nav item is added to `publicNav.ts`, the mobile menu won't update. Also missing focus trap, aria-expanded, and Escape key.

**Step 1: Replace hardcoded links with publicNavLinks import**

Remove the internal `navLinks` array and import `publicNavLinks` from `./publicNav`.

```javascript
import { publicNavLinks } from './publicNav'
```

Replace `navLinks.map(...)` with `publicNavLinks.map(...)` and use `link.label` for `{link.name}` (field is `label` in PublicNavItem, not `name`).

**Step 2: Add focus trap with useEffect**

When `isOpen` is true, trap focus inside the menu panel. Add an effect that:

1. Collects all focusable elements inside the panel ref
2. Listens for Tab/Shift+Tab to cycle within them
3. On Escape, calls `onClose`

```javascript
const panelRef = useRef(null)

useEffect(() => {
  if (!isOpen) return
  const panel = panelRef.current
  if (!panel) return
  const focusable = panel.querySelectorAll(
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  first?.focus()

  const handleKey = e => {
    if (e.key === 'Escape') {
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }
  document.addEventListener('keydown', handleKey)
  return () => document.removeEventListener('keydown', handleKey)
}, [isOpen, onClose])
```

**Step 3: Add ARIA attributes**

On the menu panel div, add:

```jsx
ref={panelRef}
role="dialog"
aria-modal="true"
aria-label="Navigation menu"
```

**Step 4: Run lint + TypeScript**

```bash
npm run lint
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/components/layout/MobileMenu.jsx
git commit -m "fix(nav): use publicNavLinks in MobileMenu, add focus trap and aria-modal"
```

---

## Phase 3: Component Overhaul (checklist.design)

### Task 5: Input — add error state, helper text, label association

**Files:**

- Modify: `src/components/ui/Input.tsx`

**Checklist gaps:** No error state, no helper text, Input doesn't know about its label (no `aria-describedby` for error/hint).

**Step 1: Expand InputProps**

```typescript
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
  hint?: string
}
```

**Step 2: Update the component**

```typescript
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, hint, id, ...props }, ref) => {
    const hintId = hint && id ? `${id}-hint` : undefined
    const errorId = error && id ? `${id}-error` : undefined
    const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

    return (
      <div className="flex flex-col gap-1.5">
        <input
          id={id}
          type={type}
          className={cn(
            'flex h-11 w-full rounded-full border bg-white/70 backdrop-blur-sm',
            'px-5 py-2 text-sm text-charcoal-900 placeholder:text-charcoal-400',
            'transition-all duration-300',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error
              ? 'border-rose-400 focus-visible:ring-rose-400'
              : 'border-gold-200/60 focus-visible:ring-gold-500',
            className
          )}
          aria-describedby={describedBy}
          aria-invalid={error ? 'true' : undefined}
          ref={ref}
          {...props}
        />
        {hint && !error && (
          <p id={hintId} className="px-2 text-xs text-charcoal-500">{hint}</p>
        )}
        {error && (
          <p id={errorId} role="alert" className="px-2 text-xs text-rose-500">{error}</p>
        )}
      </div>
    )
  }
)
```

**Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/components/ui/Input.tsx
git commit -m "feat(input): add error state, hint text, and aria-describedby"
```

---

### Task 6: Textarea — same error/hint treatment as Input

**Files:**

- Modify: `src/components/ui/Textarea.tsx`

**Step 1: Read current Textarea.tsx**

Verify the current props interface and className pattern.

**Step 2: Apply same error/hint pattern as Task 5**

Add `error?: string` and `hint?: string` to `TextareaProps`. Wrap in a `div`, add `aria-describedby`, `aria-invalid`, error/hint paragraphs with matching styles (`rounded-xl` for border since textareas aren't pill-shaped).

**Step 3: Commit**

```bash
git add src/components/ui/Textarea.tsx
git commit -m "feat(textarea): add error state and hint text matching Input pattern"
```

---

### Task 7: Button — add explicit focus-visible ring

**Files:**

- Modify: `src/components/ui/Button.tsx`

**Checklist gap:** The CVA base classes don't include `focus-visible:ring-*`. Keyboard users won't see a focus indicator.

**Step 1: Add focus ring to the CVA base string**

In `buttonVariants`, the base string currently ends at `whitespace-normal break-words`. Append:

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2
```

**Step 2: Verify the `shimmer` variant doesn't conflict**

The shimmer variant's ring will use gold-500, which is fine.

**Step 3: Commit**

```bash
git add src/components/ui/Button.tsx
git commit -m "fix(button): add focus-visible ring for keyboard accessibility"
```

---

### Task 8: Card — add interactive focus variant

**Files:**

- Modify: `src/components/ui/Card.tsx`

**Checklist gap:** Interactive cards (clickable) need hover + focus-visible states. `GlassCard` has hover but no focus ring.

**Step 1: Add `interactive` prop to Card and GlassCard**

```typescript
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }
>(({ className, interactive, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-2xl bg-cream-100 text-charcoal-900 shadow-soft',
      'transition-all duration-500 ease-out',
      interactive && [
        'cursor-pointer',
        'hover:-translate-y-0.5 hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2',
      ],
      className
    )}
    tabIndex={interactive ? 0 : undefined}
    role={interactive ? 'button' : undefined}
    {...props}
  />
))
```

Apply same `interactive` prop to `GlassCard` and `MemoryCard`.

**Step 2: Commit**

```bash
git add src/components/ui/Card.tsx
git commit -m "feat(card): add interactive focus-visible state for clickable cards"
```

---

### Task 9: Header — add aria-current to nav links

**Files:**

- Modify: `src/components/layout/Header.tsx`

**Checklist gap:** Active nav links should have `aria-current="page"` for screen readers.

**Step 1: Update HeaderLink**

The `HeaderLink` component already receives `isActive`. Add `aria-current`:

```tsx
<Link
  to={path}
  aria-current={isActive ? 'page' : undefined}
  ...
>
```

**Step 2: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "fix(header): add aria-current=page for active nav links"
```

---

### Task 10: Toast — align container to ARIA live region

**Files:**

- Modify: `src/components/notifications/Toast.tsx`

**Checklist gap:** The `ToastContainer` div doesn't have `aria-live` on it. Individual toasts have `role="alert"` but the container itself has no live region announcement for the list.

**Step 1: Add aria-live to ToastContainer**

```tsx
export const ToastContainer: React.FC = () => {
  const { toasts } = useUIStore()
  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
      role="region"
    >
```

**Step 2: Commit**

```bash
git add src/components/notifications/Toast.tsx
git commit -m "fix(toast): add aria-live region to notification container"
```

---

### Task 11: Admin panels — add empty states and error boundaries

**Files:**

- Modify: `src/components/admin/MediaReviewPanel.tsx`
- Modify: `src/components/admin/AlbumOrganizer.tsx`

**Checklist gaps:**

1. No visible "no results" empty state UI
2. No error boundary wrapping the panels
3. Loading states should use `Skeleton` components from `src/components/ui/Skeleton.tsx`

**Step 1: Read MediaReviewPanel.tsx and AlbumOrganizer.tsx**

Before modifying (77KB and 36KB respectively — read the relevant sections for loading/empty state rendering).

**Step 2: Add EmptyState component inline**

```tsx
function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className='flex flex-col items-center gap-3 py-16 text-center text-charcoal-500'>
      <Icon className='h-12 w-12 opacity-30' />
      <p className='font-medium text-charcoal-700'>{title}</p>
      <p className='text-sm'>{description}</p>
    </div>
  )
}
```

**Step 3: Replace ad-hoc loading divs with `GallerySkeleton` / `ListSkeleton`**

Search for any `isLoading && <div>Loading...` patterns and replace with appropriate Skeleton from `src/components/ui/Skeleton.tsx`.

**Step 4: Wrap panel root with RouteErrorBoundary from `src/components/error/ErrorBoundary`**

**Step 5: Commit**

```bash
git add src/components/admin/MediaReviewPanel.tsx src/components/admin/AlbumOrganizer.tsx
git commit -m "feat(admin): add empty states, skeleton loading, and error boundaries"
```

---

### Task 12: Run full verification after Phase 3

**Step 1: TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 2: Lint**

```bash
npm run lint
```

Expected: 0 errors.

**Step 3: E2E tests**

```bash
npx playwright test
```

Expected: All 9 specs pass.

**Step 4: Visual spot-check**
Start dev server (`npm run dev`), use `preview_screenshot` on Home, Gallery, Guestbook, and Admin pages to confirm no visual regressions.

---

## Phase 4: New Features

### Task 13: Create wedding config file

**Files:**

- Create: `src/config/weddingConfig.ts`

**Step 1: Create the config**

```typescript
export const WEDDING_CONFIG = {
  /** ISO date string of the wedding day */
  weddingDate: '2025-09-27T15:00:00', // Update to actual date/time
  coupleNames: { person1: 'Abby', person2: 'Jake' },
  /** Days before anniversary to flip countdown to "countdown to" mode */
  anniversaryCountdownWindowDays: 30,
} as const
```

> **Note:** Update `weddingDate` to the actual wedding date and time before committing.

**Step 2: Commit**

```bash
git add src/config/weddingConfig.ts
git commit -m "chore: add weddingConfig with wedding date and couple names"
```

---

### Task 14: Anniversary Countdown section

**Files:**

- Create: `src/components/sections/AnniversaryCountdown.tsx`
- Modify: `src/pages/Home.tsx`

**Step 1: Create the component**

```typescript
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { WEDDING_CONFIG } from '@/config/weddingConfig'
import { cn } from '@/lib/utils'

interface TimeUnit {
  value: number
  label: string
}

function getElapsedTime(weddingDate: Date): TimeUnit[] {
  const now = new Date()
  const diffMs = now.getTime() - weddingDate.getTime()
  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const years = Math.floor(totalDays / 365)
  const months = Math.floor((totalDays % 365) / 30)
  const days = totalDays % 30
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)
  return [
    { value: years, label: years === 1 ? 'Year' : 'Years' },
    { value: months, label: months === 1 ? 'Month' : 'Months' },
    { value: days, label: days === 1 ? 'Day' : 'Days' },
    { value: hours, label: 'Hours' },
    { value: minutes, label: 'Minutes' },
    { value: seconds, label: 'Seconds' },
  ]
}

function getNextAnniversary(weddingDate: Date): Date {
  const now = new Date()
  const nextAnniversary = new Date(weddingDate)
  nextAnniversary.setFullYear(now.getFullYear())
  if (nextAnniversary < now) {
    nextAnniversary.setFullYear(now.getFullYear() + 1)
  }
  return nextAnniversary
}

function getCountdownToAnniversary(anniversary: Date): TimeUnit[] {
  const now = new Date()
  const diffMs = anniversary.getTime() - now.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)
  return [
    { value: days, label: days === 1 ? 'Day' : 'Days' },
    { value: hours, label: 'Hours' },
    { value: minutes, label: 'Minutes' },
    { value: seconds, label: 'Seconds' },
  ]
}

export function AnniversaryCountdown() {
  const weddingDate = new Date(WEDDING_CONFIG.weddingDate)
  const nextAnniversary = getNextAnniversary(weddingDate)
  const daysUntilAnniversary = Math.floor(
    (nextAnniversary.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  const showCountdown = daysUntilAnniversary <= WEDDING_CONFIG.anniversaryCountdownWindowDays

  const [units, setUnits] = useState<TimeUnit[]>(
    showCountdown ? getCountdownToAnniversary(nextAnniversary) : getElapsedTime(weddingDate)
  )

  useEffect(() => {
    const id = setInterval(() => {
      setUnits(
        showCountdown ? getCountdownToAnniversary(nextAnniversary) : getElapsedTime(weddingDate)
      )
    }, 1000)
    return () => clearInterval(id)
  }, [showCountdown, nextAnniversary, weddingDate])

  return (
    <section
      aria-label={showCountdown ? 'Countdown to anniversary' : 'Time since the wedding'}
      className="py-16 px-4 text-center bg-gradient-to-b from-cream-50 to-cream-100"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7 }}
      >
        <p className="font-script text-3xl text-gold-500 mb-2">
          {showCountdown ? 'Next Anniversary In' : 'Happily Married For'}
        </p>
        <div
          className="flex flex-wrap justify-center gap-6 mt-6"
          role="timer"
          aria-live="polite"
          aria-atomic="true"
          aria-label={units.map(u => `${u.value} ${u.label}`).join(', ')}
        >
          {units.map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center gap-1 min-w-[4rem]">
              <span className="font-display text-4xl sm:text-5xl text-charcoal-900 tabular-nums">
                {String(value).padStart(2, '0')}
              </span>
              <span className="text-xs uppercase tracking-[0.18em] text-charcoal-500">
                {label}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
```

**Step 2: Add to Home.tsx**

In `src/pages/Home.tsx`, after the `<LoveTimeline />` line:

```tsx
import { AnniversaryCountdown } from '@/components/sections/AnniversaryCountdown'

// In JSX, after <LoveTimeline />:
;<AnniversaryCountdown />
```

**Step 3: TypeScript + lint**

```bash
npx tsc --noEmit && npm run lint
```

**Step 4: Visual check**

Start dev server, take `preview_screenshot` of Home page bottom section.

**Step 5: Commit**

```bash
git add src/components/sections/AnniversaryCountdown.tsx src/pages/Home.tsx
git commit -m "feat: add anniversary countdown section to home page"
```

---

### Task 15: Guest Highlight Reel section

**Files:**

- Create: `src/components/sections/GuestHighlightReel.tsx`
- Modify: `src/pages/Home.tsx`

**Step 1: Read existing Supabase photo query patterns**

Read `src/lib/supabase.ts` for the `Photo` type and existing query helpers to reuse.

**Step 2: Create the component**

This component fetches top 6 approved photos and 3 guestbook entries, renders them as a mosaic + rotating quote.

```typescript
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { getMediaPath } from '@/utils/media'
import { GlassCard } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils'

interface HighlightPhoto {
  id: string
  storage_path: string
  aspect_ratio: number
}

interface GuestMessage {
  id: string
  author_name: string
  message: string
}

export function GuestHighlightReel() {
  const [photos, setPhotos] = useState<HighlightPhoto[]>([])
  const [messages, setMessages] = useState<GuestMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [activeMessage, setActiveMessage] = useState(0)

  useEffect(() => {
    async function load() {
      const [photosRes, messagesRes] = await Promise.all([
        supabase
          .from('photos')
          .select('id, storage_path, aspect_ratio')
          .eq('status', 'approved')
          .order('likes', { ascending: false })
          .limit(6),
        supabase
          .from('guestbook_entries')
          .select('id, author_name, message')
          .eq('is_approved', true)
          .order('created_at', { ascending: false })
          .limit(3),
      ])
      if (photosRes.data) setPhotos(photosRes.data)
      if (messagesRes.data) setMessages(messagesRes.data)
      setLoading(false)
    }
    load()
  }, [])

  // Rotate messages every 5 seconds
  useEffect(() => {
    if (messages.length < 2) return
    const id = setInterval(
      () => setActiveMessage(m => (m + 1) % messages.length),
      5000
    )
    return () => clearInterval(id)
  }, [messages.length])

  if (loading) {
    return (
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <Skeleton className="h-8 w-64 mx-auto mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (photos.length === 0 && messages.length === 0) return null

  return (
    <section
      aria-label="Memories from our guests"
      className="py-16 px-4 bg-cream-50"
    >
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7 }}
          className="text-center mb-10"
        >
          <p className="font-script text-3xl text-gold-500 mb-2">Memories from Our Guests</p>
          <p className="text-sm text-charcoal-500 tracking-wide">
            Thank you for celebrating with us
          </p>
        </motion.div>

        {photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-10">
            {photos.map((photo, i) => (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{ delay: i * 0.06, duration: 0.5 }}
                className="overflow-hidden rounded-xl aspect-square"
              >
                <img
                  src={getMediaPath(photo.storage_path)}
                  alt="Guest photo"
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  loading="lazy"
                />
              </motion.div>
            ))}
          </div>
        )}

        {messages.length > 0 && (
          <div className="relative h-28 flex items-center justify-center" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeMessage}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.5 }}
                className="text-center max-w-xl mx-auto px-4"
              >
                <p className="font-display text-lg text-charcoal-700 italic">
                  "{messages[activeMessage].message}"
                </p>
                <p className="mt-2 text-sm text-charcoal-500 tracking-wide">
                  — {messages[activeMessage].author_name}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  )
}
```

**Step 3: Add to Home.tsx**

After `<AnniversaryCountdown />`:

```tsx
import { GuestHighlightReel } from '@/components/sections/GuestHighlightReel'

// In JSX:
;<GuestHighlightReel />
```

**Step 4: TypeScript + lint**

```bash
npx tsc --noEmit && npm run lint
```

**Step 5: Commit**

```bash
git add src/components/sections/GuestHighlightReel.tsx src/pages/Home.tsx
git commit -m "feat: add guest highlight reel section to home page"
```

---

### Task 16: Install JSZip for download packs

**Files:**

- Modify: `package.json` (via npm install)

**Step 1: Install**

```bash
npm install jszip
npm install --save-dev @types/jszip
```

**Step 2: Verify it's in package.json dependencies**

```bash
grep jszip package.json
```

Expected: `"jszip": "^X.X.X"` appears under `dependencies`.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add jszip for download pack feature"
```

---

### Task 17: Netlify Function — download-pack

**Files:**

- Create: `netlify/functions/download-pack.ts`

**Step 1: Create netlify/functions directory if needed**

```bash
ls netlify/functions 2>/dev/null || mkdir -p netlify/functions
```

**Step 2: Create the function**

```typescript
import type { Handler, HandlerEvent } from '@netlify/functions'
import JSZip from 'jszip'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  let photoIds: string[]
  try {
    const body = JSON.parse(event.body ?? '{}')
    photoIds = body.photoIds
    if (!Array.isArray(photoIds) || photoIds.length === 0 || photoIds.length > 50) {
      throw new Error('Invalid photoIds')
    }
  } catch {
    return { statusCode: 400, body: 'Bad Request: photoIds must be an array of 1–50 IDs' }
  }

  // Fetch approved photos only
  const { data: photos, error } = await supabase
    .from('photos')
    .select('id, storage_path, original_filename')
    .in('id', photoIds)
    .eq('status', 'approved')

  if (error || !photos || photos.length === 0) {
    return { statusCode: 404, body: 'No approved photos found' }
  }

  const zip = new JSZip()

  await Promise.all(
    photos.map(async photo => {
      const { data: signedUrl } = await supabase.storage
        .from('photos')
        .createSignedUrl(photo.storage_path, 60)

      if (!signedUrl?.signedUrl) return

      const res = await fetch(signedUrl.signedUrl)
      if (!res.ok) return
      const buffer = await res.arrayBuffer()
      const filename = photo.original_filename ?? `photo-${photo.id}.jpg`
      zip.file(filename, buffer)
    })
  )

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="theporadas-photos.zip"',
    },
    body: zipBuffer.toString('base64'),
    isBase64Encoded: true,
  }
}
```

**Step 3: Check netlify.toml for functions path**

```bash
cat netlify.toml | grep functions
```

Ensure `functions = "netlify/functions"` is set. If not, add it.

**Step 4: Commit**

```bash
git add netlify/functions/download-pack.ts netlify.toml
git commit -m "feat: add download-pack Netlify function for photo zip downloads"
```

---

### Task 18: Gallery — multi-select UI for download/share

**Files:**

- Modify: `src/pages/Gallery.tsx`

**Step 1: Add select mode state**

```typescript
const [selectMode, setSelectMode] = useState(false)
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
```

**Step 2: Add select mode toggle button**

In the Gallery toolbar (near the search/filter controls), add:

```tsx
<Button
  variant={selectMode ? 'primary' : 'secondary'}
  size='sm'
  onClick={() => {
    setSelectMode(v => !v)
    setSelectedIds(new Set())
  }}
  ariaLabel={selectMode ? 'Exit select mode' : 'Select photos to download'}
>
  {selectMode ? 'Cancel' : 'Select'}
</Button>
```

**Step 3: Show download button when photos selected**

```tsx
{
  selectMode && selectedIds.size > 0 && (
    <Button
      variant='primary'
      size='sm'
      isLoading={downloading}
      onClick={handleDownload}
      ariaLabel={`Download ${selectedIds.size} selected photo${selectedIds.size > 1 ? 's' : ''}`}
    >
      Download ({selectedIds.size})
    </Button>
  )
}
```

**Step 4: Implement handleDownload**

```typescript
const [downloading, setDownloading] = useState(false)

const handleDownload = async () => {
  setDownloading(true)
  try {
    const res = await fetch('/.netlify/functions/download-pack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoIds: Array.from(selectedIds) }),
    })
    if (!res.ok) throw new Error('Download failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'theporadas-photos.zip'
    a.click()
    URL.revokeObjectURL(url)
    setSelectMode(false)
    setSelectedIds(new Set())
  } catch {
    toast({ type: 'error', title: 'Download failed', message: 'Please try again.' })
  } finally {
    setDownloading(false)
  }
}
```

**Step 5: Pass selectMode into PhotoGrid**

The `PhotoGrid` component will need `selectMode`, `selectedIds`, and `onToggleSelect` props. Read `src/components/gallery/PhotoGrid.tsx` to understand its current props interface, then add selection checkboxes overlay on each photo when in select mode.

**Step 6: Add share URL support**

Gallery already uses `useSearchParams`. Add:

```typescript
const [searchParams] = useSearchParams()
const sharePhotoId = searchParams.get('share')

useEffect(() => {
  if (sharePhotoId) {
    // Find and open the lightbox for this photo
    const photo = photos.find(p => p.id === sharePhotoId)
    if (photo) setLightboxPhoto(photo)
  }
}, [sharePhotoId, photos])
```

In `GallerySEO` or the page's `<head>`, pass the shared photo's URL for dynamic OG tags.

**Step 7: TypeScript + lint**

```bash
npx tsc --noEmit && npm run lint
```

**Step 8: Commit**

```bash
git add src/pages/Gallery.tsx src/components/gallery/PhotoGrid.tsx
git commit -m "feat(gallery): add multi-select download packs and share URL support"
```

---

## Final Verification

**Step 1: TypeScript**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

**Step 2: Lint**

```bash
npm run lint
```

Expected: 0 errors.

**Step 3: E2E tests**

```bash
npx playwright test
```

Expected: All 9 specs pass.

**Step 4: Visual review**
Start the dev server and take screenshots:

- Home page — verify anniversary countdown and highlight reel render
- Gallery — verify select mode UI, download button
- Admin — verify empty states and skeleton loading

**Step 5: Accessibility spot-check**
Run Lighthouse accessibility audit on `/`, `/gallery`, `/guestbook`.
Expected: Score ≥ 90.

---

## Notes

- **`src/components/admin/MediaReviewPanel.tsx`** is 77KB — read it in chunks, looking specifically for loading spinner divs and empty-result conditions before editing.
- **`src/components/gallery/PhotoGrid.tsx`** needs to be read before Task 18 — it may already have a checkbox/selection pattern or the photo card click handler will need modification.
- **Supabase column names:** The `photos` table fields referenced (`storage_path`, `status`, `likes`, `aspect_ratio`, `original_filename`) should be verified against `src/types/supabase.generated.ts` before writing queries.
- **MobileMenu.jsx** is currently `.jsx` not `.tsx` — keep it as JSX to avoid a large type-migration scope creep.
