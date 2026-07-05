# Collection Cover Images — Design

## Goal

Replace the flat pill-button collection tabs in the Gallery page with gallery-style cards
that show a cover image for each collection, making the tab bar a visual collection browser
instead of a plain filter strip.

## Context

- Four collection tabs exist: Proposal, Bach+ette, Wedding Photos, Guest Photos
- Currently each tab is a pill button showing label + count
- DB has `cover-candidate-1` tagged on the highest-quality photo per album (Bach+ette,
  Wedding Day, Guest Uploads), selected by the enrichment pipeline quality scorer
- Proposal cover is a static engagement asset already used in `curatedPhotos`

## Approach

All changes confined to `src/pages/Gallery.tsx`. No new files, no new components,
no new state, no extra DB fetch.

## Cover URLs (hardcoded constants)

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

## Card Design

**Layout:** 4-column grid on `lg+`, 2×2 on mobile. Each card ~160px tall.

**Each card:**

- Full-bleed `background-image` cover photo
- Dark gradient overlay (`bg-gradient-to-t from-black/60 via-black/20 to-transparent`)
- Collection name (white, display font) + photo count pinned bottom-left
- Selected state: `ring-2 ring-gold-400` + lighter overlay
- Hover state: `-translate-y-0.5` lift + brighter overlay
- Fallback: `bg-gold-100` CSS background-color if image fails to load

**Replaces** the existing `{collectionTabs.map(...)}` pill-button block.
Keeps all existing logic: `selectedCollection`, `collectionCounts`, click handler.

## Out of Scope

- Runtime fetching of cover candidates
- Sub-collection filtering
- Changes to any file other than `Gallery.tsx`
