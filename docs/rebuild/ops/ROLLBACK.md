# ROLLBACK — hosting, data, media, auth/RLS

Documentation only. **No rollback, restore, or production action was executed.** Derived from the
owner-approved cutover strategy (`../audit/A3-data.md` §9.1–9.6; `../plans/2026-11-08-workbench.md:13-24`),
the data/media plan (`../DATA_CUTOVER.md`), the recorded final parity matrix
(`tools/parity/output/w9-matrix-final5/`, 46 rows: 35 PASS / 5 ALLOWED / 6 documented mobile-only FAIL;
`../CUTOVER.md` §2), and documented production history
(`docs/archival/RELEASE_RECOVERY_2026-07-05.md:9-16`).

Core principle (A3 §9.5): **until the DNS/Netlify switch and the data migration both succeed, the
expected rollback path is "do not switch".** Static hosting rollback is minutes; data restore is the
expensive path and is only needed after production writes.

Changed context after Wave 8: the greenfield deploy now ships **12 prerendered HTML route files**, a
versioned `sw.js` served `no-store`, hashed immutable assets, and additive-only cutover migrations. Each
row below was re-checked against those artifacts.

## 1. Trigger → rollback decision matrix

| Trigger (detected by) | Blast radius | Rollback path | Target time |
|---|---|---|---|
| Greenfield preview fails smoke/parity **before** DNS | none (production untouched) | do nothing; fix or discard the preview | immediate |
| Post-switch public route fails (smoke/matrix) | public read path | §2 deploy revert (+ DNS back if the site differs) | minutes (`UNVERIFIED`, rehearse) |
| Data migration fails verification (§3) | data | §3 restore from the pre-cutover dump; revert deploy too | window-dependent (`UNVERIFIED`, restore drill measures RTO) |
| Media URL/CORS breakage | media serving | §4: bytes never mutated; revert Worker version or config | minutes (`UNVERIFIED`) |
| Auth/RLS regression (admin can't moderate, guests blocked) | writes/admin | §5: apply the matching down-migration or restore from dump | minutes (`UNVERIFIED`) |
| PWA/caching regression (stale HTML/SW) | client cache | §2 step 4: deploy revert + `no-store` policy on `sw.js`/HTML; users may need one reload | minutes |
| Security incident (leaked token, abuse) | trust | rotate secrets (§5, owner-only), CSP/header check, then decide static/data rollback | escalate now |

Abort the whole window (`CUTOVER.md` §7) if **two** independent post-switch checks fail or any
data-loss signal appears.

## 2. Static hosting rollback (Netlify)

Netlify deploys are immutable; rollback = re-publish a previous deploy. The frozen production deploy at
cutover is byte-identical to a deploy of `legacy-freeze-2026-11-08` and is the target. Historical deploy
IDs `6a4a988f7e2119823dc5c102`, `6a4acabcd8025830013ba755` prove the pattern
(`docs/archival/RELEASE_RECOVERY_2026-07-05.md:10-11`).

Steps (owner/Lead session; `netlify-cli/24.0.1` present, **not executed**):

1. Capture **both** deploy IDs before the switch (frozen production + greenfield). Evidence:
   `netlify status`/dashboard — `UNVERIFIED` until captured. If the greenfield site is new (CUTOVER
   OD-11), also record the DNS record set before the flip.
2. Publish the previous deploy (dashboard "Publish deploy" or the equivalent API call with the owner
   token). CLI path is not committed here → `UNVERIFIED`, confirm at rehearsal.
3. If a **separate** greenfield site was cut over, optionally revert DNS to the legacy site; if the same
   site was reused, only the deploy changes (keep DNS pointed at Netlify).
4. **Prerender/cache expectations**: prerendered HTML is served with `Cache-Control: public, max-age=0,
   must-revalidate` (`rebuild/netlify.toml:146-150`), `sw.js`/manifest are `no-store`
   (`rebuild/netlify.toml:120-145`), assets are immutable hashed files. A rollback deploy is therefore
   picked up on the next navigation; existing clients may run the old SW once — note that in the window
   log. `VITE_ENABLE_PWA=1` is the production-only install gate (`rebuild/src/app/pwa.ts:15,25-28`), so a
   preview rollback does not reintroduce install tags.
5. Verify: `curl -sI <origin>/` serves the rolled-back build; `node scripts/verify-deployed-site.js`
   (read-only GET/HEAD; note legacy-specific `og:image` asserts at
   `scripts/verify-deployed-site.js:82-95`); then the public e2e subset and
   `node tools/parity/matrix.mjs --routes priority --matrix all --themes dark,light --wave 9`.

Expected evidence: previous/new deploy IDs, rollback timestamp, HTTP status + one priority-1 route
smoke, cached-artifact headers, matrix verdict.

## 3. Data rollback (additive-first migrations + restore)

Cutover schema strategy: additive-first; the 31-migration history may be squashed
(`../plans/2026-11-08-workbench.md:13-24`; `../DATA_CUTOVER.md` §5). Most changes are mechanically
reversible; the *only* production data writes are the additive migrations, the D-01 R17 function
replacement and the decided D-02 RLS bundle (`../DATA_CUTOVER.md` §7).

| Change class | Forward | Reverse | Verification after reverse |
|---|---|---|---|
| New table/column/index/constraint | additive migration | leave inert, or `DROP` only if unused + owner-approved | existing table counts unchanged; `pg_indexes` snapshot matches |
| RLS policy add/tighten (D-02 S1–S7) | `CREATE POLICY` / `ALTER … ENABLE RLS` | `DROP POLICY` + re-create the frozen definition from `contracts/schema/policies.md` | `pg_policies` diff vs `contracts/schema/policies.md`; anon/admin smoke per `../audit/A3-data.md` §9.4 |
| Function replacement (D-01 R17 fix, `search_path` pinning) | `CREATE OR REPLACE FUNCTION` | re-apply frozen definition from `contracts/schema/rpc.md` / `schema.sql` | `pg_get_functiondef` diff; `check-migrations --expect-r17-fixed` flips back to failing **by design** until re-applied |
| Data backfill (`photos.download_url`, fingerprints) | additive UPDATE | restore affected columns from the pre-cutover dump (per-column UPDATE … FROM scratch) | row counts + sampled checksums vs the Phase-0 baseline (`../DATA_CUTOVER.md` §8-§9) |
| Full restore (worst case) | — | `pg_restore` the custom-format dump into a fresh DB, repoint env, verify §4 queries | restore-verification list in `ops/BACKUP_RESTORE.md` §4 |
| Derived data (`activity_log`) | rebuild from triggers possible | safe to restore/rebuild | counts plausible; triggers present |

Rules: never drop/rewrite production content tables in the window; the destructive statements in the
frozen history are explicitly **not** part of the additive phase (`check-migrations` additive-first plan;
`../DATA_CUTOVER.md` §5). If migrations are pushed via `scripts/supabase-mgmt-api-push.mjs` (supports
`--dry-run`), a refusal about missing local history is a **stop condition**, not something to bypass
(`scripts/supabase-mgmt-api-push.mjs:1-40`).

## 4. Media rollback (no destructive migration)

- R2 bucket `wedding-media` is not mutated by cutover (guest uploads are the only writes, single-object
  presigned PUTs: `netlify/functions/guest-upload-url.ts:63-82`;
  `contracts/media/CONTRACT.md:9-25`), and the chosen strategy is **preserve bytes in place**
  (`../DATA_CUTOVER.md` D-03). Media rollback is therefore a **no-op**.
- The media-derivative pipeline is **not consumed at cutover** (parity requires byte-identical originals;
  `../checkpoints/2026-11-09-waves-7-8.md:34`), so no derivative tree needs reverting.
- Cloudflare Worker `media-rewrite` is versioned (`wrangler.toml:1-11`; historical version
  `60dc14f2-…` in `RELEASE_RECOVERY_2026-07-05.md:12`): to roll back a Worker change, redeploy the
  previous version (owner/wrangler session; not executed here).
- Keep path/encoding rules frozen: only `/video/`, `/background_audio/`, `/media/` offload; `+`/`%20`
  survive (`contracts/media/CONTRACT.md:64-76`). Keep the bucket read-only during the window; do not run
  media batch pipelines against production.

## 5. Supabase Auth + RLS rollback

- Admin is `app_metadata.role === 'admin'` with RLS authoritative (`contracts/routes.json:126`); the
  cutover checks include "promotion survived" and `is_admin()` for the owner
  (`../audit/A3-data.md:499-521`; `../DATA_CUTOVER.md` §9.1).
- Every auth/RLS change ships as a migration and is reversible via the matching down-migration or the
  frozen definition; verify by diffing `pg_policies` against `contracts/schema/policies.md` and functions
  against `contracts/schema/rpc.md`.
- Secret/key rotation is **owner-only** (A7): rotate in the provider dashboards, update Netlify env,
  redeploy; never write values into the repo or this doc (`docs/archival/SECURITY.md:15-29`).
- Telemetry is env-guarded + consent-gated (`rebuild/src/app/seo/telemetry.ts:1-25`); disabling it is an
  env change + redeploy, no data rollback needed.

## 6. Rollback rehearsal (dry-run, preview/scratch only — no production)

Run on a **preview/staging site and a scratch database only**, never production. Record each step's
evidence in the window log.

| # | Step | Command (read-only unless noted) | Expected evidence |
|---|---|---|---|
| R0 | Sanity: no production targets/credentials in shell | operator check (no prod URL exported) | note in log |
| R1 | Freeze + contracts clean | `node tools/check-legacy-freeze.mjs` && `node tools/verify-contracts.mjs` | exit 0 both; paste output |
| R2 | Harness self-check | `node tools/parity/selfcheck.mjs` (`--help` verified) | self-check passes; exit code |
| R3 | Cutover checkers green | `node tools/cutover/check-data.mjs --ignore-known`; `node tools/cutover/check-migrations.mjs` | exit 0 both (R17 gate still 1 by design) |
| R4 | Budget/prod-build artifact | `cd rebuild && npm run build:prod && npm run build:seo:check && npm run perf:budgets` (**Lead-owned build** — ask first) | exit 0; 12 prerendered files; no budget violations |
| R5 | Scratch DB snapshot | `npx supabase --workdir tmp/supabase-sandbox db dump --local --schema public -f <abs>/scratch.sql` (`tmp/` gitignored; sandbox recipe `../audit/A3-data.md:43-80`) | dump file + sha256 |
| R6 | Restore into fresh scratch DB | `psql "$SCRATCH_DB_URL" -f <abs>/scratch.sql` (psql 18.4 present; `pg_dump`/`pg_restore` **not on PATH** — install PostgreSQL client matching major 17, `supabase/config.toml:38`) | restore exits 0; no missing extension errors |
| R7 | Restore verification queries | `../DATA_CUTOVER.md` §9.1 / `../audit/A3-data.md:504-521` | counts match pre-snapshot; RLS/function diffs empty |
| R8 | Static rollback rehearsal | publish the previous **preview** deploy (dashboard; CLI path `UNVERIFIED`) | previous commit marker served; `curl -sI` 200; `Cache-Control` headers as expected |
| R9 | Media manifest sanity | `node scripts/list-r2.mjs` with a **read-only** key (single ListObjectsV2 page — treat as sample; paginate/`rclone ls` 1.75.1 present) or `rclone ls` | spot-checked keys/sizes |
| R10 | Parity against rolled-back site | `node tools/parity/matrix.mjs … --wave 9 --routes priority`; compare with the recorded baseline `tools/parity/output/w9-matrix-final5/` | exit 0 for priority rows except the known mobile residual bundle (gallery mobile capture pagination, admin mobile chrome) + reviewed allowlist; no *new* diff vs the recorded matrix |
| R11 | Record timings/gaps | manual | RTO per step, `UNVERIFIED` items, operator name |

Expected evidence bundle (checkpoint, not git, if URLs are involved): R1–R3 tails, dump checksum, restore
duration, R7 query output, deploy IDs before/after, matrix summary path/verdict, signed RTO line.

## 7. Command/tooling reality check (measured 2026-11-09)

| Tool | Status on this workstation | Consequence |
|---|---|---|
| `git` 2.56.0, `node` 26.8.1, `npm` 11.19.0 | present | R1–R3 usable |
| `netlify` CLI 24.0.1 | present; **not executed** | deploy rollback path `UNVERIFIED` until owner session |
| `wrangler` 4.95.0 | present; **not executed** | Worker version rollback `UNVERIFIED` until owner session |
| `supabase` CLI 2.117.0 (repo devDependency) | present (`npx supabase --version`) | local sandbox dump/restore reusable |
| `psql` 18.4 | present | restore rehearsal possible once a client dump exists |
| `pg_dump` / `pg_restore` | **NOT on PATH** | install the PostgreSQL client (DB major 17) or use the Supabase CLI dump path — `UNVERIFIED` prerequisite |
| `rclone` 1.75.1 | present (not executed) | independent R2 listing option |
| `tools/cutover/check-data.mjs`, `check-migrations.mjs` | committed, read-only, CI-gated | use as the pre-window data gate (`DATA_CUTOVER.md` §9.4) |
