# Product Contract — what must survive the rebuild

The rebuild may change every line of code. It may not change what this product **is**.

## North star

A permanent, public digital archive of Austin & Jordyn's wedding that a non-specialist owner can
keep alive for decades: the engagement story, the chaptered wedding film, the photo gallery with
people/face browsing, guest uploads, the guestbook, and an admin moderation portal — fast on a
phone, accessible, beautiful, and cheap to host.

## Non-negotiable invariants

1. **No content loss.** Every photo, video, caption, story chapter, timeline milestone, quote,
   guestbook message, guest upload, face tag, and editorial feature visible today is still
   reachable after cutover. `contracts/content/` + `MEDIA_MANIFEST.json` are the checklist; the
   media-loss check fails the build if a referenced path disappears.
2. **No media loss.** The archive's bytes (CDN originals, thumbnails, video renditions, audio,
   posters, captions) are migrated or preserved in place; original downloads still return the
   original bytes.
3. **Public access stays public.** All public pages remain browsable and downloadable without an
   account. Admin surfaces remain private (Supabase Auth + RLS).
4. **Guest input stays safe.** Guestbook and guest uploads keep moderation, rate limiting, RLS,
   input sanitization, and the same abuse protections (see `docs/archival/SECURITY.md`).
5. **No drift in the visible product.** Pixel parity on priority routes, plus text parity on every
   route, at desktop and mobile, in dark and light themes. Any intentional difference needs a
   reviewed allowlist entry with a reason and an expiry wave.
6. **Accessibility never regresses.** WCAG 2.2 AA: keyboard operation, visible focus, reduced
   motion, screen-reader announcements, axe clean on every route.
7. **Performance never regresses.** Route-level JS and image budgets, LCP/CLS budgets measured
   against `docs/rebuild/BASELINE.md`.
8. **SEO/OG never regresses.** Per-route metadata, canonical URLs, sitemap, robots, and the
   Netlify edge OG behavior for shared gallery photos.
9. **PWA/offline never regresses.** Manifest, service worker caching contract, offline page.
10. **Owner-operable.** Every operational task (publish photos, approve uploads, moderate the
    guestbook, rotate keys, restore a backup) is documented in a runbook the owner can follow.
11. **Exit-able.** No capability is reachable only through a transient vendor feature without a
    documented fallback; data can be exported in an open format.

## Feature parity matrix (owned by audit A4, proven by waves)

| Area | Must survive | Proof |
|---|---|---|
| Home | engagement story, timeline, quiz, featured content, guest map, music | parity + text |
| Film | chaptered player, captions, progress, family films, quotes | parity + e2e |
| Gallery | albums, masonry/virtualization, lightbox, filters/search/sort, people/faces, map, likes/comments, batch download, share links, claims, guest photos | parity + e2e + perf |
| Uploads | guest upload flow (R2 presign, progress, retry, approval status) | e2e + contract |
| Guestbook | read, submit, moderation, rate limit | e2e + contract |
| Admin | auth/session, dashboard, moderation queues, album organizer, featured content, audit log, analytics, claims | parity + e2e + security review |
| Print | memory-book route and print styles | parity (print media) |
| Platform | SEO/OG, PWA/offline, CSP/headers, analytics, Sentry, 404 | contract tests |

## What may change

- Framework, language target, build tooling, folder structure, state/data libraries, styling
  implementation, test tooling.
- Database internals: schema shape, migration history, indexes, RPC signatures — as long as the
  public behavior and data are preserved (cutover window allows a planned migration).
- Deployment details: Netlify config, edge function implementation, cache headers.

## What may not change without an explicit owner decision

- The archive's purpose, audience, or public/private boundaries.
- The visual identity (parity is the default; a redesign is a separate project).
- Canonical public URLs (redirects are acceptable; silent 404s are not).
- The set of people who can administer it (owner + explicitly granted admins).
- Anything that would make the archive dependent on a vendor that cannot be exited.
