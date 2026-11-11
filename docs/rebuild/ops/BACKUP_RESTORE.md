# BACKUP_RESTORE — what must survive, how to prove it

Documentation only. **No backup, restore, or production read was executed while writing this page.**
Everything here is derived from repo artifacts; owner-only operations are marked. Measured state:
2026-11-09, HEAD `3deee67`.

## 1. What must be backed up (and why)

| Asset | Where it lives | Size / shape (evidence) | Backup method | Cadence | Owner-only? |
|---|---|---|---|---|---|
| Database schema + data | Supabase project `zaczcyzvavetgfuucljf` (`supabase/config.toml:5`) | 18 tables / 206 columns / 71 indexes / 35 public policies + 8 storage policies / 21 functions, from 31 migrations (`contracts/schema/INVENTORY.md:15-30`) | full logical dump, custom format (`../audit/A3-data.md:473-484`) | **mandatory at T-0**; then per owner policy (recommend monthly + after each content batch) | **yes** (credentials) |
| Migration history + contracts | git: tag `legacy-freeze-2026-11-08` → `dd0cf48`; `supabase/migrations/` (31 files); `contracts/**` | 31 migrations; schema dump SHA-256 `A162C56B…F267`, storage `7968E457…2E82` (`contracts/schema/INVENTORY.md:30`) | git tag/branch is the backup; also archive the tag commit (`git archive`) | on every wave/cutover | no |
| Media objects (originals, video, audio, guest uploads) | Cloudflare R2 bucket `wedding-media` via Worker `media-rewrite` (`wrangler.toml:1-11`; `contracts/media/CONTRACT.md:11-18`) | object count/size not enumerable read-only from the repo — **UNVERIFIED** (needs an R2 read-only key) | provider-side versioning/lifecycle (owner) + independent listing/manifest | at T-0 and after media batches | **yes** |
| Private admin artifacts | Supabase Storage bucket `media-review-artifacts` (`contracts/media/CONTRACT.md:16`) | private bucket; object count **UNVERIFIED** | `supabase storage` copy with service key (`../audit/A3-data.md:480`) or dashboard download | at T-0 | **yes** (service key) |
| Tracked static media | git `public/images/**` | 542 files / 139 MB tracked, incl. `shared-gallery-new/` 473 files / 88 MB (`../RISK_REGISTER.md:28`, R22) | git tag/archive | as above | no |
| Untracked heavy media | local `public/{video,background_audio}` (gitignored) | 3.6 GB total `public/`; video 2.96 GB + audio 503 MB (`../RISK_REGISTER.md:46-47`) | **not a repo backup** — the durable copies are the R2 objects; keep raw masters outside the repo | owner-defined | **yes** |
| Hosting/deploy config | Netlify site settings + root `netlify.toml` (frozen) + `rebuild/netlify.toml` (untracked, IN FLIGHT) | `netlify.toml:1-33`; greenfield config `rebuild/netlify.toml` | export env **names** (never values) + site config screenshot/export; repo files are in git/checkpoint | T-0 | **yes** |
| DNS/CDN config | Cloudflare zone `theporadas.com`, Worker routes, R2 bucket settings (`wrangler.toml:9-11`) | not in repo (dashboard) | zone export / record screenshot; Worker version list | T-0 | **yes** |
| Supabase Auth settings (site URL, redirect allow-list, providers) | Supabase dashboard | local dev values in `supabase/config.toml:152-158`; production values **UNVERIFIED** | dashboard export/screenshot | T-0 | **yes** |
| Secrets | Netlify env, Supabase, Cloudflare, Sentry, GA, `.env` (gitignored) | names in `ENVIRONMENT.md` §2–§4; no values in repo (`docs/archival/SECURITY.md:15-29`) | secret manager backup / break-glass procedure | T-0 + rotation | **yes** |
| Historical deploys | Netlify deploy history | deploy IDs recorded historically (`docs/archival/RELEASE_RECOVERY_2026-07-05.md:10-14`) | Netlify retains deploys; record the pre-cutover production deploy ID | T-0 | **yes** (dashboard) |
| Archived planning/evidence | `docs/rebuild/**`, `contracts/**` | e.g. `contracts/baseline/metrics.json` (43124 B), checkpoints | git | n/a | no |

## 2. Backup procedure (operator workstation; not executed here)

```bash
# 0) Record what is being backed up
git rev-parse HEAD && git rev-parse 'legacy-freeze-2026-11-08^{commit}'
node tools/check-legacy-freeze.mjs "Legacy freeze intact"
node tools/verify-contracts.mjs       # contracts valid
# read-only data/media gates (same pair CI runs; see DATA_CUTOVER.md §9.4)
node tools/cutover/check-data.mjs --ignore-known    # 0 unknown mismatches, 31 migrations
node tools/cutover/check-migrations.mjs             # chain + greenfield dependency map consistent
# the production data-volume checklist to fill at T-0 is DATA_CUTOVER.md §8 (D-11 owner handoff)

# 1) Database: full logical dump (schema + data), custom format, no owner/privileges
pg_dump "$PROD_DB_URL" --format=custom --no-owner --no-privileges --file=prod-pre-cutover.dump
sha256sum prod-pre-cutover.dump > prod-pre-cutover.dump.sha256
pg_restore --list prod-pre-cutover.dump | head        # sanity: tables/functions present

# 2) Pre-cutover content baseline (for content-loss comparison)
psql "$PROD_DB_URL" -Atc "select 'photos', count(*) from public.photos union all
  select 'guestbook_messages', count(*) from public.guestbook_messages union all
  select 'guest_uploads_approved', count(*) from public.guest_uploads where status='approved' union all
  select 'guest_share_tokens', count(*) from public.guest_share_tokens" > row-counts.txt
# per-table checksum is specified in ../audit/A3-data.md:470-471

# 3) Storage manifests
node scripts/list-r2.mjs              # read-only R2 listing (needs R2 creds; prints keys/sizes)
# or: rclone ls <remote>:wedding-media | sort > r2-listing.txt   (rclone 1.75.1 present)
# signed/ETag manifest: HEAD every manifest URL (media CONTRACT §7 proof plan)

# 4) Supabase Storage private bucket (service key, operator only)
npx supabase storage cp -r ss:///media-review-artifacts ./backup/media-review-artifacts   # UNVERIFIED syntax for CLI 2.117

# 5) Repo/contracts snapshot
git archive --format=tar.gz --output=workbench-snapshot.tar.gz HEAD
```

Keep the dump, manifests and CSV checksums **off-repo, encrypted**. Never commit them (`.gitignore`
already excludes `.env` and heavy artifacts; do not rely on that alone).

## 3. Restore runbook (scratch first, production only in an authorised window)

1. Provision/choose a scratch database (same major version 17 — `supabase/config.toml:38`) or a local
   sandbox per `../audit/A3-data.md` §1.2.
2. Restore schema+data: `pg_restore --dbname "$SCRATCH_DB_URL" --no-owner --no-privileges prod-pre-cutover.dump`.
3. Run the verification queries in §4; compare with `row-counts.txt`.
4. Re-run the rebuild against the restored copy (read-only): serve the app and run the parity harness
   (`node tools/parity/compare.mjs … --out tools/parity/output/restore-drill`) plus the local data
   contract tests (`rebuild/src/shared/data/*.test.ts` via `npx vitest run`; the opt-in Supabase
   contract test needs a local sandbox).
5. Only if the restore target is production (owner-authorised): repoint env, re-enable traffic, then
   run `DEPLOY.md` §4 smoke checks and record the restore time (RTO).

## 4. Restore verification queries (from `../audit/A3-data.md:504-521`)

```sql
select count(*) from public.photos;                                  -- compare to row-counts.txt
select count(*) from public.guestbook_messages;                      -- compare
select count(*) from public.guest_uploads where status='approved';   -- compare
select count(*) from public.guest_share_tokens;                      -- compare
-- RLS enabled where expected: 16/18 before fixes (18/18 after), see contracts/schema/INVENTORY.md
select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' order by 1;
-- functions must match contracts/schema/rpc.md (21 public functions)
select proname, prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' order by 1;
-- admin gate still true for the owner identity (run in the app/auth context, not as service role)
select public.is_admin();   -- expects true for the owner session; RPC name per contracts/schema/rpc.md
```

Then: **media HEAD sweep** — every URL in `contracts/content/MEDIA_MANIFEST.json` plus every
`photos.url` / `photos.thumbnail` / `guest_uploads.photo_urls` / guestbook `media_url` must return 2xx
(and originals must return original bytes; captions `text/vtt` + CORS) per
`contracts/media/CONTRACT.md` §7 (`../RISK_REGISTER.md:28` R22). Finally run the public smoke and the
parity gate; a restore is not "verified" until the app renders from it.

## 5. Cadence and retention (owner decisions)

- **T-0 / cutover:** mandatory, with checksum + restore drill (§3) before any production write.
- **Post-cutover:** owner chooses periodic logical backups (monthly is the proposed default) plus an
  on-demand backup after each large media batch; provider plan-level backups/retention are **not
  visible from the repo → `UNVERIFIED`**. Verify: Supabase dashboard → Database → Backups and the
  contract tier; record the retention window in `CUTOVER.md` OD-12. The owner-side data-volume/R2
  handoff is `DATA_CUTOVER.md` §8 (D-11).
- **Retention:** keep the pre-cutover dump and the frozen legacy deploy/R2 state for at least the
  full rollback window; exact retention is owner policy (OD-10). Media contract requires originals to
  keep returning original bytes indefinitely (`contracts/media/CONTRACT.md:1-5`).

## 6. Owner-only actions (explicit)

1. Read production data / run `pg_dump` against prod; export R2/Storage listings with credentials.
2. Restore into any production-adjacent database or repoint production env.
3. Rotate Supabase/R2/Sentry/Netlify/Cloudflare secrets.
4. Decide backup cadence, retention window, and whether provider-level backups are sufficient.
5. Approve any restore that could overwrite production data (this is a production data write).

## 7. `UNVERIFIED` register for this page

| Gap | Verification step |
|---|---|
| R2 object count / total bytes | owner supplies a read-only R2 key; run `node scripts/list-r2.mjs` — note the script issues a **single** `ListObjectsV2` page (no pagination, `scripts/list-r2.mjs:25-46`), so for a large bucket treat it as a sample and use `rclone ls` or a paginated script for completeness |
| Supabase Storage `media-review-artifacts` contents | `supabase storage ls ss:///media-review-artifacts` with the service key (owner) |
| Provider backup tier/retention | Supabase dashboard → Backups |
| `pg_dump`/`pg_restore` availability | not on this workstation's PATH (measured 2026-11-09); install PostgreSQL client matching major 17 or use the Supabase CLI dump path |
| `npx supabase storage cp` syntax/availability in 2.117.0 | `npx supabase storage cp --help` (cheap, local) before the window |
| Production database URL / connection method | A3 notes the prod host is IPv6-only and the pooler is off (`scripts/supabase-mgmt-api-push.mjs:1-10`); confirm the backup path can actually reach prod (Management API vs psql) before T-0 |
| Restore RTO | measure during the rehearsal (`ROLLBACK.md` §6 R3–R5) and record here |
