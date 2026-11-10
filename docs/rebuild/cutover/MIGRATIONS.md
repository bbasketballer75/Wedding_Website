# Cutover migrations (D-01 R17 repair + D-02 RLS bundle)

Owner-approved forward migrations that are **not** part of the frozen legacy
baseline. They live under `tools/cutover/migrations/` so the legacy freeze stays
intact (the frozen `supabase/migrations/` chain remains read-only at 31 files).
Applying them to a database is a cutover-window action (**A2**); nothing here is
applied to production by the repo, CI or any script without `--yes` and the
operator's database URL.

## 1. Manifest (record in the cutover checkpoint)

| # | File | Bytes | SHA-256 |
|---|---|---|---|
| 1 | `20261110000000_fix_guestbook_submit_rpc.sql` | 4527 | `bad079c9d1579af18c93ec70fbc7449a8412273779c22c34a8a143289d9e3340` |
| 2 | `20261110000100_rls_hardening_bundle.sql` | 19122 | `9057df6abd2cd4791f2e34e499856a5a947a4ce053c3ac1e48a3899749a98b92` |

Re-print at any time:

```bash
node tools/cutover/check-forward-migrations.mjs          # static audit + hashes
node tools/cutover/apply-forward-migrations.mjs --dry-run
```

The static audit (also a CI step) enforces: filenames/order, no destructive
DDL/DML outside function bodies, header blocks, idempotent style and an explicit
GRANT/REVOKE surface.

## 2. What each migration does

### `20261110000000_fix_guestbook_submit_rpc.sql` — D-01 / R17

The frozen chain's `submit_guestbook_message_with_rate_limit` still inserts the
dropped `guestbook_messages.type` column, so every submission raises `42703` and
the client falls back to a direct anon INSERT that bypasses the rate limit.

This migration drops/recreates the wrapper (OUT columns cannot be replaced)
without the dropped column, keeps the frozen signature (including the ignored
`p_type`), keeps the existing rate-limit semantics (`check_rate_limit` +
`increment_rate_limit`, 3/min), pins `search_path`, and re-grants EXECUTE to
`anon, authenticated`. Validation and actor-surface checks are unchanged:
blank/long payloads return a friendly failure.

**Effect:** guestbook submissions work and are rate-limited server-side; the
client's documented direct-insert fallback is removed (see §4) because the
direct INSERT grant is revoked by the bundle.

### `20261110000100_rls_hardening_bundle.sql` — D-02 / A3 §6 S1–S7

| Gap | Change |
|---|---|
| S1 `activity_log` RLS off | RLS on + public SELECT policy; INSERT/UPDATE/DELETE revoked; the activity trigger becomes SECURITY DEFINER with pinned `search_path` (the only writer). |
| S2 public identity/token reads | Public SELECT/INSERT on `guest_identities`/`guest_share_tokens` removed; admin-only `is_admin()` policies; new SECURITY DEFINER RPCs replace the guest surfaces: `get_guest_contributions(token)` (aggregate, safe fields), `resolve_guest_identity(email, name, session)` (claim wizard find-or-create), `get_or_create_share_token(email, upload_id)` (token only for the owner of a known upload row). `photo_claims` public writes are constrained to `status='pending'` + valid kind. |
| S3 `guest_uploads` authenticated read/update | Replaced with `is_admin()` policies; public insert + approved read kept. |
| S4 no DELETE policy vs admin UI | `delete_guestbook_messages_v1(uuid[])` (admin-only, returns count); direct INSERT/DELETE on `guestbook_messages` revoked; admin UPDATE via `is_admin()`. |
| S5 `photo_likes` RLS off | RLS on, no policies, anon/authenticated table grants revoked (RPC-only). |
| S6 forgeable audit actor | `insert_moderation_audit_v1(...)` derives the actor from the JWT (`sub`/email/`user_metadata`), validates the action union, returns the row; direct INSERT revoked; `action` CHECK added `NOT VALID` (new rows enforced, historical rows never fail the cutover). |
| S7 admin RPC surface | `REVOKE EXECUTE ... FROM PUBLIC, anon` on the admin RPCs (`delete_gallery_photos_v1`, `hide/delete_photo_comment_v1`, `get_recent_photo_comments_v1`, `save_album_organization_v1/v2`); rate-limit helpers revoked from PUBLIC/anon/authenticated and `search_path` pinned on all SECURITY DEFINER helpers. |

Both files are wrapped in a transaction (the bundle has `BEGIN/COMMIT`) and are
idempotent (`IF EXISTS`, `OR REPLACE`, repeatable GRANT/REVOKE, policy drops
before creates), so a retried window is safe. A failed apply rolls back the
failing file; investigate the SQLSTATE before retrying.

## 3. Applying (cutover window, A2)

Preconditions: owner-filled A1–A8 authorisation record, verified backup (see
`ops/BACKUP_RESTORE.md`), write freeze in place (A4), and the exact manifest
hashes above recorded.

```bash
# staging / local sandbox first (no production access implied)
node tools/cutover/apply-forward-migrations.mjs --db-url "$STAGING_DATABASE_URL" --yes

# local docker sandbox
node tools/cutover/apply-forward-migrations.mjs --docker-container "supabase_db_<ref>" --yes

# verification only (safe, read-only) on any target
node tools/cutover/apply-forward-migrations.mjs --docker-container "supabase_db_<ref>" --verify-only
```

The applier prints each file + its SHA-256, applies in order, then runs **10
invariants** and exits non-zero if any fail:

1. R17 RPC no longer references the dropped `type` column;
2. `activity_log` RLS on + exactly one public SELECT policy;
3. anon cannot INSERT/UPDATE/DELETE `activity_log`;
4. anon cannot read `guest_identities` / `guest_share_tokens`;
5. guest SECURITY DEFINER RPCs exist and are anon-executable;
6. `guest_uploads` admin-only read/update policies present, old authenticated ones gone;
7. admin guestbook delete RPC exists, direct anon INSERT/DELETE revoked;
8. `photo_likes` RLS on, anon read/write revoked;
9. audit RPC exists, anon execute revoked, direct authenticated INSERT revoked;
10. anon admin-RPC surface + rate-limit helpers revoked.

### Production path options

- **psql / Supabase connection string** (used by the applier): `--db-url "$DATABASE_URL" --yes`.
- **Supabase CLI**: copy `tools/cutover/migrations/*.sql` into `supabase/migrations/`
  at the window (do not commit them there), then `supabase db push`; record the
  same manifest hashes. The repo keeps them out of `supabase/migrations` so the
  frozen baseline and its checker stay untouched.

### Rollback

These migrations are additive/replacement-only: no table, column or row is
removed. To roll back **after** applying, restore the pre-window database
snapshot (`ops/BACKUP_RESTORE.md`) — that is the rehearsed path. A targeted
reverse SQL is intentionally not shipped; do not hand-revert policies under
pressure. The old app deploy keeps working because the repaired RPC is
backwards-compatible (the frozen client also calls it first).

## 4. App-side wiring that ships with the migrations (rebuild)

- `shared/data/claims.ts`: guest-share aggregate via `get_guest_contributions`;
  identity find-or-create via `resolve_guest_identity`; share-token issuance via
  `get_or_create_share_token(email, uploadId)` (the upload flow now keeps the
  inserted upload id and passes it).
- `shared/data/guestbook.ts`: submission is RPC-only (fails closed, no direct
  INSERT fallback); admin delete via `delete_guestbook_messages_v1`.
- `shared/data/moderation.ts`: audit append via `insert_moderation_audit_v1`
  (client-supplied actor is no longer sent).
- `shared/data/cutover-rpc.ts`: one documented cast bridge for the RPCs that are
  not yet in the frozen generated `database.types.ts` (regenerate the types when
  the contract baseline next moves).
- Parity harness mocks mirror the new RPC payloads (`tools/parity/mocks/index.mjs`)
  so the guest-share page renders identically in capture.

## 5. Verification evidence (local sandbox, 2026-11-10)

- Fresh `supabase db reset` then `apply-forward-migrations --docker-container … --yes`:
  both migrations applied; re-apply (idempotency) succeeded; **10/10 invariants PASS**.
- REST-level behaviour: rate-limited submit succeeds 3× then returns the
  friendly rate-limit row; anon table reads/writes denied with `42501`;
  token RPC returns a token only for the matching upload id; contributions
  aggregate returns identity/uploads/guestbook/approved claims; admin audit +
  delete RPCs derive/authorise from a simulated admin JWT and delete exactly the
  requested rows.
- Contract suite (`SUPABASE_CONTRACT_POST_CUTOVER=1 npm run test:contract`):
  **11/11 tests pass**, including D-01 success, D-02 denials, and the new RPCs.
- Static audit: PASS. Frozen baseline checker: 31 migrations, 0 mismatches.

The same commands must be re-run against the staging database after the staging
site exists; record their output here / in the checkpoint before the production
window.
