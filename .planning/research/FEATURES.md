# Feature Research: Wedding Archive Websites

**Domain:** Post-wedding photo/video archive and guest interaction platform
**Researched:** 2026-04-23
**Confidence:** MEDIUM (Domain knowledge + competitor product analysis; web search unavailable for verification)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Photo gallery with album organization** | Users expect to browse memories by event/date | MEDIUM | Albums (Engagement, Bach+ette, Wedding Day, Guest Uploads) already exist in project |
| **Lightbox image viewing** | Standard expectation from all photo apps | LOW | Full-screen view, navigation arrows, close button |
| **Video playback** | Wedding films are central memories | LOW | Chaptered film already exists in project |
| **Guest upload functionality** | "Share your photos" is expected at weddings | MEDIUM | Photos and videos already exist; needs polish on progress/error handling |
| **Guestbook/message submission** | Traditional wedding guestbook digitised | LOW | Already exists; may need UI polish |
| **Mobile responsiveness** | 60%+ of guests view on phone | MEDIUM | Basic mobile exists; needs consistency across all pages |
| **Smooth page transitions** | Modern app feel | LOW | Framer Motion available; needs consistent application |
| **Loading states** | Users panic without feedback | MEDIUM | Currently missing in many places; critical for upload |
| **Error states with recovery** | Something always fails | MEDIUM | Admin pages lack error boundaries; upload errors need handling |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued and memorable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Face-tagged people gallery** | "Find me in the photos!" drives engagement | MEDIUM | Already exists; high value differentiator vs generic wedding sites |
| **Admin content moderation queue** | Clean site, quality over quantity | MEDIUM | Approve/reject uploads, manage guestbook, feature content |
| **Lazy loading with placeholder shimmer** | Fast perceived performance, no layout shift | MEDIUM | Gallery currently makes parallel calls with no caching |
| **Guest upload progress persistence** | "Will my video upload if I close my laptop?" | MEDIUM | Currently missing; session tracking with resume capability |
| **Content feature/spotlight** | Couple can highlight best moments | LOW | Admin ability to mark photos as "featured" |
| **Album cover customization** | Personalization beyond default thumbnails | LOW | Admin sets cover image per album |
| **Download original quality option** | Preserve memories locally | LOW | Download button on lightbox |
| **Share to social/export** | Easy sharing to Instagram stories | LOW | Share button with proper OG tags |
| **PWA offline access** | View photos without internet at reception | MEDIUM | PWA support exists; needs verification of full offline capability |
| **Guest message reactions** | Express appreciation without writing | LOW | Simple heart/like on guestbook entries |
| **Photo location/moment context** | "This was the first dance" narrative | LOW | Optional caption/moment on photos |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time upload notifications** | "I want to see guest photos as they come in" | Creates complexity, performance issues, no real value since couple reviews later | Admin can refresh moderation queue; email digest is sufficient |
| **Live chat/messaging between guests** | Social interaction | Out of scope per PROJECT.md; invites moderation nightmares | Guestbook provides social expression |
| **Multiple event sections** | Rehearsal dinner, brunch, etc. | Increases complexity, dilutes focus | Single archive with albums organizing by date/event |
| **Email newsletter signup** | Keep guests updated | Adds complexity, consent requirements | One-time "notify me" for site updates is enough |
| **Face recognition auto-tagging** | Save manual tagging effort | Privacy concerns, accuracy issues, technical complexity | Manual face tagging is already working well |
| **Download all photos as ZIP** | "Save all memories" | Storage costs, server strain, no real urgency | Download individual photos or contact couple for full set |
| **Unlimited video uploads** | Guests want to share long videos | Storage costs, playback performance | Limit to 30s clips or suggest trimming |
| **Public comment threads on photos** | "Comment on this moment!" | Moderation burden, potential for spam/abuse | Reactions/likes instead |

---

## Feature Dependencies

```
[Photo Gallery] ──requires──> [Lazy Loading System]
      │
      └──requires──> [Album Organization]
                              │
                              └──requires──> [Media Storage Layer]

[Guest Upload] ──requires──> [Upload Progress Tracking]
      │                            │
      │                            └──requires──> [Error Recovery/Retry]
      │
      └──requires──> [Admin Moderation Queue]

[Guestbook] ──enhances──> [Moderation Queue] (admin reviews flagged content)

[Lightbox] ──enhances──> [Photo Gallery] (better browsing experience)

[Admin Panel] ──requires──> [Auth] (already exists)
```

### Dependency Notes

- **Photo Gallery requires Lazy Loading:** Without lazy loading, gallery performance degrades with scale. Phase this first.
- **Guest Upload requires Admin Moderation:** Guests expect uploads to be reviewed; queue must exist before enabling uploads broadly.
- **Admin Panel requires Error Boundaries:** Without boundaries, one bad component crashes entire admin. High priority.
- **Lightbox enhances Gallery:** Nice-to-have polish but doesn't block gallery functionality.

---

## MVP Definition

### Launch With (v1)

Minimum viable polish — what's needed to feel "complete" rather than "work-in-progress."

- [ ] **Loading states everywhere** — Spinner/skeleton on all async operations
- [ ] **Error states with clear recovery** — "Upload failed, tap to retry" not silent failure
- [ ] **Lightbox with keyboard navigation** — Arrow keys, ESC to close
- [ ] **Mobile consistent navigation** — Hamburger menu works on all pages
- [ ] **Admin error boundaries** — No white screens in admin
- [ ] **Upload progress feedback** — Progress bar during upload, confirmation after

### Add After Validation (v1.x)

Once core feels stable and polished.

- [ ] **Admin moderation queue** — Full approve/reject/feature workflow
- [ ] **Lazy loading with placeholder shimmer** — Perceived performance improvement
- [ ] **Guest message reactions** — Simple heart/like on entries
- [ ] **Featured content spotlight** — Admin can highlight best photos
- [ ] **Download original quality** — Save button on lightbox
- [ ] **Share to social** — OG tags, share buttons

### Future Consideration (v2+)

Features to defer until polish is complete and product-market fit validated.

- [ ] **PWA offline verification and enhancement** — Full offline gallery browsing
- [ ] **Photo moment captions** — Context text on photos
- [ ] **Album cover customization** — Admin sets covers
- [ ] **Guest upload queue status** — "Your photo is being reviewed" feedback

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Loading states (spinners/skeletons) | HIGH | LOW | P1 |
| Error states with recovery | HIGH | LOW | P1 |
| Lightbox keyboard navigation | MEDIUM | LOW | P1 |
| Admin error boundaries | HIGH | LOW | P1 |
| Upload progress feedback | HIGH | MEDIUM | P1 |
| Mobile nav consistency | HIGH | MEDIUM | P1 |
| Admin moderation queue | HIGH | MEDIUM | P2 |
| Lazy loading with shimmer | MEDIUM | MEDIUM | P2 |
| Guest message reactions | MEDIUM | LOW | P2 |
| Featured content spotlight | MEDIUM | LOW | P2 |
| Download original quality | MEDIUM | LOW | P2 |
| Share to social/OG tags | MEDIUM | LOW | P2 |
| PWA offline verification | MEDIUM | MEDIUM | P3 |
| Photo moment captions | LOW | MEDIUM | P3 |
| Album cover customization | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch (addresses "feels incomplete")
- P2: Should have, add when core is stable
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Generic Wedding Platforms (Squarespace, Wix) | Specialized Wedding Photo Apps (Tagt, WeddingWire Photos) | Our Approach |
|---------|---------------------------------------------|----------------------------------------------------------|--------------|
| Photo gallery | Basic album organization | Tagging, fan favorite voting | Focus on performance + polish |
| Guest uploads | File size limits, basic form | Queue, approve/reject | Already exists; improve UX + add moderation |
| Guestbook | Simple form | Template suggestions | Already exists; add reactions |
| Admin moderation | Limited or none | Full dashboard with analytics | Build proper queue for couple |
| Lightbox | Basic viewing | Social sharing integration | Keyboard nav + download + share |
| Mobile | Responsive template | Native app quality | Consistent polish across all pages |
| Performance | Often slow, loads everything | Optimized but closed platform | Lazy load + shimmer placeholders |

---

## Sources

- **Project context:** `.planning/PROJECT.md` (existing features, constraints, tech stack)
- **Domain knowledge:** General wedding photo archive product patterns
- **Limitation:** Web search unavailable; web search findings not verified via external sources

---

*Feature research for: Wedding Archive Websites*
*Researched: 2026-04-23*