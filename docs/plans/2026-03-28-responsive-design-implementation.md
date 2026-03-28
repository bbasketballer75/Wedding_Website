# Responsive Design Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make every guest-facing page adapt visually to all viewport sizes and orientations — portrait phone, landscape phone, iPad portrait/landscape, desktop, and ultrawide.

**Architecture:** Purely Tailwind class edits in existing files. No new components. Uses the standard `sm:`/`md:`/`lg:`/`xl:`/`2xl:` breakpoint ladder plus Tailwind's built-in `portrait:` and `landscape:` variants (available in Tailwind CSS v4 out of the box). MasonryGrid gets a JS-responsive column fix since it already uses inline JS column distribution.

**Tech Stack:** React 19, TypeScript 5.9, Tailwind CSS 4, Framer Motion

---

## Breakpoint Reference

| Prefix | Min-width | Target |
|--------|-----------|--------|
| *(base)* | 0px | Portrait phone (320–479px) |
| `sm:` | 640px | Large phone / landscape phone |
| `md:` | 768px | Tablet portrait |
| `lg:` | 1024px | Tablet landscape / small desktop |
| `xl:` | 1280px | Desktop |
| `2xl:` | 1536px | Large desktop |

---

## Task 1: MasonryGrid — Make columns responsive

The `MasonryGrid` component distributes children across columns using pure JavaScript. Currently it only reads `columns.lg` (defaults to 4), ignoring all other breakpoints. This makes the gallery single-column on mobile at `columns.base || 4` — wrong on every viewport except desktop.

**Files:**
- Modify: `src/components/MasonryGrid.tsx`
- Modify: `src/components/gallery/PhotoGrid.tsx` (wherever it calls `<MasonryGrid columns={...}>`)

---

### Step 1: Read PhotoGrid to confirm how it calls MasonryGrid

```bash
grep -n "MasonryGrid\|columns" src/components/gallery/PhotoGrid.tsx
```

Note the exact `columns` prop value currently passed.

### Step 2: Update MasonryGrid to be breakpoint-aware

Replace the entire `MasonryGrid.tsx` with this responsive implementation:

```tsx
import React, { useEffect, useState } from 'react'

interface MasonryGridProps {
  columns: {
    base?: number
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
  children: React.ReactNode
}

function getColumnCount(columns: MasonryGridProps['columns']): number {
  const w = window.innerWidth
  if (w >= 1280 && columns.xl != null) return columns.xl
  if (w >= 1024 && columns.lg != null) return columns.lg
  if (w >= 768 && columns.md != null) return columns.md
  if (w >= 640 && columns.sm != null) return columns.sm
  return columns.base ?? 1
}

const MasonryGrid: React.FC<MasonryGridProps> = ({ columns, children }) => {
  const [columnCount, setColumnCount] = useState(() => getColumnCount(columns))

  useEffect(() => {
    const update = () => setColumnCount(getColumnCount(columns))
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [columns])

  const childrenArray = React.Children.toArray(children)

  return (
    <div className="flex gap-2">
      {Array.from({ length: columnCount }).map((_, colIndex) => (
        <div key={colIndex} className="flex flex-1 flex-col gap-2">
          {childrenArray.filter((_, i) => i % columnCount === colIndex)}
        </div>
      ))}
    </div>
  )
}

export default MasonryGrid
```

### Step 3: Update PhotoGrid to pass all column breakpoints

Find where `PhotoGrid` calls `<MasonryGrid>` and update the `columns` prop:

```tsx
// Before (whatever it currently passes):
<MasonryGrid columns={{ lg: 4 }}>

// After:
<MasonryGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }}>
```

### Step 4: Verify TypeScript is clean

```bash
cd C:/Users/bbask/Coding_Projects/Wedding_Website_Clean && npx tsc --noEmit
```
Expected: no output

### Step 5: Verify in browser at multiple widths

Open `http://localhost:5173/gallery` and resize browser:
- 390px wide → 1 column
- 640px wide → 2 columns
- 768px wide → 3 columns
- 1024px+ → 4 columns

### Step 6: Commit

```bash
git add src/components/MasonryGrid.tsx src/components/gallery/PhotoGrid.tsx
git commit -m "fix(gallery): make MasonryGrid responsive across all breakpoints"
```

---

## Task 2: Gallery — Fix control bar for tablet

The gallery control bar (filter chips + view mode toggle) uses `xl:grid-cols-[minmax(0,1fr)_auto]` — so filters and view toggle only go side-by-side at 1280px. On tablets (768–1279px) filters stack above the toggle. Move the layout trigger to `md:`.

**Files:**
- Modify: `src/pages/Gallery.tsx` (~line 972)

---

### Step 1: Update the control bar grid

**Before:**
```tsx
<div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
```

**After:**
```tsx
<div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
```

### Step 2: Verify TypeScript is clean

```bash
npx tsc --noEmit
```

### Step 3: Check in browser at 768px

Resize to iPad portrait width — filter pills and view toggle should be side-by-side.

### Step 4: Commit

```bash
git add src/pages/Gallery.tsx
git commit -m "fix(gallery): show filter bar and view toggle side-by-side from md: breakpoint"
```

---

## Task 3: Guestbook — Move sidebar and feed grid from 2xl: to xl:

The guestbook sidebar and two-column feed only appear at 1536px+. Standard desktops (1280–1535px) get the single-column mobile layout. Move all `2xl:` layout triggers to `xl:`.

**Files:**
- Modify: `src/pages/Guestbook.tsx`

---

### Step 1: Move main content grid trigger

**Before:**
```tsx
<div className="mx-auto grid max-w-6xl gap-6 2xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] 2xl:items-start">
```

**After:**
```tsx
<div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] xl:items-start">
```

### Step 2: Move sidebar sticky trigger

**Before:**
```tsx
<div className="grid gap-4 2xl:sticky 2xl:top-28">
```

**After:**
```tsx
<div className="grid gap-4 xl:sticky xl:top-28">
```

### Step 3: Move feed header flex trigger

**Before:**
```tsx
<div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
```

**After:**
```tsx
<div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
```

### Step 4: Find and move any remaining 2xl: layout triggers in Guestbook.tsx

Search for all 2xl: occurrences in the file:
```bash
grep -n "2xl:" src/pages/Guestbook.tsx
```

For any `2xl:grid-cols-2` used on the message feed, change to `xl:grid-cols-2`. Skip any `2xl:` classes that control sizing (padding, text) rather than layout — those can stay.

### Step 5: Verify TypeScript is clean

```bash
npx tsc --noEmit
```

### Step 6: Check at 1280px wide

Open `/guestbook` at 1280px — sidebar should be visible on the left, feed on the right.

### Step 7: Commit

```bash
git add src/pages/Guestbook.tsx
git commit -m "fix(guestbook): show sidebar and two-column feed at xl: (1280px) instead of 2xl:"
```

---

## Task 4: Upload — Move sidebar and form grid from 2xl: to xl:

Same issue as Guestbook: the share panel sidebar only appears at 1536px+. Move to 1280px.

**Files:**
- Modify: `src/pages/Upload.tsx`

---

### Step 1: Move main form grid trigger

**Before:**
```tsx
<form onSubmit={handleSubmit} className="mt-8 grid gap-8 2xl:grid-cols-[minmax(0,1fr)_23rem]">
```

**After:**
```tsx
<form onSubmit={handleSubmit} className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_23rem]">
```

### Step 2: Move sidebar sticky trigger

**Before:**
```tsx
<div className="grid gap-6 2xl:sticky 2xl:top-28 2xl:self-start">
```

**After:**
```tsx
<div className="grid gap-6 xl:sticky xl:top-28 xl:self-start">
```

### Step 3: Find and move any remaining 2xl: layout triggers in Upload.tsx

```bash
grep -n "2xl:" src/pages/Upload.tsx
```

Change any remaining layout-related `2xl:` to `xl:`. Leave sizing `2xl:` alone.

### Step 4: Verify TypeScript is clean

```bash
npx tsc --noEmit
```

### Step 5: Check at 1280px wide

Open `/upload` at 1280px — share panel should appear to the right of the form.

### Step 6: Commit

```bash
git add src/pages/Upload.tsx
git commit -m "fix(upload): show share panel sidebar at xl: (1280px) instead of 2xl:"
```

---

## Task 5: Footer — Fix 3-card grid on small phones

The footer's 3-card navigation grid (`grid-cols-3`) squishes badly on phones under 400px wide. Add a base single-column layout that switches to 3 columns at `sm:`.

**Files:**
- Modify: `src/components/layout/Footer.tsx` (~line 61)

---

### Step 1: Find the footer links grid

```bash
grep -n "grid-cols-3" src/components/layout/Footer.tsx
```

### Step 2: Update the grid

**Before:**
```tsx
<div className="grid grid-cols-3 gap-2">
```

**After:**
```tsx
<div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-2">
```

### Step 3: Verify TypeScript is clean

```bash
npx tsc --noEmit
```

### Step 4: Check at 375px wide

Footer cards should stack vertically. At 640px+ they should show side-by-side.

### Step 5: Commit

```bash
git add src/components/layout/Footer.tsx
git commit -m "fix(footer): stack 3-card grid on small phones, side-by-side at sm:"
```

---

## Task 6: Film — Add tablet breakpoint to chapter guide grid

The chapter guide grid currently goes `grid-cols-2 → sm:grid-cols-3 → lg:grid-cols-5` with no `md:` stop. At tablet (768px) it shows 3 columns — fine, but the jump from 3 to 5 at 1024px is abrupt. Add `md:grid-cols-4` as a midpoint. Also fix base to single column so portrait phones get a proper 1-column list before jumping to 2.

**Files:**
- Modify: `src/pages/Film.tsx` (~line 771)

---

### Step 1: Update chapter guide grid

**Before:**
```tsx
<div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
```

**After:**
```tsx
<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
```

Note: `sm:grid-cols-2` (not 3) keeps cards from being too narrow on landscape phones. `md:grid-cols-3` fills tablets nicely. `lg:grid-cols-5` remains for desktop.

### Step 2: Verify TypeScript is clean

```bash
npx tsc --noEmit
```

### Step 3: Check at 390px, 768px, 1024px

- 390px: 1 column of chapter cards
- 768px: 3 columns
- 1024px: 5 columns

### Step 4: Commit

```bash
git add src/pages/Film.tsx
git commit -m "fix(film): add md: breakpoint to chapter guide grid, fix base to 1 column"
```

---

## Task 7: Film — Family film modal portrait orientation nudge

The `FamilyFilmModal` component detects portrait phone orientation via JS `matchMedia` and pauses the video when portrait. This is correct for media control. However the visual treatment (whatever overlay is shown) should be a lightweight CSS nudge, not a full-screen blur.

**Files:**
- Modify: `src/pages/Film.tsx` (the `FamilyFilmModal` component — the grid layout and portrait overlay JSX)

---

### Step 1: Find the portrait overlay JSX in FamilyFilmModal

Search for where `shouldRequireLandscape` or `isPhonePortrait` is used in JSX:
```bash
grep -n "shouldRequireLandscape\|isPhonePortrait" src/pages/Film.tsx
```

Note what JSX renders when `shouldRequireLandscape` is true.

### Step 2: If there's a full-screen blur/overlay, replace it

If the current code renders something like a full overlay with blur when `shouldRequireLandscape`:

**Replace with an inline nudge banner inside the modal:**
```tsx
{shouldRequireLandscape && (
  <div className="flex items-center justify-center gap-3 rounded-xl bg-white/8 px-4 py-3 text-sm text-white/70">
    <RotateCcw className="h-4 w-4 shrink-0 text-gold-400" />
    Rotate your phone for the best view
  </div>
)}
```

Add `RotateCcw` to the lucide-react import at the top of Film.tsx.

Place this nudge banner just above or below the video element inside the modal — not as a full-screen overlay.

### Step 3: Update the modal's inner grid layout

The family film modal grid is `lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]`. On tablet (md:), add a simpler two-column layout:

**Before:**
```tsx
<div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
```

**After:**
```tsx
<div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_16rem] lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
```

### Step 4: Verify TypeScript is clean

```bash
npx tsc --noEmit
```

### Step 5: Commit

```bash
git add src/pages/Film.tsx
git commit -m "fix(film): replace portrait overlay with inline nudge, add md: grid to film modal"
```

---

## Task 8: Gallery — Lightbox landscape phone layout

On landscape phones (844×390px), the `PhotoLightbox` info panel slides up from the bottom (`fixed inset-x-0 bottom-0`). On a small landscape phone this covers too much of the image. Add a `landscape:` class to collapse the panel height when in landscape on small screens.

**Files:**
- Modify: `src/components/photo-viewer/PhotoLightbox.tsx`

---

### Step 1: Find the info panel container

The current info panel class string is:
```tsx
className="fixed inset-x-0 bottom-0 z-20 flex h-[min(72vh,34rem)] flex-col rounded-t-[1.5rem] border-t border-charcoal-800 bg-charcoal-900 sm:relative sm:inset-auto sm:h-auto sm:w-80 sm:rounded-none sm:border-l sm:border-t-0"
```

### Step 2: Reduce panel height in landscape on small screens

**Before:**
```tsx
className="fixed inset-x-0 bottom-0 z-20 flex h-[min(72vh,34rem)] flex-col rounded-t-[1.5rem] border-t border-charcoal-800 bg-charcoal-900 sm:relative sm:inset-auto sm:h-auto sm:w-80 sm:rounded-none sm:border-l sm:border-t-0"
```

**After:**
```tsx
className="fixed inset-x-0 bottom-0 z-20 flex h-[min(72vh,34rem)] flex-col rounded-t-[1.5rem] border-t border-charcoal-800 bg-charcoal-900 landscape:h-[min(55vh,28rem)] sm:relative sm:inset-auto sm:h-auto sm:w-80 sm:rounded-none sm:border-l sm:border-t-0 sm:landscape:h-auto"
```

The `landscape:h-[min(55vh,28rem)]` reduces the panel height on any landscape phone. The `sm:landscape:h-auto` resets it back to auto at larger sizes where the panel is already side-mounted.

### Step 3: Verify TypeScript is clean

```bash
npx tsc --noEmit
```

### Step 4: Test in browser at 844×390 (iPhone landscape)

Open `/gallery`, click a photo, rotate to landscape (or resize browser to 844×390). The info panel should take less vertical space, showing more of the image.

### Step 5: Commit

```bash
git add src/components/photo-viewer/PhotoLightbox.tsx
git commit -m "fix(lightbox): reduce info panel height on landscape phones"
```

---

## Task 9: Home — Large screen text caps

The Home hero text has no upper size limit on `2xl:` screens (1536px+). Add caps so it doesn't blow up on large monitors.

**Files:**
- Modify: `src/pages/Home.tsx`

---

### Step 1: Find the hero headline text classes

```bash
grep -n "text-5xl\|text-6xl\|text-7xl\|text-8xl" src/pages/Home.tsx | head -20
```

### Step 2: Add 2xl: size cap to the largest headline

For any headline that scales to `text-7xl` or `text-8xl`, add a `2xl:` cap one size below the maximum:

Pattern — if a headline is `text-5xl sm:text-6xl lg:text-7xl`, cap it at `2xl:text-7xl` (already capped, fine). If it goes `text-7xl lg:text-8xl` with no 2xl cap, add `2xl:text-8xl` or keep `lg:text-8xl` as the ceiling — no change needed since `lg:` already stops it.

The main change: ensure the hero section has `max-w-7xl mx-auto` on its content container so text doesn't span the full viewport on ultrawide screens. Find the hero container div and confirm or add this constraint.

### Step 3: Verify TypeScript is clean

```bash
npx tsc --noEmit
```

### Step 4: Commit

```bash
git add src/pages/Home.tsx
git commit -m "fix(home): cap hero text at 2xl: breakpoint for large screens"
```

---

## Task 10: Header — Improve mobile nav scroll feel

On portrait phones the header nav items are too tight. Add `scroll-smooth` and improve the touch scroll padding.

**Files:**
- Modify: `src/components/layout/Header.tsx`

---

### Step 1: Find the nav bar container

Current:
```tsx
<div className="flex w-full items-center gap-1 overflow-x-auto rounded-full border border-gold-300/45 bg-gradient-to-r from-cream-100/92 via-gold-50/92 to-cream-100/92 px-1.5 py-1.5 shadow-[0_18px_40px_-28px_rgba(46,33,13,0.42)] backdrop-blur-xl hide-scrollbar sm:justify-between sm:gap-0 sm:px-2 sm:py-2">
```

### Step 2: Tighten the base gap and add scroll padding

**Before:**
```tsx
<div className="flex w-full items-center gap-1 overflow-x-auto rounded-full border border-gold-300/45 bg-gradient-to-r from-cream-100/92 via-gold-50/92 to-cream-100/92 px-1.5 py-1.5 shadow-[0_18px_40px_-28px_rgba(46,33,13,0.42)] backdrop-blur-xl hide-scrollbar sm:justify-between sm:gap-0 sm:px-2 sm:py-2">
```

**After:**
```tsx
<div className="flex w-full items-center gap-0.5 overflow-x-auto scroll-smooth rounded-full border border-gold-300/45 bg-gradient-to-r from-cream-100/92 via-gold-50/92 to-cream-100/92 px-1 py-1.5 shadow-[0_18px_40px_-28px_rgba(46,33,13,0.42)] backdrop-blur-xl hide-scrollbar sm:justify-between sm:gap-0 sm:px-2 sm:py-2">
```

Changes: `gap-1` → `gap-0.5`, `px-1.5` → `px-1`, added `scroll-smooth`.

### Step 3: Verify TypeScript is clean

```bash
npx tsc --noEmit
```

### Step 4: Commit

```bash
git add src/components/layout/Header.tsx
git commit -m "fix(header): tighten mobile nav gap and add scroll-smooth"
```

---

## Final: Push all commits

```bash
git push origin main
```

---

## Verification Checklist

Test every page at these viewports:

| Viewport | Size | Key checks |
|----------|------|------------|
| iPhone portrait | 390×844 | Gallery 1-col, footer cards stack, chapter guide 1-col, guestbook single-col |
| iPhone landscape | 844×390 | Lightbox panel shorter, film nudge visible, gallery 2-col |
| iPad portrait | 768×1024 | Gallery 3-col, guestbook sidebar visible, control bar inline |
| iPad landscape | 1024×768 | Film chapters 5-col, upload form + sidebar side-by-side |
| Desktop | 1440×900 | Guestbook sidebar + 2-col feed, upload share panel visible |
| Large screen | 1920×1080 | Home hero capped, no content stretching beyond max-w |

```bash
npx tsc --noEmit    # 0 errors
npm run lint        # 0 errors
npm run test:run    # all tests pass
git log --oneline origin/main..HEAD  # empty after push
```
