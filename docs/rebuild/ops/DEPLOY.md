# DEPLOY — greenfield deploy runbook

Documentation only. **No deploy was executed while writing this page.** Every step below is written
for the Lead/owner to run after the Wave 8 gate closes and the owner authorises the cutover
(`CUTOVER.md` §8). Commands that were verified only up to `--help`/`--version` are marked with the
verification that was actually performed; anything the repo cannot prove is `UNVERIFIED`.

Context measured on 2026-11-09: HEAD `3deee67` (Wave 7 admin committed 2026-11-08 14:29). Wave 8
artifacts exist **uncommitted in the working tree** (`rebuild/netlify.toml`, `rebuild/scripts/prerender.mjs`,
`rebuild/scripts/generate-sitemap.mjs`, `rebuild/public/{sitemap.xml,robots.txt,manifest.webmanifest,sw.js,images/icons,images/og-image.webp}`,
`rebuild/src/app/seo/routeMeta.json`, `tools/perf/bundle.mjs`, `tools/cutover/lib.mjs`) — treat them as
IN FLIGHT until committed and verified by the Lead.

## 1. Preconditions (all must be true before any deploy command)

| # | Precondition | Verify with | Expected | Status measured 2026-11-09 |
|---|---|---|---|---|
| P1 | Legacy freeze intact | `node tools/check-legacy-freeze.mjs` | `Legacy freeze intact`, exit 0 | **RED (transient)**: exit 1, 2 untracked log files at repo root (`logs-legacy-serve.txt`, `logs-rebuild-serve.txt`) are outside the allowlist. Must be moved out of the repo and the checker rerun. This is workspace hygiene, not a legacy edit |
| P2 | Contracts valid for this exact commit | `node tools/verify-contracts.mjs` | `contracts valid: …`, exit 0 | PASS: 8 JSON contracts / 8 fixtures / 9 content files / 12 rendered routes / 7 schema artifacts |
| P3 | Greenfield gates green on the exact commit | CI run of `.github/workflows/rebuild.yml` (jobs `workbench`, `rebuild`) | all steps green; artifacts attached | **UNVERIFIED at HEAD**. Last recorded full-green window is the Waves 2–6 checkpoint (`../checkpoints/2026-11-09-waves-2-6.md:52`): 81 files / 645 tests, coverage 88.5/79.6/88.6/90.2, TS7+TS6 clean, build green. Wave 7 was committed afterwards with no checkpoint. Verify: run/read the CI run for the exact cutover commit |
| P4 | Parity matrix green | `node tools/parity/compare.mjs --legacy-url <u> --rebuild-url <u> --routes all --matrix all --themes dark,light --wave 9 --out tools/parity/output/cutover` | exit 0; no unexplained text/pixel diffs (`PARITY.md` §4) | **NOT GREEN**: see `CUTOVER.md` §1 for per-route measured status |
| P5 | Wave 8 complete (SEO/PWA/headers/perf) | Wave 8 checkpoint + `rebuild/scripts/generate-sitemap.mjs --check`, `rebuild/scripts/prerender.mjs --check`, `node tools/perf/bundle.mjs` | generated artifacts drift-free; budgets met | **IN FLIGHT**: generators and `rebuild/netlify.toml` exist untracked; `rebuild/package.json:12` is still plain `"build": "vite build"` (the SEO steps are not wired yet) |
| P6 | Data reconciliation report exists | read-only prod introspection diff vs `contracts/schema/` (`../audit/A3-data.md:171-186`) | no schema/RPC/policy divergence, or an explicit accepted diff list | **UNVERIFIED** — no production access was used. Verify: operator runs A3 §3.3 read-only checks in the maintenance window |
| P7 | Backup created and a restore drill passed | `BACKUP_RESTORE.md` §2–§3 | dump checksum recorded; restore-into-scratch passed; RTO recorded | **UNVERIFIED / not done** |
| P8 | Owner authorisation recorded | `CUTOVER.md` §8 authorisation record | DNS switch, production migration, prod data writes explicitly approved | **NOT YET** |

Do not deploy while P1, P3, P4, P5, P7, or P8 are open.

## 2. What actually deploys (two sites, one repo)

| Site | Config | Build command | Publish dir | State |
|---|---|---|---|---|
| Legacy production (`www.theporadas.com`) | root `netlify.toml` (frozen; read-only) | `npm run verify:env && npm run build` (`netlify.toml:3`) | `dist` | live, serves the archive today |
| Greenfield (staging, then production) | `rebuild/netlify.toml` — **untracked/in flight W8-1**; Netlify **base directory must be `rebuild`** | `npm run build` (`rebuild/netlify.toml:49-51`) | `dist` relative to base (`rebuild/dist`) | no Netlify site created yet (`UNVERIFIED`; verify `netlify sites:list` with owner session) |

Important consequences:

- The root `netlify.toml` is **frozen** by the rules (`../RULES_OF_ENGAGEMENT.md` §3); the greenfield
  site therefore needs its own site-level config (`rebuild/netlify.toml`) and base directory, not a
  root-file edit.
- The frozen `gallery-share` edge function lives at the repository root (`netlify.toml:20-22`,
  `netlify/edge-functions/gallery-share.ts`) and its file is shared with the rebuild config
  (`rebuild/netlify.toml:32-37`). A base-`rebuild` site must still deploy that function — owner/Lead
  decision recorded in the W8-1 report.
- The greenfield build must include the Wave 8 SEO post-steps before this runbook counts it complete:
  the intended wiring is documented in `rebuild/netlify.toml:9-24` (`vite build && build:seo`, with
  `generate-sitemap.mjs --check` / `prerender.mjs --check` as drift gates).

## 3. Environment

Use `ENVIRONMENT.md` §2–§5 as the checklist. The greenfield site needs at minimum:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL` (the origin being tested — staging first,
final origin only at the switch), and at production `VITE_MEDIA_BASE_URL=https://media.wedding.theporadas.com`.
Sentry/GA values stay unset until the owner approves the privacy posture (`CUTOVER.md` OD-9).
Never place `R2_*`, `SUPABASE_SERVICE_ROLE_KEY`, or `SENTRY_AUTH_TOKEN` in a `VITE_*` variable.

## 4. Preview / branch deploy (staging)

Performed by the Lead/owner with their own Netlify session. Commands assume `netlify-cli/24.0.1`
(present on this workstation; **not executed** here because that needs auth and would deploy):

```bash
cd rebuild
netlify link                  # link to the greenfield site (owner session)
netlify build                 # optional local build using the site's env (Lead-owned build policy)
netlify deploy --build --context deploy-preview   # draft deploy URL
```

Verification after the deploy returns its URL:

| Check | Command (read-only) | Expected evidence |
|---|---|---|
| Site up + headers | `curl -sSI <deploy-url>/` | HTTP 200; `X-Frame-Options: DENY`, `Strict-Transport-Security`, CSP present (`rebuild/netlify.toml:84-133`) |
| Prerendered metadata per route | `curl -s <deploy-url>/film` and inspect `<title>`/`og:image` | per-route metadata from `rebuild/src/app/seo/routeMeta.json`; `/admin/*` and `/guest/*` noindex |
| SEO/PWA artifacts drift-free | `cd rebuild && node scripts/generate-sitemap.mjs --check` | exit 0; no diff vs committed `rebuild/public/*` |
| Prerender drift-free | `cd rebuild && node scripts/prerender.mjs --check` | exit 0 |
| Routes reachable | `curl -sSI <deploy-url>/gallery`, `/film`, `/guestbook`, `/upload`, `/guest-photos`, `/print`, `/admin/login` | HTTP 200 (SPA), 404 route returns the app's 404 shell |
| Edge OG contract | `curl -sSI "<deploy-url>/gallery?share=<fixture-id>"` | OG tags rewritten by `gallery-share` (requires edge function to be deployed; `UNVERIFIED` until the function is wired to the base-`rebuild` site) |
| PWA | fetch `/manifest.webmanifest` and `/sw.js` | 200, `Content-Type: application/manifest+json` for the manifest, `no-store` for `sw.js` (`rebuild/netlify.toml:102-116`) |
| Critical e2e / axe | from repo root: `cd rebuild && npm run test:e2e` | exit 0 (note: the Playwright webServer runs `npm run build` → **Lead-owned build; ask before running**) |
| Parity against the preview | from repo root, after legacy + rebuild are served per `PARITY.md` §6: `node tools/parity/compare.mjs --legacy-url http://127.0.0.1:4174 --rebuild-url <deploy-url> --routes all --matrix all --themes dark,light --wave 9 --out tools/parity/output/cutover-preview` | exit 0; summary recorded (see `CUTOVER.md` §1 for the current gap list) |

## 5. Production promote + DNS/Netlify switch (owner-authorised sequence)

Only after §1 P1–P8 are green. Suggested order (mirrors `../audit/A3-data.md` §9 and the owner-approved
maintenance-window decision in `../plans/2026-11-08-workbench.md:13-24`):

1. **Owner authorisation recorded** (`CUTOVER.md` §8). No step below runs without it.
2. **Freeze production writes.** The frozen app has no maintenance flag
   (`../audit/A3-data.md:463-471`): choose one of (a) short read-only window by revoking anon
   INSERT policies + blocking the upload function, or (b) accepted replication window with guest
   writes paused in the UI/deploy. This is a **production data-write action → owner-only**.
3. **Record the pre-cutover baseline**: legacy deploy commit equals the freeze tag; production row
   counts/checksums; R2 object listing + ETag manifest (`BACKUP_RESTORE.md` §2).
4. **Backup** the database and storage manifests; store off-repo, encrypted (`BACKUP_RESTORE.md` §2).
5. **Apply additive migrations** only (`ROLLBACK.md` §3); no destructive step. Production migration is
   owner-authorised (OD-A2).
6. **Promote the greenfield deploy** (deploy to the production site / switch the production slot in
   Netlify) and **attach the custom domain** (`www.theporadas.com`, apex, `wedding.*` redirect) in
   Netlify, then the **DNS change in Cloudflare**. DNS switch is owner-authorised (OD-A1).
7. **Post-switch verification** (same table as §4 plus production URL checks below), then
   re-enable guest writes, record the switch time, and keep the legacy deploy + R2 read-only for the
   rollback window (`ROLLBACK.md` §2).
8. **Do not decommission the legacy app or delete old Netlify deploys** until the rollback window
   closes (`CUTOVER.md` OD-10).

DNS/Netlify prerequisites (all owner-side; `UNVERIFIED` from this workstation because no credentials
were used):

- Cloudflare owns DNS (`docs/archival/DEPLOYMENT_CHECKLIST.md:5-12`); apex/`www` records and the
  `media.wedding.theporadas.com` worker route must remain untouched by the switch.
- Netlify custom domain attached and HTTPS certificate issued **before** the DNS flip; record the
  current TTLs and propose lowering them (≥30 min before the window) — TTL values are dashboard-only,
  `UNVERIFIED`.
- `wedding.theporadas.com → www` 301 must keep working (`netlify.toml:13-18`,
  `rebuild/netlify.toml:58-63`).
- Verify with `netlify domains:list` / dashboard and `dig +short www.theporadas.com` before/after
  (owner session; DNS propagation cannot be proven from the repo).

## 6. Per-step verification matrix (record the output as evidence)

| Step | Command | Expected |
|---|---|---|
| Freeze clean | `node tools/check-legacy-freeze.mjs` | exit 0, "Legacy freeze intact" |
| Contracts | `node tools/verify-contracts.mjs` | exit 0, counts printed |
| Rebuild gates | CI `rebuild.yml` / local `cd rebuild && npm run lint && npm run typecheck && npm run typecheck:ts6 && npm run test:coverage` | 0 problems / 0 errors / thresholds met |
| SEO artifacts drift | `cd rebuild && node scripts/generate-sitemap.mjs --check` | exit 0 |
| Prerender drift | `cd rebuild && node scripts/prerender.mjs --check` | exit 0 |
| Parity | `node tools/parity/compare.mjs … --wave 9 --out tools/parity/output/cutover` | exit 0; `summary.json` verdict `passed` |
| Deployed headers | `curl -sSI https://www.theporadas.com/` | HSTS/CSP/XFO present |
| Deployed OG | `curl -s https://www.theporadas.com/ \| grep -o '<meta property="og:[^>]*>'` | real `og:image` (no 404 HTML fallback; A4 §5 defect R21) |
| Sitemap contents | `curl -s https://www.theporadas.com/sitemap.xml` | public routes only, no `/people` (`rebuild/scripts/generate-sitemap.mjs:1-14`; `contracts/routes.json:153-162`) |
| Admin noindex | `curl -sI https://www.theporadas.com/admin/login` + body | `noindex, nofollow` metadata in prerendered shell |
| Rollback ready | `ROLLBACK.md` §2–§3 evidence bundle | deploy ID + dump checksum recorded |

## 7. Stop / abort conditions

Abort the window and roll back (`ROLLBACK.md`) if any of: post-switch public smoke fails on a
priority-1 route; an unexplained parity diff appears at the production URL; the DNS/certificate step
fails; a migration verification query returns an unexpected count; the backup cannot be verified.
Escalation and owner contact are defined in `CUTOVER.md` §9.

## 8. What this page is not

It is not authorisation to deploy, and it does not record real site IDs, tokens, DNS values, or deploy
IDs beyond the historical ones in `docs/archival/RELEASE_RECOVERY_2026-07-05.md:9-16`. All such values
are `UNVERIFIED` here on purpose and must come from the owner at the cutover window.
