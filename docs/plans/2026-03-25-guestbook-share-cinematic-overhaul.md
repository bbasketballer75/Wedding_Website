# Guestbook & Share Pages — Cinematic Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Guestbook (`/guestbook`) and Share/Upload (`/upload`) pages from light cream aesthetic to dark cinematic style with glass panels — matching the film CTA and footer visual language.

**Architecture:** Visual-only changes — no logic, state, or data layer touched. Swap background colors, replace `editorial-panel`/`editorial-card` with dark glass equivalents, update all text colors and accent styles in-place. Both pages share the same dark canvas foundation.

**Tech Stack:** React 19, Tailwind CSS 4 custom tokens, Framer Motion, Lucide icons

---

## Shared Design Tokens (memorize these)

```
Page bg:       bg-[linear-gradient(to_b,rgba(12,8,5,1),rgba(22,14,6,1))]
Glass panel:   bg-white/6 backdrop-blur-md border border-gold-200/15 rounded-2xl
Glass card:    bg-white/5 backdrop-blur-sm border border-gold-200/12 rounded-xl
Primary text:  text-white
Secondary:     text-white/55
Muted:         text-white/35
Gold accent:   text-gold-400
Eyebrow:       text-[10px] uppercase tracking-[0.3em] text-gold-400
Divider:       border-white/10
Input bg:      bg-white/8 border-white/12 text-white placeholder:text-white/30
Button row:    glass circle icons (no text labels on small share buttons)
```

---

## Task 1: Guestbook Page — Dark Canvas + Hero

**Files:**
- Modify: `src/pages/Guestbook.tsx`

No test needed — visual change. Verify with screenshot after each task.

**Step 1: Update page wrapper background**

Find the return statement's outermost div (line ~675):
```tsx
// BEFORE
<div className="min-h-screen bg-cream-50 pb-20 pt-28 sm:pt-32">

// AFTER
<div className="min-h-screen bg-[linear-gradient(to_b,rgba(12,8,5,1),rgba(22,14,6,1))] pb-20 pt-28 sm:pt-32">
```

**Step 2: Update hero panel**

Find the hero `<motion.div>` (line ~681) that currently uses `editorial-panel`:
```tsx
// BEFORE
className="editorial-panel overflow-hidden px-6 py-10 sm:px-10 sm:py-14"
// glow blobs: bg-gold-200/30, bg-blush-200/35
// eyebrow-chip
// h1: text-charcoal-900
// p: text-charcoal-600
// note count: text-charcoal-400

// AFTER
className="relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-6 py-10 sm:px-10 sm:py-14"
// glow blobs: bg-gold-500/8 blur-3xl (atmosphere only)
// eyebrow: <span className="text-[10px] uppercase tracking-[0.3em] text-gold-400 flex items-center gap-1.5"><BookHeart className="h-3.5 w-3.5" />After the film</span>
// h1: text-white
// p: text-white/55
// note count: text-white/35
```

**Step 3: Build and take screenshot to verify hero**

Run: `npx tsc --noEmit`
Expected: 0 errors

Take a screenshot of `/guestbook` at 390px wide and 1280px wide.

**Step 4: Commit**

```bash
git add src/pages/Guestbook.tsx
git commit -m "feat: guestbook dark canvas and cinematic hero"
```

---

## Task 2: Guestbook Page — Sidebar Cards

**Files:**
- Modify: `src/pages/Guestbook.tsx`

**Step 1: Update sidebar "Leave a note" card** (line ~712, currently `editorial-card`)

```tsx
// BEFORE
className="editorial-card px-5 py-5"
// text-gold-700 eyebrow, text-charcoal-900 heading, text-charcoal-500 body

// AFTER
className="relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-gold-200/12 px-5 py-5"
// eyebrow: text-[10px] uppercase tracking-[0.3em] text-gold-400
// heading h2: text-white
// body p: text-white/55
// Button variant stays "primary" (no change needed)
```

**Step 2: Update sidebar "Newest note" card** (line ~728)

Same pattern — `editorial-card` → glass card. Update all text colors:
- `text-charcoal-900` → `text-white`
- `text-charcoal-500` → `text-white/55`
- `text-charcoal-600` → `text-white/60`

**Step 3: Update sidebar filter card** (line ~746)

Same glass card class. Update filter button active state:
```tsx
// BEFORE active: 'cinematic-toggle-active'
// BEFORE inactive: 'bg-cream-50 text-charcoal-600 hover:bg-gold-50/80 hover:text-charcoal-800'

// AFTER active: 'bg-gold-500/15 border border-gold-400/30 text-gold-300'
// AFTER inactive: 'bg-white/5 text-white/55 hover:bg-white/10 hover:text-white'
// Both: 'rounded-full px-4 py-2 text-sm transition-all'
```
Count badge color:
- active: `text-white/60`
- inactive: `text-white/30`

**Step 4: TypeScript check + screenshot + commit**

```bash
npx tsc --noEmit
git add src/pages/Guestbook.tsx
git commit -m "feat: guestbook cinematic sidebar cards"
```

---

## Task 3: Guestbook Page — Composer Panel

**Files:**
- Modify: `src/pages/Guestbook.tsx`

**Step 1: Update composer outer wrapper** (line ~775, `data-testid="guestbook-composer"`)

```tsx
// BEFORE
className="editorial-panel px-5 py-5 sm:px-6 sm:py-6 lg:px-8"

// AFTER
className="relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-5 py-5 sm:px-6 sm:py-6 lg:px-8"
```

**Step 2: Update composer success state**

Inside `isSubmitted` branch (line ~778):
- `text-charcoal-900` → `text-white`
- `text-charcoal-600` → `text-white/55`
- Keep `CheckCircle` green ring (unchanged)
- eyebrow-chip → `text-[10px] uppercase tracking-[0.3em] text-gold-400 flex items-center gap-1.5`

**Step 3: Update composer form — heading and close button**

```tsx
// heading: text-charcoal-900 → text-white
// close button:
// BEFORE: border-gold-200/70 bg-cream-50/88 text-charcoal-500
// AFTER:  border-white/15 bg-white/8 text-white/50 hover:text-white hover:bg-white/12
```

**Step 4: Update Label and Input components dark styles**

The `Label` and `Input` components in the composer receive className props. Update their inline appearance:

For Labels — add `text-white/70` class:
```tsx
<Label htmlFor="guestbook-name" className="text-white/70">Your name</Label>
<Label htmlFor="guestbook-email" className="text-white/70">
  Email <span className="font-normal text-white/35">(optional)</span>
</Label>
```

The `Input` component in `src/components/ui/Input.tsx` uses global styles. Rather than modifying the shared component, pass className overrides:
```tsx
<Input
  id="guestbook-name"
  className="bg-white/8 border-white/12 text-white placeholder:text-white/30 focus:border-gold-400/50"
  ...
/>
```

Check the Input component first to understand what classes it applies so you can override cleanly without breaking light-mode pages.

**Step 5: Update textarea dark style similarly**

Same pattern as Input — pass `className` override:
```tsx
<Textarea
  className="bg-white/8 border-white/12 text-white placeholder:text-white/30 focus:border-gold-400/50"
  ...
/>
```

Update helper text below email input:
- `text-charcoal-400` → `text-white/30`

**Step 6: Update submit error message** (line ~submitError area)

```tsx
// BEFORE: border-rose-200 bg-rose-50 text-rose-600
// AFTER:  border-rose-400/30 bg-rose-500/10 text-rose-300
```

**Step 7: TypeScript check + screenshot + commit**

```bash
npx tsc --noEmit
git add src/pages/Guestbook.tsx
git commit -m "feat: guestbook cinematic composer panel"
```

---

## Task 4: Guestbook Page — MessageCard Component

**Files:**
- Modify: `src/pages/Guestbook.tsx` (the `MessageCard` function, line ~209)

**Step 1: Update MessageCard outer article**

```tsx
// BEFORE
className={cn(
  'editorial-card px-5 py-5 ...',
  isHighlighted && 'ring-2 ring-gold-300/80 ...'
)}

// AFTER
className={cn(
  'relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-gold-200/12 px-5 py-5 transition-all duration-300 sm:px-6 sm:py-6',
  isHighlighted && 'ring-2 ring-gold-400/40 shadow-[0_0_40px_-10px_rgba(198,156,78,0.25)]'
)}
```

**Step 2: Update avatar and name/date**

```tsx
// name h3: text-charcoal-900 → text-white
// date p: text-charcoal-500 → text-white/45
```

The `Avatar` component likely uses `bg-gold-100 text-gold-700` internally. If it accepts className, keep it or override for dark mode — add `ring-2 ring-gold-400/30` to give it the gold ring from design.

**Step 3: Update Badge for message type**

The badge uses light colors (`badgeClass`). Update `messageTypeMeta`:
```tsx
const messageTypeMeta = {
  text:  { label: 'Written note', icon: PenSquare, badgeClass: 'border-gold-400/30 bg-gold-500/10 text-gold-300' },
  voice: { label: 'Voice note',   icon: Mic,       badgeClass: 'border-rose-400/30 bg-rose-500/10 text-rose-300' },
  video: { label: 'Video note',   icon: Video,     badgeClass: 'border-white/15 bg-white/8 text-white/60' },
}
```

**Step 4: Update message content bubble**

```tsx
// BEFORE: rounded-[1.35rem] bg-white/74 px-4 py-4
// AFTER:  rounded-xl bg-white/6 px-4 py-4
// text: text-charcoal-700 → text-white/75
```

**Step 5: Update AudioPlayer dark theme**

The `AudioPlayer` component uses light rose styles. Update:
- Container: `bg-[linear-gradient(135deg,...)]` → `bg-white/8 border border-rose-400/20`
- Play button: keep dark cinematic gradient (it already looks good)
- Waveform label: `text-charcoal-900` → `text-white`
- Time: `text-charcoal-400` → `text-white/45`
- Bar active: `bg-rose-400` (keep), inactive: `bg-rose-400/20`
- "No URL" fallback: `bg-rose-50/90` → `bg-rose-500/10 border border-rose-400/20`
  - text: `text-charcoal-900` → `text-white`, `text-charcoal-500` → `text-white/55`

**Step 6: Update comments section**

```tsx
// BEFORE: rounded-[1.35rem] border border-white/75 bg-cream-50/88 px-4 py-4
// AFTER:  rounded-xl border border-white/10 bg-white/4 px-4 py-4

// Replies label: text-charcoal-500 → text-white/40
// Count: text-charcoal-400 → text-white/30
// Individual comment bubble: bg-cream-50/90 → bg-white/5
// Comment author: text-charcoal-900 → text-white
// Comment timestamp: text-charcoal-400 → text-white/35
// Comment content: text-charcoal-600 → text-white/65
// "Show all" button: text-gold-700 → text-gold-400 hover:text-gold-300
```

**Step 7: Update reactions row and reply button**

```tsx
// Reaction container: bg-cream-50/90 → bg-white/5 rounded-full (ReactionPicker wraps itself)
// Border above: border-charcoal-900/8 → border-white/8

// Reply button default: border-white/70 bg-cream-50/88 text-charcoal-500 → border-white/12 bg-white/5 text-white/50 hover:text-white
// Reply button active: border-gold-300 bg-gold-50 text-gold-700 → border-gold-400/40 bg-gold-500/10 text-gold-300
```

**Step 8: Update reply form**

```tsx
// BEFORE: rounded-[1.35rem] border border-white/80 bg-white/72 px-4 py-4
// AFTER:  rounded-xl border border-white/10 bg-white/5 px-4 py-4

// Label: add className="text-white/70"
// Input: className="bg-white/8 border-white/12 text-white placeholder:text-white/30"
```

**Step 9: TypeScript check + screenshot + commit**

```bash
npx tsc --noEmit
git add src/pages/Guestbook.tsx
git commit -m "feat: guestbook cinematic message cards and audio player"
```

---

## Task 5: Guestbook Page — Feed, Loading, and Error States

**Files:**
- Modify: `src/pages/Guestbook.tsx`

**Step 1: Update loading state** (find `isLoading` branch in feed)

Look for the loading spinner/skeleton in the feed area. Update:
- Spinner or skeleton bg: light → `bg-white/8`
- Text: `text-charcoal-500` → `text-white/40`

**Step 2: Update load error banner**

```tsx
// BEFORE: likely amber or rose light styling
// AFTER:  border-amber-400/25 bg-amber-500/8 text-amber-300
```

**Step 3: Update "Load more" button**

```tsx
// BEFORE: likely cream/charcoal styling
// AFTER:  border border-white/12 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 rounded-full px-6 py-2.5 text-sm transition-all
```

**Step 4: Add atmosphere glow blobs to page wrapper**

Inside the outermost page div, add non-interactive atmosphere:
```tsx
<div className="pointer-events-none fixed inset-0 overflow-hidden">
  <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-gold-500/4 blur-[120px]" />
  <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-gold-400/3 blur-[100px]" />
</div>
```

**Step 5: TypeScript check + screenshot at 390px and 1280px + commit**

```bash
npx tsc --noEmit
git add src/pages/Guestbook.tsx
git commit -m "feat: guestbook cinematic feed states and atmosphere"
```

---

## Task 6: Upload/Share Page — Dark Canvas, Hero, and Highlights

**Files:**
- Modify: `src/pages/Upload.tsx`

**Step 1: Update main page wrapper background**

```tsx
// BEFORE (line ~433)
<div className="min-h-screen bg-cream-50 pb-20 pt-28 sm:pt-32">

// AFTER
<div className="min-h-screen bg-[linear-gradient(to_b,rgba(12,8,5,1),rgba(22,14,6,1))] pb-20 pt-28 sm:pt-32">
```

Also add the same atmosphere blobs (inside page div, before UploadSEO):
```tsx
<div className="pointer-events-none fixed inset-0 overflow-hidden">
  <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-gold-500/4 blur-[120px]" />
  <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-gold-400/3 blur-[100px]" />
</div>
```

**Step 2: Update hero `editorial-panel`** (line ~441)

```tsx
// BEFORE
className="editorial-panel px-6 py-8 sm:px-8 sm:py-10"

// AFTER
className="relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-6 py-8 sm:px-8 sm:py-10"
```

Update all text inside the hero:
- eyebrow-chip → `text-[10px] uppercase tracking-[0.3em] text-gold-400 flex items-center gap-1.5`
- `h1` text-charcoal-900 → text-white
- `p` text-charcoal-600 → text-white/55
- Status pills (selected photo/video count): `border-white/80 bg-white/76` → `border-white/12 bg-white/8`
  - text: `text-charcoal-500` → `text-white/50`
- "Pass the site along" inner card (line ~474): `border-white/80 bg-white/76` → `border-white/10 bg-white/5`
  - eyebrow: `text-gold-700` → `text-gold-400`
  - heading: `text-charcoal-900` → `text-white`
  - body: `text-charcoal-500` → `text-white/55`

**Step 3: Update share buttons**

The current share buttons are text+icon pill style. Condense to icon-only glass circles plus the copy/link display:
```tsx
// Pattern for each share button:
<button
  type="button"
  onClick={...}
  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white/60 transition-all hover:border-gold-400/30 hover:text-gold-300 hover:bg-white/10"
  aria-label="..."
>
  <Icon className="h-4 w-4" />
</button>
```

Wrap all share buttons in `<div className="flex flex-wrap gap-2 items-center">`.

Keep the URL display pill but update style:
```tsx
// border-white/90 bg-white → border-white/12 bg-white/6
// Link2 icon: text-gold-600 → text-gold-400
// URL text: text-charcoal-500 → text-white/40
```

**Step 4: Update `uploadHighlights` info cards** (line ~562)

```tsx
// BEFORE: editorial-card px-5 py-5
// AFTER:  relative overflow-hidden rounded-xl bg-white/5 backdrop-blur-sm border border-gold-200/12 px-5 py-5

// Icon badge: border-gold-200/70 bg-gold-50 text-gold-600 → border-gold-400/20 bg-gold-500/10 text-gold-400
// Title: text-charcoal-900 → text-white
// Body: text-charcoal-500 → text-white/55
```

**Step 5: TypeScript check + screenshot + commit**

```bash
npx tsc --noEmit
git add src/pages/Upload.tsx
git commit -m "feat: upload page dark canvas, cinematic hero, and highlight cards"
```

---

## Task 7: Upload/Share Page — Dropzone and File Queue

**Files:**
- Modify: `src/pages/Upload.tsx`

**Step 1: Update upload dropzone** (line ~595, `data-testid="upload-dropzone"`)

```tsx
// BEFORE
className={cn(
  'relative overflow-hidden rounded-[2rem] border-2 border-dashed px-6 py-8 text-center transition-all sm:px-8 sm:py-10',
  isDragging
    ? 'border-gold-500 bg-gold-50/72 shadow-...'
    : 'border-gold-200/80 bg-white/82 hover:border-gold-400 hover:bg-white'
)}

// AFTER
className={cn(
  'relative overflow-hidden rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all sm:px-8 sm:py-10',
  isDragging
    ? 'border-gold-400 bg-gold-500/8 shadow-[0_0_60px_-20px_rgba(198,156,78,0.3)]'
    : 'border-gold-200/20 bg-white/4 hover:border-gold-400/40 hover:bg-white/6'
)}
```

Update dropzone content:
- Upload icon circle: `border-gold-200/70 bg-gold-100` → `border-gold-400/20 bg-gold-500/10`; icon: `text-gold-600` → `text-gold-400`
- `h2`: `text-charcoal-900` → `text-white`
- `p`: `text-charcoal-600` → `text-white/55`
- Format pills: `border-white/80 bg-white/76` → `border-white/12 bg-white/6`; text+icon: `text-charcoal-500` / `text-gold-600` → `text-white/50` / `text-gold-400`

**Step 2: Update queue notice banner** (queueNotice, line ~642)

```tsx
// BEFORE: border-amber-200 bg-amber-50 text-amber-700
// AFTER:  border-amber-400/25 bg-amber-500/8 text-amber-300
```

**Step 3: Update file queue panel** (line ~656, `editorial-panel px-6 py-6`)

```tsx
// BEFORE: editorial-panel px-6 py-6 sm:px-8
// AFTER:  relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-6 py-6 sm:px-8

// eyebrow-chip → text-[10px] uppercase tracking-[0.3em] text-gold-400 flex items-center gap-1.5
// h3: text-charcoal-900 → text-white
// status text: text-charcoal-500 → text-white/55
```

**Step 4: Update individual file items in queue**

Find the file thumbnail items (look for file preview grid). For each file item:
- Container: light bg → `bg-white/5 border border-white/8 rounded-xl`
- Filename: `text-charcoal-900` → `text-white`
- Status text: `text-charcoal-500` → `text-white/50`
- Error state: rose light → `text-rose-300 bg-rose-500/10 border-rose-400/20`
- Remove button (×): light → `border-white/12 bg-white/8 text-white/50 hover:text-white`
- Loader: keep `text-gold-500`
- Check (complete): keep `text-green-500`

**Step 5: TypeScript check + screenshot + commit**

```bash
npx tsc --noEmit
git add src/pages/Upload.tsx
git commit -m "feat: upload page cinematic dropzone and file queue"
```

---

## Task 8: Upload/Share Page — Form, Errors, and Submit

**Files:**
- Modify: `src/pages/Upload.tsx`

**Step 1: Find the form section** (line ~585, the `<form onSubmit={handleSubmit}>`)

The form contains the dropzone (done), file queue (done), and then the contact fields sidebar. Find the contact fields panel:
```tsx
// Update the panel wrapping name/email/message fields
// BEFORE: editorial-panel or light bg variant
// AFTER:  relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-6 py-6
```

**Step 2: Update form Labels and Inputs**

Same pattern as Guestbook — pass className to override:
```tsx
<Label className="text-white/70">...</Label>
<Input className="bg-white/8 border-white/12 text-white placeholder:text-white/30 focus:border-gold-400/50" ... />
<Textarea className="bg-white/8 border-white/12 text-white placeholder:text-white/30 focus:border-gold-400/50" ... />
```
Helper text: `text-charcoal-400` → `text-white/30`

**Step 3: Update submit error message**

```tsx
// BEFORE: border-red light styling
// AFTER:  border-rose-400/25 bg-rose-500/8 text-rose-300 rounded-xl px-4 py-3
```

**Step 4: Update submit button area**

The submit button uses `<Button>` component. Keep as-is (primary variant should already be gold). Just ensure the disabled state looks right on dark bg.

Update `describeSubmitLabel` display if there's a helper note under the button — `text-charcoal-400` → `text-white/30`.

**Step 5: TypeScript check + screenshot + commit**

```bash
npx tsc --noEmit
git add src/pages/Upload.tsx
git commit -m "feat: upload page cinematic form and submit"
```

---

## Task 9: Upload/Share Page — Success State

**Files:**
- Modify: `src/pages/Upload.tsx`

**Step 1: Update success state page wrapper** (line ~354)

```tsx
// BEFORE
<div className="min-h-screen bg-cream-50 px-4 pb-20 pt-32">

// AFTER
<div className="min-h-screen bg-[linear-gradient(to_b,rgba(12,8,5,1),rgba(22,14,6,1))] px-4 pb-20 pt-32">
```

**Step 2: Update success card** (line ~358, `data-testid="upload-success-panel"`)

```tsx
// BEFORE: editorial-panel px-6 py-10 text-center sm:px-10
// AFTER:  relative overflow-hidden rounded-2xl bg-white/6 backdrop-blur-md border border-gold-200/15 px-6 py-10 text-center sm:px-10

// Glow blobs: bg-gold-200/35 blur-3xl, bg-blush-200/35 → bg-gold-500/8, bg-gold-400/5 (atmosphere only)
// CheckCircle badge: border-green-200/80 bg-green-100/88 → border-green-400/25 bg-green-500/10
// CheckCircle icon: text-green-600 → text-green-400
// eyebrow-chip → text-[10px] uppercase tracking-[0.3em] text-gold-400
// h1: text-charcoal-900 → text-white
// p: text-charcoal-600 → text-white/55
// Stat pills: border-white/80 bg-white/76 → border-white/12 bg-white/8; text: text-charcoal-500 → text-white/50
```

**Step 3: Update "What happens next" step cards**

```tsx
// BEFORE: border-gold-100 bg-white/76 px-4 py-4
// AFTER:  border-gold-200/15 bg-white/5 px-4 py-4 rounded-xl

// Step label: text-gold-700 → text-gold-400
// Heading: text-charcoal-900 → text-white
// Body: text-charcoal-500 → text-white/55
```

**Step 4: TypeScript check + final screenshots at 390px and 1280px + commit**

```bash
npx tsc --noEmit
git add src/pages/Upload.tsx
git commit -m "feat: upload page cinematic success state"
```

---

## Task 10: Final Polish Pass

**Files:**
- Modify: `src/pages/Guestbook.tsx`
- Modify: `src/pages/Upload.tsx`

**Step 1: Scan both pages for any remaining `cream`, `charcoal`, `bg-white/7` or light-bg patterns**

Search for leftover light values:
```bash
grep -n "bg-cream\|text-charcoal\|bg-white/7[0-9]\|editorial-card\|editorial-panel" src/pages/Guestbook.tsx src/pages/Upload.tsx
```

Fix any found instances using the shared token table at the top of this plan.

**Step 2: Check the `ReactionPicker` component**

Read `src/components/guestbook/ReactionPicker.tsx` briefly. If it uses hardcoded light bg, wrap it with a dark container in `MessageCard` rather than modifying the shared component.

**Step 3: Check the `Avatar` component**

Read `src/components/ui/Avatar.tsx`. If it accepts className, add `ring-2 ring-gold-400/30` in the MessageCard usage to give the gold ring effect from the design.

**Step 4: Final TypeScript check**

```bash
npx tsc --noEmit
```

Expected: 0 errors

**Step 5: Final commit**

```bash
git add src/pages/Guestbook.tsx src/pages/Upload.tsx
git commit -m "feat: guestbook and share pages cinematic polish pass"
```

---

## Verification Checklist

Before declaring done:

- [ ] `/guestbook` at 390px: dark bg, glass cards, readable text, composer opens correctly
- [ ] `/guestbook` at 768px: sidebar visible, cards properly spaced
- [ ] `/guestbook` at 1280px: two-column layout with dark sidebar
- [ ] `/upload` at 390px: dark bg, dropzone clear, form readable
- [ ] `/upload` at 1280px: two-column layout, highlights sidebar
- [ ] Submit a test note in guestbook — verify form, success state, and new message appears
- [ ] `npx tsc --noEmit` returns 0 errors
