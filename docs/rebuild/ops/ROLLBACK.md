# ROLLBACK — hosting, data, media, auth/RLS

Documentation only. **No rollback or restore was executed.** The plan below is derived from the
owner-approved cutover strategy (`../audit/A3-data.md` §9.1–9.6, `../plans/2026-11-08-workbench.md:13-24`)
and the documented production history (`docs/archival/RELEASE_RECOVERY_2026-07-05.md:9-16`).

Core principle from A3 §9.5: **until the DNS/Netlify switch and the data migration both succeed, the
expected rollback path is "do not switch" rather than "restore production".** Static hosting rollback
is cheap and immediate; data restore is expensive and only needed after writes have happened.

## 1. Trigger → rollback decision matrix

| Trigger (detected by) | Blast radius | Rollback path | Target time |
|---|---|---|---|
| Greenfield deploy preview fails smoke/parity **before** DNS | none (production untouched) | do nothing; fix or discard the preview. No rollback needed | immediate |
| Post-switch public route fails (smoke/parity) | public read path | §2 static rollback (previous immutable deploy) + DNS back if needed | minutes (`UNVERIFIED`, rehearse) |
| Data migration fails verification (§3) | data | §3 restore from pre-cutover dump; static rollback too | window-dependent (`UNVERIFIED`, restore drill measures RTO) |
| Media URL/CORS breakage | media serving | §4: no data mutation; fix CDN/Worker config or revert Worker version; R2 untouched | minutes (`UNVERIFIED`) |
| Auth/RLS regression (admin can't moderate, guests blocked) | writes/admin | §5: run the down-migration for the policy/function change, or restore section from dump | minutes (`UNVERIFIED`) |
| Security incident (leaked token, abuse) | trust | rotate secrets/keys (§5, owner-only), CSP/header hardening, then decide static/data rollback | immediate escalation |

Abort the whole window (`CUTOVER.md` §9) if **two** independent post-switch checks fail or any
data-loss signal appears.

## 2. Static hosting rollback (Netlify)

Netlify deploys are immutable; rolling back means re-publishing a previous deploy. Historical deploy
IDs recorded in `docs/archival/RELEASE_RECOVERY_2026-07-05.md:10-11` prove this is how the archive has
been operated (`6a4a988f7e2119823dc5c102`, `6a4acabcd8025830013ba755`). The frozen production deploy at
the cutover is the natural rollback target and is byte-identical to a deploy of `legacy-freeze-2026-11-08`.

Steps (owner/Lead session; `netlify-cli/24.0.1` is installed on this workstation but **no command was
executed**):

1. Capture **both** IDs before the switch: the frozen production deploy ID and the greenfield deploy
   ID. Evidence: `netlify status` / site → Deploys (dashboard) — `UNVERIFIED` until captured.
2. To roll back: publish the previous deploy (Netlify dashboard "Publish deploy", or the equivalent
   API/CLI call with the owner token). CLI path is not committed in this repo → verify with
   `netlify deploy --help` / dashboard at rehearsal time — `UNVERIFIED`.
3. If the custom domain was switched: keep DNS pointed at Netlify (the site does not change), only the
   deploy changes. Reverting DNS is only needed if the greenfield deploy lives on a *different*
   Netlify site (owner choice, `CUTOVER.md` OD-11).
4. Invalidate the PWA cache path: `sw.js` is served `no-cache, no-store` and the manifest is
   `no-store` (`rebuild/netlify.toml:102-116`), so a rollback deploy is picked up on next load; the
   legacy `public/_headers` already enforces no-store for `sw.js`/`registerSW.js`/`manifest` (A4 §5).
   Existing clients may still run the old service worker once — record that expectation in the window log.
5. Verify: `curl -sI <origin>/` for the frozen build marker; `node scripts/verify-deployed-site.js`
   (requires `VITE_SITE_URL`, performs read-only GET/HEAD; note it asserts legacy-specific
   `og:image` paths — `scripts/verify-deployed-site.js:82-95`), then re-run the public e2e subset
   (`npm run test:e2e:public`, Lead-owned build) and the parity harness against the restored legacy
   origin (`node tools/parity/compare.mjs --rebuild-url <restored-url> --wave 9`).

Expected evidence to capture: previous/new deploy IDs, rollback timestamp, `/` HTTP status, one
priority-1 route smoke output, `sitemap.xml`/`robots.txt` hashes, and the parity `summary.json`.

## 3. Data rollback (additive-first migrations + restore)

Strategy comes from the owner-approved plan: schema may be **squashed** at cutover and the 31-migration
history need not be replayed (`../plans/2026-11-08-workbench.md:13-24`; `../audit/A3-data.md:486-499`).
Migrations are applied **additive-first**, so most steps have a mechanical reverse.

| Change class | Forward | Reverse | Verification after reverse |
|---|---|---|---|
| New table/column/index/constraint | additive migration | `DROP` only if unused and owner-approved; otherwise leave (inert) | `select count(*)` unchanged on existing tables; `pg_indexes` snapshot matches |
| RLS policy add/tighten (A3 §6 fixes S1–S7) | `CREATE POLICY` / `ALTER … ENABLE ROW LEVEL SECURITY` | `DROP POLICY <name>` + re-create the frozen definition from `contracts/schema/policies.md` | `pg_policies` diff vs `contracts/schema/policies.md`; anon/admin smoke from A3 §9.4 |
| Function replacement (guestbook RPC R17 fix, `search_path` pinning, audit constraints) | `CREATE OR REPLACE FUNCTION` | re-apply the frozen definition from `contracts/schema/rpc.md` / `schema.sql` | `pg_get_functiondef` diff; call the RPC in the local sandbox |
| Data backfill (`photos.download_url`, `guest_uploads` fingerprints) | additive UPDATE | restore affected columns from the pre-cutover dump (per-column `UPDATE … FROM` scratch table) | row counts + sampled checksums vs pre-cutover baseline (`../audit/A3-data.md:470-484`) |
| Full restore (worst case) | — | `pg_restore` the custom-format dump into a fresh DB, repoint env, verify §3 queries | `../audit/A3-data.md:504-521` query list |
| Derived data (`activity_log`) | rebuild from triggers if desired | safe to restore or rebuild; it is derived (`A3 §9.3`) | row count plausible; triggers present |

Rules:

- **Never drop or rewrite production content tables** in the window; the only destructive path allowed
  is "restore from the verified dump into a fresh DB and repoint".
- Capture the pre-cutover baseline (row counts + per-table checksums, A3 §9.1) **before** any write;
  that is what makes both verification and rollback possible.
- Migration history reconciliation: if migrations are pushed via the Management API script
  (`scripts/supabase-mgmt-api-push.mjs`, supports `--dry-run`), it refuses to silently re-apply when
  remote history misses a local file (`scripts/supabase-mgmt-api-push.mjs:9-40`) — treat that refusal
  as a stop condition, not something to bypass.

## 4. Media rollback (no destructive migration)

- R2 bucket `wedding-media` is **never mutated by the cutover**: guest uploads are the only writes and
  they are presigned single-object PUTs (`contracts/media/CONTRACT.md:9-25`;
  `netlify/functions/guest-upload-url.ts:63-82`). Therefore media rollback is a **no-op**.
- The Cloudflare Worker `media-rewrite` is versioned (`wrangler.toml:1-11`;
  historical version `60dc14f2-…` in `RELEASE_RECOVERY_2026-07-05.md:12`). To roll back a Worker
  change, redeploy the previous Worker version (owner/wrangler session; not executed here).
- Path/encoding rules must not change during the window: only `/video/`, `/background_audio/`,
  `/media/` are offloaded, and `+`/`%20` path segments must survive (`contracts/media/CONTRACT.md:64-76`).
- Keep the bucket and objects read-only during the rollback window; do not run media batch pipelines
  (`npm run media:*`) against production.

## 5. Supabase Auth + RLS rollback

- Admin access is `app_metadata.role === 'admin'` (UI check) with RLS authoritative
  (`contracts/routes.json:126`); the A3 cutover checks include "verify the promotion survived" and
  `is_admin()` for the owner (`../audit/A3-data.md:499-521`).
- Every auth/RLS change ships as a migration and is reversible by the matching down-migration or by
  restoring the frozen definition; verify by diffing `pg_policies` against
  `contracts/schema/policies.md` and functions against `contracts/schema/rpc.md`.
- Secret/key rotation is **owner-only**: Supabase API keys, R2 keys, Sentry token, Netlify tokens.
  Rotate in the provider dashboards first, then update Netlify env, then redeploy; never put rotated
  values in the repo or this doc (`docs/archival/SECURITY.md:15-29`).

## 6. Rollback rehearsal (dry-run, preview branch only — no production)

The card asks for a rehearsal script; this is the exact checklist. Run it on a **preview/staging site
and a scratch database only** — never against production. Each step records evidence in the window log.

| # | Step | Command (read-only unless noted) | Expected evidence |
|---|---|---|---|
| R0 | Confirm no production credentials/targets in the shell | `env \| grep -Ei 'prod\|production'` (operator judgement) | no accidental production URL |
| R1 | Freeze + contracts are clean | `node tools/check-legacy-freeze.mjs` && `node tools/verify-contracts.mjs` | exit 0 both; paste output |
| R2 | Locally validate the rollback artefacts | `node tools/parity/selfcheck.mjs` (options via `--help`; verified) | self-check passes; paste exit code |
| R3 | Take a scratch DB snapshot (operator, local sandbox) | `npx supabase --workdir tmp/supabase-sandbox db dump --local --schema public -f <abs>/scratch.sql` (`tmp/` is gitignored; sandbox recipe `../audit/A3-data.md:43-80`) | dump file + sha256 |
| R4 | Rehearse restore into a fresh scratch DB | `psql "$SCRATCH_DB_URL" -f <abs>/scratch.sql` (psql 18.4 present; `pg_restore`/`pg_dump` **not on PATH** — install PostgreSQL client v17+ or use the Supabase CLI dump; `UNVERIFIED` until installed) | restore exits 0; no missing extension errors |
| R5 | Restore verification queries | queries from `../audit/A3-data.md:504-521` (counts, RLS on 16/18 tables, function list) | counts match pre-snapshot; policy/function diffs empty |
| R6 | Rehearse static rollback on the preview site | publish the previous preview deploy (dashboard; `UNVERIFIED` CLI path) | previous commit marker served; `curl -sI` 200 |
| R7 | Rehearse media manifest check | `node scripts/list-r2.mjs` with a **read-only** R2 key (prints object keys/sizes; single ListObjectsV2 page — treat as sample, see `BACKUP_RESTORE.md` §2) or `rclone ls` (rclone 1.75.1 present) | spot-checked keys/sizes match manifest |
| R8 | Rehearse parity against the rolled-back site | `node tools/parity/compare.mjs --legacy-url <legacy> --rebuild-url <preview-or-restored> --routes priority --matrix all --themes dark,light --wave 9 --out tools/parity/output/rehearsal-rollback` | exit 0 or only reviewed allowlist entries |
| R9 | Record timings + gaps | manual table | RTO per step (minutes), anything `UNVERIFIED`, name of the operator |

Expected evidence bundle for the rehearsal (store in the checkpoint, not in git if it contains URLs):
exit codes and tails for R1–R2, dump checksum, restore duration, R5 query output, deploy IDs before/after,
parity `summary.json` path/verdict, and the operator's signed RTO line.

**Do not rehearse by restoring into production or by flipping DNS.** The rehearsal proves the mechanics;
the real window is separately owner-authorised (`CUTOVER.md` §8).

## 7. Command/tooling reality check (measured 2026-11-09)

| Tool | Status on this workstation | Consequence |
|---|---|---|
| `git` 2.56.0, `node` 26.8.1, `npm` 11.19.0 | present | §2/§6 non-deploy steps usable |
| `netlify` CLI 24.0.1 | present; **not executed** (needs auth) | dashboard/CLI rollback path `UNVERIFIED` until owner session |
| `wrangler` 4.95.0 | present; **not executed** | Worker version rollback path `UNVERIFIED` until owner session |
| `supabase` CLI 2.117.0 (repo devDependency) | present (`npx supabase --version`) | local sandbox dump/restore reusable |
| `psql` 18.4 | present | restore rehearsal possible once a client dump exists |
| `pg_dump` / `pg_restore` | **NOT in PATH** | A3 §9.2 commands need a PostgreSQL client install (DB major version 17, `supabase/config.toml:38`); `UNVERIFIED` owner decision |
| `rclone` 1.75.1 | present (not executed) | independent R2 listing option |
| `node tools/cutover/lib.mjs` | untracked, IN FLIGHT; read-only helpers only | future cutover checkers are being written; do not depend on them yet |
