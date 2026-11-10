# Backup / restore + rollback rehearsal (local drill evidence)

Scope: **local Supabase sandbox only** — no production data, credentials, DNS or Netlify/Cloudflare action.
The production/staging rehearsal remains a cutover-window item (U8/U9) and must repeat these steps against
the window's actual backup.

## Drill setup

- Source: local Supabase stack (`supabase start -x logflare,vector` to keep the Docker Desktop VM stable).
- Baseline state: `supabase db reset` → frozen chain only (31 migrations, pre-cutover).
- Cutover state: baseline + `node tools/cutover/apply-forward-migrations.mjs --docker-container … --yes`
  (D-01 + D-02 applied; applier reported **10/10 invariants**).
- Backups: `pg_dump -Fc` inside the db container; copied to a host path.
- Restores: fresh databases `rollback_probe` (baseline dump) and `restore_probe` (cutover dump) in the same
  cluster, restored with `pg_restore --no-owner` (ACLs preserved; default-privilege statements warn because
  the dump is owned by `postgres` and restore runs as `postgres` without changing cluster defaults — cosmetic,
  SQL-level ACLs are restored and were verified directly).
- RTO measured wall-clock for the restore step.

## Artifacts

| Artifact | Size | SHA-256 (first 16) |
|---|---|---|
| `tmp/drills/baseline.dump` (pre-cutover) | 451 KB | `5A7B92933577B866…` |
| `tmp/drills/cutover.dump` (post-cutover) | 463 KB | `6C09FB386FD525C2…` |

(Local artifacts are disposable; the hashes document the drill run. Production backups must be recorded in the
cutover checkpoint with the dump's own SHA-256 and storage location.)

## Results

| Check | Duration | Result |
|---|---|---|
| Restore pre-cutover backup into an empty database | **2.7 s** | PASS — database usable |
| Restore post-cutover backup into an empty database | **2.7 s** | PASS — database usable |
| Row counts: 18 public tables, baseline vs cutover | — | **18/18 equal, 0 mismatches** |

Restored-state behaviour (identical DB cluster, anon role, ACLs restored):

| Expectation | Pre-cutover restore | Post-cutover restore |
|---|---|---|
| `anon` can SELECT `guest_share_tokens` | **true** (baseline drift) | **false** (S2 closed) |
| `anon` can INSERT `activity_log` | **true** (baseline drift) | **false** (S1 closed) |
| Guestbook submit RPC | **raises 42703** (`type` column missing — R17) | **succeeds** (`success=true`, message id set — D-01 applied) |
| `anon` can execute `get_guest_contributions` | n/a (absent) | **true** (guest share works) |

This proves both directions: the pre-cutover backup restores a database on which the **frozen app behaves as
before** (rollback path), and the post-cutover backup restores the repaired/closed surface (forward path).
The same restore steps were used to regenerate the local cutover state, so the app's 11/11 post-cutover
contract suite ran against a database that came from the backup path.

## Caveats / what is still pending

1. **Production/staging drill (U8/U9)** — must repeat with the real pre-window dump, the real storage (R2/Netlify)
   assets, and the documented A1–A8 window; measure RTO against the owner's target and record the operator.
2. Restore was into the **same cluster**; production restore must use a fresh database/project or a verified
   in-place restore per `ops/BACKUP_RESTORE.md`.
3. `pg_restore --no-owner` warnings about default privileges are expected for a pre-created public schema; they do
   not indicate data loss. The cutover runbook uses the Supabase dashboard/managed backup restore path in
   production, which handles ownership natively.
4. Storage/media bytes are not part of these SQL dumps (media is preserved in place per the owner's hybrid
   decision; see `MEDIA_OPTIMIZATION.md` / `ops/BACKUP_RESTORE.md`).

## Related

- Apply/verify tooling and the migration manifest: [MIGRATIONS.md](./MIGRATIONS.md).
- Backup/restore + rollback runbooks: [../ops/BACKUP_RESTORE.md](../ops/BACKUP_RESTORE.md),
  [../ops/ROLLBACK.md](../ops/ROLLBACK.md).
