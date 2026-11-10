# Local Supabase Contract Evidence — Wave 9 (W9-7)

> Status: **COMPLETE** — one fresh, reproducible evidence run of the greenfield data-layer contract
> suite against the documented local Supabase sandbox, plus cutover checker JSON/hashes.
>
> Read-only with respect to the repo: the only files added by this task are this document and
> `tmp/evidence/contract-35/**` (gitignored). No production Supabase access, no migrations applied to
> any production project, no writes to `contracts/`, `supabase/`, `rebuild/`, `public/`, `src/` or
> legacy files. The sandbox was stopped with `--no-backup` afterwards (§7).

## 0. Snapshot identity

| Field | Value |
|---|---|
| Date / window | 2026-11-09, 19:46–19:58 America/New_York (evidence capture completed 19:58) |
| Branch | `rebuild/greenfield` |
| Capture commit | `056ae0c4965700799c66b9975e5ba44a6b20692f` (`feat(wave8): prerender/PWA/perf pipeline, gallery parity wiring, ops + cutover tooling`) |
| Final tree commit | `2357fe336db04d628a12271511d673ebcd4cc278` — two commits landed during the run (`16ebc8b feat(wave9): guest/film/admin data wiring, lightbox integration, media decision + cutover docs`, `2357fe3 chore(rebuild): drop stray agent log files and ignore rebuild-root logs`). Checker hashes and the contract-run conditions were **re-verified byte-identical on the final tree** (§5); the data layer, `contract.test.ts`, `vitest.config.ts` and `rebuild/package.json` are unchanged between capture and final HEAD. |
| Working tree | dirty at capture: **44** porcelain entries from other members' concurrent Wave 9 work (e.g. `contracts/parity-allowlist.json`, `docs/rebuild/*`, `rebuild/src/app/router.tsx`, gallery/film feature files); that work was committed during the evidence run. Final `git status`: **only this new document is untracked** (nothing else dirty). |
| Evidence artifacts | `tmp/evidence/contract-35/**` (gitignored; see Appendix B for names/hashes) |
| Sandbox | `tmp/supabase-sandbox`, `project_id = theporadas-workbench`, ports +1000, **Not linked** (no remote project) |
| Other workspaces | `resell-os` Supabase stack (9 containers) was running before and after this run and was **not touched** (different project id and default ports) |

Because the repo tree was simultaneously being edited by other members, the hashes in §5 are a
snapshot of the tree at capture time; `tmp/evidence/contract-35/*.json` are the exact captured bytes.

## 1. Observed environment

| Tool / service | Version |
|---|---|
| Node.js | v26.8.1 |
| npm | 11.19.0 |
| Docker | 29.7.2 (build a7dcaa6) |
| Supabase CLI | 2.117.0 (update available v3.1.0 — intentionally **not** upgraded for reproducibility) |
| PostgreSQL | 17.6 (`x86_64-pc-linux-gnu`, gcc 15.2.0), image `postgres:17.6.1.167` |
| GoTrue (auth) | `gotrue:v2.196.0` |
| PostgREST | `postgrest:v16.2` |
| Storage API | `storage-api:v1.72.1` |
| Realtime | `realtime:v2.130.0` |
| Studio | `studio:2026.08.24-sha-8ec45b2` |
| postgres-meta | `postgres-meta:v0.99.0` |
| Mailpit (inbucket) | `mailpit:v1.30.2` |
| Edge Runtime | `edge-runtime:v1.74.3` |
| Logflare (analytics) | `logflare:1.50.6` |
| Vector | `vector:0.53.0-alpine` |

Sandbox endpoints observed (`supabase status`): API `http://127.0.0.1:55321`, DB
`postgresql://postgres:postgres@127.0.0.1:55334/postgres`, Studio `55323`, Mailpit `55324`;
status prints **`Not linked.`** (a purely local sandbox).

## 2. Copy-paste reproduction (Wave 0 sandbox recipe)

All commands run from the repo root unless noted. The sandbox directory already exists in this
repo (`tmp/supabase-sandbox`); if it is missing, recreate it by copying the project's
`supabase/config.toml`, `migrations/`, `seed.sql` into `tmp/supabase-sandbox/supabase`, setting
`project_id = "theporadas-workbench"` and ports `+1000` (API 55321, DB 55334, Studio 55323,
Pooler 54329, Shadow 55320, …). Never copy `supabase/.temp` (it links production) and never start
this sandbox in a linked state. Reference: `docs/rebuild/audit/A3-data.md` §1.2 and
`docs/rebuild/DATA_CUTOVER.md` §11.

### 2.1 Start / reset / fixtures (bash)

```bash
# 1. start the sandbox (ports +1000, project_id theporadas-workbench)
npx supabase --workdir tmp/supabase-sandbox start

# 2. deterministic clean DB: applies all 31 migrations in order, then supabase/seed.sql
npx supabase --workdir tmp/supabase-sandbox db reset

# 3. synthetic fixtures (local only; NEVER on production/preview)
docker exec -i supabase_db_theporadas-workbench \
  psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 < contracts/schema/fixtures.sql

# 4. capture sandbox env (shell-assignment output of this CLI version)
npx supabase --workdir tmp/supabase-sandbox status -o env | grep -E '^(API_URL|ANON_KEY)=' > /tmp/sandbox.env
set -a && . /tmp/sandbox.env && set +a
```

### 2.2 Run the contract suite (from `rebuild/`)

Wave 8 added deterministic `test.env` VITE_* defaults in `rebuild/vitest.config.ts:15-22`, so shell
`VITE_SUPABASE_*` values are shadowed inside vitest. Use the suite's first-priority env names
(`rebuild/src/shared/data/contract.test.ts:43-44`) — this is the canonical cutover recipe:

```bash
cd rebuild
SUPABASE_CONTRACT_TEST=1 \
SUPABASE_CONTRACT_URL="$API_URL" \
SUPABASE_CONTRACT_ANON_KEY="$ANON_KEY" \
  npx vitest run src/shared/data/contract.test.ts --reporter=verbose
```

PowerShell equivalent (the form used for this evidence run):

```powershell
$env:SUPABASE_CONTRACT_TEST = '1'
$env:SUPABASE_CONTRACT_URL = $API_URL          # from status -o env, e.g. http://127.0.0.1:55321
$env:SUPABASE_CONTRACT_ANON_KEY = $ANON_KEY    # local demo anon JWT; never commit it
Push-Location rebuild
npx vitest run src/shared/data/contract.test.ts --reporter=verbose
Pop-Location
```

### 2.3 Raw defect probes (independent of the test suite)

```bash
# R17: the un-repaired RPC must return 42703 ("column type ... does not exist")
curl -s -w '\nHTTP %{http_code}\n' -X POST "$API_URL/rest/v1/rpc/submit_guestbook_message_with_rate_limit" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -H 'Content-Type: application/json' \
  -d '{"p_name":"Contract Probe","p_email":"contract-probe@fixtures.example","p_content":"expected R17 failure"}'

# RLS is_admin() must be false for anon
curl -s -w '\nHTTP %{http_code}\n' -X POST "$API_URL/rest/v1/rpc/is_admin" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -H 'Content-Type: application/json' -d '{}'
```

### 2.4 Cutover checkers + canonical hashes

```bash
node tools/cutover/check-data.mjs --json                    # exit 1: known R21 mismatch
node tools/cutover/check-data.mjs --json --ignore-known     # exit 0: no unknown mismatch
node tools/cutover/check-migrations.mjs --json              # exit 0

# Canonical hash recipe (LF stdout, independent of shell redirection):
node -e "const {execFileSync}=require('node:child_process');const out=execFileSync('node',['tools/cutover/check-data.mjs','--json','--ignore-known'],{encoding:'utf8'});console.log(require('node:crypto').createHash('sha256').update(out).digest('hex'))"
```

> Hash caveat found during this run: PowerShell redirection with `2>&1` re-encodes native stdout as
> CRLF text (5,953 B LF -> 6,128 B CRLF for the same JSON), which changes the file hash. Use the
> `execFileSync` recipe above (or bash `>`) for hashes; the saved `tmp/evidence/*.json` are LF.

### 2.5 Stop

```bash
npx supabase stop --workdir tmp/supabase-sandbox --no-backup
```

## 3. Observed evidence (real outputs)

### 3.1 Start + reset: 31/31 migrations, seed, healthy stack

`tmp/evidence/contract-35/reset.log` (abridged; the log contains all 31 `Applying migration` lines
in filename order, same order/checksums as `docs/rebuild/DATA_CUTOVER.md` Appendix A):

```text
Applying migration 20240303000000_init_schema.sql
...
Applying migration 20260624000000_fix_guestbook_rpc_drop_type.sql
Applying migration 20260915020000_remove_unsplash_placeholder_photos.sql
Seeding data from supabase/seed.sql...
Finished supabase db reset on branch rebuild/greenfield.
```

- `Supabase db reset` measured **46.7 s** wall-clock on this machine/images.
- 31 `Applying migration` lines; seed applied; start reported `Started supabase local development
  setup.` with the port table in §1.
- `start.log` (first run before the reset) shows the same 31 migrations applied, i.e. both a fresh
  start and a reset converge on the same chain.

### 3.2 Sandbox status: local only

```text
Not linked.
supabase local development setup is running.
Project URL    http://127.0.0.1:55321
DB URL         postgresql://postgres:postgres@127.0.0.1:55334/postgres
Studio         http://127.0.0.1:55323
Mailpit        http://127.0.0.1:55324
```

### 3.3 Migration history and PostgreSQL version

`tmp/evidence/contract-35/db-verification.log`:

```text
PostgreSQL 17.6 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit
select count(*) from supabase_migrations.schema_migrations;  ->  31
```

The 31 `schema_migrations` rows are exactly the frozen chain (`20240303000000` …
`20260915020000`), in filename order; the per-file SHA-256s are recorded in
`docs/rebuild/DATA_CUTOVER.md` Appendix A and re-verified by `check-migrations` (§5).

### 3.4 Fixtures applied (synthetic, local only)

`tmp/evidence/contract-35/fixtures-apply.log`: statements end with `COMMIT` (single transaction,
`ON_ERROR_STOP=1`). Resulting row counts:

| Table | Rows | Table | Rows |
|---|---:|---|---:|
| `photos` | 24 | `guestbook_messages` | 8 |
| `photo_likes` | 6 | `guestbook_comments` | 2 |
| `photo_comments` | 4 | `guest_identities` | 2 |
| `guest_uploads` | 4 | `guest_share_tokens` | 2 |
| `photo_claims` | 3 | `media_review_batches` | 1 |
| `media_review_clusters` | 2 | `media_review_faces` | 3 |
| `guest_face_tagging_batches` | 1 | `moderation_audit_log` | 3 |
| `site_editorial_features` | 4 | `site_editorial_feature_history` | 2 |
| `activity_log` | 11 | `rate_limit_logs` | 1 |

These are identical to the Wave 3 / W9-2 fixture baseline (24 public photos = 12 seed + 12 fixtures,
8 guestbook messages, etc.). Fixtures are derived only from `contracts/schema/fixtures.sql`; no
production data was copied.

### 3.5 Contract suite: **9/9 passed**, exit 0

`tmp/evidence/contract-35/contract-test.log`:

```text
RUN  v5.1.0 C:/Users/bbask/Coding_Projects/Wedding_Website_Clean/rebuild

✓ local Supabase contract (anon key, read-only) > public photos are readable and parse into the view model 59ms
✓ ... > public guestbook feed is readable with replies 15ms
✓ ... > approved guest uploads are readable (RLS filters non-approved rows) 14ms
✓ ... > public editorial features respect the active/window RLS policy 12ms
✓ ... > activity feed is publicly readable (documented RLS-off drift, A3 §6 S1) 6ms
✓ ... > engagement RPCs answer the anon role 1ms
✓ ... > is_admin() is false for anon (authoritative role gate) 25ms
✓ ... > documents baseline defect R17: guestbook submit RPC references the dropped type column 16ms
✓ ... > documents the guest-share token public-read drift (A3 §6 S2) 12ms

Test Files  1 passed (1)
      Tests  9 passed (9)
   Duration  1.62s
exit=0
```

### 3.6 Raw R17 + RLS probes (baseline defect assertions)

`tmp/evidence/contract-35/probe-r17-rpc.txt` (anon REST call):

```json
{"code":"42703","details":null,"hint":null,"message":"column \"type\" of relation \"guestbook_messages\" does not exist"}
HTTP_STATUS:400
```

`tmp/evidence/contract-35/probe-is-admin.txt`:

```text
false
HTTP_STATUS:200
```

This matches the cutover assumptions: R17 is still broken on the frozen baseline (client falls back
to a direct insert, bypassing the server rate limit) and `is_admin()` is the authoritative role gate
(false for anon).

### 3.7 Supplementary drift check: data-layer unit suite

`tmp/evidence/contract-35/data-unit-tests.log`:

```text
Test Files  15 passed | 1 skipped (16)
      Tests  212 passed | 9 skipped (221)
   Duration  4.51s
exit=0
```

Identical counts to Wave 3 — no data-layer test drift.

### 3.8 Cutover checkers (JSON captured; hashes in §5)

| Command | Exit | Result |
|---|---:|---|
| `node tools/cutover/check-data.mjs --json` | 1 | `ok:false`; exactly 1 mismatch = known R21 `/images/og-image.webp` (4 refs in `contracts/content/rendered/{activity,admin}.json`); schema counts all matched (18/18 tables, 206/206 columns, 43/43 policies, 21/21 RPCs, 3/3 triggers) |
| `node tools/cutover/check-data.mjs --json --ignore-known` | 0 | `ok:true`; media refs 610/113 distinct (offloaded 104, local 504, synthetic 2), manifest 83, localResolved 500, unresolvedLocal 1 (R21) |
| `node tools/cutover/check-migrations.mjs --json` | 0 | `ok:true`; 31 migrations / 31 history rows; D1 repaired; R17 unrepaired; 28 app dependencies, 25 required migrations, 6 legacy-only, 5 indirect objects, 2 destructive statements, 13 schema-supersession drops |

## 4. Sandbox cleanup

`tmp/evidence/contract-35/stop.log`:

```text
Stopped supabase local development setup.
exit=0
```

Verification immediately after stop:

```text
docker ps -a --filter "name=theporadas-workbench"  ->  0 containers
docker ps | grep resell-os                         ->  9 running (other workspace, untouched)
```

No volumes were kept for this sandbox's data (`--no-backup`); the next run starts from `start` +
`db reset` again.

## 5. Checker JSON hashes (and drift vs W9-2)

Canonical hashes = SHA-256 of the checker's raw stdout (LF), captured with the `execFileSync` recipe
in §2.4; files saved under `tmp/evidence/contract-35/`.

| Artifact | SHA-256 | W9-2 record | Match? |
|---|---|---|---|
| `check-data --json` (strict, exit 1) | `d6b5b09d023a64f7bb1c5a892e76ba720dc139bd4a84d79779a3562a024be50f` | not recorded | — (strict mode hash added by this run) |
| `check-data --json --ignore-known` (exit 0) | `d6f1d2721debe4988b0eb3cdcaef4d72c7f39707c527cc55852493bba8d41c2` | `D6F1D272…E8D41C2` | **identical** — no data/media contract drift |
| `check-migrations --json` (exit 0) | `f1cb668bb1b3386ed5da8e324d8a22dcb16837d8e2528ed477519f998ccc057c` | `1217BEBB…6570E8D` | **differs — explained below** |

Migrations-checker hash drift explanation (all object-level results are unchanged):

- The JSON embeds `counts.greenfieldSourceFiles`, which was **357** when W9-2 captured its record and
  is **365** now — the working tree grew with the Wave 8 commit and concurrent Wave 9 work after
  W9-2's run (the checker scans `rebuild/src/**`).
- 3 of the 28 app dependency rows have changed file-path lists for the same reason.
- Everything deterministic for cutover is identical: 31 migrations / 31 history rows, 28 app
  dependencies (16 tables, 11 RPCs, 1 channel), 5 indirect objects, 25 required migrations,
  6 superseded legacy-only migrations, 2 top-level destructive statements, 13 schema-supersession
  drops, D1 = repaired, R17 = unrepaired.
- The data/media JSON hash is byte-identical to W9-2, so no contract/media drift has occurred.

**Re-verification on the final tree:** after the two post-capture commits (`16ebc8b`, `2357fe3`),
the canonical checker recipe was re-run from the now-clean tree at
`2357fe336db04d628a12271511d673ebcd4cc278` and produced the **same three hashes byte-for-byte**
(`d6b5b09d…`, `d6f1d272…`, `f1cb668b…`). `git diff 056ae0c..2357fe3` is empty for
`rebuild/src/shared/data`, `contract.test.ts`, `vitest.config.ts` and `rebuild/package.json`, so the
9/9 contract result also applies to the final tree.

## 6. Drift vs Wave 3 (and actions)

Verified against the Wave 3 checkpoint commit `719b1b3` and the W9-2 cutover record.

| Area | Wave 3 / W9-2 | This run | Drift | Action |
|---|---|---|---|---|
| Data-layer source | `rebuild/src/shared/data/**` at `719b1b3` | `git diff --stat 719b1b3..HEAD -- rebuild/src/shared/data` = **empty** | none | — |
| Contract suite | 9/9 passed | **9/9 passed**, exit 0, 1.62 s | none in results | — |
| **Contract test env recipe** | File header documents `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | Wave 8 added deterministic `test.env` defaults in `rebuild/vitest.config.ts:15-22`; those **shadow** shell `VITE_SUPABASE_*` inside vitest. A first run with the header's VITE_* recipe hit the placeholder host and failed **8/9** (5 GET timeouts, RPC/error-shape failures; log: `contract-test-vite-recipe-shadowed.log`). Using the suite's `SUPABASE_CONTRACT_URL`/`SUPABASE_CONTRACT_ANON_KEY` override path gave 9/9. | **recipe drift (new in Wave 8)** | **Follow-up (rebuild code, outside W9-7 scope):** update `contract.test.ts` header to the `SUPABASE_CONTRACT_*` recipe and either drop `VITE_SUPABASE_*` from `test.env` or document that they are vitest-only; add the missing `npm run test:contract` script (still absent from `rebuild/package.json`). |
| Fixtures | 24 photos / 8 guestbook / etc. (W9-2) | identical counts app-wide (§3.4) | none | — |
| Data-layer unit suite | 212 passed / 9 skipped | 212 passed / 9 skipped | none | — |
| Data/media contract checker | `D6F1D272…` | `D6F1D272…` | none | — |
| Migrations checker | `1217BEBB…` | `F1CB668B…` | source-file count 357→365 after Wave 8/concurrent work; object results identical (§5) | expected; refresh the recorded hash in the cutover record when the tree stabilizes |
| Repo HEAD | `719b1b3` checkpoint | capture `056ae0c`; final `2357fe3` (`16ebc8b` Wave 9 data wiring/docs, `2357fe3` log cleanup) | two commits landed during the run (capture tree had them as uncommitted work); data layer unchanged across all | — |
| Toolchain | Supabase CLI 2.117.0 (v3.0.0 update available) | CLI 2.117.0 (v3.1.0 update available) | update notice only; **not** upgraded | keep pinned for reproducibility until a planned tooling bump |
| Sandbox images | postgres 17.6.1.167, gotrue v2.196.0, postgrest v16.2, storage v1.72.1, realtime v2.130.0 | same set | none | — |

Nothing in the data layer, schema contract, media contract or fixtures drifted since Wave 3. The only
real regression is the **documented contract-test env recipe**, which Wave 8's deterministic
`test.env` invalidated without updating the suite header — reproducible evidence and the exact fix
are above.

## 7. Not verified in this run — explicit `UNVERIFIED` list

1. **`UNVERIFIED` — production schema/RLS/RPC parity.** No production access in this task; the local
   sandbox proves the repo chain, not the live project. Phase-0 read-only diff remains in
   `docs/rebuild/DATA_CUTOVER.md` §5/§9.
2. **`UNVERIFIED` — R2 media object population/counts.** Requires owner-provided read-only listing
   (W9-2 decision D-11 / risk R22).
3. **`UNVERIFIED` — live CDN headers/media URL sweep.** Read-only plan exists in
   `docs/rebuild/DATA_CUTOVER.md` §9.3; not executed here.
4. **`UNVERIFIED` — rebuild app route/E2E smoke against the sandbox.** The dev server was not started
   in this task; route assertions belong to the app/parity evidence runs.
5. **`UNVERIFIED` — R17 repair and RLS hardening effects.** Neither has shipped (baseline defects are
   asserted as-is); after the D-01/D-02 migrations land, re-run this recipe with
   `check-migrations --expect-r17-fixed` and the updated contract suite.
6. **`UNVERIFIED` — CI wiring of the contract suite.** It is opt-in by design; no CI job and no
   `test:contract` npm script exist yet (see §6 follow-up).
7. **`UNVERIFIED` — sandbox repeatability beyond this single clean reset.** One run only; the 31
   migration checksums and the deterministic fixture counts make a repeat expected to be identical,
   but it was not executed twice.

## 8. No-write / scope confirmation

- New files from this task only:
  - `docs/rebuild/CONTRACT_EVIDENCE.md` (this document)
  - `tmp/evidence/contract-35/**` (gitignored evidence artifacts; see Appendix B)
- No changes under `contracts/`, `supabase/`, `rebuild/`, `public/`, `src/`, `scripts/`, `tools/`
  or legacy paths. Other members' 44 dirty-tree entries observed at capture were committed during the
  run; the **final** `git status` shows only this new untracked document. No tracked file other than
  the new document was changed by this run.
- Database writes were confined to the local sandbox containers: `db reset` (migrations + seed) and
  `contracts/schema/fixtures.sql`; the sandbox was stopped with `--no-backup`.
- No production Supabase, Netlify, R2 or DNS access occurred; the sandbox printed `Not linked.`
- The other workspace's stack (`resell-os`, 9 containers) was running before/after and was not
  touched (different project id/ports).

## Appendix A — exact commands used (in order)

```powershell
# from repo root
npx supabase --workdir tmp/supabase-sandbox start
npx supabase --workdir tmp/supabase-sandbox db reset
docker exec -i supabase_db_theporadas-workbench psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 `
  -f - < contracts/schema/fixtures.sql        # (fixtures content piped in; COMMIT)
npx supabase --workdir tmp/supabase-sandbox status -o env
npx supabase --workdir tmp/supabase-sandbox status

# contract suite
$env:SUPABASE_CONTRACT_TEST='1'; $env:SUPABASE_CONTRACT_URL='http://127.0.0.1:55321'
$env:SUPABASE_CONTRACT_ANON_KEY='<from status -o env ANON_KEY>'
Push-Location rebuild; npx vitest run src/shared/data/contract.test.ts --reporter=verbose; Pop-Location

# raw probes (curl.exe), then:
node tools/cutover/check-data.mjs --json                    # exit 1
node tools/cutover/check-data.mjs --json --ignore-known     # exit 0
node tools/cutover/check-migrations.mjs --json              # exit 0

# supplementary drift check
Push-Location rebuild; npx vitest run src/shared/data; Pop-Location

# cleanup
npx supabase stop --workdir tmp/supabase-sandbox --no-backup
docker ps -a --filter "name=theporadas-workbench"    # 0 containers
```

## Appendix B — evidence artifacts (`tmp/evidence/contract-35/`, gitignored)

SHA-256 prefixes (16 hex chars); full hashes for the three checker JSONs are in §5.

| Artifact | Bytes | SHA-256[:16] | Contents |
|---|---:|---|---|
| `check-data-strict.json` | 6,474 | `D6B5B09D023A64F7` | strict checker JSON (R21 mismatch) |
| `check-data-ignore-known.json` | 5,953 | `D6F1D2721DEBE498` | unknown-mismatch-free checker JSON |
| `check-migrations.json` | 27,614 | `F1CB668BB1B3386E` | chain/defects/dependency/plan JSON |
| `contract-test.log` | 1,638 | `89C77CDB41A5F539` | 9/9 contract suite output |
| `contract-test-vite-recipe-shadowed.log` | 8,451 | `8A1CF4A910462B78` | first (failed) run with header VITE_* recipe |
| `data-unit-tests.log` | 1,150 | `7EFFE6BEF7690776` | 212 passed / 9 skipped |
| `reset.log` | 2,597 | `1793E3228B212305` | 31 migrations + seed apply |
| `start.log` | 7,170 | `B5760D59546C3388` | initial start (31 migrations + health checks) |
| `status-env.txt` | 1,588 | `8542F0EA45A75A93` | sandbox API URL + keys (local demo values; not committed) |
| `status-pretty.txt` | 3,927 | `A3870EEA2E01CC48` | `supabase status` (Not linked) |
| `db-verification.log` | 1,803 | `5DE178F914760F07` | Postgres version, 31 history rows, fixture counts |
| `fixtures-apply.log` | 410 | `53FD1354EA2A1268` | fixtures transaction (`COMMIT`) |
| `probe-r17-rpc.txt` | 140 | `2AEC27FAFB9026B5` | raw 42703 RPC response |
| `probe-is-admin.txt` | 24 | `99FE1B707F7A3F63` | raw `false` for anon |
| `postgres-version.txt` | 78 | `3C485D6AB564F6CC` | `select version()` |
| `sandbox-images.txt` | 976 | `F5CD197C15C4D030` | container → image mapping (our project) |
| `container-images.txt` | 848 | `9A3F78FFA33A181D` | unique image tags observed |
| `stop.log` | 375 | `61619022367E0927` | `--no-backup` stop output |

`status-env.txt` contains the local sandbox demo anon key (public by design, regenerated per start);
it is kept only in gitignored `tmp/` and never committed.
