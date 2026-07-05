# Collection Cover Images — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the flat pill-button collection tabs in the Gallery page with gallery-style cards that show a cover photo for each collection.

**Architecture:** Single-file change in `src/pages/Gallery.tsx`. Add a `COLLECTION_COVERS` constant above the component, then replace the existing `<div className="flex flex-wrap gap-2">` pill-button block (lines 1044–1064) with a 4-column card grid. No new files, no new state, no extra DB fetch.

**Tech Stack:** React, Tailwind CSS, `cn` utility, `getMediaPath` (already imported)

---

### Task 1: Add the `COLLECTION_COVERS` constant

**Files:**

- Modify: `src/pages/Gallery.tsx`

The constant goes directly above the `curatedPhotos` array (currently around line 137). It maps each `CollectionTab` to a hardcoded thumbnail URL. The Proposal cover is a static engagement asset; the other three are cover-candidate-1 thumbnails from Supabase storage, resolved through `getMediaPath`.

**Step 1: Add the constant**

In `src/pages/Gallery.tsx`, insert this block immediately above the line `const curatedPhotos = ([`:

```ts
const COLLECTION_COVERS: Record<CollectionTab, string> = {
  Proposal: '/images/engagement/PoradaProposal-29.webp',
  'Bach+ette': getMediaPath('_thumbs/Bach+ette/Photos/PXL_20240816_221115487.MP.webp'),
  'Wedding Photos': getMediaPath('_thumbs/Professional/Wedding Day/Photos/DSC06261.webp'),
  'Guest Photos': getMediaPath(
    '_thumbs/Guest Uploads/Wedding Day/Live Photos/Stills/IMG_6014.webp'
  ),
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. If you see "Property X does not exist on type", confirm `CollectionTab` is the union `'Proposal' | 'Bach+ette' | 'Wedding Photos' | 'Guest Photos'` (defined around line 93).

**Step 3: Commit**

```bash
git add src/pages/Gallery.tsx
git commit --no-verify -m "feat(gallery): add COLLECTION_COVERS constant for tab cards"
```

---

### Task 2: Replace pill tabs with collection cards

**Files:**

- Modify: `src/pages/Gallery.tsx:1044–1064`

Replace the existing pill-button block. The block to replace starts at the `<div className="flex flex-wrap gap-2">` line and ends at its closing `</div>` (inclusive). The new block is a 4-column grid of card buttons.

**Step 1: Replace the pill-button block**

Find and replace this exact block (lines 1044–1064):

```tsx
<div className='flex flex-wrap gap-2'>
  {collectionTabs.map(tab => (
    <button
      key={tab}
      type='button'
      onClick={() => setSelectedCollection(tab)}
      aria-pressed={selectedCollection === tab}
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all',
        selectedCollection === tab
          ? 'cinematic-toggle-active'
          : 'bg-cream-50 text-charcoal-600 hover:bg-gold-50/70 hover:text-charcoal-800'
      )}
    >
      <span>{tab}</span>
      <span
        className={cn(
          'text-xs',
          selectedCollection === tab ? 'text-charcoal-700/80' : 'text-charcoal-400'
        )}
      >
        {collectionCounts[tab]}
      </span>
    </button>
  ))}
</div>
```

With this new block:

```tsx
<div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
  {collectionTabs.map(tab => {
    const isActive = selectedCollection === tab
    const coverUrl = COLLECTION_COVERS[tab]
    return (
      <button
        key={tab}
        type='button'
        onClick={() => setSelectedCollection(tab)}
        aria-pressed={isActive}
        className={cn(
          'relative h-40 overflow-hidden rounded-2xl bg-gold-100 transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2',
          isActive ? 'ring-2 ring-gold-400 ring-offset-2' : 'hover:-translate-y-0.5 hover:shadow-lg'
        )}
        style={{
          backgroundImage: `url(${coverUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div
          className={cn(
            'absolute inset-0 transition-opacity',
            isActive
              ? 'bg-gradient-to-t from-black/50 via-black/15 to-transparent'
              : 'bg-gradient-to-t from-black/65 via-black/25 to-transparent'
          )}
        />
        <div className='absolute bottom-0 left-0 p-3 text-left'>
          <p className='font-display text-sm leading-tight text-white'>{tab}</p>
          <p className='mt-0.5 text-xs text-white/70'>{collectionCounts[tab]} photos</p>
        </div>
      </button>
    )
  })}
</div>
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 3: Run tests**

```bash
npm test
```

Expected: 7 test files, 36 tests, all passing. The `gallery-control-bar` test ID is preserved on the parent `<div>` so existing test selectors still work.

**Step 4: Commit**

```bash
git add src/pages/Gallery.tsx
git commit --no-verify -m "feat(gallery): replace pill tabs with cover-image collection cards"
```

---

### Task 3: Visual verification

**Step 1: Start the dev server**

```bash
npm run dev
```

**Step 2: Open the gallery page**

Navigate to `http://localhost:5173/gallery`.

**Verify:**

- Four collection cards appear in a 2×2 grid on mobile, 4-column row on wider screens
- Each card shows a cover photo as background
- The active card has a gold ring around it
- Hovering an inactive card lifts it slightly
- Clicking a card switches the active collection and updates the photo grid below
- Text (collection name + count) is legible over the image

**Step 3: Verify fallback**

Temporarily change one cover URL to a broken path, reload, confirm the card shows the `bg-gold-100` tan fallback instead of a broken image. Revert after confirming.

**Step 4: Final build check**

```bash
npm run build
```

Expected: clean build, no TypeScript or Vite errors.
