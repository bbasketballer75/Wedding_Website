# Phase 18: Photo Claiming - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 18-photo-claiming
**Areas discussed:** Claiming Flow UX, Email Verification Method, Post-Claim Experience, Edge Cases

---

## Claiming Flow UX

| Option | Description | Selected |
|--------|-------------|----------|
| "Claim My Photos" on Guest Uploads | Button on guest uploads page, triggers email verification | ✓ |
| From People gallery | Face cluster "Is this you?" prompt | Not selected (deferred) |
| Email-based discovery | Auto-email after upload with claim link | Not selected |
| Combined entry | Both button and face prompting | Not selected |

**User's choice:** "Claim My Photos" on Guest Uploads page
**Notes:** Guest visits Guest Uploads page, sees button, enters email to verify and claim uploads. SC-02 (face claiming) deferred to post-launch.

---

## Email Verification Method

| Option | Description | Selected |
|--------|-------------|----------|
| Magic link | Single-use link in email, instant verification | ✓ |
| One-time code | 6-digit code, guest types on site | ✓ |
| Signed URL | Token embedded in link, no auth required | Not selected |

**User's choice:** Both magic link AND one-time code (supports both)
**Notes:** Guest chooses which they prefer. Both supported.

---

## Post-Claim Experience

| Option | Description | Selected |
|--------|-------------|----------|
| "My Photos" collection | Claimed photos in gallery collection, tagged with email | ✓ |
| Guest profile page | New "/my-photos" route | Not selected |
| Silent attribution | Photos retain metadata, no separate collection | Not selected |
| Notification to couple | Admin gets email when photos claimed | Not selected |

**User's choice:** "My Photos" collection in gallery
**Notes:** Claimed photos appear in gallery with filter, tagged with uploader email. No separate route — collection embedded in main gallery.

---

## Edge Cases

| Option | Description | Selected |
|--------|-------------|----------|
| Must have uploaded to claim | Only guests who uploaded can claim | ✓ |
| Claiming is automatic | Guest doesn't select specific photos — all their uploads are claimed | ✓ |
| Silent/notification options | Various notification approaches | Not selected |

**User's choice:** Must upload to claim, automatic claiming on verification
**Notes:** If guest uploaded photos, they're automatically claimed when email is verified. No face claiming in this phase (deferred).

---

## Deferred Ideas

- **SC-02 (Face Cluster Claiming)** — "Is this you?" prompt in People gallery, face cluster confirmation. Deferred post-launch. Guest can still claim via email (SC-01).

---

*Phase: 18-photo-claiming*
*Discussion complete: 2026-04-30*