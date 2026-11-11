# Wave 4 Plan — Content pages (Home, Film, Print, 404)

> Status: queued (starts when Waves 2–3 are green). Branch: `rebuild/greenfield`.

## Goal

Port the archive's content surfaces to parity with real data: Home (hero, story, timeline,
countdown, guest reel, editorial slots), Film (chaptered player, family films, guest clips) and
Print (memory book), keeping the 404 already shipped. This is the first wave with user-visible
content beyond chrome.

## Inputs that must be green first

- Wave 2 primitives (`shared/ui`) and the parity edge tolerance.
- Wave 3 data layer (`shared/data`) + auth + media helpers.
- `contracts/content/*` (film chapters, curated photos, story, timeline, party) and
  `contracts/content/rendered/{home,film,print,not-found}.json` (text oracle).

## Exit criteria

1. Routes `/`, `/film`, `/print` render from the rebuilt components and the typed data layer; no
   legacy imports; no placeholder pages remain for these routes.
2. Text/DOM parity against the frozen rendered snapshots: 0 diffs (title/meta/canonical/headings/
   links/images/body text) after normalising the documented dynamic bits.
3. Pixel parity: every documented mask is justified and listed; anything else within the harness
   tolerance. Home's animated sections use documented masks (carousel/countdown ticker), not
   route-level allowances.
4. Interaction parity covered by Playwright: home hero scroll + timeline expand/collapse + editorial
   slot rendering; film chapter menu, captions toggle, progress/resume, family-film modal deep link;
   print selection + print-disabled state (screen media).
5. Gates: lint, format, TS7/TS6, coverage thresholds, build, e2e; CI green.
6. Checkpoint with evidence.

## Work packages

| ID | Owner | Deliverable |
|---|---|---|
| W4-1 | feature agent A | Home page + sections (hero, story, timeline, countdown, guest reel, editorial) |
| W4-2 | feature agent B | Film page + VideoPlayer + family films + guest clips |
| W4-3 | feature agent C | Print page + print styles |
| W4-4 | Lead | router wiring, data binding review, parity masks, tests, checkpoint |

## Rules

- Content comes from `contracts/content/*` and the DB via `shared/data` — no copy duplication back
  into components except layout-only labels.
- Animations: keep the frozen timings/values; parity runs with reduced motion, so masks target the
  genuinely time-driven nodes, never whole pages.
- Media (video/audio/images) uses the media path helpers; do not copy assets.
- No new dependencies without Lead approval.
