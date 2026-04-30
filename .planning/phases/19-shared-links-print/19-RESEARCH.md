# Phase 19: Shared Links & Print - Research

**Researched:** 2026-04-30
**Domain:** Shared album links via unique tokens, external print provider redirect
**Confidence:** MEDIUM-HIGH

## Summary

Phase 19 enables guests to share a public link viewing their contributions (uploads + guestbook messages) and provides a print ordering redirect to external providers (Shutterfly or Artifact Uprising). The shared link flow generates a unique token per guest email, stored in a new `guest_share_tokens` table, and renders a `/guest/:token` public page. The print flow adds an "Order Prints" button to the lightbox and gallery that opens an external URL with photo context.

**Key findings:**
- `guest_share_tokens` table schema is defined in REQUIREMENTS.md with `guest_email`, `token`, `created_at` fields
- `/guest/:token` route does not exist yet in App.tsx — must be added as a new public route
- Token generation should use Supabase's `gen_random_uuid()` for unpredictability (matching existing patterns)
- Print redirect uses environment variable `VITE_PRINT_PROVIDER` to select Shutterfly vs Artifact Uprising
- No login required for shared view — token IS the authentication mechanism
- `supabase.ts` already has `GuestUpload` and `GuestbookMessage` types — can be reused for the shared album page

**Primary recommendation:** Create `GuestSharedPage` component that queries `guest_share_tokens` by token, then fetches `guest_uploads` and `guestbook_messages` filtered by the matched email. Add "Order Prints" button to `PhotoLightbox` toolbar (next to Download button) and/or in `GalleryHeader`. Print URL construction passes the current photo URL or selected photos to the external provider.

---

## User Constraints (from CONTEXT.md)

**No CONTEXT.md found for Phase 19.** Phase depends on Phase 18 (Photo Claiming) but does not have its own context document. The phase scope is defined in ROADMAP.md and REQUIREMENTS.md.

### Phase Locked Decisions (from ROADMAP.md + REQUIREMENTS.md)

| Decision | Source | Description |
|----------|--------|-------------|
| Token generation per guest on first upload | SC-03 | When guest first uploads, generate share token |
| Store in `guest_share_tokens` table | SC-03 | `guest_email`, `token`, `created_at` schema |
| New `/guest/:token` route | SC-03 | Public page rendering shared album view |
| Filter by email where token matches | SC-03 | Both `guest_uploads` and `guestbook_messages` |
| Public view (no login required) | SC-03 | Token IS the access credential |
| "Order Prints" in lightbox and/or gallery header | PR-01 | Button placement flexibility |
| Opens Shutterfly or Artifact Uprising | PR-01 | External providers |
| No internal payment/fulfillment | PR-01 | External provider handles everything |
| Vendor via environment variable | PR-01 | `VITE_PRINT_PROVIDER` config |

### Out of Scope
- Print fulfillment or payment processing (external redirect)
- Token expiration (no expiry defined in requirements)
- Token revocation or management UI

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-03 | Shared Album Links | Token generation strategy, `/guest/:token` route design, public view rendering, `guest_share_tokens` table schema, email-to-token lookup flow |
| PR-01 | Print Ordering Redirect | Vendor URL construction (Shutterfly/Artifact Uprising), photo URL passing, environment variable configuration, lightbox button integration |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Token generation/storage | Database / Storage | — | `guest_share_tokens` table, UUID tokens |
| `/guest/:token` route | Browser / Client | — | New route in App.tsx, React component |
| Guest uploads fetch | API / Backend | — | Supabase query on `guest_uploads` filtered by email |
| Guestbook messages fetch | API / Backend | — | Supabase query on `guestbook_messages` filtered by email |
| Shared album page rendering | Browser / Client | — | New `GuestSharedPage` component |
| Print provider URL construction | Browser / Client | — | Build URL with photo params, open in new tab |
| Order Prints button | Browser / Client | — | Add to PhotoLightbox toolbar and/or GalleryHeader |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.105.1 [VERIFIED: npm registry] | Database queries for tokens, uploads, messages | Already in project |
| Zustand | latest via npm | State management for share token if needed | Already in project |
| Framer Motion | latest via npm | Page transitions | Already in project |
| React Router v7 | latest via npm | `/guest/:token` route | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| existing `GuestUpload`, `GuestbookMessage` types | — | Type shared album page data | supabase.ts already has these |
| existing `supabase.ts` client | — | Database queries | Add new query functions as needed |

**No new packages required.**

---

## Architecture Patterns

### System Architecture Diagram

```
Guest clicks "Share My Album" button
           |
           v
[Generate Share Token]
  - Check if token exists for guest_email
  - If not, generate UUID token + store in guest_share_tokens
           |
           v
[Copy Link to Clipboard]
  - URL: {origin}/guest/{token}
           |
           v
Guest shares URL with friends/family
           |
           v
Visitor opens /guest/:token
           |
           v
[Lookup Token in guest_share_tokens]
  - Find guest_email by token
  - If not found -> 404 error page
           |
           v
[Fetch Guest Contributions]
  - Query guest_uploads WHERE guest_email = X AND status = 'approved'
  - Query guestbook_messages WHERE email = X
           |
           v
[Render Shared Album Page]
  - Show photo grid of uploads
  - Show guestbook entries below
  - "Order Prints" button per photo
```

### Print Ordering Flow

```
User clicks "Order Prints" button
           |
           v
[Build Print Provider URL]
  - Read VITE_PRINT_PROVIDER (shutterfly | artifact_upspring)
  - For single photo: provider.com/photos?url={photo_url}
  - For multiple: provider.com/photos?urls={url1,url2,...}
           |
           v
[Open in New Tab]
  - window.open(url, '_blank')
  - External provider handles rest
```

### Recommended Project Structure

```
src/
├── pages/
│   └── GuestShared.tsx              # NEW — /guest/:token page
├── components/
│   ├── gallery/
│   │   ├── components/
│   │   │   └── OrderPrintsButton.tsx  # NEW — print button component
│   │   └── GalleryHeader.tsx         # existing — may add button here too
│   └── photo-viewer/
│       └── PhotoLightbox.tsx          # existing — add Order Prints to toolbar
├── lib/
│   └── supabase.ts                    # existing — add fetchGuestShareToken, fetchGuestUploadsByEmail, fetchGuestbookByEmail
│   └── shareUtils.ts                 # NEW — token generation, URL building
stores/
│   └── shareStore.ts                 # NEW — shared link state (Zustand)
supabase/
└── migrations/
    └── 20260502000000_guest_share_tokens.sql  # NEW — guest_share_tokens table
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token generation | Custom random string generators | `gen_random_uuid()` or `crypto.randomUUID()` | Cryptographically unpredictable, database-native |
| Email lookup for share token | String comparison hacks | SQL query on `guest_share_tokens.token` | Proper index usage, secure |
| Print provider URL construction | Hardcoded URLs | Environment variable + switch statement | Easy to change provider without code changes |
| Public access control | Custom auth middleware | No auth needed — token IS the credential | Token acts as bearer token |

---

## Common Pitfalls

### Pitfall 1: Token Not Generated on First Upload
**What goes wrong:** Guest uploads photos but never gets a share token, so Share button does nothing.
**Why it happens:** Token generation is not wired into the upload flow.
**How to avoid:** When saving a new `guest_uploads` record, also check if a token exists for that email; if not, generate one and insert into `guest_share_tokens`.
**Warning signs:** Guests report they can't share, or Share button doesn't produce a link.

### Pitfall 2: RLS Policy Missing on guest_share_tokens
**What goes wrong:** Token lookup fails with "Permission denied".
**Why it happens:** New table created with RLS enabled but no policies configured.
**How to avoid:** Add `SELECT` policy for public (to lookup token by value) and `INSERT` policy (to create token on first upload).
**Warning signs:** Console errors about permission denied on token query.

### Pitfall 3: Photo URL Not Accessible to Print Provider
**What goes wrong:** Print provider receives a signed Supabase URL that has expired or requires auth.
**Why it happens:** Using internal signed URLs directly in external redirect.
**How to avoid:** Pass the public photo URL (or generate a fresh signed URL with long expiry) in the redirect URL.
**Warning signs:** External print provider shows broken image or error.

### Pitfall 4: No Valid Token Handling UI
**What goes wrong:** Invalid token shows default error or blank page.
**Why it happens:** Route exists but error handling is missing.
**How to avoid:** Create friendly "Link not found or expired" page with option to upload photos.
**Warning signs:** Users see blank page or React error boundary.

---

## Code Examples

### Token Generation on First Upload

```typescript
// When saving guest_upload, ensure share token exists
async function ensureGuestShareToken(email: string): Promise<string> {
  // Check if token already exists
  const { data: existing } = await supabase
    .from('guest_share_tokens')
    .select('token')
    .eq('guest_email', email)
    .single()

  if (existing) {
    return existing.token
  }

  // Generate new token
  const token = crypto.randomUUID()
  await supabase
    .from('guest_share_tokens')
    .insert({ guest_email: email, token })

  return token
}
```

### Shared Album Page Data Fetching

```typescript
// Fetch shared album data by token
async function fetchSharedAlbum(token: string) {
  // 1. Lookup token -> email
  const { data: tokenData, error: tokenError } = await supabase
    .from('guest_share_tokens')
    .select('guest_email')
    .eq('token', token)
    .single()

  if (tokenError || !tokenData) {
    return { error: 'Token not found' }
  }

  const email = tokenData.guest_email

  // 2. Fetch guest uploads
  const { data: uploads } = await supabase
    .from('guest_uploads')
    .select('*')
    .eq('guest_email', email)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })

  // 3. Fetch guestbook messages
  const { data: messages } = await supabase
    .from('guestbook_messages')
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false })

  return { email, uploads, messages }
}
```

### Print Provider URL Construction

```typescript
// Environment variable: VITE_PRINT_PROVIDER=shutterfly | artifact_uprising
type PrintProvider = 'shutterfly' | 'artifact_uprising'

function buildPrintUrl(provider: PrintProvider, photoUrl: string): string {
  const encodedUrl = encodeURIComponent(photoUrl)

  switch (provider) {
    case 'shutterfly':
      return `https://www.shutterfly.com/photos/print?photo=${encodedUrl}`
    case 'artifact_uprising':
      return `https://www.artifactuprising.com/print?photo=${encodedUrl}`
    default:
      // Fallback to Shutterfly
      return `https://www.shutterfly.com/photos/print?photo=${encodedUrl}`
  }
}

// Usage in component
const handleOrderPrints = (photoUrl: string) => {
  const provider = (import.meta.env.VITE_PRINT_PROVIDER as PrintProvider) || 'shutterfly'
  const url = buildPrintUrl(provider, photoUrl)
  window.open(url, '_blank')
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Token in URL param (?token=xxx) | Token as URL path (`/guest/:token`) | Now | Cleaner URLs, token is the page identity |
| Hardcoded Shutterfly URL | Environment variable provider config | Now | Easy to switch print providers |
| No shared album page | Dedicated `/guest/:token` public page | Now | Guests can share contributions publicly |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Token generation happens on first guest upload | Token Generation | If token is generated differently (e.g., on demand only), implementation will be partially wrong |
| A2 | `guest_share_tokens.token` has UNIQUE constraint | Database | If not unique, same token could be assigned multiple times — security issue |
| A3 | Print provider URLs accept `photo` query param | Print Redirect | If provider API differs, URL construction will be wrong — needs verification |

---

## Open Questions (RESOLVED)

1. **Should the share token be generated on first upload OR only when guest clicks "Share"?**
   - **What we know:** Requirements say "on first upload" but don't specify implementation
   - **What's unclear:** Could be lazy generation (on Share button click) — simpler but less discoverable
   - **Recommendation:** Generate on first upload (per requirements) — ensures share link is always ready
   - **Resolution:** Generate on first upload (per requirements) — ensures share link is always ready

2. **Should the shared album page show ONLY approved uploads, or include pending?**
   - **What we know:** Standard practice is approved only (consistent with gallery)
   - **What's unclear:** Guest might want to share their pending uploads
   - **Recommendation:** Show approved only — align with public gallery behavior
   - **Resolution:** Show approved only — align with public gallery behavior

3. **Should "Order Prints" pass the photo URL directly or use a product ID?**
   - **What we know:** Requirements say "selected photos" — URL approach is simplest
   - **What's unclear:** Whether print provider supports direct URL or requires product code
   - **Recommendation:** Use direct URL approach with fallback message if provider doesn't accept it
   - **Resolution:** Use direct URL approach with fallback message if provider doesn't accept it

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase (@supabase/supabase-js) | DB queries, token storage | Yes | 2.105.1 | — |
| React Router v7 | `/guest/:token` route | Yes | latest | — |
| Zustand | Share state management if needed | Yes | latest | — |
| Framer Motion | Page transitions | Yes | latest | — |

**All dependencies satisfied.** No external services, CLIs, or runtimes needed beyond existing project stack.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (already in project) |
| Config file | `vite.config.ts` with test config |
| Quick run command | `npm run test -- src/stores/shareStore.test.ts` |
| Full suite command | `npm run test:run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| SC-03 | Token lookup returns email | unit | `npm run test -- tests/share.test.ts` | Yes - Wave 0 |
| SC-03 | Shared page shows guest uploads | unit | `npm run test -- tests/share.test.ts` | Yes - Wave 0 |
| SC-03 | Invalid token shows error page | unit | `npm run test -- tests/share.test.ts` | Yes - Wave 0 |
| SC-03 | Share button copies link to clipboard | e2e | Playwright | Yes - Wave 0 |
| PR-01 | Order Prints opens correct provider URL | unit | `npm run test -- tests/print.test.ts` | Yes - Wave 0 |
| PR-01 | VITE_PRINT_PROVIDER controls vendor | unit | `npm run test -- tests/print.test.ts` | Yes - Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- src/stores/ --passwithno-tests`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [x] `tests/share.test.ts` — unit tests for token lookup and shared page
- [x] `tests/print.test.ts` — unit tests for print URL construction
- [x] `src/lib/shareUtils.test.ts` — Wave 0 test for shareUtils
- [x] Framework install: Not needed — Vitest already in project

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Token acts as bearer credential for shared album access |
| V3 Session Management | No | No session management — token is the credential |
| V4 Access Control | Yes | Token must be validated before showing any data |
| V5 Input Validation | Yes | Token format validation (UUID), email format on token creation |
| V6 Cryptography | Yes | Token must be unpredictable (UUID) |

### Known Threat Patterns for Shared Links

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token enumeration (guessing tokens) | Information Disclosure | Use UUID v4 — 122 bits of entropy makes brute force infeasible |
| Token collision (two guests get same token) | Spoofing | UNIQUE constraint on token column prevents this |
| Sharing private uploads publicly | Information Disclosure | Only show `status='approved'` uploads in shared view |
| Print provider redirect with sensitive URLs | Information Disclosure | Use public URLs or short-lived signed URLs (1 hour expiry) |

### Security Considerations

1. **Token entropy:** UUID v4 is the minimum — do not use sequential integers or short random strings
2. **No sensitive data in shared view:** Shared page should only show approved content (same visibility as gallery)
3. **Print redirect URL exposure:** The URL in the redirect is visible in the browser — avoid passing sensitive tokens; use public photo URLs
4. **No token expiry (per requirements):** Tokens don't expire, so there is no revocation mechanism — acceptable for wedding context where content is public anyway

---

## Sources

### Primary (HIGH confidence)
- Project `src/App.tsx` — Route structure, lazy loading pattern
- Project `src/lib/supabase.ts` — `GuestUpload`, `GuestbookMessage` types, existing query patterns
- Project `supabase/migrations/20260501000000_photo_claiming_schema.sql` — RLS policy patterns for new tables
- Project `src/components/photo-viewer/PhotoLightbox.tsx` — Existing toolbar buttons pattern
- Project `src/components/gallery/components/GalleryHeader.tsx` — Header button integration pattern

### Secondary (MEDIUM confidence)
- Supabase docs — `gen_random_uuid()` for token generation [WebSearch]
- Print provider documentation — URL param conventions [WebSearch]

### Tertiary (LOW confidence)
- Shutterfly/Artifact Uprising exact URL format — needs official documentation verification

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — using existing project stack, no new packages
- Architecture: HIGH — route pattern is clear, data flow is straightforward
- Pitfalls: MEDIUM — common mistakes identified but token generation timing needs verification

**Research date:** 2026-04-30
**Valid until:** 2026-07-30 (print provider URLs may change, but architecture is stable)
