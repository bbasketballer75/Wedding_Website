# verifier-web

Wedding website (theporadas.com) — end-to-end visual verification protocol.

## Project

React SPA (Vite + Supabase) running locally on port **5173** (dev) or **4173** (preview).
Media served from Cloudflare R2 via `/__media_proxy/` in dev, `https://media.wedding.theporadas.com` in production.

## When to use this skill

Any time you need to verify that a change to this project works correctly — whether it's image loading, a UI bug fix, navigation, or a new feature. Always follow this protocol before declaring PASS.

---

## Step 1 — Get a handle

### Check if dev server is already running

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/
```

- Returns `200` → server is up, skip to Step 2.
- Returns anything else → start it.

### Start the dev server

```bash
npm run dev
```

Run this with `run_in_background: true`. Then wait ~5 seconds and re-check with curl.

**Important:** The dev server at 5173 uses real Supabase data and the R2 media CDN proxy. This is the right surface for visual verification.

---

## Step 2 — Connect to Chrome

Use the **Chrome DevTools MCP** (`mcp__plugin_chrome-devtools-mcp_chrome-devtools__*`).

1. `list_pages` — find the tab at `localhost:5173`
2. `select_page` — select it (or navigate a new tab with `navigate_page`)
3. `navigate_page(type="url", url="http://localhost:5173/")` to start at the home page

**Do NOT use Playwright for visual screenshots.** The home page has a GPU-composited video background that renders as a black rectangle in headless Chromium. The Chrome DevTools MCP connects to a real running browser and produces correct screenshots.

Use Playwright only for functional/accessibility checks where screenshots aren't needed.

---

## Step 3 — Image audit (run on every page)

Paste this into `evaluate_script` after navigating to each page. Wait 3–5 seconds after load before running it.

```javascript
;async () => {
  // Wait for in-flight images to settle
  await new Promise(r => setTimeout(r, 3000))
  const imgs = [...document.querySelectorAll('img')]
  const real = imgs.filter(i => i.src && !i.src.startsWith('data:'))
  const broken = real.filter(i => i.complete && i.naturalWidth === 0)
  const loading = real.filter(i => !i.complete)
  return {
    page: location.pathname,
    total: real.length,
    loaded: real.filter(i => i.complete && i.naturalWidth > 0).length,
    broken: broken.map(i => i.src.replace(location.origin, '')),
    stillLoading: loading.map(i => i.src.replace(location.origin, '')),
  }
}
```

**Interpreting results:**

- `broken` (complete=true, naturalWidth=0) → real failures — 404, CORS, bad path
- `stillLoading` (complete=false) → CDN latency, not a bug — probe with `fetch()` to confirm
- `stillLoading` entries that later become `broken` after waiting → real failures

**Probe a broken URL:**

```javascript
;async () => {
  const res = await fetch('/__media_proxy/path/to/image.jpg')
  return { status: res.status, ok: res.ok, url: res.url }
}
```

---

## Step 4 — Pages to check

Run the image audit on each page. Take a screenshot after each audit passes.

| Page      | Route        | Notes                                                                                          |
| --------- | ------------ | ---------------------------------------------------------------------------------------------- |
| Home      | `/`          | Wait **5s** — GuestHighlightReel fetches from Supabase async. Timeline carousel waits for CDN. |
| Film      | `/film`      | Video player renders. Chapter nav visible.                                                     |
| Gallery   | `/gallery`   | Check all 4 album tabs: Engagement, Bach & Bachelorette, Wedding Photos, Guest Uploads         |
| Guestbook | `/guestbook` | Text only — 0 images expected. Check messages render.                                          |
| Upload    | `/upload`    | Dropzone renders. 0 images expected.                                                           |
| People    | `/people`    | Face thumbnails.                                                                               |

### Gallery tab switching

```javascript
// After navigating to /gallery, click each tab:
() => document.querySelector('[role="tab"][data-value="Bach & Bachelorette"]')?.click()
// or find by text:
() => [...document.querySelectorAll('[role="tab"]')].find(t => t.textContent.includes('Bach'))?.click()
```

---

## Step 5 — Key interactions to verify

### Timeline carousel (Home page)

```javascript
// Scroll to timeline
;() => document.querySelector('[data-testid="love-timeline"]')?.scrollIntoView()
```

After scrolling, wait 2s then check images. All 4 timeline events should show carousels. The Bach & Bachelorette card (event 3) should show images from `media/timeline/bachelor_ette__1nlhm4u/`.

### GuestHighlightReel (Home page, below timeline)

Scroll down on the home page. Should show a 3×2 photo grid (desktop) or single photo (mobile) plus a rotating quote from the guestbook. All 6 photos should load.

### Guestbook quotes rotating

On the home page, wait 5 seconds and re-run the audit — the quote card should cycle to the next message.

### Gallery lightbox

Click a photo in the gallery. A lightbox/dialog should open. Press Escape to close.

---

## Step 6 — Screenshot protocol

After each page passes the image audit:

```javascript
// Chrome DevTools MCP
take_screenshot({ fullPage: false }) // viewport shot
```

For sections that need to be scrolled into view:

```javascript
// First scroll
;() =>
  document.querySelector('[data-testid="section-name"]')?.scrollIntoView({ behavior: 'instant' })
// Then screenshot
```

---

## Step 7 — Report format

```
## Verification: <what changed>

**Verdict:** PASS | FAIL | BLOCKED

| Page         | Images  | Status |
|--------------|---------|--------|
| /            | 26/26   | ✅     |
| /film        | 20/20   | ✅     |
| /gallery     | 12/12   | ✅     |
| /guestbook   | 0       | ✅     |
| /upload      | 0       | ✅     |
| /people      | 2/2     | ✅     |

### Key interactions
- Timeline carousel: ✅ all 4 events show images
- Bach+ette carousel: ✅ images load from bachelor_ette__1nlhm4u/
- GuestHighlightReel: ✅ 6 photos + quotes visible
- Gallery lightbox: ✅ opens and closes

### Findings
<observations, anything unexpected>
```

---

## Common failure patterns

| Symptom                                                                             | Likely cause                                                                               | Fix                                                    |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Image `src` is a bare relative path (`media/...` without leading `/` or CDN prefix) | `getMediaPath()` not called on that `<img>`                                                | Wrap with `getMediaPath()`                             |
| 404 on `/__media_proxy/media/timeline/bachelor+ette/...`                            | Unsanitized folder name — R2 key uses `bachelor_ette__1nlhm4u`                             | Update config key in `LoveTimeline.tsx`                |
| GuestHighlightReel photos 404                                                       | Photos fetched from Supabase with relative `url` field not passed through `getMediaPath()` | Check `GuestHighlightReel.tsx`                         |
| `getCarouselImages is not defined` at runtime                                       | Stale Vite module cache                                                                    | Restart the dev server (`npm run dev`)                 |
| Playwright screenshots black                                                        | Headless Chromium can't composite the video background                                     | Use Chrome DevTools MCP instead                        |
| Netlify build fails: "No url found for submodule path .claude/worktrees/..."        | A Claude worktree was committed as a gitlink                                               | `git rm --cached .claude/worktrees/<name>` then commit |

---

## Running the automated test suites

### Functional tests (mocked Supabase — CI-safe)

```bash
npm run test:e2e:public
```

Starts a preview build, runs all public-page specs with mocked Supabase. Fast, repeatable, no real credentials needed.

### Live visual tests (real Supabase — requires dev server)

```bash
npm run dev          # separate terminal
npm run test:visual  # in another terminal
```

Uses `playwright.config.visual.ts` + `tests/e2e-live/`. Runs against real data in headed Chrome. Snapshots in `tests/e2e-live/screenshots/`.

### Update visual baselines

```bash
npm run test:visual:update
```

### Full release verification

```bash
npm run verify:release
```

Runs lint → tsc → unit tests → build → functional e2e. Use before pushing to production.
