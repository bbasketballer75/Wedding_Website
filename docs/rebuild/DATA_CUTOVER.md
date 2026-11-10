# Data & Media Cutover Plan — Wave 9 (W9-2)

> Status: **analysis complete; owner decisions open**. Read-only Wave 9 artifact: no production
> Supabase, Netlify, R2 or DNS access was used, no migrations were applied, and nothing outside
> `docs/rebuild/DATA_CUTOVER.md` / `tools/cutover/**` was written.
>
> Scope: data + media completeness audit of the frozen repo, migration plan (additive first),
> seed/fixture strategy for preview, media migration plan, and the **owner decisions that must be
> made before cutover**. The actual push/DNS/Netlify switch happens in the approved maintenance
> window with owner credentials (see `docs/rebuild/CUTOVER.md` / checkpoints).

Machine-checkable evidence lives in two new read-only checkers:

| Checker | What it proves | Run |
|---|---|---|
| [`tools/cutover/check-data.mjs`](../../tools/cutover/check-data.mjs) | contract schema == frozen migration chain; media references covered by the media inventory | `node tools/cutover/check-data.mjs [--json] [--ignore-known]` |
| [`tools/cutover/check-migrations.mjs`](../../tools/cutover/check-migrations.mjs) | migration order/duplicates/checksums vs committed history; D1/R17 defect status; greenfield dependency map + additive-first order | `node tools/cutover/check-migrations.mjs [--json] [--expect-r17-fixed]` |

Shared read-only helpers: [`tools/cutover/lib.mjs`](../../tools/cutover/lib.mjs). Neither script
imports any write API (`writeFile`/`mkdir`/`rm`/mutating exec) and neither calls Supabase; the only
process exec is `git ls-files` for the media git-tracking claims. See §1.4 for the no-write proof.

## 0. What the owner must decide (summary)

| # | Decision | Recommendation | Blocks |
|---|---|---|---|
| **D-01** | **R17 repair timing** — the guestbook submit RPC is broken on the frozen baseline and its server-side rate limit is bypassed today | Ship the repaired RPC as a **new additive cutover migration** (`001-r17-...`) in the window, after a read-only prod `pg_get_functiondef` check; never hot-patch the historical file | cutover window start |
| **D-02** | **A3 §6 RLS hardening bundle (S1–S7)** — 7 live RLS/authorization gaps | Close all 7 in a forward migration; S2/S3/S4 change product-visible data access, so each needs explicit owner sign-off (details §7) | Phase 2 migration + app switch |
| **D-03** | **Media migration ordering/method** — how R2/local media is carried | **Preserve bytes in place** (recommended): no copy, no renames, no re-encode; app+DB keep the existing URL contract. Alternative copy/rename rejected in §4 | media migration |
| **D-04** | **Legacy Supabase Storage guest buckets** (`guest-photos`/`guest-videos`/`guest-voice`, policies only, no bucket rows on reset) | Do **not** recreate; leave untouched at cutover; delete decision after rollback window | cleanup |
| **D-05** | **`anniversary_entries` drop replay** — migration `20260410001200` drops this table, no migration creates it | Confirm production table state read-only before the window; **do not replay the drop** on prod unless the owner confirms it is retired/empty | Phase 2 |
| **D-06** | **Unsplash placeholder delete replay** — `20260915020000` deletes Unsplash photo rows | Treat as data hygiene: count matching prod rows read-only; only run if the owner approves (no-op expected) | Phase 2/5 |
| **D-07** | **R21 broken OG image** — `check-data` strict run fails on missing `/images/og-image.webp` | Fix in Wave 8 (ship a real `public/images/og-image.webp` or point the static tag at an existing poster). After the fix, the strict checker goes green | cutover gate |
| **D-08** | **R18 client-side claim "verification"** | Replace with an honest, admin-moderated claim queue (or real verification) before claim endpoints are exposed | Phase 2/app switch |
| **D-09** | **R19 upload-status lookup by email** | Require guest share token / magic link, or remove the lookup panel | Phase 2 |
| **D-10** | **R20 guestbook reactions last-write-wins** | Move to an RPC/append-only reaction rows when the guestbook is rewired; preserve the 4 reaction types | Wave 6 follow-up |
| **D-11** | **Data-volume confirmation + R2 listing handoff** | Owner supplies a read-only R2 object listing + production row counts; record them in the checkpoint (§8/§9) | validation sign-off |

D-01, D-02, D-03 are the gating decisions for the cutover window; D-04…D-11 either block a phase or
must be recorded as accepted residual risk.

## 1. Verification evidence (real output, read-only)

The blocks below are the captured console output; long dependency/legacy lists are abbreviated only
where marked `…`. `--json` produces the complete deterministic object (hashes in Appendix B).

Commands were run from the repo root on 2026-11-09 (branch `rebuild/greenfield`, working tree shared
with other members; only this task's files were added by me).

### 1.1 `check-data` — strict (exits 1: one known finding, R21)

```text
> Schema contract — migrations vs committed contract dumps
  - migrations replayed: 31
  + tables: 18/18 matched
  + columns: 206/206 matched (contract dump has 206)
  + RLS policies: 43/43 matched (public 35, storage 8)
  + RPCs: 21/21 matched
  - triggers: 3/3 matched

> Media inventory coverage — contracts/content + fixtures vs contracts/media/INVENTORY.json
  - buckets: 6; local media dirs: 7
  - references: 610 (113 distinct); kinds: offloaded=104, local=504, synthetic-absolute=2
  - manifest entries checked: 83; resolved local refs: 500
  - destructive statements found in migration history: 2

> Known findings (documented defects, owner-visible)
  ! [R21] /images/og-image.webp: Static og:image referenced by rendered content; the file is
    intentionally absent on the frozen baseline (A4 §5 / R21). Wave 8 SEO work owns the real image
    or a corrected tag. (4 reference(s))

RESULT: 1 mismatches, 0 warnings, 31 migrations
  x [media-missing-local-file] referenced local media does not exist: /images/og-image.webp
    (4 reference(s); known R21)
    (contracts/content/rendered/activity.json#$.snapshots.desktop.meta.ogImage,
     contracts/content/rendered/activity.json#$.snapshots.mobile.meta.ogImage,
     contracts/content/rendered/admin.json#$.snapshots.desktop.meta.ogImage,
     contracts/content/rendered/admin.json#$.snapshots.mobile.meta.ogImage)
exit=1
```

### 1.2 `check-data --ignore-known` (exits 0: no *unknown* mismatch)

```text
> Known findings (documented defects, owner-visible)
  ! [R21] /images/og-image.webp: … (4 reference(s))

RESULT: 0 mismatches, 0 warnings, 31 migrations
  + data + media contract matches the frozen migration chain (read-only check)
exit=0
```

### 1.3 `check-migrations` (exits 0) and the R17 cutover gate

```text
> Migration chain
  + 31 migrations, versions strictly ascending, no duplicate version
  - committed history table: 31 rows in contracts/schema/INVENTORY.md §2
  - checksums (SHA-256) recorded in --json output for the cutover record

> Known-defect status
  + D1/R16 repaired read RPC: invariants hold
    (workbench-note=true, four-semicolons=true, no-type-reference=true)
  ! R17 guestbook rate-limit RPC: UNREPAIRED — latest definition
    supabase/migrations/20240303000003_rate_limiting.sql:195
    (inserts-type-column=true, has-p_type-parameter=true,
     type-drop-migration=supabase/migrations/20260410001200_drop_guestbook_type_and_anniversary.sql)
  - R17 stays a known pre-cutover defect; the cutover gate is --expect-r17-fixed

> Greenfield dependency map (rebuild/src -> migrations)
  - scanned 356 source files; 28 distinct app object references
  + mapped references: 1 channel, 11 rpc, 16 table
  + greenfield requires 25/31 migrations:
    20240303000000_init_schema.sql, 20240303000002_guestbook_comments.sql,
    20240303000003_rate_limiting.sql, 20260312000100_moderation_audit_log.sql,
    20260312000200_site_editorial_features.sql, 20260312000300_site_editorial_features_public_read.sql,
    20260312000400_editorial_workflow_expansion.sql, 20260314000100_media_review_staging.sql,
    20260314000200_admin_photo_updates.sql,
    20260314000300_face_review_faces_and_guest_upload_fingerprints.sql,
    20260315000100_guest_face_tagging_batches.sql, 20260315000200_photo_engagement.sql,
    20260315000600_toggle_photo_like_v2.sql, 20260315000700_add_photo_album.sql,
    20260315000800_photo_album_organizer.sql, 20260315000900_gallery_photo_delete_tools.sql,
    20260316001000_photo_comment_lifecycle_and_delete_key_fix.sql,
    20260316001100_add_photo_download_url.sql,
    20260410001200_drop_guestbook_type_and_anniversary.sql,
    20260427000100_moderation_queue_schema.sql, 20260430000100_activity_log_table.sql,
    20260521000100_photo_claiming.sql, 20260521000200_guest_share_links.sql,
    20260623000100_admin_role_app_metadata.sql,
    20260624000000_fix_guestbook_rpc_drop_type.sql
  - superseded legacy-only migrations: 6
  - indirect objects required by the app RPCs: 5

> Additive-first cutover ordering
  - 1. baseline (additive, forward-only): … required migration set below (or a reviewed 1:1 squash)
  - 2. cutover migration(s) (additive): R17 repair + A3 §6 RLS fixes as new forward migrations
  - 3. backfill + validation: DATA_CUTOVER verification queries, row counts/checksums, media sweep
  - 4. app switch / maintenance window
  - 5. cleanup (only after the rollback window): destructive statements are NOT additive
  - legacy-only (not required): 20240303000001_storage_buckets.sql
  - legacy-only (not required): 20260315000300_fix_toggle_photo_like.sql
  - legacy-only (not required): 20260315000400_replace_toggle_photo_like.sql
  - legacy-only (not required): 20260315000500_finalize_toggle_photo_like.sql
  - legacy-only (not required): 20260428000100_update_auth_metadata.sql
  - legacy-only (not required): 20260915020000_remove_unsplash_placeholder_photos.sql
  ! destructive in history (drop-table): DROP TABLE IF EXISTS anniversary_entries
    (supabase/migrations/20260410001200_drop_guestbook_type_and_anniversary.sql:5)
  ! destructive in history (delete-from): delete from public.photos where url like 'https://images.unsplash.com/%'
    (supabase/migrations/20260915020000_remove_unsplash_placeholder_photos.sql:20)

RESULT: 0 mismatches, 0 warnings, 31 migrations
exit=0
```

`--expect-r17-fixed` (the cutover-window gate) currently fails — by design until the repair ships:

```text
x [r17-not-fixed] --expect-r17-fixed was requested but submit_guestbook_message_with_rate_limit
  still references the dropped type column (supabase/migrations/20240303000003_rate_limiting.sql)
exit=1
```

Indirect dependencies discovered by walking RPC SQL bodies (recorded in `--json`):
`check_rate_limit`, `increment_rate_limit`, `is_admin` (functions), `public.photo_likes`,
`public.rate_limit_logs` (tables).

### 1.4 No-write proof

- `tools/cutover/lib.mjs`, `check-data.mjs`, `check-migrations.mjs` import only
  `node:fs` **read** functions (`readFileSync`, `readdirSync`, `statSync`, `existsSync`),
  `node:path`, `node:crypto` (hash) and `node:child_process` `execFileSync('git', ['ls-files', …])`.
  There is no `writeFile`, `mkdir`, `rm`, `unlink`, `rename`, `cp`, or mutating shell command.
- `git status --porcelain` after the runs shows no change under `supabase/`, `contracts/`, `public/`,
  `src/`, `rebuild/` or any legacy path caused by this task. The only added paths are this document
  and `tools/cutover/**` (plus unrelated pre-existing work by other members).
- The local Supabase stack was not started for W9-2; no DB/query/write occurred anywhere.

## 2. Counts (audited 2026-11-09)

### 2.1 Database schema (contract baseline == frozen migration chain)

| Object | Expected from 31 migrations | Present in `contracts/schema/schema.sql`(+`storage.sql`) | Mismatches |
|---|---:|---:|---:|
| Tables | 18 | 18 | 0 |
| Columns | 206 | 206 | 0 |
| RLS policies (public) | 35 | 35 | 0 |
| RLS policies (storage) | 8 | 8 | 0 |
| RPCs | 21 | 21 | 0 |
| Triggers (app) | 3 | 3 | 0 |

Migrations: **31**, filename versions strictly ascending, no duplicates, exactly the 31 rows
committed in [`contracts/schema/INVENTORY.md`](../../contracts/schema/INVENTORY.md) §2 (labels match).
Per-file SHA-256 checksums: Appendix A.

### 2.2 Greenfield app dependency

- `rebuild/src/**`: **356** source files scanned (tests excluded), **28** distinct app-referenced
  objects: **16 tables**, **11 RPCs**, **1 realtime channel**.
- **25/31** migrations are required by the greenfield app (direct + SQL-body closure).
- **6/31** migrations are legacy-only / data-only for the greenfield contract (listed in §1.3),
  including the 3 superseded `toggle_photo_like` iterations and the out-of-band storage-bucket
  policy file.
- **5** indirect objects (via RPC bodies): `photo_likes`, `rate_limit_logs`,
  `check_rate_limit`, `increment_rate_limit`, `is_admin`.
- No `app-undefined-object` mismatch: every object `rebuild/src` references exists in the migration
  chain.

### 2.3 Media

| Dimension | Count |
|---|---:|
| Media inventory buckets declared | 6 (1 R2/CDN public, 1 private Storage, 3 legacy Storage, 1 dead legacy) |
| Local media directories declared | 7 |
| `MEDIA_MANIFEST.json` entries | 83 (all `existsLocally`, all resolve) |
| Media-looking references found (content + fixtures + fixtures.sql) | 610 |
| Distinct media paths referenced | 113 |
| Offloaded CDN references | 104 (all match a declared bucket path pattern) |
| Local `public/` references | 504 (500 resolve; 4 are the R21 `og-image.webp` finding) |
| Synthetic/mock absolute URLs (fixtures) | 2 (allowed) |
| Uncovered external hosts | 0 |
| Media inventory drift (declared vs measured files/bytes) | 0 |

Local media on disk (re-measured by the checker, metadata only — no copies):

| Directory | Files | Bytes | Git |
|---|---:|---:|---|
| `public/` (root files) | 11 | 26,532 | tracked |
| `public/images` | 542 | 146,067,823 (~139 MiB) | tracked |
| `public/captions` | 1 | 53 | tracked |
| `public/icons` | 12 | 197,473 | tracked |
| `public/video` | 14 | 3,104,823,136 (~2.89 GiB) | ignored |
| `public/background_audio` | 22 | 527,649,160 (~503 MiB) | ignored |
| `public/media` | 22 | 15,477,829 | ignored |
| **`public/` total** | **624** | **3,794,242,006** | 566 tracked |

Cross-checks that passed: `rebuild/src/shared/data/media.ts` still declares exactly
`['/video/', '/background_audio/', '/media/']` and each prefix is covered by a public CDN path
pattern; `public/_headers` CSP still allows `media.wedding.theporadas.com` and `*.r2.dev`.

### 2.4 Mismatches found

Only **one** data/media mismatch, and it is the already-known R21 defect:

| Kind | Detail | File references |
|---|---|---|
| `media-missing-local-file` (known R21) | `/images/og-image.webp` does not exist but rendered content sets it as `og:image` | [`contracts/content/rendered/activity.json`](../../contracts/content/rendered/activity.json) `$.snapshots.{desktop,mobile}.meta.ogImage`; [`contracts/content/rendered/admin.json`](../../contracts/content/rendered/admin.json) same |

No schema mismatch of any kind. No media host/path is uncovered except the missing local file above.
Destructive statements in migration history (recorded, not errors):

| Kind | Statement | File:line | Cutover handling |
|---|---|---|---|
| `drop-table` | `DROP TABLE IF EXISTS anniversary_entries CASCADE` | `supabase/migrations/20260410001200_drop_guestbook_type_and_anniversary.sql:5` | D-05: do not replay unless owner confirms the table is retired/empty |
| `delete-from` | `delete from public.photos where url like 'https://images.unsplash.com/%' …` | `supabase/migrations/20260915020000_remove_unsplash_placeholder_photos.sql:20` | D-06: owner approves a counted no-op/hygiene run |

Additionally **13 schema-supersession drops** exist in history (10 policies, 2 functions, 1 column:
the dropped `guestbook_messages.type`). They are schema history, not data loss, and are **not**
replayed as drops in the additive phase (the baseline creates the final schema directly).

## 3. Known defect status carried into cutover

| ID | Defect | Current baseline state | Cutover action |
|---|---|---|---|
| R16/D1 | `20260624000000_fix_guestbook_rpc_drop_type.sql` (hand-reconstructed, was missing 4 semicolons) and its read RPC `get_guestbook_messages_with_comments()` | **Repaired and verified** (workbench note + 4 semicolons + read body no longer references `gm.type`) | include the repaired migration in the baseline; no further action |
| R17 | `submit_guestbook_message_with_rate_limit` inserts the dropped `guestbook_messages.type` column (and keeps `p_type`) → raises `42703`; the client silently falls back to a direct insert, bypassing server-side rate limiting | **Unrepaired, documented** (A3 §5; checker prints UNREPAIRED) | D-01: ship additive repair `001-r17-*`; then run `check-migrations --expect-r17-fixed` as the gate |

## 4. Media migration plan (R2 / Supabase Storage -> CDN contract)

### 4.1 Current media roles (unchanged by the rebuild)

| Layer | Owner of bytes | What must stay true |
|---|---|---|
| Cloudflare R2 bucket `wedding-media` | origin for `/video/`, `/background_audio/`, `/media/` (film, audio, gallery display/thumbnails, guest uploads `guest-uploads/{photos,videos}/`) | same object keys; original bytes downloadable; public via the CDN |
| Cloudflare Worker `media-rewrite` on `media.wedding.theporadas.com` | path rewrite + CORS + immutable cache + Range/ETag | documented behavior in [`contracts/media/CONTRACT.md`](../../contracts/media/CONTRACT.md) §4; rebuild's `getMediaPath` is byte-compatible (unit-tested) |
| Netlify `dist/` + `public/images/**` | the 542 tracked photography files (same-origin, **not** offloaded) | files stay in the bundle; paths unchanged |
| Supabase Storage | private `media-review-artifacts`; legacy `guest-photos`/`guest-videos`/`guest-voice` policy-only buckets | private artifacts untouched; legacy buckets untouched (D-04) |

### 4.2 Chosen strategy: preserve bytes in place, no destructive renames

**Recommended (D-03):** do **not** migrate/copy/rename/re-encode any media byte for cutover. The
rebuild's media contract is identical to the frozen app's (same URLs, same Worker, same R2 keys), so
cutover is a pure app/DB switch:

- R2 bucket + custom domain + Worker stay exactly as they are; no object moves, no key renames.
- `public/images/**`, `public/captions/**`, `public/icons/**` stay in the rebuild bundle (tracked in
  git; 566 files). `public/video`, `public/background_audio`, `public/media` are gitignored local
  copies used only when `VITE_MEDIA_BASE_URL` is unset; in production they are served from R2.
- `photos.url`, `photos.thumbnail`, `photos.download_url`, `guest_uploads.photo_urls/video_urls`,
  `guestbook_messages.media_url`, editorial `source_url`, review `artifact_paths` are **not
  rewritten**. The frozen thumbnail/legacy names (e.g. `DSC…` -> curated `media/…` renames) are
  handled by the Worker mapping; "fixing" them would break parity.
- Rejected alternative: copy/rename into a new layout would move up to 3.79 GB, invalidate
  immutable caches, require DB URL rewrites and a second verification pass — high risk for zero
  product value, and it would violate the no-media-loss invariant's simplest proof (same bytes,
  same keys).

### 4.3 Media cutover ordering (no destructive renames)

1. **Freeze writes** (maintenance mode): pause guest uploads/guestbook; legacy stays read-only.
2. **Snapshot the media baseline (read-only):** list R2 objects with `ETag`/`Content-Length` into a
   manifest; record `public/` counts/sizes (already recorded in §2.3); record the private
   `media-review-artifacts` object list (service role, operator-only) if it must be preserved.
3. **Verify URL preservation before any switch:** `check-data --ignore-known` green; all 83 manifest
   paths and 610 references resolve from the *deployed* site/CDN (HEAD sweep, §9.3).
4. **DB backup** (see §5 Phase 0) — media is independent of the DB but both are frozen together.
5. **Additive DB migrations** (Phase 1/2) — no media change.
6. **App switch / DNS/Netlify** in the window.
7. **Post-switch media sweep**: every DB-driven media URL HEAD 200/206 + expected headers; spot-check
   original bytes via the download path; 404 count unchanged for a fixed window.
8. **Rollback window**: keep the legacy deploy + R2 bucket read-only for one checkpoint window. R2
   was never mutated, so media rollback is "revert the app deploy/DNS" only.
9. **Cleanup (after window):** none for R2; legacy Supabase Storage bucket deletion only if D-04
   decides so. Never delete R2 keys or local media as part of cutover.

## 5. Database migration plan (additive first)

### Phase 0 — freeze + backup + read-only production capture

1. Maintenance window starts; writes paused (uploads/guestbook/admin).
2. Full logical backup (operator, secrets injected, never committed):
   `pg_dump "$PROD_DB_URL" --format=custom --no-owner --no-privileges -f prod-pre-cutover.dump`
3. Verify the backup restores into a scratch DB and run §9.1 counts there.
4. Read-only production capture for reconciliation:
   - `schema_migrations` rows (expect 31 versions from Appendix A),
   - `pg_policies` (compare with `contracts/schema/policies.md`),
   - `pg_get_functiondef` for every public RPC (compare with `contracts/schema/rpc.md`),
   - table row counts + `pg_total_relation_size` per table,
   - `select public.is_admin()` for the owner session (must be true after auth),
   - R2 listing from step 4.3.2.
5. Record measured numbers in the checkpoint before any write.

### Phase 1 — baseline schema, additive (no drops/renames)

Greenfield requires **25/31** migrations (§1.3). Two acceptable options:

- **Recommended for fidelity:** replay the full migration chain (all 31) or a reviewed 1:1 squash of
  it, forward-only, in order. The 6 "legacy-only" migrations are harmless when replaying in order
  (they create legacy buckets policies/RPC iterations that the app ignores); keeping them avoids a
  bespoke migration-history reconciliation.
- Squash option (allowed by the product contract): build the baseline from
  `contracts/schema/schema.sql` (+ `storage.sql`) and mark the 31 versions repaired in
  `supabase_migrations` at cutover. Must be reviewed against §1/Appendix A; the 6 legacy-only
  migrations still need a recorded disposition (D-04/D-05/D-06).

**Never in Phase 1:** the two data-destructive statements, or the 13 schema-supersession drops.
The baseline creates the final schema directly; drops from history are not replayed.

### Phase 2 — forward cutover migrations (additive only, new files)

1. `001-r17-guestbook-submit-fix.sql` — DROP + CREATE `submit_guestbook_message_with_rate_limit`
   without `p_type`/`type`; keep the rate-limit semantics and return shape; re-grant
   `anon, authenticated`. Sketch in [`audit/A3-data.md`](./audit/A3-data.md) §5.4. After shipping:
   `check-migrations --expect-r17-fixed` must exit 0 (gate).
2. `002-rls-hardening.sql` — the decided S1–S7 bundle (§7):
   - S1 `activity_log`: enable RLS + `for select using (true)` policy (realtime stays functional).
   - S5 `photo_likes`: enable RLS, no write policies (RPC-only).
   - S3 `guest_uploads`: replace "authenticated read all/update" with `is_admin()`-gated policies.
   - S2 `guest_identities`/`guest_share_tokens`: drop public table SELECT; add SECURITY DEFINER
     token lookup RPC; revoke anon/PUBLIC execute where not needed.
   - S4 `guestbook_messages`: add admin delete RPC (`delete_guestbook_message_v1` with
     `public.is_admin()`); do not add a broad DELETE policy.
   - S6 `moderation_audit_log`: insert RPC that derives actor from JWT; revoke direct insert.
   - S7: revoke anon EXECUTE on admin-gated RPCs; pin `search_path` on all SECURITY DEFINER
     functions; add CHECK/enum for `moderation_audit_log.action`.
3. `003-data-hygiene.sql` (optional, per D-06): the Unsplash cleanup as a counted, reviewed delete.
4. Apply in the window with `SET lock_timeout`/transaction expectations; all migrations additive
   (create/replace/grant/revoke; no table drops/renames, no destructive data deletes).
5. Update the client call sites that rely on the replaced paths (guestbook delete, audit insert,
   share-token lookup) in the same wave; the data layer already funnels these calls through the
   respective modules.

### Phase 3 — backfill + validation

- Schema backfill: none expected (baseline + additive migrations produce the target schema).
- Data backfill/repairs to consider and decide (mostly "no"):
  - `app_metadata.role='admin'` for the owner accounts (verify with §9.1 query; promote via the
    service-role admin tool if missing).
  - `activity_log` reconstruction (optional; it is derived from triggers — do not duplicate).
  - Editorial feature publish windows (`starts_at`/`ends_at`) — verify with §9.1.
  - Guest share tokens — verify uniqueness; do not regenerate (links are permanent).
- Run the full §9 validation set; every query has an expected value/row set.

### Phase 4 — app switch

Netlify/DNS switch with owner credentials per `docs/rebuild/CUTOVER.md`; legacy deploy stays live but
read-only for rollback. Run §9.2 + §9.3 post-switch.

### Phase 5 — cleanup (only after the rollback window)

- `anniversary_entries` drop: only if D-05 approved (confirm empty/retired first).
- Legacy Supabase Storage guest buckets: only if D-04 approved.
- Remove the legacy Netlify site/DNS after the agreed retention period; keep R2 untouched.
- Do not run history drops (`drop column type`, drop-function/policy statements) on prod.

### Rollback

- **Before switch:** disconnect/do not switch; production DB untouched except the additive
  migrations, which are backward-compatible for the legacy app (R17 repair changes only the broken
  RPC; RLS tightening could affect legacy app paths → roll back by keeping the legacy app's needed
  grants until after switch, or restrict RLS phase to the post-switch step; see §7 decision notes).
- **After switch:** restore `prod-pre-cutover.dump` into a fresh DB (or point the old app at the
  pre-cutover DB), redeploy the frozen legacy build (immutable Netlify deploy), re-enable writes.
- Media rollback: none needed (bytes untouched; revert app/DNS only).

## 6. Seed / fixture strategy for preview

- **Local development / contract tests:** `supabase db reset` against the sandbox (Wave 0 recipe)
  then apply [`contracts/schema/fixtures.sql`](../../contracts/schema/fixtures.sql) — synthetic only,
  fixed UUIDs, idempotent, media paths point at files that exist in the repo. Never load fixtures
  into a preview/production project.
- **`supabase/seed.sql` is legacy demo data** (12 Unsplash photos + 3 guestbook notes) and must not
  be loaded at cutover; it exists only for the frozen local baseline.
- **Preview/staging for cutover rehearsal:** restore `prod-pre-cutover.dump` into a scratch Supabase
  project, apply Phase 1/2 migrations there, run §9 validation, point a rebuild preview build at it
  (anon key only) and run the parity/e2e smoke suite. Preview holds real data → keep it access
  controlled (private project, no public URL) and never write its data into the repo/artifacts.
- **Owner-visible demo content must not come from production.** If a public demo of the rebuild is
  needed, use fixtures/synthetic content, not the restored backup.

## 7. Owner decisions — detail

### D-01 — R17 repair timing (gating)

- **Facts:** `submit_guestbook_message_with_rate_limit` (defined in
  `supabase/migrations/20240303000003_rate_limiting.sql`, lines 147+) inserts
  `guestbook_messages.type`, which `20260410001200` dropped. It raises `42703`; the frozen client
  falls back to a direct anon insert, so the server-side guestbook rate limit is bypassed today.
  Baseline evidence: [`audit/A3-data.md`](./audit/A3-data.md) §5; checker status in §1.3/§3.
- **Options:**
  - **A (recommended)** Ship `001-r17-...` as a new additive migration in the cutover window, after
    a read-only prod `pg_get_functiondef` comparison. Route stays available; rate limit starts
    working at switch. Gate: `check-migrations --expect-r17-fixed` and the contract test that calls
    the RPC with the repair applied.
  - B Hot-fix production before the window: same SQL, earlier. Only if the owner needs the rate limit
    enforced during the pre-window period; first check prod's function body (it may already have been
    repaired out-of-band like R16).
  - C Defer: **not acceptable** — it leaves the abuse path open post-cutover.
- **Decision needed by:** before Phase 2; owner/Lead own the window.

### D-02 — A3 §6 RLS hardening bundle (gating)

All seven findings are documented in [`audit/A3-data.md`](./audit/A3-data.md) §6 and
[`contracts/schema/policies.md`](../../contracts/schema/policies.md) §3. Recommended disposition:

| Gap | Change (additive migration) | Product impact to sign off |
|---|---|---|
| S1 `activity_log` RLS off | enable RLS + public SELECT policy only | none (feed stays public; anon write surface closes) |
| S2 public SELECT on `guest_identities` + `guest_share_tokens` (email/token enumeration) | revoke public SELECT; SECURITY DEFINER `get_guest_contributions(p_token)` (and narrow claim-lookup RPCs) returning safe fields only | `/guest/:token` must keep working via the new RPC; email→token/claim lookups need explicit design (ties to D-09/R19) |
| S3 `guest_uploads` "authenticated" read-all/update-any | replace with `is_admin()` policies; keep public insert + approved-read | admin moderation unchanged (admin sessions pass `is_admin()`); no non-admin auth users expected |
| S4 no DELETE policy for `guestbook_messages` while admin UI deletes | add admin `delete_guestbook_message_v1` RPC + revoke direct deletes; update rebuild data layer call | admin delete flow must switch to the RPC |
| S5 `photo_likes` RLS off | enable RLS, no write policies (RPC-only) | none (likes already go through `toggle_photo_like_v2`) |
| S6 audit actor client-supplied | insert RPC deriving actor from JWT; revoke direct insert | audit "actor" becomes trustworthy; rebuild moderation module switches to RPC |
| S7 anon EXECUTE on admin RPCs; unpinned `search_path`; audit `action` unconstrained | revoke anon grants, `set search_path` on definer functions, add CHECK/enum | admin calls remain authenticated; no anon behavior change expected |

- **Options:** (a) ship all seven in Phase 2 (recommended, with the listed client follow-ups);
  (b) split: ship S1/S5/S7 pre-switch (low risk) and S2/S3/S4/S6 with the Wave-6/7 app wiring;
  (c) defer any item → must be recorded as accepted residual risk with an expiry.
- **Decision needed by:** Phase 2; each behaviour-changing item (S2, S3, S4, S6) explicitly signed.

### D-03 — Media migration ordering/method (gating)

- **Options:** (a) **preserve bytes in place** — recommended; no R2/local changes, cutover = app/DB
  switch; verification = URL sweep + checksums metadata; (b) copy/rename into a new layout — rejected
  (3.79 GB transfer, cache/DB-URL rewrites, parity/SEO risk, no product value).
- **Ordering for (a):** freeze writes -> R2/ETag + local counts snapshot -> URL-preservation check ->
  DB backup -> additive migrations -> app switch -> media sweep -> rollback window -> cleanup.
- **Decision needed by:** before starting media snapshot (can be same day as window).

### D-04…D-11

| # | Decision detail | Recommendation |
|---|---|---|
| D-04 | Legacy Storage buckets `guest-photos`/`guest-videos`/`guest-voice` have policies but no bucket rows (production created them out-of-band); dead after the upload flow moved to R2 presign | Leave untouched at cutover; do not recreate; decide deletion after rollback window |
| D-05 | `anniversary_entries` is dropped by `20260410001200` but never created by any migration (production may hold historical data) | Check prod existence/row count read-only; do not replay the drop; keep the table unless the owner confirms it is retired and backed up |
| D-06 | `20260915020000` deletes Unsplash placeholder rows | Count matching rows read-only; run only if approved (expected no-op) and after backup |
| D-07 | R21: `/images/og-image.webp` referenced by `contracts/content/rendered/activity.json` + `admin.json` meta but absent locally (checker fails strict) | Wave 8: ship a real OG image or point the tag at an existing poster; strict checker then green |
| D-08 | R18: claim wizard "verification" is client-side only; claims written directly with anon key | Honest admin-moderated queue + honest copy (or real OTP) before claims endpoints are exposed |
| D-09 | R19: upload-status lookup queries `guest_uploads` by email with anon key | Require share token/magic link, or remove the panel; coordinate with S2 |
| D-10 | R20: guestbook reactions are last-write-wins client patches | RPC or append-only reaction rows; preserve 4 reaction types; Wave 6 follow-up |
| D-11 | Data-volume confirmation / R2 listing | Owner supplies read-only R2 listing + prod row counts; record in checkpoint (§8/§9) |

## 8. Data-volume checklist for the owner (capture at Phase 0)

Record these measured values in the cutover checkpoint (read-only commands in §9):

- [ ] Production DB size (`pg_database_size`) and per-table `pg_total_relation_size`.
- [ ] Exact row counts for all 18 tables; compare with the pre-cutover record (same query, before/after).
- [ ] Photos/media references: `count(*)` of `photos`, non-null `download_url`, distinct `url`.
- [ ] Guest uploads by status (`pending/approved/rejected`) + total photo/video URL counts.
- [ ] Guestbook messages + comments counts; claims by status; guest identities/verified count;
      share-token count/uniqueness.
- [ ] Editorial features per slot (expect 4 unique slots), history rows.
- [ ] Media-review batches/clusters/faces counts + `media-review-artifacts` object count/size.
- [ ] `rate_limit_logs` size/retention (can be purged with `cleanup_old_rate_limits`).
- [ ] R2 `wedding-media` object count + total bytes + ETag manifest (read-only listing), compared
      against the local `public/` reference counts in §2.3 (R2 also holds guest uploads + display
      media that are not all in `public/`, so the numbers are not expected to be equal — record
      both).
- [ ] Legacy Storage bucket object counts (if any), frozen read-only.
- [ ] Migrations applied count = 31 (Appendix A) — note any production-only rows in
      `schema_migrations` (out-of-band history) and their disposition.

## 9. Exact verification queries / commands the operator runs

### 9.1 Database integrity (cutover DB, read-only)

```sql
-- A. counts (run before + after; values must be equal for content tables)
select 'photos' t, count(*) from public.photos
union all select 'photo_comments', count(*) from public.photo_comments
union all select 'photo_likes', count(*) from public.photo_likes
union all select 'guest_uploads', count(*) from public.guest_uploads
union all select 'guestbook_messages', count(*) from public.guestbook_messages
union all select 'guestbook_comments', count(*) from public.guestbook_comments
union all select 'guest_identities', count(*) from public.guest_identities
union all select 'photo_claims', count(*) from public.photo_claims
union all select 'guest_share_tokens', count(*) from public.guest_share_tokens
union all select 'site_editorial_features', count(*) from public.site_editorial_features
union all select 'site_editorial_feature_history', count(*) from public.site_editorial_feature_history
union all select 'moderation_audit_log', count(*) from public.moderation_audit_log
union all select 'media_review_batches', count(*) from public.media_review_batches
union all select 'media_review_clusters', count(*) from public.media_review_clusters
union all select 'media_review_faces', count(*) from public.media_review_faces
union all select 'guest_face_tagging_batches', count(*) from public.guest_face_tagging_batches
union all select 'activity_log', count(*) from public.activity_log
union all select 'rate_limit_logs', count(*) from public.rate_limit_logs
order by t;

-- B. data-shape assertions (each must return 0 rows / expected value)
select 'photos missing url' check, count(*) from public.photos where url is null or url = ''
union all select 'duplicate photo urls', count(*) - count(distinct url) from public.photos
union all select 'duplicate identity emails', count(*) - count(distinct email) from public.guest_identities
union all select 'duplicate share emails', count(*) - count(distinct guest_email) from public.guest_share_tokens
union all select 'duplicate share tokens', count(*) - count(distinct token) from public.guest_share_tokens
union all select 'editorial slots', 4 - count(distinct slot) from public.site_editorial_features
union all select 'orphan claims (identity)', count(*) from public.photo_claims c
  left join public.guest_identities i on i.id = c.guest_identity_id where i.id is null
union all select 'orphan claims (photo)', count(*) from public.photo_claims c
  left join public.photos p on p.id = c.photo_id where c.photo_id is not null and p.id is null
union all select 'orphan comments (photo)', count(*) from public.photo_comments c
  left join public.photos p on p.id::text = c.photo_key where p.id is null
union all select 'approved uploads w/o photos', count(*) from public.guest_uploads
  where status = 'approved' and coalesce(array_length(photo_urls,1),0) = 0
  and coalesce(array_length(video_urls,1),0) = 0;

-- C. RLS expected post-hardening (after D-02 migration)
select c.relname, c.relrowsecurity, (select count(*) from pg_policies p
  where p.schemaname='public' and p.tablename=c.relname) as policies
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by 1;
-- expect: all relrowsecurity = true; activity_log and photo_likes each have exactly one SELECT policy.

-- D. RPC inventory + R17 gate
select p.proname, pg_get_function_identity_arguments(p.oid) args, p.prosecdef
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' order by 1;   -- 21 rows, compare with contracts/schema/rpc.md
select pg_get_functiondef('public.submit_guestbook_message_with_rate_limit'::regproc)
       not like '% p_type text%' as r17_fixed;
-- expect: true after 001-r17 migration; false on the frozen baseline.

-- E. admin role model
select count(*) from auth.users where raw_app_meta_data ->> 'role' = 'admin';  -- expect >= 1
select public.is_admin();                                                     -- expect true for an owner session

-- F. migration history
select count(*), max(version) from supabase_migrations.schema_migrations;      -- expect 31 / 20260915020000
```

### 9.2 App/route smoke (after switch)

`/`, `/film`, `/gallery`, `/guestbook`, `/upload`, `/guest-photos`, `/guest/:token`, `/activity`,
`/print`, `/people` (404), `/admin/login`, plus the rebuild's parity suite and a11y gate from the
checkpoint; confirm `getMediaPath` emits the production CDN host for `/video/`, `/background_audio/`,
`/media/` and same-origin `/images/`.

### 9.3 Media URL sweep (read-only, no writes)

```powershell
# From an operator machine with the media manifest (contracts/content/MEDIA_MANIFEST.json) exported:
$paths = (Get-Content contracts/content/MEDIA_MANIFEST.json | ConvertFrom-Json).media | ForEach-Object { $_.path }
foreach ($p in $paths) {
  $u = "https://media.wedding.theporadas.com/$($p.TrimStart('/'))"
  $r = Invoke-WebRequest -Method Head -Uri $u -SkipHttpErrorCheck
  if ($r.StatusCode -notin 200,206) { "FAIL $($r.StatusCode) $u" }
}
```

Also verify headers on `https://media.wedding.theporadas.com/video/main.vtt`: `Content-Type:
text/vtt`, `Access-Control-Allow-Origin` = site origin or `*`, `Accept-Ranges: bytes`,
`Cache-Control: max-age=…`, and Range/206 content-range semantics (contract:
[`contracts/media/CONTRACT.md`](../../contracts/media/CONTRACT.md) §4; live spec:
`tests/e2e-live/media-cors-contract.spec.ts`). For DB-driven media (not in the manifest), export
`select url from photos union select thumbnail from photos union ...` and sweep the same way; compare
counts with §8.

### 9.4 Checker gates (run from the repo root)

```bash
node tools/cutover/check-data.mjs --ignore-known   # exit 0 = no unknown data/media mismatch
node tools/cutover/check-migrations.mjs            # exit 0 = chain + dependency map consistent
node tools/cutover/check-migrations.mjs --expect-r17-fixed  # exit 0 only after D-01 ships
```

## 10. Rollback (data/media)

- Media: nothing to roll back (bytes untouched; §4.2). App deploy revert only.
- DB: restore `prod-pre-cutover.dump` into a clean project or point the legacy app back at the
  pre-cutover database; the additive migrations are the only prod writes and are schema-additive
  (plus the R17 function replacement and RLS changes). Keep the dump local, encrypted, off-repo.
- Legacy deploy: the frozen Netlify deploy is immutable; keep it available for one checkpoint window.
- DNS: point back to the legacy publish; TTLs planned for fast revert.
- Record rollback drill result (RTO) in the checkpoint before the window.

## 11. Assumptions, gaps, and scope limits

1. **Read-only analysis.** No production access was used; production schema/RLS/RPC drift is still a
   Phase-0 read-only diff task (the R16 incident shows production was repaired out-of-band at least
   once). `contracts/schema/*` is the reference, not proof of production.
2. **DB-driven media is a blind spot in the repo checkers (R22).** The 610 references checked are
   code/contract references; the gallery's `photos.url` rows and guest-upload URLs live in the DB
   only. The owner must export them at Phase 0 and sweep URLs (§9.3). The checker explicitly reports
   this coverage boundary rather than pretending completeness.
3. **R2 object listing is unavailable in Wave 9** (needs an owner-provided read-only credential). The
   local `public/` counts are recorded; R2 counts must be captured in Phase 0/D-11.
4. **Checker parsers are statement-level regex scanners** for the exact SQL style used by this repo
   (frozen migrations + `pg_dump` output). They are intentionally dependency-free and read-only; a
   future migration using unusual formatting may need a parser update (the checker reports parse
   warnings instead of silently passing when it cannot parse a block).
5. **R21** is the single known data/media mismatch and blocks the strict `check-data` exit until
   Wave 8 fixes the OG image.
6. Items from `RISK_REGISTER.md` R18/R19/R20 are adjacent product/security decisions (D-08/D-09/D-10)
   that affect Phase 2 endpoints and should be decided in the same owner decision round.
7. Wave 9 makes **no** production mutation; the actual window/credentials/DNS work is the Lead/owner
   step (`docs/rebuild/CUTOVER.md`, checkpoints).

## Appendix A — migration checksums (SHA-256, frozen chain)

Recorded by `node tools/cutover/check-migrations.mjs --json`; use to detect any post-freeze drift
before committing to the cutover baseline.

| Migration | SHA-256 |
|---|---|
| 20240303000000_init_schema.sql | d1c8222353111daeb8546760816153ec09edc46bde56fd86757dc8d875248ddd |
| 20240303000001_storage_buckets.sql | 4f7c71c234a785eea5b41b12abc6c851ca32472b01e2687788077812dcac9a8e |
| 20240303000002_guestbook_comments.sql | 84ecc9da2fe53b5d3c9b141066997f6763160c74c54cf2f7ee1e3feeb61ce335 |
| 20240303000003_rate_limiting.sql | ba56e144d6fefd3267e9427c2d164957aac8ce588ef0f5c817d757b655f75d9b |
| 20260312000100_moderation_audit_log.sql | d916b5bbe3ef732c90a35420ad1868b32ee2bb6f3d15ebce9eab694df870846e |
| 20260312000200_site_editorial_features.sql | 1aadc5d4a499f31e0c9253836515f1613c2dafac1571147fafb8943aee2d7fcf |
| 20260312000300_site_editorial_features_public_read.sql | 966d6f5bda630ccdee2ea5d3e01ab26ed7e165328109db4b2cc5518dae53e686 |
| 20260312000400_editorial_workflow_expansion.sql | db3213b9408a15285fda4688e0546fee2144c4aa5c2ad1723992c33f561cea3a |
| 20260314000100_media_review_staging.sql | 85e837a8af3fbc1e87457bb9c2211428eee23badaef0f41726d668f46809f1ce |
| 20260314000200_admin_photo_updates.sql | 0ada122972324ee0bd189dcf5f9c20b13ac1e1c61c58b6c0e62449e8881bc6cf |
| 20260314000300_face_review_faces_and_guest_upload_fingerprints.sql | bcc0783c8ec716036dbaf9224c86f503b0e8ce655023a50bb0542e41415bcc89 |
| 20260315000100_guest_face_tagging_batches.sql | 3ea535ae48c157b21478c120665731434a6da570c0537f7f0795795a4b35116e |
| 20260315000200_photo_engagement.sql | 19b7ea5385c4ac07334637d842d11544082eb721d0f8030ce18ac349dfd5be75 |
| 20260315000300_fix_toggle_photo_like.sql | c2fb26234a352bd2d4960d27c5fa68bbb1d3307f7f4bb49350577d47355b8ab6 |
| 20260315000400_replace_toggle_photo_like.sql | c84b5d3d42b75382393098afa1cdafbfefc140f8cc6083581c4be450b92afd99 |
| 20260315000500_finalize_toggle_photo_like.sql | 403540348127ffe89141eaf8a34ceab632c19beea9f3dd05680d48fdce1c0f50 |
| 20260315000600_toggle_photo_like_v2.sql | d5d0bb3d79ac27b581ddc9c1c367c7ec435e01da4c7392d9961365ccbd149c4a |
| 20260315000700_add_photo_album.sql | 0ff1ba3f50ca4f4bf6a77803fa1845ecd627a24149ad7511afa6a810511cca36 |
| 20260315000800_photo_album_organizer.sql | b6ea56fc9152cc791479036566c816adf339bf14cde382b6c44aaec087a8e0fa |
| 20260315000900_gallery_photo_delete_tools.sql | d11b152673f858a74dc42c1fd8e3877247b4316dc3c9658a52f601d96020c141 |
| 20260316001000_photo_comment_lifecycle_and_delete_key_fix.sql | 0c82d44d1f95901a87fcd0c4af9e6aba5977d167f8954f26803e75bd071a240d |
| 20260316001100_add_photo_download_url.sql | 35fffae4baae030a5a08d7a633f825c4f311b93b2e0f104a141df1fa56b4ba28 |
| 20260410001200_drop_guestbook_type_and_anniversary.sql | 72131aceca95eac3d74f9f4ef1f5e472aec0e6c40781e2906e07a6a9048e66bc |
| 20260427000100_moderation_queue_schema.sql | 155ab2eb22b5a317e7e34089f7f9c618dc4124aa0918a2444e3c34fc881c4afb |
| 20260428000100_update_auth_metadata.sql | 572665102d543559938ac39e6696139eab5f82dafc08893c1206d4bd73fd838f |
| 20260430000100_activity_log_table.sql | b8ae67613f6757a5d7fb98cc10ca28725cde3767429ecff25987344e1ff9ab0b |
| 20260521000100_photo_claiming.sql | 6de69aec33325cedc9b158c26774e5e2b07ee4ff46448f2484cefbf6a603e5e6 |
| 20260521000200_guest_share_links.sql | 7dda24be7f4cd3bd7fb82faa5f83d4ea8921914f9a310cc2fe69e14f4871eccd |
| 20260623000100_admin_role_app_metadata.sql | 519fc710374680a8d8520719a1f7af565d476b3e26e55fdfd81597de15eab8fa |
| 20260624000000_fix_guestbook_rpc_drop_type.sql | 2ba371b7d83fa52039962804f621324bd894f7ec7fad2f18200a5cde7915738b |
| 20260915020000_remove_unsplash_placeholder_photos.sql | 2a57c85385006b6f1aa8ec567a5bb455530cbf4db2049b93cf2466f5dd9d6b81 |

## Appendix B — checker outputs and machine-readable artifacts

| Artifact | How to reproduce | Notes |
|---|---|---|
| `check-data` strict | `node tools/cutover/check-data.mjs` | exit 1 while R21 is unfixed; JSON with `--json` |
| `check-data` unknown-mismatch gate | `node tools/cutover/check-data.mjs --ignore-known` | exit 0 pre-cutover |
| `check-migrations` | `node tools/cutover/check-migrations.mjs` | exit 0; `--json` adds checksums, dependency map, defect status, additive plan |
| R17 cutover gate | `node tools/cutover/check-migrations.mjs --expect-r17-fixed` | exit 1 now; must be 0 after D-01 ships |
| Full JSON evidence | `--json` on both scripts | `counts`, `mismatches`, `knownFindings`, `defects`, `appDependencies`, `indirectDependencies`, `additiveFirstPlan`, `checksums` |

Checker JSON is deterministic for an unchanged tree (no timestamps in the output), suitable for
checkpoint evidence and CI once the Lead wires it into the rebuild workflow. Verified on 2026-11-09:
two consecutive `--json` runs hash identically — `check-data --json --ignore-known`
`D6F1D2721DEBE4988B0EB3CDCAEF4D72C7F39707C527CC55852493BBAE8D41C2`, `check-migrations --json`
`1217BEBB5BFECE2B378BF19BBA5BF07C8F44E4B85A8A2B8B1BB22BAC96570E8D` (SHA-256).
