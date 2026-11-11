# THEME_INCIDENT — production colouring/theming incident (2026-11-10)

Status: **root cause found, fix staged locally — not committed, not deployed** (Lead owns
commit + deploy). Production deploy under investigation: `6af3ed9d1c516a64aba25527`
(`www.theporadas.com`).

## 1. Summary

The user reported that production "theming/coloring is NOT correct and doesn't look good".
The design tokens, fonts, Tailwind v4 layers and theme provider are **not** the cause: they
render identically to the frozen oracle (verified byte-for-byte, §5). The incident is a
**missing-asset deployment fault**: the rebuilt app references its archive photography at
same-origin `/images/**`, but the cutover deploy ships only the W8-1 social/PWA assets
(`rebuild/public/images/{og-image.*,icons/**}`) and returns **404 for every archive image**.
The Home hero has no text of its own — all of its headline typography lives inside the
1920×1080 `intro-video-poster.png` — so a 404 poster turns the first screen into a large
empty black area; gallery tiles, the film poster/portraits and the image washes used across
the pages disappear too, which reads as broken colours/theming.

The parity harness had masked the fault: the rebuild preview was always served with
`tools/parity/serve.mjs --fallback-dir` pointing at the legacy `public/images/**` tree
(see `docs/rebuild/PARITY.md` §10.4), so every local parity/W8 capture had the legacy bytes.
The production deploy has no such fallback.

Fix: copy the 65 referenced originals from the frozen legacy tree into
`rebuild/public/images/**` (byte-identical, 50.1 MiB) and rebuild with `build:prod`.
After the fix the rebuilt Home page is **pixel-identical to the frozen-legacy parity
capture** (0 of 1,296,000 pixels changed) with zero failed image requests.

## 2. Reproduction

Environment: Playwright (headless Chromium, 1440×900, dark theme default) from
`rebuild/node_modules`; production public over HTTPS. Audit scripts are in
`tmp/theme-audit/` (gitignored, not part of the fix).

```
GET https://www.theporadas.com/images/home/intro-video-poster.png  -> 404
GET https://www.theporadas.com/images/film/main-film-poster.png    -> 404
GET https://www.theporadas.com/images/couple/austin.png            -> 404
GET https://www.theporadas.com/images/engagement/PoradaProposal-29.webp -> 404
GET https://www.theporadas.com/images/parents/christine.webp       -> 404
GET https://www.theporadas.com/images/og-image.webp                -> 200  (W8-1 asset only)
```

Computed-style audit of production (all six routes): `<html class="dark-theme">`,
`data-theme="dark"`, `--ui-canvas: #090605`, `--ui-text: #fff7eb`,
`--color-gold-500: #d4af37`, `--font-body: "Instrument Sans", …` — i.e. the shipped CSS
variables match `rebuild/src/app/styles/tokens.css` and the frozen
`src/index.css`/`src/tokens/designTokens.ts` contract. Production `body` computes to
`font-family: Inter, sans-serif; color: #fff; background-color: #000`, which is **expected**:
`rebuild/src/app/styles/global.css` deliberately ports the frozen `index.html` unlayered
critical-CSS `body` rule for parity (see the comment block at `global.css` §
“FROZEN index.html CRITICAL CSS (unlayered)”; the legacy app has the same rule and the parity
matrix matched it byte-for-byte). That rule is not a regression and was left untouched.

Per-route production 404s (snapshot):

| Route                             | Broken image requests                         | Notes                                 |
| --------------------------------- | --------------------------------------------- | ------------------------------------- |
| `/`                               | `home/intro-video-poster.png`                 | hero poster → empty first screen      |
| `/gallery`                        | 12+ `engagement/*.webp`                       | album tiles/thumbnails blank          |
| `/film`                           | 6+ `parents/*`, `couple/*`, `wedding-party/*` | poster/portrait cards blank           |
| `/guestbook`, `/upload`, `/print` | none                                          | no archive photography above the fold |

## 3. Root cause

1. `rebuild/public/images/**` contains only W8-1 assets (`og-image.png|webp`, `icons/**`);
   the legacy `public/images/**` tree was never copied into the rebuild's Vite public dir,
   and `rebuild/scripts/prerender.mjs`/`netlify.toml` add no `/images/**` fallback or redirect.
2. The rebuild's runtime URLs (`HERO_POSTER`, `film.json` poster, gallery fixture/DB media,
   `party.json` portraits, `og:image`/JSON-LD) are 65 same-origin `/images/**` paths inherited
   from the frozen media contract; they 404 on the deployed host.
3. Local/parity verification could not catch this because the rebuild preview URL was always
   fronted by the parity server's legacy-image fallback directory; `rebuild/dist` has no
   images in the pre-cutover state.

## 4. Fix (staged, not deployed)

1. Enumerated every `/images/**` path referenced by `rebuild/src/**` (non-test) and
   `contracts/**` (77 references) and copied each existing original from the frozen
   `public/images/**` tree into `rebuild/public/images/**` with the same relative path
   (script: `tmp/theme-audit/collect-and-copy.mjs`). Derived/collision-safe naming is not
   needed for this incident: originals are byte-identical → parity-safe.
   - copies: **65 files / 50.1 MiB** — `engagement` 35, `wedding-party` 14, `couple` 4,
     `parents` 4, `parent-film-cards` 4, `home` 1, `film` 1, `rings` 1,
     `shared-gallery-new` 1.
   - 9 references not copied because they already ship from W8-1
     (`/images/og-image.webp`, `/images/icons/icon-*.png`); 3 fixture-generated paths skipped.
2. `cd rebuild && npm run build` and `npm run build:prod` — both green; `dist/images` now has
   79 files / 50.19 MiB, `dist/index.html` keeps the prerender boot shell (8 route shells)
   and `dist/images/home/intro-video-poster.png` is present.
3. Local production-like verification: `vite preview` of the freshly built `dist`,
   Playwright screenshots at 1440×900 dark, all `/images/**` requests 200; hero poster loads
   at 1920×1080; Home desktop dark is **byte-identical to the frozen-legacy parity capture**
   (`legacy/home__desktop__dark--s000.png`, both 216,807 B; pixel diff 0/1,296,000,
   max channel delta 0); zero failed requests on `/`, `/gallery`, `/film`.

### Files changed (uncommitted; Lead integrates)

| Path                                          | Change                                          |
| --------------------------------------------- | ----------------------------------------------- |
| `rebuild/public/images/couple/**`             | +4 original files copied from frozen tree       |
| `rebuild/public/images/engagement/**`         | +35 original files                              |
| `rebuild/public/images/film/**`               | +1 (`main-film-poster.png`)                     |
| `rebuild/public/images/home/**`               | +1 (`intro-video-poster.png`)                   |
| `rebuild/public/images/parent-film-cards/**`  | +4                                              |
| `rebuild/public/images/parents/**`            | +4                                              |
| `rebuild/public/images/rings/**`              | +1                                              |
| `rebuild/public/images/shared-gallery-new/**` | +1                                              |
| `rebuild/public/images/wedding-party/**`      | +14                                             |
| `docs/rebuild/incidents/*.png`                | 7 evidence screenshots (before/after/reference) |

No `rebuild/src/**` change was needed: tokens, global CSS, fonts, theme provider and component
class usage already render the frozen design correctly once the media bytes are present.
No root `src/`, `public/`, `contracts/`, `supabase/` or frozen file was modified
(`node tools/check-legacy-freeze.mjs` passes; the only new entries it reports are these
untracked rebuild images and the incident docs).

## 5. Evidence

Screenshots are in this directory (production “before”, fixed local build “after”, frozen
reference):

| File                                  | What it shows                                                          |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `before-home-desktop-dark.png`        | production: black empty hero (poster 404), nav + CTA bar only          |
| `frozen-legacy-home-desktop-dark.png` | oracle parity shot of the frozen app (hero poster text visible)        |
| `after-home-desktop-dark.png`         | local `build:prod` with images restored — identical to the oracle shot |
| `before-gallery-desktop-dark.png`     | production gallery: blank/broken album tiles, live counts              |
| `after-gallery-desktop-dark.png`      | local fixed gallery: album photos render                               |
| `before-film-desktop-dark.png`        | production film page: missing poster/portraits                         |
| `after-film-desktop-dark.png`         | local fixed film page                                                  |

Measured comparison:

- Home desktop dark, fixed build vs frozen-legacy parity shot:
  `changedPixels 0 / 1,296,000 (ratio 0.0000)`, `maxChannelDelta 0`.
- Production `/gallery` and `/film` screenshots differ from the frozen parity shots by
  `12.18%` and `0.77%` of pixels respectively. These differences are **data/capture
  conditions, not palette**: production now serves live Supabase gallery data (album counts
  70/198/599 vs the parity fixture's 30/0/5/0) and the live video frame is not paused/t=0 like
  the parity capture harness; the fixed local gallery/film screenshots render the same
  cream/gold design as the oracle once images are present.

## 6. Verification (run 2026-11-10, after the fix)

| Command                                             | Result                                                                            |
| --------------------------------------------------- | --------------------------------------------------------------------------------- |
| `cd rebuild && npm run build`                       | ✅ vite build, 1.18 s                                                             |
| `cd rebuild && npm run build:prod`                  | ✅ build + sitemap/manifest/sw + 12 prerendered route files (8 boot shells)       |
| `cd rebuild && npx tsc --noEmit`                    | ✅ exit 0                                                                         |
| `cd rebuild && npx eslint .`                        | ✅ 0 errors, 11 pre-existing `react-refresh` warnings                             |
| `cd rebuild && npm run test:run`                    | ✅ 127 files passed / 1 skipped; 1,076 tests passed / 9 skipped                   |
| `node tools/check-legacy-freeze.mjs`                | ✅ exit 0 (frozen sources untouched)                                              |
| Playwright local preview (`/`, `/gallery`, `/film`) | ✅ 0 failed image requests; hero poster 1920×1080; Home pixel-identical to oracle |

## 7. Integration steps for the Lead (required to fix production)

1. **Commit the copied images** (they are untracked → a git-based Netlify build/deploy will
   not include them unless added):
   `git add rebuild/public/images docs/rebuild/incidents`
   (or, if 50 MiB repo growth is unacceptable, add a deploy-time copy step
   `cp -r ../public/images rebuild/public/images` before `vite build`/`build:prod` and do not
   commit the images — but then CI must still run the copy).
2. Rebuild/deploy with `npm run build:prod`; verify in the deploy preview:
   - `GET /images/home/intro-video-poster.png` → 200 (not 404)
   - Home first screen shows the poster headline; `/gallery` and `/film` show photos.
3. Add a **release guard** so this cannot recur silently: after build, assert
   `dist/images/home/intro-video-poster.png`, `dist/images/film/main-film-poster.png` and one
   engagement image exist (e.g. extend `tools/verify-contracts.mjs`/CI, or a 5-line check in
   the build pipeline).
4. Re-run the parity matrix or capture a fresh parity baseline against the deployed build
   (the pre-cutover parity evidence was served through the legacy fallback directory, which
   is why this slipped).
5. Consider the W9-8 media decision separately: the 50.1 MiB originals are parity-safe and
   immediate; the derivative pipeline (`docs/rebuild/MEDIA_OPTIMIZATION.md`) can later reduce
   deploy size once its D1/D2 defects are fixed, but do not block this incident fix on it.

## 8. Remaining risks / follow-ups

- **Deploy wiring**: until the images are committed or copied by the build, production stays
  broken exactly as reported. This fix is staged in the working tree only.
- **Weight**: +50.1 MiB of originals in the repo/deploy (frozen bytes). Acceptable for parity;
  the W9-8 derivative option can shrink it later.
- **Other asset classes**: `/media/**` CDN images, fonts and video streams are served from
  other origins and were not implicated; only same-origin `/images/**` was missing.
- **Gallery/film live-data state** now differs from the parity fixtures (70/198/599 counts);
  that is expected post-cutover, but any visual acceptance pass should be done against live
  data, not the old fixture screenshots.
- No deploy, commit or legacy-source change was made by this incident response.
