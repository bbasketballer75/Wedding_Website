---
phase: 8
slug: moderation-queue-featured-spotlight
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-27
---

# Phase 8 — UI Design Contract

> Visual and interaction contract for Phase 8: Moderation Queue & Featured Spotlight.
> Generated manually (gsd-sdk unavailable), verified by gsd-ui-checker.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (manual) |
| Preset | not applicable |
| Component library | base Radix + custom |
| Icon library | lucide-react |
| Font | Newsreader (display), Instrument Sans (body), Allura (script) |

**Source:** `src/tokens/designTokens.ts` — established project design tokens

---

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline elements |
| sm | 8px | Compact element spacing, gap-2 |
| md | 16px | Default element spacing, card padding |
| lg | 24px | Section padding, card gaps |
| xl | 32px | Layout gaps, major section breaks |
| 2xl | 48px | Page section margins |
| 3xl | 64px | Not typically used |

**Exceptions:** Admin touch targets minimum 44px (per D-01 inline buttons)

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 16px | 400 | 1.5 |
| Label | 14px | 500 | 1.4 |
| Heading | 20px | 600 | 1.2 |
| Display | 28px | 600 | 1.2 |

**Source:** `src/tokens/designTokens.ts` — Instrument Sans body, Newsreader headings

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#fdfcfa` cream | Background, surfaces |
| Secondary (30%) | `#ffffff` white | Cards, modals, inputs |
| Accent (10%) | `#c9a05c` gold-500 | Primary actions, highlights |
| Destructive | `#e36a83` rose-500 | Reject buttons, destructive actions |

**Accent reserved for:** Approve button, featured highlights, selected states

**Destructive reserved for:** Reject button only

**Source:** `src/tokens/designTokens.ts` — gold, rose, cream palette

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | "Approve" (single) / "Reject" (single) |
| Bulk CTA | "Approve All Selected" / "Reject All Selected" |
| Empty state heading | "No pending uploads" |
| Empty state body | "All guest uploads have been moderated." |
| Error state | "Moderation failed. Please try again." |
| Destructive confirmation | "Reject Upload": "Are you sure? This will decline [N] upload(s). Guests will see the rejection reason when they check status." |
| Bulk destructive confirmation | "Reject [N] Uploads": "Are you sure? These [N] uploads will be declined. Guests will see the rejection reason when they check status." |
| Success toast (approve) | "Upload approved" / "[N] uploads approved" |
| Success toast (reject) | "Upload rejected" / "[N] uploads rejected" |
| Reject reason label | "Rejection reason" |
| Reject reason placeholder | "Optional: Let the guest know why..." |
| Status filter tabs | "Pending" / "Approved" / "Rejected" |

**Source:** D-01, D-02, D-03 from CONTEXT.md

---

## Component Inventory

### MediaReviewPanel (admin)
- **Layout:** Tabbed interface (existing face review + new guest upload moderation tab)
- **Guest Upload Tab sections:** Filter bar → Upload list → Bulk action toolbar
- **States:** loading (skeleton), empty, populated, error

### Upload Card (per guest upload)
- **Content:** Thumbnail, uploader info, upload date, status badge
- **Actions:** Approve button (gold), Reject button (rose), checkbox (for bulk select)
- **Rejected state:** Shows rejection reason if provided

### Bulk Action Toolbar
- **Appears:** When 1+ items selected
- **Actions:** "Approve All Selected" (gold), "Reject All Selected" (rose)
- **Confirmation:** Modal before destructive bulk reject

### Filter Bar
- **Tabs:** Pending (default), Approved, Rejected
- **Counts:** Badge with count per status

### Confirmation Modal
- **Trigger:** Bulk reject + single reject (when reason provided)
- **Content:** Warning text, optional reason textarea (for bulk)
- **Actions:** "Cancel", "Confirm Reject"

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |
| third-party | none | not applicable |

No third-party components — using existing project patterns with custom components.

---

## Decisions Pre-Populated from CONTEXT.md

| Decision | Source | Applied As |
|----------|--------|------------|
| D-01: Inline quick-action buttons | 08-CONTEXT.md | Approve/Reject on each card |
| D-02: Reject reason visible to guest | 08-CONTEXT.md | Reason shown on Upload Status page |
| D-03: Bulk approve/reject + checkboxes | 08-CONTEXT.md | Bulk toolbar with confirmation |
| D-04: No spotlight system | 08-CONTEXT.md | Out of scope — not specified |
| Gold theme accent | designTokens.ts | Approve buttons, selected states |
| Rose destructive | designTokens.ts | Reject buttons |
| Lucide icons | MediaReviewPanel.tsx | Icons already in use |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS — CTAs use standard moderation UX patterns; empty/error/destructive copy specific
- [x] Dimension 2 Visuals: PASS — primary focal point is upload queue; filter bar establishes hierarchy
- [x] Dimension 3 Color: PASS — 60/30/10 split explicit; accent reserved for approve/highlights/selected only
- [x] Dimension 4 Typography: PASS — 4 sizes, 2 weights, all line heights declared
- [x] Dimension 5 Spacing: PASS — all multiples of 4; 44px exception justified by D-01 admin touch targets
- [x] Dimension 6 Registry Safety: PASS — no third-party registries; no shadcn

**Approval:** approved 2026-04-27
