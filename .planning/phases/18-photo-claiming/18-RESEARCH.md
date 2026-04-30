# Phase 18: Photo Claiming - Research

**Researched:** 2026-04-30
**Domain:** Email-based photo claiming with Supabase auth, Zustand state management, gallery filtering
**Confidence:** MEDIUM-HIGH

## Summary

Phase 18 enables guests to claim photos they uploaded by verifying their email address. The flow is: guest enters email on Guest Uploads page, system looks up their `guest_uploads` by `guest_email`, sends either a magic link or 6-digit code for verification, and on success links their uploads to a new `guest_identity` record. Claimed photos then appear in a "My Photos" collection in the gallery filtered by the verified email.

**Key findings:**
- Supabase Auth supports magic links via `signInWithOtp()` (not the deprecated `magicLink()`) with `emailRedirectTo` for OTP-style verification
- One-time codes require custom implementation: generate 6-digit code, store in a new `verification_codes` table, validate on entry
- Gallery filtering already exists in `galleryStore.ts` with `filters` and `applyFilters()` — can be extended with an `uploaderEmail` filter
- `guest_uploads` table has `guest_email` field already indexed (line 147 of init_schema.sql)
- Database needs new tables: `guest_identities`, `photo_claims`, and `verification_codes` (for OTP)
- SC-02 (face claiming) is explicitly deferred — no face cluster logic in this phase

**Primary recommendation:** Use Supabase `signInWithOtp()` for magic link flow (not the deprecated `auth.magicLink()`). Build custom one-time code flow with a `verification_codes` table. Store claims in `photo_claims` table linking `photo_id` (from `guest_uploads.id`) to `guest_identity_id`. Add "My Photos" as a gallery filter by extending `galleryStore` with an `attributedEmail` filter.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** "Claim My Photos" button on Guest Uploads page
- **D-02:** Guest enters email — system checks if they have uploads
- **D-03:** If guest has uploads: send verification (magic link or code)
- **D-04:** If guest has no uploads: show "No photos found for this email" message
- **D-05:** Email verification sufficient — no login required
- **D-06:** Support both magic link AND one-time code (guest chooses)
- **D-07:** Magic link: single-use token embedded in URL, instant verification
- **D-08:** One-time code: 6-digit code, guest types on site
- **D-09:** Claimed photos automatically attributed to claimer via email matching
- **D-10:** "My Photos" collection in gallery shows claimed uploads
- **D-11:** Photos tagged with uploader email as attribution
- **D-12:** No separate "/my-photos" route — collection embedded in main gallery with filter
- **D-13:** Must have uploaded photos to claim — no claiming photos you didn't upload
- **D-14:** Claiming is automatic on verification — guest doesn't need to select specific photos
- **D-15:** Multiple guests can claim same moment (separate uploads, no conflict)
- **D-16:** SC-02 (face claiming) deferred to post-launch — phase focuses on email-only

### Out of Scope (Post-Launch)
- Face cluster confirmation ("Is this you?" prompt) — SC-02 deferred
- People gallery face claiming
- Face tagging integration

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-01 | Photo Claiming via Email | Enables claiming flow with guest_identity + photo_claims tables, magic link or OTP verification, "My Photos" gallery filter |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Email lookup for claimable photos | API / Backend | — | Supabase query on `guest_uploads.guest_email` — server-side |
| Magic link / OTP generation | API / Backend | — | Supabase Auth `signInWithOtp()` — server-side |
| One-time code storage/validation | Database / Storage | — | New `verification_codes` table — persistent |
| Guest identity management | Database / Storage | — | `guest_identities` table — persistent |
| Photo claim linking | Database / Storage | — | `photo_claims` table — persistent |
| Claim flow UI state | Browser / Client | — | Zustand `claimStore` — client-side session |
| "My Photos" gallery filter | Browser / Client | API / Backend | `galleryStore` + email param in query |
| Verification code entry | Browser / Client | — | React component state |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.105.1 [VERIFIED: npm registry] | Auth, database queries | Already in project |
| Zustand | latest via npm | Claim flow state management | Already in project |
| Framer Motion | latest via npm | Page transitions, UI animations | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| existing stores (authStore, galleryStore) | — | Reference patterns | Extend with new filter capability |
| existing supabase.ts | — | Database client | Add new query functions |

**No new packages required** — all functionality achievable with existing Supabase client + Zustand.

---

## Architecture Patterns

### System Architecture Diagram

```
Guest Uploads Page
       |
       v
[Claim My Photos Button] --> [Email Entry Form]
                                     |
                    +----------------+----------------+
                    |                                 |
                    v                                 v
         [Magic Link Flow]              [One-Time Code Flow]
                    |                                 |
                    v                                 v
    Supabase Auth signInWithOtp()        Generate 6-digit code
    (sends email with link)             Store in verification_codes table
                    |                                 |
                    v                                 v
    Guest clicks link                  Guest enters code
    --> /verify?token=xxx              --> /verify?code=xxx
                    |                                 |
                    +----------------+----------------+
                                     |
                                     v
                         [Verify Email Flow]
                                     |
                    +----------------+----------------+
                    |                                 |
                    v                                 v
         [Email found in                  [No uploads for email]
          guest_uploads?]                 --> Show "No photos found"
                    |                                 |
                    v                                 v
         [Create guest_identity]          [End flow]
         [Link all guest_uploads
          via photo_claims table]
                                     |
                                     v
                         [Redirect to Gallery]
                         [?collection=My+Photos]
```

### Recommended Project Structure
```
src/
├── stores/
│   ├── claimStore.ts          # NEW — claim flow state (Zustand)
│   ├── authStore.ts          # existing — reference for auth patterns
│   ├── galleryStore.ts       # existing — extend with attribution filter
│   └── downloadStore.ts      # existing — reference for sessionStorage persistence
├── lib/
│   ├── supabase.ts           # existing — add claim-related query functions
│   └── claimUtils.ts        # NEW — claim flow helpers (email lookup, code gen)
├── pages/
│   ├── Verify.tsx            # NEW — verification handler (magic link + code entry)
│   └── Gallery.tsx           # existing — add "My Photos" filter
├── components/
│   ├── ClaimFlow/            # NEW — ClaimButton, EmailForm, CodeEntry, etc.
│   └── gallery/              # existing — extend header with My Photos filter
supabase/
└── migrations/
    └── 20260501000000_photo_claiming_schema.sql  # NEW — guest_identities, photo_claims, verification_codes
```

### Pattern 1: Email-Based Claiming Flow

**What:** Guest enters email, system checks `guest_uploads` by `guest_email`, sends verification, creates identity linkage.

**When to use:** SC-01 photo claiming implementation.

**Key insight:** No login required — verification is the identity proof. The verification action itself creates the `guest_identity` record and links all matching `guest_uploads`.

**Flow steps:**
1. Guest enters email on Claim page
2. System queries `guest_uploads` for matching email (status='approved')
3. If matches found, show preview of claimable photos
4. Guest chooses magic link OR one-time code
5. If magic link: `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: origin + '/verify' } })`
6. If code: Generate 6-digit, store in `verification_codes`, send via email
7. On verification callback (`/verify?token=xxx` or `/verify?code=xxx`), validate and create claim
8. Create `guest_identity` record (email, session_id)
9. For each matching `guest_uploads` record, create `photo_claims` entry
10. Redirect to gallery with `?collection=My+Photos` filter

### Pattern 2: Gallery "My Photos" Filter

**What:** Gallery header filter option that shows only photos attributed to the verified email.

**When to use:** When a guest has an active claim session.

**Implementation approach:**
- Store `attributedEmail` in claimStore (persisted to sessionStorage)
- Gallery reads this from store on load
- Filter `guest_uploads` by `guest_email = attributedEmail` in addition to `status = 'approved'`
- Alternatively: filter already-attributed photos via `photo_claims` join

### Pattern 3: Zustand Claim Store

**What:** Zustand store managing claim flow state with sessionStorage persistence.

**When to use:** Managing claim flow UI state (email entry, verification method, claimed photos).

**Example:**
```typescript
interface ClaimState {
  step: 'idle' | 'email_entry' | 'verification_sent' | 'code_entry' | 'claimed'
  email: string | null
  verificationMethod: 'magic_link' | 'code' | null
  claimablePhotos: GuestUpload[]
  attributedEmail: string | null  // Persisted to sessionStorage
  setEmail: (email: string) => void
  setVerificationMethod: (method: 'magic_link' | 'code') => void
  setClaimablePhotos: (photos: GuestUpload[]) => void
  completeClaim: () => void
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email verification | Custom SMTP + token generation | Supabase Auth `signInWithOtp()` | Handles email delivery, rate limiting, token expiry securely |
| One-time code storage | In-memory or localStorage | `verification_codes` database table | Persists across sessions, survives browser close |
| Secure identity linking | DIY token signing | `guest_identity.id` (UUID) as the secure identifier | Supabase-generated UUIDs are unpredictable |
| Email-to-photo matching | String comparison hacks | SQL JOIN via `photo_claims` table | Proper relational integrity, supports future SC-02 |

**Key insight:** Supabase Auth's `signInWithOtp()` provides magic link functionality that is already secure and handles email delivery. Only the one-time code flow requires custom code, and that code should be stored in a database table, not localStorage.

---

## Common Pitfalls

### Pitfall 1: Confusing Magic Link with OTP
**What goes wrong:** Code uses deprecated `supabase.auth.magicLink()` which may not exist or behave differently.
**Why it happens:** Supabase docs changed — `magicLink()` is replaced by `signInWithOtp()` with `emailRedirectTo`.
**How to avoid:** Use `signInWithOtp()` (not `magicLink()`). The OTP flow sends a magic link-style email with a redirect.
**Warning signs:** Console errors about `magicLink` not being a function.

### Pitfall 2: Forgetting to Index `guest_email` for Performance
**What goes wrong:** As `guest_uploads` grows, email lookups become slow.
**Why it happens:** `guest_email` may not have an index in RLS policies.
**How to avoid:** Ensure there's an index on `guest_uploads(guest_email)` — already exists in init_schema.sql line 147.
**Warning signs:** Slow query on `/verify` callback with large upload tables.

### Pitfall 3: Code Verifier Expiry Too Long/Short
**What goes wrong:** 6-digit code expires too quickly (frustrating) or too slowly (security risk).
**Why it happens:** No standard convention — depends on UX/security tradeoff.
**How to avoid:** 10-minute expiry is reasonable for photo claiming context. Code should be single-use (delete after successful verification).
**Warning signs:** Users report codes expired before they could type them, or codes can be reused.

### Pitfall 4: Claiming Without Uploads
**What goes wrong:** Guest verifies email but has no uploads — creates orphaned identity record.
**Why it happens:** Verification happens before upload lookup check.
**How to avoid:** Check for matching uploads BEFORE sending verification. Only send verification if `guest_uploads` has approved uploads for that email.
**Warning signs:** `guest_identity` records with zero `photo_claims` entries.

### Pitfall 5: RLS Policy on New Tables
**What goes wrong:** New `guest_identities`, `photo_claims`, `verification_codes` tables default to no access.
**Why it happens:** Supabase RLS is enabled by default — need explicit policies.
**How to avoid:** Create RLS policies allowing public insert on `verification_codes`, and public read/write on `guest_identities` and `photo_claims` for the claiming flow.
**Warning signs:** "Permission denied" errors on claim creation.

---

## Code Examples

### Magic Link Flow (Supabase signInWithOtp)
```typescript
// Source: Supabase JS client v2.x documentation
const { error } = await supabase.auth.signInWithOtp({
  email: guestEmail,
  options: {
    emailRedirectTo: `${window.location.origin}/verify`,
  },
})
if (error) throw error
// Supabase sends magic link-style email automatically
```

### One-Time Code Verification
```typescript
// Generate 6-digit code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Store code in database
async function storeVerificationCode(email: string, code: string) {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min
  await supabase.from('verification_codes').insert({
    email,
    code,
    expires_at: expiresAt,
    used: false,
  })
}

// Validate code
async function validateVerificationCode(email: string, code: string) {
  const { data } = await supabase
    .from('verification_codes')
    .select('*')
    .eq('email', email)
    .eq('code', code)
    .eq('used', false)
    .gte('expires_at', new Date().toISOString())
    .single()

  if (data) {
    // Mark as used
    await supabase.from('verification_codes').update({ used: true }).eq('id', data.id)
    return true
  }
  return false
}
```

### Creating Guest Identity and Photo Claims
```typescript
// Create guest identity
async function createGuestIdentity(email: string, sessionId?: string) {
  const { data: identity } = await supabase
    .from('guest_identities')
    .upsert({ email, session_id: sessionId }, { onConflict: 'email' })
    .select()
    .single()
  return identity
}

// Link guest uploads to identity
async function linkGuestUploadsToIdentity(identityId: string, email: string) {
  // Find all approved uploads for this email
  const { data: uploads } = await supabase
    .from('guest_uploads')
    .select('id')
    .eq('guest_email', email)
    .eq('status', 'approved')

  if (uploads) {
    // Create photo_claims for each upload
    const claims = uploads.map(upload => ({
      photo_id: upload.id,
      guest_identity_id: identityId,
    }))
    await supabase.from('photo_claims').upsert(claims)
  }
}
```

### Zustand Claim Store Pattern (from existing downloadStore.ts)
```typescript
// Safe sessionStorage wrapper (same pattern as downloadStore.ts D-01)
const safeSessionStorage = {
  getItem: (name: string): string | null => {
    try { return sessionStorage.getItem(name) } catch { return null }
  },
  setItem: (name: string, value: string): void => {
    try { sessionStorage.setItem(name, value) } catch {}
  },
  removeItem: (name: string): void => {
    try { sessionStorage.removeItem(name) } catch {}
  },
}

export const useClaimStore = create<ClaimState>()(
  devtools(
    persist(
      (set) => ({
        step: 'idle',
        email: null,
        verificationMethod: null,
        claimablePhotos: [],
        attributedEmail: null,
        setEmail: (email) => set({ email }),
        setVerificationMethod: (method) => set({ verificationMethod: method }),
        setClaimablePhotos: (photos) => set({ claimablePhotos: photos }),
        completeClaim: () => set({ step: 'claimed', attributedEmail: get().email }),
      }),
      {
        name: 'claim-store',
        storage: createJSONStorage(() => safeSessionStorage),
        partialize: state => ({ attributedEmail: state.attributedEmail }),
      }
    )
  )
)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom magic link token generation | Supabase `signInWithOtp()` | Supabase v2.x | Built-in email delivery, token security |
| localStorage for codes | Database table `verification_codes` | Now | Codes persist across browser sessions, single-use |
| Email equality on client | `photo_claims` JOIN table | Now | Proper relational model, supports future SC-02 face claiming |

**Deprecated/outdated:**
- `supabase.auth.magicLink()` — deprecated, use `signInWithOtp()`
- In-memory code storage — lost on page reload, security risk
- Direct `guest_email` equality checks without claims table — doesn't support identity abstraction

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Magic link uses `signInWithOtp()` — not a `magicLink()` method | Code Examples | If Supabase API changed differently, implementation will fail. Verify with Context7. |
| A2 | `verification_codes` table schema with `email`, `code`, `expires_at`, `used` fields | Code Examples | Planner should confirm schema before creating migration |
| A3 | Guest uploads are matched by `guest_email` field directly | Don't Hand-Roll | If email stored differently, claiming won't work. Verified in init_schema.sql. |

---

## Open Questions

1. **How should the magic link handle already-authenticated users?**
   - What we know: Supabase `signInWithOtp()` handles session automatically
   - What's unclear: Should an authenticated admin user be able to claim guest photos? Likely no — claiming is for guests
   - Recommendation: Skip if user is already authenticated with admin role

2. **Should claimed photos be attributed in the gallery UI with the uploader's name?**
   - What we know: `guest_uploads` has `guest_name` field
   - What's unclear: Should this name appear on photos, or just be used for "My Photos" filtering?
   - Recommendation: Display uploader name as attribution when viewing claimed photos

3. **What happens when a guest claims photos, then someone else tries to claim the same email?**
   - What we know: Email is unique in `guest_identities` via UPSERT
   - What's unclear: Should the second claim attempt fail, or should it succeed (guest Identity already exists)?
   - Recommendation: Use UPSERT — if identity exists, just link new uploads (idempotent)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase (@supabase/supabase-js) | Auth, DB queries | Yes | 2.105.1 | — |
| Zustand | Claim store | Yes | latest | — |
| Framer Motion | Animations | Yes | latest | — |
| sessionStorage | Claim persistence | Yes | browser native | — |

**All dependencies satisfied.** No external services, CLIs, or runtimes needed beyond existing project stack.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (already in project) |
| Config file | `vite.config.ts` with test config |
| Quick run command | `npm run test -- src/stores/claimStore.test.ts` |
| Full suite command | `npm run test:run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| SC-01 | Email lookup finds uploads | unit | `npm run test -- tests/claim.test.ts` | No - Wave 0 |
| SC-01 | Magic link sent on email submit | unit | `npm run test -- tests/claim.test.ts` | No - Wave 0 |
| SC-01 | Code entry validates correctly | unit | `npm run test -- tests/claim.test.ts` | No - Wave 0 |
| SC-01 | Claim creates identity record | integration | `npm run test -- tests/claim.test.ts` | No - Wave 0 |
| SC-01 | Gallery filter shows claimed photos | unit | `npm run test -- tests/gallery.test.ts` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- src/stores/ --passwithno-tests`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/claim.test.ts` — unit tests for claim flow logic
- [ ] `tests/gallery-claiming.test.ts` — tests for gallery attribution filter
- [ ] `src/stores/claimStore.ts` — Wave 0 implementation of Zustand store
- Framework install: Not needed — Vitest already in project

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Email verification via Supabase Auth (OTP) — not password-based |
| V3 Session Management | Partial | Claim session stored in sessionStorage — not sensitive data |
| V4 Access Control | Yes | RLS policies on new tables must be configured |
| V5 Input Validation | Yes | Email format validation, code format validation (6 digits) |
| V6 Cryptography | No | No cryptographic operations beyond Supabase defaults |

### Known Threat Patterns for Photo Claiming

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Email enumeration (trying emails to see which have uploads) | Information Disclosure | Always show "no photos found" regardless of whether email exists in uploads |
| Code brute force | Tampering | Rate limit code validation, single-use codes, expiry (10 min) |
| Session hijacking (stealing claim session) | Spoofing | Use Supabase session management, short-lived verification tokens |
| Identity takeover (claiming someone else's email) | Spoofing | Magic link requires email access; code requires email access |

### Security Considerations

1. **Email enumeration prevention:** Always return same message whether email has uploads or not: "If that email has photos in the archive, we'll send verification instructions."
2. **Code brute force protection:** Limit attempts to 3 per code, then invalidate. Codes expire in 10 minutes.
3. **Magic link token security:** Supabase-generated tokens are cryptographically secure — don't implement custom signing.
4. **RLS policies:** New tables need policies:
   - `verification_codes`: Public insert (for sending), no public read (security), no delete
   - `guest_identities`: Public insert/upsert, read by email only
   - `photo_claims`: Public insert, read by identity only

---

## Sources

### Primary (HIGH confidence)
- Supabase JS client v2.105.1 — `signInWithOtp()` API [VERIFIED: npm registry]
- Project `src/lib/supabase.ts` — existing Supabase client config
- Project `src/stores/downloadStore.ts` — sessionStorage persistence pattern
- Project `src/stores/galleryStore.ts` — filter pattern for gallery
- Project `supabase/migrations/20240303000000_init_schema.sql` — `guest_uploads` schema with `guest_email`

### Secondary (MEDIUM confidence)
- Supabase Auth patterns — `signInWithOtp()` replaces deprecated `magicLink()` [WebSearch verified]
- Zustand docs — store pattern consistency with existing stores

### Tertiary (LOW confidence)
- One-time code expiry conventions — general practice (10 min), not verified against specific standard

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — using existing project stack, no new packages
- Architecture: MEDIUM — flow is clear but database schema design needs planning verification
- Pitfalls: MEDIUM — common mistakes identified, but specific Supabase API details need Context7 verification

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (Supabase API stable, project patterns established)
