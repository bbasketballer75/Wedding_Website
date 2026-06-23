# Phase 5: Social Sharing & Upload Resume — UI Specification

**Phase:** 05-social-sharing
**Status:** Ready for implementation
**Version:** 1.0

---

## Overview

This document specifies the UI design for two Phase 5 features: Social Sharing with OG Tags and Upload Queue Persistence. Both features enhance guest experience on the wedding archive site — sharing photos with rich social previews and resuming interrupted uploads.

---

## Part 1: Social Sharing with OG Tags

### 1.1 Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| SOC-01 | Share modal wired to lightbox, passing photo URL and image | P0 |
| SOC-02 | Dynamic OG meta tags when visiting `/gallery?shared=abc123` | P0 |

---

### 1.2 Visual Design

#### Color Palette

Uses the existing gold-themed wedding aesthetic:

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Primary Gold | gold-500 | `#c9a05c` | Active states, share button accent, gold glow effects |
| Gold Light | gold-300 | `#dbb880` | Hover states, progress gradients |
| Gold Dark | gold-600 | `#a6824a` | Pressed states |
| Charcoal | charcoal-900 | `#151413` | Modal backgrounds |
| Cream | cream-50 | `#fdfbf7` | Preview card backgrounds |
| White | white | `#ffffff` | Modal surfaces, text on dark |
| Overlay | black/60 | `rgba(0,0,0,0.6)` | Backdrop blur |

#### Typography

Uses existing design tokens from `tokens.ts`:

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Modal title | Newsreader (heading) | `2xl` (1.5rem) | 500 (medium) |
| Modal body text | Instrument Sans | `sm` (0.875rem) | 400 |
| URL preview | Instrument Sans | `xs` (0.75rem) | 400 |
| Share button labels | Instrument Sans | `sm` (0.875rem) | 500 (medium) |

#### Spacing

Uses the existing spacing scale (`tokens.spacing`):

- Modal padding: `p-6` (24px)
- Section spacing: `gap-3` (12px)
- Button padding: `p-3` (12px)
- Border radius: `rounded-xl` (12px) for cards, `rounded-full` for buttons

#### Layout

**Modal Layout:**
- Fixed overlay with `backdrop-blur-sm` and `bg-black/60`
- Centered modal at `max-w-md` (448px)
- Scale animation on open: 0.95 → 1.0

**Preview Card:**
- Background: `bg-cream-50`
- Border radius: `rounded-xl`
- Padding: `p-4`
- Shows: title, description (2-line clamp), truncated URL

---

### 1.3 Component Specifications

#### ShareModal (Enhanced)

The existing `ShareModal` component is already wired with all required props:

```typescript
interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string           // Default: "Austin & Jordyn's Wedding"
  description?: string      // Default: site description
  url?: string            // Default: window.location.href
  imageUrl?: string       // Added for photo-specific sharing
}
```

**Prop Flow from PhotoLightbox:**

The `PhotoLightbox` passes these props to `ShareModal`:

```typescript
<ShareModal
  isOpen={shareModalOpen}
  onClose={() => setShareModalOpen(false)}
  title={currentPhoto?.caption || "Wedding Photo"}
  description="Check out this beautiful moment from Austin & Jordyn's wedding!"
  imageUrl={currentPhoto?.url}
  // url defaults to window.location.href which includes ?shared= param
/>
```

**Share Button Styles (per platform):**

| Platform | Icon | Background | Text | Hover Effect |
|----------|------|------------|------|--------------|
| Copy Link | Link2 / Check | `bg-charcoal-100` | `text-charcoal-700` | Scale 1.02 |
| Facebook | Facebook | `bg-blue-100` | `text-blue-700` | Scale 1.02 |
| Twitter | Twitter | `bg-sky-100` | `text-sky-700` | Scale 1.02 |
| Email | Mail | `bg-gold-100` | `text-gold-700` | Scale 1.02 |
| Native Share | Share2 | Secondary variant | — | — |

**States:**

| State | Visual Indicator |
|-------|-----------------|
| Default | Platform-specific colors (see above) |
| Copy Success | Link icon changes to Check with `text-green-600`, auto-resets after 2s |
| Hover | `hover:scale-[1.02]` scale transform |

---

#### GallerySEO (Enhanced)

The `GallerySEO` component detects the `?shared=` URL parameter and fetches photo metadata to dynamically update OG tags:

```typescript
interface GallerySEOProps {
  shareImage?: string  // Photo-specific image URL
}
```

**URL Param Detection:**
- Read `?shared=` from `window.location` on component mount
- Fetch photo metadata from Supabase using the photo ID
- Update `og:image` dynamically to the photo's URL

**Dynamic OG Tag Content (when shared photo):**
- Title: `"Shared Wedding Photos"`
- Description: `"Check out these wedding photos from Austin & Jordyn's special day."`
- Image: The specific photo URL (1200x630 crop from Supabase)

**Standard Gallery OG Tags:**
- Title: `"Photo Gallery"`
- Description: `"Browse our wedding photos and share your own."`
- Image: `DEFAULT_SOCIAL_IMAGE` (`/images/home/intro-video-poster.png`)

---

### 1.4 Interaction Specifications

#### Lightbox Share Button Flow

1. Guest clicks Share button in lightbox toolbar
2. `setShareModalOpen(true)` is called
3. ShareModal opens with current photo's:
   - `title`: Photo caption or "Wedding Photo"
   - `description`: "Check out this beautiful moment from Austin & Jordyn's wedding!"
   - `imageUrl`: Photo's CDN URL
   - `url`: Current page URL (which may include `?shared=abc123` param)
4. Guest selects share option (Copy, Facebook, Twitter, Email, Native)
5. URL shared includes the full `window.location.href` which contains the photo context

#### Shared Photo URL Flow

1. Guest visits `/gallery?shared=abc123`
2. `GallerySEO` reads the `?shared=` param on mount
3. System fetches photo metadata from Supabase
4. OG tags update dynamically:
   - `og:title` → "Shared Wedding Photos"
   - `og:description` → Photo-specific description
   - `og:image` → Photo's full-resolution URL
5. When page loads with lightbox open to shared photo, lightbox auto-opens to that photo

#### Copy Link Interaction

1. Guest clicks "Copy Link" button
2. `navigator.clipboard.writeText(url)` copies full URL
3. Icon changes from `Link2` to `Check` with green color
4. Success state persists for 2 seconds
5. Icon reverts to `Link2`

---

## Part 2: Upload Queue Persistence

### 2.1 Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| UPL-01 | Incomplete uploads appear in queue on page load with "Resume" button | P0 |

---

### 2.2 Visual Design

#### Color Palette (Upload Queue)

Same gold theme consistent throughout:

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Primary Gold | gold-500 | `#c9a05c` | Resume button, progress bar |
| Gold Light | gold-300 | `#dbb880` | Progress bar gradient end |
| Emerald Success | emerald-300 | `#6ee7b7` | Complete status |
| Rose Error | rose-300 | `#fca5a5` | Error status |
| White Overlay | white/5 | `rgba(255,255,255,0.05)` | File card background |
| Border | white/8 | `rgba(255,255,255,0.08)` | Card border |

#### Typography

Same typography system for consistency:

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Queue header | Newsreader | `4xl` (2.25rem) | 500 |
| File name | Instrument Sans | `sm` (0.875rem) | 600 |
| File metadata | Instrument Sans | `xs` (0.75rem) | 400 |
| Status text | Instrument Sans | `xs` (0.75rem) | 500 |

#### Spacing

- File card padding: `px-4 py-4`
- Card gap: `gap-3` (12px)
- Button padding: `px-3 py-1.5`

#### Layout

**Upload Queue Card (Standard):**

```
+----------------------------------------------------------+
| [Preview] [File Name]           [Progress/Upload Status] [X]
|  16x16    MB | Type                                        |
+----------------------------------------------------------+
```

**Upload Queue Card (Resumed/Pending):**

```
+----------------------------------------------------------+
| [Preview] [File Name]           [Resume Button]          [X]
|  16x16    MB | Type - Pending resume                      |
+----------------------------------------------------------+
```

Visual distinction for resumed uploads:
- Left border accent: `border-l-2 border-gold-400`
- Badge: "Resume to continue" in gold tones
- Preview retained from localStorage

---

### 2.3 Data Model

#### Stored Upload Metadata (localStorage)

```typescript
interface StoredUploadMetadata {
  id: string              // UUID generated at upload start
  name: string            // File name
  type: string            // MIME type
  size: number            // File size in bytes
  fingerprint: string    // SHA-256 hash for deduplication
  preview: string        // Base64 data URL for image preview
  status: 'uploading' | 'paused' | 'error'
  progress?: number       // 0-100 upload percentage
  createdAt: number      // Timestamp for ordering
}
```

**localStorage Key:** `wedding-upload-queue`

**What is NOT stored:**
- The actual `File` object (not JSON-serializable)
- Any personally identifiable data

#### Resume Match Logic

```
Guest re-selects file
        ↓
buildFileFingerprint(newFile)
        ↓
Search localStorage for matching fingerprint
        ↓
[MATCH FOUND]              [NO MATCH]
        ↓                        ↓
Restore metadata,           Add as new upload
resume upload                (no distinction)
```

---

### 2.4 Component Specifications

#### Upload Page (Enhanced)

**Queue Section Header:**
- Label: "Upload queue" with upload icon
- Counter: "{completed} of {total} files ready to send"
- Subtitle explaining the queue

**File Card States:**

| Status | Visual Treatment |
|--------|-----------------|
| `uploading` | Progress bar with percentage, "Keep window open" message |
| `complete` | Emerald badge "Uploaded and ready" |
| `error` | Rose badge "Needs retry", error message, "Try again" link |
| `paused` (resumable) | Gold badge "Resume to continue", Resume button |

**Resume Button Styling:**

```typescript
// Resume button variant
<button
  type="button"
  onClick={() => resumeUpload(file.id)}
  className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-500/10 px-3 py-1.5 text-xs font-medium text-gold-300 hover:bg-gold-500/20 transition-colors"
>
  <RefreshCw className="h-3.5 w-3.5" />
  Resume
</button>
```

**Distinction Between New vs Resumed Uploads:**

| Aspect | New Upload | Resumed Upload |
|--------|-----------|----------------|
| Left border | Default | `border-l-2 border-gold-400` |
| Status badge | None initially | "Pending resume" gold badge |
| Preview | Generated from File | Restored from localStorage |
| Position in queue | Appended to end | Prepended to queue top |

---

### 2.5 Interaction Specifications

#### Page Load Flow

1. Upload page mounts
2. Check `localStorage.getItem('wedding-upload-queue')`
3. If incomplete uploads exist (status = `uploading` or `paused`):
   - Parse stored metadata
   - Prepend to visible queue with resume state
   - Show "Resume to continue" badge on each
4. Guest can click "Resume" or "Select more files"

#### Resume Flow

1. Guest clicks "Resume" on incomplete upload
2. System opens file picker filtered to that file type
3. Guest selects the same file
4. System computes fingerprint: `buildFileFingerprint(selectedFile)`
5. Fingerprint matches stored metadata
6. Upload resumes from beginning (full file re-upload)
7. Server handles deduplication via fingerprint
8. Progress bar resumes, status updates to `uploading`

#### File Re-Selection Match Flow

1. Guest adds new files via dropzone or picker
2. `addFiles()` called with FileList
3. For each file, compute fingerprint
4. Check against `existingFingerprints` Set
5. Check against localStorage queued uploads
6. If match found:
   - Skip as duplicate
   - Show notice: "{filename} was already in your queue"
7. If no match:
   - Add as new upload
   - Start upload immediately

#### Success/Completion Flow

1. All files complete (status = `complete`)
2. Queue shows "X of Y files ready to send"
3. Submit button becomes active
4. On submit, clear localStorage queue
5. Show success state

---

## 3. Accessibility

### Share Modal

- Focus trapped within modal when open
- Escape key closes modal
- `aria-modal="true"` and `aria-labelledby` on dialog
- All share buttons have `aria-label` with platform name

### Upload Queue

- Resume button has descriptive `aria-label`
- File cards have `aria-label` with filename
- Status badges are `aria-live` regions for screen readers
- Focus moves logically through queue on Tab

---

## 4. Acceptance Criteria

### Social Sharing

- [ ] ShareModal opens from lightbox Share button
- [ ] ShareModal displays photo caption and preview
- [ ] Copy Link copies the full URL with `?shared=` param
- [ ] Facebook/Twitter/Email share buttons open with correct pre-filled content
- [ ] Visiting `/gallery?shared=abc123` shows dynamic OG title/description/image
- [ ] Native share API is called on mobile with title, text, url
- [ ] Copy success state shows checkmark for 2 seconds

### Upload Queue Persistence

- [ ] Incomplete uploads persist in localStorage across page refresh
- [ ] On page reload, incomplete uploads appear with "Resume" button
- [ ] Clicking "Resume" opens file picker filtered to that file type
- [ ] Resuming a file re-matches via fingerprint
- [ ] Resumed uploads have visual distinction (gold left border, badge)
- [ ] Preview image is restored from localStorage data URL
- [ ] Full file is re-uploaded (server handles deduplication)
- [ ] Completed uploads are cleared from localStorage on form submit

---

## 5. Implementation Notes

### Key Files

| File | Role |
|------|------|
| `src/components/share/ShareModal.tsx` | Existing — needs url prop wired from lightbox |
| `src/components/photo-viewer/PhotoLightbox.tsx` | Existing — already wires ShareModal correctly |
| `src/components/seo/SEOHead.tsx` | Existing — GallerySEO already accepts shareImage |
| `src/pages/Upload.tsx` | Existing — needs localStorage persistence layer |
| `src/utils/storage.ts` | Existing — use for safe localStorage operations |
| `src/stores/galleryStore.ts` | Lightbox state management |

### localStorage Key Convention

- Upload queue: `wedding-upload-queue`
- Upload comment author: `wedding-gallery-comment-author` (already exists)

### Error Handling

- localStorage unavailable: Gracefully degrade, uploads work without persistence
- Fingerprint mismatch: Treat as new upload, server will deduplicate
- Photo fetch fail on `?shared=`: Fall back to standard gallery OG tags

---

*UI-SPEC Version 1.0 — Phase 5: Social Sharing & Upload Resume*
