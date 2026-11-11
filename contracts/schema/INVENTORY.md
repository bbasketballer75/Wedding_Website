# Database Inventory & Drift Report — reconstructed backend baseline

Owner: backend-eng (WP-4). Generated 2026-11-08 from a clean local Supabase reset of the frozen
migrations (`rebuild/greenfield` @ `legacy-freeze-2026-11-08`). Companion files in this directory:

| File | What it is |
|---|---|
| [`schema.sql`](./schema.sql) | `pg_dump --schema public` of the clean reset (schema-only; 18 tables, 35 policies, 41 indexes incl. unique constraints, functions, triggers, grants) |
| [`storage.sql`](./storage.sql) | `pg_dump --schema storage` of the same reset (Storage platform schema + app object policies) |
| [`database.types.ts`](./database.types.ts) | `supabase gen types typescript --schema public` output for the reset database |
| [`policies.md`](./policies.md) | every RLS policy per table/operation + risk analysis |
| [`rpc.md`](./rpc.md) | every public function with args/returns/SECURITY DEFINER/callers |
| [`fixtures.sql`](./fixtures.sql) | synthetic, anonymised rows sufficient to render every screen locally (no production data/PII) |

**Headline result:** 31/31 migrations apply cleanly (after the one repo repair described in §1.4) and
two consecutive resets produce **byte-identical** dumps.

| Metric | Value |
|---|---|
| Migrations applied | 31 / 31 (`supabase_migrations.schema_migrations` has 31 rows) |
| Public tables | 18 (206 columns) |
| Public indexes | 71 (41 in `schema.sql` for tables + unique constraints; full list below) |
| RLS | enabled on 16/18 tables; 35 public policies + 8 `storage.objects` policies |
| Public functions | 21 (20 SECURITY DEFINER + 1 trigger function) + 4 Storage-platform triggers |
| App triggers | 3 (`activity_log` fan-out) |
| Realtime publication | `supabase_realtime` → `public.activity_log`, `public.rate_limit_logs` |
| Storage buckets | 1 after clean reset (`media-review-artifacts`, private) |
| Extensions | `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault`, `plpgsql` |
| Clean reset time | 41.9 s (#1) / 41.4 s (#2); schema dump 4.7 s, 77,970 B |
| Reproducibility | public dump SHA-256 `A162C56BD506D8AB0391D93584350089829EF6932584FBD315B70843C211F267`, storage dump `7968E45710A637F3003038A175603664E7F752ABA782D72D497983A4C4E72E82` — identical across both resets |

## 1. How this baseline was forced (reproducible sandbox)

### 1.1 Why a sandbox

This host runs another Supabase project on the default Docker ports (`supabase_db_resell-os`, …,
listening on 54321–54324). Stopping it is forbidden (it belongs to another workspace), so the repo's
`supabase/config.toml` ports cannot be bound. The frozen `supabase/**` tree is read-only, so the port
override is made in a **gitignored sandbox project directory** (`tmp/` is in `.gitignore`) and the
CLI is pointed at it with the global `--workdir` flag. Only the sandbox config differs; migrations and
seed are verbatim copies of the repo.

### 1.2 Sandbox recipe (exact)

```powershell
$root = 'tmp/supabase-sandbox'
New-Item -ItemType Directory -Path "$root/supabase" -Force | Out-Null
Copy-Item 'supabase/config.toml'               "$root/supabase/config.toml"
Copy-Item -Recurse 'supabase/migrations'       "$root/supabase/migrations"
Copy-Item 'supabase/seed.sql'                  "$root/supabase/seed.sql"
# config.toml deltas (ONLY these): project_id + ports, see 1.3
```

Config delta (the only difference from the repo config; every other line is a copy):

| Key | Repo value | Sandbox value |
|---|---|---|
| `project_id` | `zaczcyzvavetgfuucljf` | `theporadas-workbench` |
| `[api] port` | 54321 | **55321** |
| `[db] port` | 54334 | **55334** |
| `[db] shadow_port` | 54320 | **55320** |
| `[studio] port` | 54323 | **55323** |
| `[inbucket] port` | 54324 | **55324** |
| `[analytics] port` | 54327 | **55327** |
| `[edge_runtime] inspector_port` | 8083 | **18083** |

`supabase/.temp` is deliberately **not** copied (it holds the linked remote project ref); the sandbox
reports `linked_project: null` and never contacts a remote project.

### 1.3 Commands used

```powershell
npx supabase --workdir tmp/supabase-sandbox start                 # 31 migrations + seed
npx supabase db reset --workdir tmp/supabase-sandbox             # reset #1 (41.9 s)
npx supabase --workdir tmp/supabase-sandbox db dump --local --schema public  -f <abs>\reset1-public.sql
npx supabase --workdir tmp/supabase-sandbox db dump --local --schema storage -f <abs>\reset1-storage.sql
npx supabase db reset --workdir tmp/supabase-sandbox             # reset #2 (41.4 s)
npx supabase --workdir tmp/supabase-sandbox db dump --local --schema public  -f <abs>\reset2-public.sql
npx supabase --workdir tmp/supabase-sandbox db dump --local --schema storage -f <abs>\reset2-storage.sql
npx supabase gen types typescript --db-url "postgresql://postgres:postgres@127.0.0.1:55334/postgres" --schema public
npx supabase stop --workdir tmp/supabase-sandbox --no-backup
```

Notes:

- `db dump -f` resolves the path against `--workdir`, so absolute `-f` paths are required.
- `gen types --local` fails inside this sandbox with `password authentication failed for user
  "postgres"` (the CLI's helper container cannot authenticate to the shifted-port DB). The equivalent
  local-only invocation with `--db-url postgresql://postgres:postgres@127.0.0.1:55334/postgres` is used
  instead — still purely local, no remote endpoint.
- Dumps are schema-only (pg_dump default for this CLI): no `COPY`/`INSERT` data, hence random UUIDs
  from `seed.sql` cannot make the hashes differ. `storage.sql` likewise carries DDL + policies, not
  bucket rows.
- Evidence (gitignored, on this machine): `tmp/evidence/reset1*.sql`, `reset2*.sql`, `reset1.log`,
  `reset2.log`, `inv-*.txt` (raw psql inventory), `runtime-probes.log`, `tables-section.md`.
- Dumps contain **no** secrets or PII: schema, policies, function bodies, grants only. The local
  anon/service-role demo keys printed by `supabase start` are never written into contracts.

### 1.4 Repo defect found and fixed before the baseline (Lead-approved, one path only)

The first `supabase start` failed after 30 migrations: the hand-reconstructed migration
`20260624000000_fix_guestbook_rpc_drop_type.sql` (commit `7e8df7c`, “reconcile missing … migration
(#141)”) was **missing four semicolons** and could never have executed:

```
ERROR: syntax error at or near "CREATE" (SQLSTATE 42601)
At statement: 0
DROP FUNCTION IF EXISTS public.get_guestbook_messages_with_comments()
CREATE FUNCTION public.get_guestbook_messages_with_comments()
```

Four missing terminators: after the `DROP FUNCTION`, after `$$ LANGUAGE plpgsql`, and after each of the
two `GRANT EXECUTE … TO anon/authenticated` lines. The Lead repaired this **one path**
(syntax-only; no SQL semantics changed, no other file touched) and added a narrow, documented exception
in `tools/check-legacy-freeze.mjs`. Migrations never enter the client bundle, so the parity oracle is
unaffected. After the repair both resets applied 31/31. This is recorded as a repo defect
found-and-fixed, not a footnote: it proves the committed migration set did **not** reproduce the
schema as shipped.

## 2. Migration history (31, applied in filename order)

| # | Version | Name | Notes |
|---:|---|---|---|
| 1 | 20240303000000 | `init_schema` | core tables: photos, guestbook_messages (+2 demo rows), guestbook_comments, guest_uploads; seeds 2 guestbook rows |
| 2 | 20240303000001 | `storage_buckets` | policies for legacy guest-photos/guest-videos/guest-voice buckets (bucket rows not created) |
| 3 | 20240303000002 | `guestbook_comments` | comments table + read RPC seed definition |
| 4 | 20240303000003 | `rate_limiting` | `rate_limit_logs`, `check_rate_limit`, `increment_rate_limit`, `cleanup_old_rate_limits`, guestbook submit wrapper |
| 5 | 20260312000100 | `moderation_audit_log` | audit table + policies |
| 6 | 20260312000200 | `site_editorial_features` | editorial slots |
| 7 | 20260312000300 | `site_editorial_features_public_read` | anon read active window |
| 8 | 20260312000400 | `editorial_workflow_expansion` | schedule window, memory trail, history table, badge/cta |
| 9 | 20260314000100 | `media_review_staging` | batches/clusters admin tables + `media-review-artifacts` bucket + storage policies |
| 10 | 20260314000200 | `admin_photo_updates` | admin UPDATE policy on photos |
| 11 | 20260314000300 | `face_review_faces_and_guest_upload_fingerprints` | `media_review_faces`, fingerprints columns |
| 12 | 20260315000100 | `guest_face_tagging_batches` | tagging batch table |
| 13 | 20260315000200 | `photo_engagement` | `photo_likes`, `photo_comments`, engagement RPCs |
| 14 | 20260315000300 | `fix_toggle_photo_like` | v1 iteration |
| 15 | 20260315000400 | `replace_toggle_photo_like` | v1 iteration |
| 16 | 20260315000500 | `finalize_toggle_photo_like` | v1 final |
| 17 | 20260315000600 | `toggle_photo_like_v2` | current v2 signature |
| 18 | 20260315000700 | `add_photo_album` | `photos.album`, `album_sort_order`, album CHECK |
| 19 | 20260315000800 | `photo_album_organizer` | `save_album_organization_v1` RPC |
| 20 | 20260315000900 | `gallery_photo_delete_tools` | `delete_gallery_photos_v1`, `save_album_organization_v2` |
| 21 | 20260316001000 | `photo_comment_lifecycle_and_delete_key_fix` | `is_hidden` fields, hide/delete/recent RPCs |
| 22 | 20260316001100 | `add_photo_download_url` | `photos.download_url` (original downloads) |
| 23 | 20260410001200 | `drop_guestbook_type_and_anniversary` | drops `guestbook_messages.type` + anniversary columns (breaks the submit RPC — §RPC-defect) |
| 24 | 20260427000100 | `moderation_queue_schema` | claim/media-review queue hardening |
| 25 | 20260428000100 | `update_auth_metadata` | `update_auth_user_metadata` RPC |
| 26 | 20260430000100 | `activity_log_table` | `activity_log` + fan-out triggers + realtime |
| 27 | 20260521000100 | `photo_claiming` | `guest_identities`, `photo_claims` |
| 28 | 20260521000200 | `guest_share_links` | `guest_share_tokens` |
| 29 | 20260623000100 | `admin_role_app_metadata` | `is_admin()`, promote/demote, moves 7 policies + 7 RPCs off spoofable `user_metadata`, one-shot admin data migration |
| 30 | 20260624000000 | `fix_guestbook_rpc_drop_type` | **REPAIRED (Lead, 2026-11-08)** — read RPC redefined without `type`; originally unparseable (§1.4) |
| 31 | 20260915020000 | `remove_unsplash_placeholder_photos` | deletes placeholder photo rows |

Ordering nuance: the CLI sorts filenames lexicographically, so `20260624000000` applies **before**
`20260915020000`. `seed.sql` runs after all migrations.

## 3. Demo data present after a clean reset (not production data)

| Table | Rows | Source |
|---|---:|---|
| `photos` | 12 | `supabase/seed.sql` (Unsplash placeholder URLs, re-added *after* migration 31 removed older placeholders) |
| `guestbook_messages` | 5 | 2 from `init_schema` migration + 3 from `seed.sql` (names like “Sarah & Mike”, `*@example.com` — synthetic) |
| `activity_log` | 3 | triggers fired for the 3 seeded guestbook rows (`init_schema` demo rows predate the trigger) |
| all other 15 tables | 0 | — |

The rebuild must not treat `seed.sql` as content: production content comes from `contracts/content/`
and `contracts/fixtures/`. `fixtures.sql` in this directory supersedes it for local rendering and uses
fixed UUIDs + synthetic identities only.

## 4. Tables (18) — columns, keys/constraints, RLS status, row counts

Column notation: `Type` is the simplified type (`timestamptz` = `timestamp with time zone`,
`text[]` = text array); `Null` is `NO` for NOT NULL; `Default` is the server-side default.

### 4.1 `activity_log` — rows after clean reset: 3

RLS: **disabled** (0 policies).

Keys/constraints:
- `activity_log_pkey` (PK): `PRIMARY KEY (id)`
- `activity_log_source_type_check` (CHECK): `CHECK ((source_type = ANY (ARRAY['guest_uploads'::text, 'guestbook_messages'::text, 'site_editorial_features'::text])))`
- `activity_log_type_check` (CHECK): `CHECK ((type = ANY (ARRAY['photo_upload'::text, 'guestbook_entry'::text, 'featured_moment'::text])))`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `type` | text | NO | — |
| `source_id` | text | NO | — |
| `source_type` | text | NO | — |
| `display_name` | text | YES | — |
| `thumbnail_url` | text | YES | — |
| `content_preview` | text | YES | — |
| `created_at` | timestamptz | YES | `now()` |

### 4.2 `guest_face_tagging_batches` — rows after clean reset: 0

RLS: enabled (1 policies).

Keys/constraints:
- `guest_face_tagging_batches_batch_key_key` (UNIQUE): `UNIQUE (batch_key)`
- `guest_face_tagging_batches_pkey` (PK): `PRIMARY KEY (id)`
- `guest_face_tagging_batches_status_check` (CHECK): `CHECK ((status = ANY (ARRAY['prepared'::text, 'synced'::text, 'failed'::text])))`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `batch_key` | text | NO | — |
| `label` | text | NO | — |
| `status` | text | NO | `'prepared'::text` |
| `exportable_upload_count` | integer | NO | `0` |
| `exportable_photo_count` | integer | NO | `0` |
| `synced_photo_count` | integer | NO | `0` |
| `skipped_photo_count` | integer | NO | `0` |
| `last_error` | text | YES | — |
| `notes` | text | YES | — |
| `metadata` | jsonb | NO | `'{}'::jsonb` |
| `created_by_user_id` | uuid | YES | — |
| `created_by_email` | text | YES | — |
| `synced_by_user_id` | uuid | YES | — |
| `synced_by_email` | text | YES | — |
| `last_synced_at` | timestamptz | YES | — |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |

### 4.3 `guest_identities` — rows after clean reset: 0

RLS: enabled (3 policies).

Keys/constraints:
- `guest_identities_email_key` (UNIQUE): `UNIQUE (email)`
- `guest_identities_pkey` (PK): `PRIMARY KEY (id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `email` | text | NO | — |
| `session_id` | text | YES | — |
| `display_name` | text | NO | — |
| `is_verified` | boolean | NO | `false` |
| `created_at` | timestamptz | NO | `now()` |

### 4.4 `guest_share_tokens` — rows after clean reset: 0

RLS: enabled (3 policies).

Keys/constraints:
- `guest_share_tokens_guest_email_key` (UNIQUE): `UNIQUE (guest_email)`
- `guest_share_tokens_pkey` (PK): `PRIMARY KEY (id)`
- `guest_share_tokens_token_key` (UNIQUE): `UNIQUE (token)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `guest_email` | text | NO | — |
| `token` | text | NO | — |
| `created_at` | timestamptz | NO | `now()` |

### 4.5 `guest_uploads` — rows after clean reset: 0

RLS: enabled (4 policies).

Keys/constraints:
- `guest_uploads_memory_trail_check` (CHECK): `CHECK (((memory_trail IS NULL) OR (memory_trail = ANY (ARRAY['ceremony'::text, 'family'::text, 'dance-floor'::text, 'engagement-season'::text, 'bach-ette'::text]))))`
- `guest_uploads_pkey` (PK): `PRIMARY KEY (id)`
- `guest_uploads_status_check` (CHECK): `CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))`
- `guest_uploads_video_visibility_check` (CHECK): `CHECK ((video_visibility = ANY (ARRAY['archive_only'::text, 'guest_highlights'::text, 'featured'::text])))`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `guest_name` | text | NO | — |
| `guest_email` | text | NO | — |
| `message` | text | YES | — |
| `photo_urls` | text[] | YES | `'{}'::text[]` |
| `video_urls` | text[] | YES | `'{}'::text[]` |
| `status` | text | YES | `'pending'::text` |
| `created_at` | timestamptz | YES | `now()` |
| `video_visibility` | text | NO | `'archive_only'::text` |
| `memory_trail` | text | YES | — |
| `editorial_title` | text | YES | — |
| `editorial_summary` | text | YES | — |
| `featured_rank` | integer | YES | — |
| `photo_fingerprints` | text[] | NO | `'{}'::text[]` |
| `video_fingerprints` | text[] | NO | `'{}'::text[]` |
| `rejection_reason` | text | YES | — |

### 4.6 `guestbook_comments` — rows after clean reset: 0

RLS: enabled (2 policies).

Keys/constraints:
- `guestbook_comments_message_id_fkey` (FK): `FOREIGN KEY (message_id) REFERENCES guestbook_messages(id) ON DELETE CASCADE`
- `guestbook_comments_pkey` (PK): `PRIMARY KEY (id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `message_id` | uuid | NO | — |
| `author` | text | NO | `'Guest'::text` |
| `content` | text | NO | — |
| `created_at` | timestamptz | YES | `now()` |

### 4.7 `guestbook_messages` — rows after clean reset: 5

RLS: enabled (3 policies).

Keys/constraints:
- `guestbook_messages_pkey` (PK): `PRIMARY KEY (id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `name` | text | NO | — |
| `email` | text | NO | — |
| `content` | text | NO | — |
| `media_url` | text | YES | — |
| `reactions` | jsonb | YES | `'{}'::jsonb` |
| `created_at` | timestamptz | YES | `now()` |
| `ip_address` | text | YES | — |
| `rate_limited` | boolean | YES | `false` |

### 4.8 `media_review_batches` — rows after clean reset: 0

RLS: enabled (1 policies).

Keys/constraints:
- `media_review_batches_batch_key_key` (UNIQUE): `UNIQUE (batch_key)`
- `media_review_batches_pkey` (PK): `PRIMARY KEY (id)`
- `media_review_batches_status_check` (CHECK): `CHECK ((status = ANY (ARRAY['pending'::text, 'in_review'::text, 'approved'::text, 'archived'::text])))`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `batch_key` | text | NO | — |
| `label` | text | NO | — |
| `status` | text | NO | `'pending'::text` |
| `source_root` | text | YES | — |
| `working_root` | text | YES | — |
| `artifact_bucket` | text | NO | `'media-review-artifacts'::text` |
| `artifact_prefix` | text | NO | — |
| `artifact_paths` | jsonb | NO | `'{}'::jsonb` |
| `notes` | text | YES | — |
| `cluster_count` | integer | NO | `0` |
| `detection_count` | integer | NO | `0` |
| `pushed_by_user_id` | uuid | YES | — |
| `pushed_by_email` | text | YES | — |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |

### 4.9 `media_review_clusters` — rows after clean reset: 0

RLS: enabled (1 policies).

Keys/constraints:
- `media_review_clusters_batch_id_cluster_id_key` (UNIQUE): `UNIQUE (batch_id, cluster_id)`
- `media_review_clusters_batch_id_fkey` (FK): `FOREIGN KEY (batch_id) REFERENCES media_review_batches(id) ON DELETE CASCADE`
- `media_review_clusters_pkey` (PK): `PRIMARY KEY (id)`
- `media_review_clusters_review_status_check` (CHECK): `CHECK ((review_status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'ignored'::text, 'merged'::text, 'split_requested'::text])))`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `batch_id` | uuid | NO | — |
| `cluster_id` | text | NO | — |
| `review_status` | text | NO | `'pending'::text` |
| `confirmed_name` | text | YES | — |
| `merge_into_cluster_id` | text | YES | — |
| `split_requested` | boolean | NO | `false` |
| `split_notes` | text | YES | — |
| `sample_thumbnail_path` | text | YES | — |
| `member_count` | integer | NO | `0` |
| `average_quality_score` | numeric | YES | — |
| `source_record_ids` | text[] | NO | `'{}'::text[]` |
| `members` | jsonb | NO | `'[]'::jsonb` |
| `metadata` | jsonb | NO | `'{}'::jsonb` |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |

### 4.10 `media_review_faces` — rows after clean reset: 0

RLS: enabled (1 policies).

Keys/constraints:
- `media_review_faces_batch_id_face_id_key` (UNIQUE): `UNIQUE (batch_id, face_id)`
- `media_review_faces_batch_id_fkey` (FK): `FOREIGN KEY (batch_id) REFERENCES media_review_batches(id) ON DELETE CASCADE`
- `media_review_faces_pkey` (PK): `PRIMARY KEY (id)`
- `media_review_faces_review_status_check` (CHECK): `CHECK ((review_status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'ignored'::text])))`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `batch_id` | uuid | NO | — |
| `face_id` | text | NO | — |
| `cluster_id` | text | YES | — |
| `source_record_id` | text | YES | — |
| `source_relative_path` | text | YES | — |
| `photo_url` | text | YES | — |
| `thumbnail_url` | text | YES | — |
| `thumbnail_object_path` | text | YES | — |
| `x` | numeric | NO | `0` |
| `y` | numeric | NO | `0` |
| `box` | jsonb | NO | `'{}'::jsonb` |
| `quality_score` | numeric | YES | — |
| `review_status` | text | NO | `'pending'::text` |
| `confirmed_name` | text | YES | — |
| `person_key` | text | YES | — |
| `notes` | text | YES | — |
| `metadata` | jsonb | NO | `'{}'::jsonb` |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |

### 4.11 `moderation_audit_log` — rows after clean reset: 0

RLS: enabled (2 policies).

Keys/constraints:
- `moderation_audit_log_entity_type_check` (CHECK): `CHECK ((entity_type = ANY (ARRAY['guest_upload'::text, 'guestbook_message'::text, 'photo_claim'::text])))`
- `moderation_audit_log_pkey` (PK): `PRIMARY KEY (id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `entity_type` | text | NO | — |
| `entity_id` | uuid | NO | — |
| `action` | text | NO | — |
| `actor_user_id` | uuid | YES | — |
| `actor_email` | text | YES | — |
| `actor_name` | text | YES | — |
| `from_status` | text | YES | — |
| `to_status` | text | YES | — |
| `summary` | text | NO | — |
| `metadata` | jsonb | NO | `'{}'::jsonb` |
| `created_at` | timestamptz | NO | `now()` |

### 4.12 `photo_claims` — rows after clean reset: 0

RLS: enabled (3 policies).

Keys/constraints:
- `photo_claims_claim_type_check` (CHECK): `CHECK ((claim_type = ANY (ARRAY['upload'::text, 'face'::text])))`
- `photo_claims_face_id_fkey` (FK): `FOREIGN KEY (face_id) REFERENCES media_review_faces(id) ON DELETE SET NULL`
- `photo_claims_guest_identity_id_fkey` (FK): `FOREIGN KEY (guest_identity_id) REFERENCES guest_identities(id) ON DELETE CASCADE`
- `photo_claims_photo_id_fkey` (FK): `FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE`
- `photo_claims_pkey` (PK): `PRIMARY KEY (id)`
- `photo_claims_status_check` (CHECK): `CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))`
- `unique_identity_face` (UNIQUE): `UNIQUE (guest_identity_id, face_id)`
- `unique_identity_photo` (UNIQUE): `UNIQUE (guest_identity_id, photo_id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `guest_identity_id` | uuid | NO | — |
| `photo_id` | uuid | YES | — |
| `face_id` | uuid | YES | — |
| `claim_type` | text | NO | — |
| `status` | text | NO | `'pending'::text` |
| `rejection_reason` | text | YES | — |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |

### 4.13 `photo_comments` — rows after clean reset: 0

RLS: enabled (1 policies).

Keys/constraints:
- `photo_comments_content_check` (CHECK): `CHECK (((char_length(btrim(content)) >= 1) AND (char_length(btrim(content)) <= 1000)))`
- `photo_comments_pkey` (PK): `PRIMARY KEY (id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `photo_key` | text | NO | — |
| `author` | text | NO | `'Guest'::text` |
| `content` | text | NO | — |
| `created_at` | timestamptz | YES | `now()` |
| `session_id` | text | YES | — |
| `is_hidden` | boolean | NO | `false` |
| `hidden_at` | timestamptz | YES | — |
| `hidden_by_user_id` | uuid | YES | — |
| `hidden_reason` | text | YES | — |

### 4.14 `photo_likes` — rows after clean reset: 0

RLS: enabled (0 policies).

Keys/constraints:
- `photo_likes_photo_key_session_id_key` (UNIQUE): `UNIQUE (photo_key, session_id)`
- `photo_likes_pkey` (PK): `PRIMARY KEY (id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `photo_key` | text | NO | — |
| `session_id` | text | NO | — |
| `created_at` | timestamptz | YES | `now()` |

### 4.15 `photos` — rows after clean reset: 12

RLS: enabled (3 policies).

Keys/constraints:
- `photos_album_check` (CHECK): `CHECK (((album IS NULL) OR (album = ANY (ARRAY['Engagement'::text, 'Bach+ette'::text, 'Wedding Day'::text, 'Guest Uploads'::text]))))`
- `photos_pkey` (PK): `PRIMARY KEY (id)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `url` | text | NO | — |
| `thumbnail` | text | NO | — |
| `caption` | text | YES | — |
| `category` | text | YES | `'Uncategorized'::text` |
| `location` | text | YES | — |
| `date` | timestamptz | YES | `now()` |
| `likes` | integer | YES | `0` |
| `photographer` | text | YES | — |
| `is_professional` | boolean | YES | `false` |
| `tags` | text[] | YES | `'{}'::text[]` |
| `faces` | jsonb | YES | `'[]'::jsonb` |
| `created_at` | timestamptz | YES | `now()` |
| `album` | text | YES | — |
| `album_sort_order` | integer | NO | `0` |
| `download_url` | text | YES | — |

### 4.16 `rate_limit_logs` — rows after clean reset: 0

RLS: enabled (1 policies).

Keys/constraints:
- `rate_limit_logs_pkey` (PK): `PRIMARY KEY (id)`
- `unique_ip_action_window` (UNIQUE): `UNIQUE (ip_address, action, window_start)`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `ip_address` | text | NO | — |
| `action` | text | NO | — |
| `request_count` | integer | YES | `1` |
| `window_start` | timestamptz | YES | `now()` |
| `created_at` | timestamptz | YES | `now()` |

### 4.17 `site_editorial_feature_history` — rows after clean reset: 0

RLS: enabled (2 policies).

Keys/constraints:
- `site_editorial_feature_history_pkey` (PK): `PRIMARY KEY (id)`
- `site_editorial_feature_history_slot_check` (CHECK): `CHECK ((slot = ANY (ARRAY['home_newest_standout_upload'::text, 'home_featured_guestbook_note'::text, 'home_moment_of_the_week'::text, 'film_featured_guest_video'::text])))`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `slot` | text | NO | — |
| `feature_id` | uuid | YES | — |
| `actor_user_id` | uuid | YES | — |
| `actor_email` | text | YES | — |
| `actor_name` | text | YES | — |
| `change_summary` | text | NO | — |
| `previous_feature` | jsonb | NO | `'{}'::jsonb` |
| `next_feature` | jsonb | NO | `'{}'::jsonb` |
| `created_at` | timestamptz | NO | `now()` |

### 4.18 `site_editorial_features` — rows after clean reset: 0

RLS: enabled (4 policies).

Keys/constraints:
- `site_editorial_features_memory_trail_check` (CHECK): `CHECK (((memory_trail IS NULL) OR (memory_trail = ANY (ARRAY['ceremony'::text, 'family'::text, 'dance-floor'::text, 'engagement-season'::text, 'bach-ette'::text]))))`
- `site_editorial_features_pkey` (PK): `PRIMARY KEY (id)`
- `site_editorial_features_schedule_window_check` (CHECK): `CHECK (((starts_at IS NULL) OR (ends_at IS NULL) OR (starts_at <= ends_at)))`
- `site_editorial_features_slot_check` (CHECK): `CHECK ((slot = ANY (ARRAY['home_newest_standout_upload'::text, 'home_featured_guestbook_note'::text, 'home_moment_of_the_week'::text, 'film_featured_guest_video'::text])))`
- `site_editorial_features_slot_key` (UNIQUE): `UNIQUE (slot)`
- `site_editorial_features_source_type_check` (CHECK): `CHECK ((source_type = ANY (ARRAY['guest_upload'::text, 'guestbook_message'::text, 'film_chapter'::text, 'custom'::text])))`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `slot` | text | NO | — |
| `title` | text | NO | — |
| `summary` | text | YES | — |
| `trail` | text | YES | — |
| `source_type` | text | NO | — |
| `source_id` | text | YES | — |
| `source_label` | text | YES | — |
| `source_url` | text | YES | — |
| `is_active` | boolean | NO | `true` |
| `display_order` | integer | NO | `0` |
| `metadata` | jsonb | NO | `'{}'::jsonb` |
| `updated_by_user_id` | uuid | YES | — |
| `updated_by_email` | text | YES | — |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |
| `memory_trail` | text | YES | — |
| `badge_label` | text | YES | — |
| `cta_label` | text | YES | — |
| `starts_at` | timestamptz | YES | — |
| `ends_at` | timestamptz | YES | — |

## 5. Triggers

### 5.1 Application triggers (3)

All three call `public.trigger_activity_log_insert()` and maintain the public `/activity` feed plus
the realtime publication.

| Table | Trigger | Timing / events | Condition | Effect |
|---|---|---|---|---|
| `guest_uploads` | `guest_uploads_after_approve` | AFTER UPDATE, FOR EACH ROW | `new.status = 'approved'` AND `old.status IS DISTINCT FROM 'approved'` | insert `activity_log(type='photo_upload', source_type='guest_uploads', display_name=guest_name, thumbnail_url=photo_urls[1])` |
| `guestbook_messages` | `guestbook_messages_after_insert` | AFTER INSERT, FOR EACH ROW | — | insert `activity_log(type='guestbook_entry', source_type='guestbook_messages', display_name=name, thumbnail_url=media_url, content_preview=LEFT(content,100))` |
| `site_editorial_features` | `site_editorial_features_after_insert` | AFTER INSERT, FOR EACH ROW | `new.is_active = true` | insert `activity_log(type='featured_moment', source_type='site_editorial_features', display_name=title, thumbnail_url=source_url)` |

Important rebuild semantics: the upload trigger fires on the *transition* to approved, not on insert,
so an upload seeded already-approved never appears in the activity feed; a re-approval of a rejected
row does fire. There is no trigger on `guestbook_messages` DELETE (deleted notes stay in the feed) and
no trigger for `site_editorial_features` UPDATE (an edited/deactivated slot keeps its original feed
entry). No `updated_at` trigger exists for app tables — those columns are written by client code/RPCs.

### 5.2 Storage-platform triggers (4, installed by Supabase Storage, shipped in `storage.sql`)

`storage.buckets`: `enforce_bucket_name_length_trigger` (BEFORE INSERT/UPDATE OF name),
`protect_buckets_delete` (BEFORE DELETE, statement). `storage.objects`:
`protect_objects_delete` (BEFORE DELETE, statement), `update_objects_updated_at`
(BEFORE UPDATE). These are platform behavior, not app code; do not reimplement in the rebuild.

## 6. Functions

Full contract per function (args + defaults, return columns, SECURITY DEFINER, grants, src call sites,
behaviour notes, and the broken guestbook RPC) → [`rpc.md`](./rpc.md). Summary:

- **21 functions in `public`**: 20 `SECURITY DEFINER` + `trigger_activity_log_insert()` (trigger
  return type); 1 is `STABLE` (`is_admin()`), the rest `VOLATILE`.
- **10 are called by `src/**`**: the 9 gallery/engagement RPCs plus
  `submit_guestbook_message_with_rate_limit` (currently broken — see `rpc.md` §3 / A3 §5).
- **3 are service-role admin tooling**: `promote_to_admin`, `demote_from_admin`,
  `update_auth_user_metadata` (EXECUTE revoked from public/anon/authenticated).
- **Rate limiting helpers** (`check_rate_limit`, `increment_rate_limit`,
  `cleanup_old_rate_limits`) are called from the guestbook RPC or run manually; no scheduler exists
  in the repo.
- **Superseded versions retained for compatibility**: `toggle_photo_like` (v1),
  `save_album_organization_v1`.
- `storage.*` functions (search/list/filename/…) are platform internals captured in `storage.sql`;
  not app RPCs.

RPCs are exposed by PostgREST at `POST/GET /rest/v1/rpc/<name>`; `[api].schemas = ["public",
"graphql_public"]`, `max_rows = 1000`, `extra_search_path = ["public","extensions"]`.

## 7. Realtime

| Item | Value |
|---|---|
| Publication | `supabase_realtime` (insert/update/delete/truncate enabled, `puballtables = false`) |
| Tables | `public.activity_log`, `public.rate_limit_logs` |
| Client subscription | `src/hooks/useActivityRealtime.ts` — channel `activity_feed`, `postgres_changes`, event `INSERT`, `schema: public`, `table: activity_log` (bypassed when `window.__E2E__`) |
| Required auth | none (activity_log has RLS disabled; if the rebuild enables RLS it must add a public SELECT policy or realtime delivery will break) |
| Realtime config | client `eventsPerSecond: 10` (`src/lib/supabase/client.ts`) |

`rate_limit_logs` is in the publication but no client subscribes to it; putting a client-writable table
in realtime adds nothing today. The rebuild should publish only `activity_log` and gate delivery via
RLS.

## 8. Storage buckets and object policies

After a clean reset, `storage.buckets` contains exactly **one** row:

| Bucket | Public | Size limit | MIME limits | Created by |
|---|---|---|---|---|
| `media-review-artifacts` | **false** | none | none | migration 20260314000100 |

Policies on `storage.objects` (8, detail in [`policies.md`](./policies.md) §2):

- `media-review-artifacts`: `Admin users read media review artifacts` (SELECT) and
  `Admin users write media review artifacts` (ALL) — both require `bucket_id =
  'media-review-artifacts' AND public.is_admin()`, granted to `authenticated`.
- `guest-photos`, `guest-videos`, `guest-voice`: public INSERT + public SELECT each (6 policies).
  **Bucket rows for these three do not exist after a clean reset** — the migration that creates the
  policies explicitly expects the buckets to be created out-of-band in the Storage UI. They are
  legacy, unused by the shipping upload flow (which presigns Cloudflare R2). See
  [`../media/CONTRACT.md`](../media/CONTRACT.md).

Object layout (`media-review-artifacts`) is owned by the review scripts
(`scripts/push-*-review-batch.mjs`): `artifact_bucket`/`artifact_prefix`/`artifact_paths` live on
`media_review_batches`, and clients read objects via `createSignedUrl()` / `download()` in
`src/lib/supabase/mediaReview.ts`. The DB never stores public URLs for this bucket.

See [`../media/INVENTORY.json`](../media/INVENTORY.json) for the public media origin (Cloudflare R2),
path patterns, and local media counts/sizes.

## 9. Auth and role model

- **Provider**: Supabase Auth email/password (`[auth]` config: signup enabled, confirmations disabled
  locally, JWT expiry 3600 s, refresh-token rotation on, anonymous sign-ins off, MFA off).
- **Roles at the DB level**: `anon`, `authenticated`, `service_role` (PostgREST request roles),
  `authenticator`, `postgres`, `supabase_admin`, `supabase_auth_admin` (platform).
- **Authorization model**: a single server-set claim, `auth.jwt() -> 'app_metadata' ->> 'role'`,
  read by `public.is_admin()` (SECURITY DEFINER, STABLE, grant `authenticated`). `app_metadata` is
  writable only by the service-role key / admin API, so it is not user-spoofable. This replaced the
  old `user_metadata.role` check in migration 20260623000100, which:
  1. added `is_admin()`;
  2. added `promote_to_admin(uuid)` / `demote_from_admin(uuid)` (service-role only, write
     `auth.users.raw_app_meta_data`);
  3. one-shot copied existing `raw_user_meta_data.role='admin'` users to `raw_app_meta_data.role`;
  4. repointed 7 admin-gated RLS policies + 7 admin-gated RPCs at `is_admin()`;
  5. locked `update_auth_user_metadata()` to write `raw_app_meta_data` and revoked it from
     public/anon/authenticated.
- **Where the gate is used**: SELECT/UPDATE on `photos`; ALL on `media_review_batches`,
  `media_review_clusters`, `media_review_faces`, `guest_face_tagging_batches`; SELECT/ALL on
  `storage.objects` for `media-review-artifacts`; the admin body check in
  `save_album_organization_v1/v2`, `delete_gallery_photos_v1`, `get_recent_photo_comments_v1`,
  `hide_photo_comment_v1`, `delete_photo_comment_v1`.
- **Auth users**: 0 after a clean reset (`auth.users` is not seeded — no credentials belong in a
  committed fixture). Local admin bootstrap (documented, not automated in `fixtures.sql`): create a
  user in Supabase Studio / via the Auth admin API, then
  `select public.promote_to_admin('<uuid>');` with the local service role. The legacy helper
  `scripts/test-admin-flow-setup.mjs` does exactly this against `VITE_SUPABASE_URL` when pointed at
  the local API.
- **Client surface**: the browser only ever gets `VITE_SUPABASE_URL` + anon key
  (`src/lib/supabase/client.ts`); the service-role key is never shipped (see
  `docs/archival/SECURITY.md`). RLS is the only authorization boundary for the public client, so any
  RLS gap is directly reachable by anon — see `policies.md` §3.

## 10. Rate limiting (current implementation)

| Piece | Contract |
|---|---|
| Storage | `rate_limit_logs(id uuid, ip_address text, action text, request_count int default 1, window_start timestamptz default now(), created_at timestamptz default now())`; UNIQUE `(ip_address, action, window_start)`; indexes `idx_rate_limit_logs_lookup`, `idx_rate_limit_logs_cleanup`; RLS: service role only |
| Window model | clock-aligned minute buckets: `date_trunc('minute', now()) - interval '1 minute' * (extract(minute from now())::int % p_window_minutes)` |
| `check_rate_limit(ip, action, p_max_requests=5, p_window_minutes=1)` | returns `(allowed, remaining, reset_after_seconds, current_count)`; reads the bucket `FOR UPDATE SKIP LOCKED`, does not increment |
| `increment_rate_limit(ip, action, p_window_minutes=1)` | upsert `request_count = request_count + 1` on the current bucket |
| `cleanup_old_rate_limits()` | deletes rows older than 1 hour; returns count; **no scheduler** in repo (run manually / add pg_cron at rebuild) |
| Guestbook wrapper | `submit_guestbook_message_with_rate_limit(..., p_max_requests=3, p_window_minutes=1)`: derives client IP from PostgREST `request.headers` (`x-forwarded-for` then `x-real-ip`), checks, returns `success=false` + friendly message when limited, increments, inserts message with `ip_address`. **Broken today (§13.2/`rpc.md` §3): the insert references the dropped `type` column** |
| Client-side complement | `src/pages/guestbook/useGuestbookComposer.ts` also enforces 3 submissions / 60 s via `rateLimiter.check('guestbook-submit', …)` in localStorage; the server RPC is the authoritative layer |
| Photo comments | inline limit inside `create_photo_comment_v1`: max 5 comments per `session_id` per 10 minutes (no `rate_limit_logs` involvement) |

Because the submit RPC errors before its INSERT, the client falls back to a direct table insert and the
server-side limit is bypassed in any environment running this function version. See `rpc.md` §3 and
`docs/rebuild/audit/A3-data.md` §5 for blast radius, the exact fix sketch (not applied in Wave 0), and
risk register **R17**.

## 11. Moderation state machines

### 11.1 Guest uploads (`guest_uploads`)

```
(insert by guest, RLS public INSERT)
        status = 'pending'
          ├── update status='approved'  → public via RLS "Allow public read approved"
          │      trigger guest_uploads_after_approve → activity_log(photo_upload)
          │      admin may then publish photos into `photos` (album copy) via
          │      publishGuestUploadPhotosToAlbum() in src/lib/supabase/guestUploads.ts
          └── update status='rejected', rejection_reason=<text> → hidden from public
```
- `status` CHECK: `pending | approved | rejected` (default `pending`).
- Orthogonal `video_visibility` CHECK: `archive_only | guest_highlights | featured` (default
  `archive_only`) — used by the film page for guest video placement.
- `memory_trail` CHECK: `ceremony | family | dance-floor | engagement-season | bach-ette` (nullable).
- Editorial columns: `editorial_title`, `editorial_summary`, `featured_rank`; fingerprints:
  `photo_fingerprints`/`video_fingerprints` (dedupe support).
- Reject is a status change, never a delete (no DELETE policy/RPC).
- Audit: every transition is logged by the client into `moderation_audit_log` (not by a DB trigger):
  actions `upload_moved_to_pending`, `upload_approved_unpublished`, `upload_approved_published`,
  `upload_removed_from_gallery`, `upload_rejected`, `upload_bulk_rejected`.

### 11.2 Photo/face claims (`photo_claims` + `guest_identities`)

```
guest submits claim (find-or-create guest_identities by email; is_verified=false)
   photo_claims.status='pending', claim_type ∈ {upload, face}
     ├── approve → status='approved'; guest_identities.is_verified=true;
     │            if claim_type='face': media_review_faces.confirmed_name := display_name,
     │            review_status := 'confirmed', updated_at := now()
     └── reject  → status='rejected', rejection_reason
```
- CHECK: `status pending|approved|rejected`; `claim_type upload|face`.
- Uniqueness: `(guest_identity_id, photo_id)` and `(guest_identity_id, face_id)`; FKs
  `photo_id → photos ON DELETE CASCADE`, `face_id → media_review_faces ON DELETE SET NULL`,
  `guest_identity_id → guest_identities ON DELETE CASCADE`.
- Audit actions: `claim_approved`, `claim_rejected` (entity_type `photo_claim`).
- Admin UI reads `photo_claims` with embedded `guest_identities` and `photos`.

### 11.3 Media-review pipeline

| Object | States (CHECK) | Notes |
|---|---|---|
| `media_review_batches.status` | `pending | in_review | approved | archived` | default `pending`; `batch_key` unique; counts `cluster_count`/`detection_count`; `artifact_bucket`/`artifact_prefix`/`artifact_paths` point at private storage |
| `media_review_clusters.review_status` | `pending | confirmed | ignored | merged | split_requested` | default `pending`; `split_requested` bool + `split_notes`; `merge_into_cluster_id`; unique `(batch_id, cluster_id)`; FK batch ON DELETE CASCADE; `members` jsonb + `source_record_ids` text[] |
| `media_review_faces.review_status` | `pending | confirmed | ignored` | default `pending`; `confirmed_name`, `person_key`, `box` jsonb, `quality_score`, thumbnail paths; unique `(batch_id, face_id)`; FK batch ON DELETE CASCADE |
| `guest_face_tagging_batches.status` | `prepared | synced | failed` | default `prepared`; export/sync/skip counts; creator/syncer user ids+emails; `last_error`, `last_synced_at` |

All four tables are admin-only via `is_admin()`; batch deletion cascades clusters and faces (storage
objects are not deleted by the DB — the review scripts own cleanup).

### 11.4 Editorial features (`site_editorial_features` + history)

- Slots (unique): `home_newest_standout_upload`, `home_featured_guestbook_note`,
  `home_moment_of_the_week`, `film_featured_guest_video`.
- `source_type`: `guest_upload | guestbook_message | film_chapter | custom`; optional `source_id`,
  `source_label`, `source_url`.
- Publish window: `is_active` + `starts_at`/`ends_at` (CHECK `starts_at IS NULL OR ends_at IS NULL OR
  starts_at <= ends_at`); public anon read only while active and inside the window; `display_order`.
- `memory_trail` CHECK shares the same five values as guest uploads.
- Every admin edit is mirrored by the client into `site_editorial_feature_history` (append-only:
  `slot`, `feature_id`, `change_summary`, `previous_feature`/`next_feature` jsonb, actor fields).

### 11.5 Moderation audit log (`moderation_audit_log`)

Append-only (RLS allows SELECT+INSERT for authenticated, no UPDATE/DELETE).
- `entity_type` CHECK: `guest_upload | guestbook_message | photo_claim`.
- `action` is **plain text with no CHECK constraint**; the client type union
  (`src/lib/supabase/types.ts`) defines 10 values: `upload_moved_to_pending`,
  `upload_approved_unpublished`, `upload_approved_published`, `upload_removed_from_gallery`,
  `upload_rejected`, `upload_bulk_rejected`, `guestbook_message_deleted`, `guestbook_bulk_deleted`,
  `claim_approved`, `claim_rejected`. A rebuild should add the CHECK or an enum.
- Actor fields are client-supplied (`actor_user_id/email/name`) — spoofable by any authenticated
  writer; better design is an insert RPC deriving actor from the JWT.
- Indexes: `(entity_type, entity_id, created_at)`, `(actor_email, created_at)`, `created_at`.

## 12. Guest-share token model (`guest_share_tokens`)

Purpose: give every guest one permanent, unguessable URL (`/guest/:token`) that aggregates their
approved uploads, guestbook notes and claimed photos — no account required.

Schema: `id uuid PK`, `guest_email text NOT NULL UNIQUE`, `token text NOT NULL UNIQUE`,
`created_at timestamptz NOT NULL default now()`. RLS: public SELECT/INSERT `true`, authenticated ALL.

Flow (`src/lib/supabase/claims.ts`):

1. `getOrCreateShareToken(email)` — lowercases/trims the email, `select token from
   guest_share_tokens where guest_email = …`; if absent, generates `crypto.randomUUID()` and inserts;
   on a race (unique violation) it re-selects and returns the winner's token. Insert-on-read.
2. `fetchGuestContributionsByToken(token)` — resolves the token to its email, then in parallel:
   approved `guest_uploads` for that email, all `guestbook_messages` for that email, the verified
   `guest_identities` row with `photo_claims(*, photos(*))`; returns
   `{ guestName, uploads, guestbook, claimedPhotos }`. Display name resolution order:
   identity → first guestbook name → first upload guest_name → `'Special Guest'`.
3. The route is `/guest/:token` (routes contract owned by contracts-eng).

Properties/limits: tokens never expire and cannot be revoked except by deleting the row; one token per
email (unique); token is a random UUID (122 bits) so unguessable, **but** the table grants public
SELECT, so `(guest_email, token)` pairs are enumerable by anyone with the anon key — that defeats the
token's only security property. Rebuild must replace table-level public read with a SECURITY DEFINER
lookup by token (and ideally stop returning `guest_email` to the client). See `policies.md` §3.2.

## 13. Drift Report — `src/**` references vs the local database

### 13.1 Method and legend

```bash
# tables
rg -n "\.from\('([A-Za-z0-9_-]+)'\)" src
# RPCs (including multi-line .rpc(\n  'name')
rg -n "\.rpc\(|rpc\(\s*'" src
# storage buckets
rg -n "storage\.from\('([^']+)'\)" src
# then compare each name with the clean-reset inventory (public tables, public functions,
# storage.buckets rows) and inspect the calling module's reachability.
```

Legend: **DEFINED** = object exists in the clean-reset DB and the call is reachable;
**DEFINED-BROKEN** = exists but the call fails at runtime; **MISSING** = name does not exist in the DB;
**DEAD-CODE** = the referencing module is not reachable from the app entry point (nothing imports it);
**TEST-ONLY** = only a unit test/mock uses the name; **INDIRECT** = table is only touched through an
RPC, never by a direct `from()` query.

### 13.2 Tables referenced by `src/**`

| Table | Status | Sources (file:line) |
|---|---|---|
| `photos` | DEFINED | `hooks/useGalleryData.ts:66`; `pages/Gallery.tsx:97`; `components/search/Search.tsx:199`; `components/sections/GuestHighlightReel.tsx:25`; `pages/admin/Dashboard.tsx:134`; `pages/admin/Analytics.tsx:50,54,59`; `components/admin/ReviewImportManifest.tsx:70,88`; `lib/supabase/photos.ts:34,43,53,165,177,190`; `lib/supabase/guestUploads.ts:184`; `lib/supabase/mediaReview.ts:42` |
| `guest_uploads` | DEFINED | `lib/supabase/guestUploads.ts:13,23,35,48,54,77,83,106,131,164,207`; `lib/supabase/claims.ts:256,346`; `pages/Film.tsx:92`; `pages/admin/Analytics.tsx:36,41`; `pages/admin/Dashboard.tsx:136,141`; `pages/upload/useGuestUploadSubmit.ts:71` |
| `guestbook_messages` | DEFINED | `components/search/Search.tsx:204`; `components/sections/GuestHighlightReel.tsx:31`; `pages/Print.tsx:179`; `lib/supabase/claims.ts:354`; `pages/admin/Dashboard.tsx:139`; `pages/admin/Analytics.tsx:46`; `pages/admin/GuestbookModeration.tsx:34,61,97`; `pages/guestbook/useGuestbookMessages.ts:26`; `pages/guestbook/useGuestbookComposer.ts:127`; `pages/guestbook/useGuestbookReactions.ts:71` |
| `guestbook_comments` | DEFINED | `pages/guestbook/useGuestbookReplies.ts:24`; embedded via `useGuestbookMessages.ts:28` (`comments:guestbook_comments(...)`, works because of the FK) |
| `photo_comments` | DEFINED | `lib/supabase/photos.ts:109` (+ write RPCs) |
| `photo_likes` | DEFINED / INDIRECT | no direct query; only `toggle_photo_like_v2` / `get_photo_like_statuses` |
| `guest_identities` | DEFINED | `lib/supabase/claims.ts:24,85,95,101,179,361,368` |
| `photo_claims` | DEFINED | `lib/supabase/claims.ts:36,47,58,123,160,171,217,228` |
| `guest_share_tokens` | DEFINED | `lib/supabase/claims.ts:283,295,306,331` |
| `site_editorial_features` | DEFINED | `lib/supabase/editorial.ts:18,46,73` |
| `site_editorial_feature_history` | DEFINED | `lib/supabase/editorial.ts:32,56` |
| `moderation_audit_log` | DEFINED | `lib/supabase/moderation.ts:18,37` |
| `activity_log` | DEFINED | `lib/supabase/activity.ts:10,23`; realtime `hooks/useActivityRealtime.ts:29` |
| `media_review_batches` | DEFINED | `lib/supabase/mediaReview.ts:25,118` |
| `media_review_clusters` | DEFINED | `lib/supabase/mediaReview.ts:97,133` |
| `media_review_faces` | DEFINED | `lib/supabase/mediaReview.ts:67,106,149,167`; `lib/supabase/claims.ts:188` |
| `guest_face_tagging_batches` | DEFINED | `lib/supabase/mediaReview.ts:89` |
| `rate_limit_logs` | DEFINED / INDIRECT | no direct query; only `check_rate_limit` / `increment_rate_limit` / cleanup |
| `wedding_gallery` | **MISSING** | `services/galleryService.ts:53,98,184,210,244,271` — **DEAD-CODE** (nothing imports `galleryService.ts`; only its own `logger` import) |
| `gallery_categories` | **MISSING** | `services/galleryService.ts:127` + embedded relation at `:57` — same DEAD-CODE module |
| `error_logs` | **MISSING** | `utils/logger.ts:83` — logger.error is called only from the dead `galleryService.ts`; `utils/storage.ts` calls `logger.warn` (console only), so the `error_logs` write path never executes in the shipping app; module ships in the bundle only if imported |
| `audit_logs` | **MISSING** | `utils/security.ts:106` — **DEAD-CODE** (nothing imports `utils/security.ts`, so `auditLog()` never runs) |
| `dummy` | TEST-ONLY | `lib/supabase.test.ts:46` — mocked query builder, not a real table |

**Explanation of every mismatch:** all four missing tables are referenced only by unreachable modules
(`services/galleryService.ts`, `utils/logger.ts`'s write path, `utils/security.ts`). They are legacy
scaffolding that predates the current `photos`/guestbook/`moderation_audit_log` implementation and were
never dropped from the bundle. The rebuild must not port `wedding_gallery`, `gallery_categories`,
`error_logs`, or `audit_logs`; if error tracking is wanted, use Sentry (`VITE_SENTRY_DSN`, already
wired) instead of `error_logs`. No live screen depends on any missing table.

### 13.3 RPCs referenced by `src/**`

| RPC | Status | Call site |
|---|---|---|
| `get_photo_like_statuses` | DEFINED | `lib/supabase/photos.ts:67` |
| `get_photo_engagement_summary_v1` | DEFINED | `lib/supabase/photos.ts:76` |
| `toggle_photo_like_v2` | DEFINED | `lib/supabase/photos.ts:83` |
| `create_photo_comment_v1` | DEFINED | `lib/supabase/photos.ts:124` |
| `get_recent_photo_comments_v1` | DEFINED | `lib/supabase/photos.ts:135` |
| `hide_photo_comment_v1` | DEFINED | `lib/supabase/photos.ts:143` |
| `delete_photo_comment_v1` | DEFINED | `lib/supabase/photos.ts:153` |
| `save_album_organization_v2` | DEFINED | `lib/supabase/photos.ts:214` |
| `delete_gallery_photos_v1` | DEFINED | `lib/supabase/photos.ts:234` |
| `submit_guestbook_message_with_rate_limit` | **DEFINED-BROKEN** | `pages/guestbook/useGuestbookComposer.ts:96` — raises `column "type" does not exist`; client silently falls back to a direct insert (`:126-133`) |

No RPC referenced by `src/**` is missing. The one broken RPC is a function-body defect independent of
migration application (all 31 migrations apply): see `rpc.md` §3 and A3 §5.

### 13.4 Storage buckets referenced by `src/**`

| Bucket | Status | Call site |
|---|---|---|
| `media-review-artifacts` | DEFINED (private bucket; objects reachable only via signed URL + `is_admin()` policy) | `lib/supabase/mediaReview.ts:185,189` (bucket passed from `media_review_batches.artifact_bucket`) |
| `wedding-gallery` | **MISSING** | `services/galleryService.ts:168,240` — DEAD-CODE, no bucket row/policy in the 31 migrations |

### 13.5 Objects defined in the DB but not referenced by `src/**` (defined-unused)

| Object | Kind | Why it exists / action |
|---|---|---|
| `toggle_photo_like` | RPC (v1) | superseded by `toggle_photo_like_v2`; keep for prod compatibility during rebuild, drop at cutover |
| `save_album_organization_v1` | RPC (v1) | superseded by v2; only legacy `scripts/test-admin-flow-rls.mjs` calls it |
| `check_rate_limit`, `increment_rate_limit`, `cleanup_old_rate_limits` | RPC | internal rate-limit helpers; cleanup has no scheduler — add one at rebuild |
| `get_guestbook_messages_with_comments` | RPC | not used by current src (PostgREST embed is used instead), but used by `scripts/verify_supabase.js`, `scripts/inspect_guestbook.cjs`, the e2e mock, and the content extractor; keep through cutover |
| `is_admin` | RPC/helper | consumed by RLS policies + admin RPC bodies, not by the client |
| `promote_to_admin`, `demote_from_admin`, `update_auth_user_metadata` | RPC | service-role admin tooling; only `scripts/test-admin-flow-setup.mjs` uses `promote_to_admin` |
| `trigger_activity_log_insert` | trigger function | called by the 3 triggers |
| `rate_limit_logs` | table (INDIRECT) | internal rate limiter |
| `photo_likes` | table (INDIRECT) | managed by the like RPCs |

### 13.6 Drift outside `src/**` (recorded for completeness, not part of the required `src` audit)

- `scripts/inspect-columns.mjs:27` calls RPC `get_table_info` — **MISSING** in the DB (script-only).
- Legacy scripts target production with their own env (`VITE_SUPABASE_URL` etc.); they are not part of
  the rebuild runtime.
- `supabase/schema.sql` is stale (170 lines, 4 tables) and must never be used as the baseline; the
  reset dumps in this directory are authoritative.

### 13.7 Rebuild implications of the drift

1. Data layer for the rebuild should expose exactly the 18 defined tables / 10 useful RPCs; the four
   missing tables and `galleryService`/`security` modules are deleted code, not features.
2. `error_logs`/`audit_logs` never worked — replace with Sentry + `moderation_audit_log`.
3. Fix the broken guestbook RPC in Wave 3 (or cutover) and verify prod's actual function definition
   read-only first; the UI fallback masks it, so no e2e will catch it unless the RPC is tested
   directly.
4. Add missing DELETE policy/RPC for guestbook moderation, close the RLS gaps in `policies.md` §3,
   and add `CHECK` constraints for audit `action` and status enums where the current baseline relies on
   client types.

## 14. Extensions, schemas, indexes

Extensions (clean reset): `pgcrypto 1.3` (extensions), `uuid-ossp 1.1` (extensions),
`pg_stat_statements 1.11` (extensions), `supabase_vault 0.3.1` (vault), `plpgsql 1.0` (pg_catalog).
Installed by the platform / Supabase CLI bootstrap, not by app migrations; the rebuild must keep
`pgcrypto`/`uuid-ossp` for `gen_random_uuid()`/uuid generation compatibility.

Schemas in the database: `public` (18 app tables), `storage` (platform + object policies), `auth`
(platform), `extensions`, `vault`, `graphql_public`, `realtime`, `_realtime`, `supabase_functions`,
`supabase_migrations`. API-exposed schemas: `public`, `graphql_public` (`[api].schemas`).

Public indexes (71) per table:

| Table | Indexes |
|---|---|
| `activity_log` | `activity_log_pkey`, `idx_activity_log_created_at` |
| `guest_face_tagging_batches` | `guest_face_tagging_batches_batch_key_key`, `guest_face_tagging_batches_pkey`, `idx_guest_face_tagging_batches_status`, `idx_guest_face_tagging_batches_updated_at` |
| `guest_identities` | `guest_identities_email_key`, `guest_identities_pkey`, `idx_guest_identities_email` |
| `guest_share_tokens` | `guest_share_tokens_guest_email_key`, `guest_share_tokens_pkey`, `guest_share_tokens_token_key`, `idx_guest_share_tokens_email`, `idx_guest_share_tokens_token` |
| `guest_uploads` | `guest_uploads_pkey`, `idx_guest_uploads_created_at`, `idx_guest_uploads_memory_trail_created_at`, `idx_guest_uploads_status`, `idx_guest_uploads_video_visibility_created_at` |
| `guestbook_comments` | `guestbook_comments_pkey`, `idx_guestbook_comments_created_at`, `idx_guestbook_comments_message_id` |
| `guestbook_messages` | `guestbook_messages_pkey`, `idx_guestbook_created_at`, `idx_guestbook_messages_ip` |
| `media_review_batches` | `media_review_batches_batch_key_key`, `media_review_batches_pkey`, `idx_media_review_batches_status_updated_at` |
| `media_review_clusters` | `media_review_clusters_batch_id_cluster_id_key`, `media_review_clusters_pkey`, `idx_media_review_clusters_batch_status`, `idx_media_review_clusters_confirmed_name` |
| `media_review_faces` | `media_review_faces_batch_id_face_id_key`, `media_review_faces_pkey`, `idx_media_review_faces_batch_person`, `idx_media_review_faces_batch_source`, `idx_media_review_faces_batch_status` |
| `moderation_audit_log` | `moderation_audit_log_pkey`, `moderation_audit_log_actor_created_idx`, `moderation_audit_log_created_at_idx`, `moderation_audit_log_entity_created_idx` |
| `photo_claims` | `photo_claims_pkey`, `idx_photo_claims_face_id`, `idx_photo_claims_guest_identity`, `idx_photo_claims_photo_id`, `idx_photo_claims_status`, `unique_identity_face`, `unique_identity_photo` |
| `photo_comments` | `photo_comments_pkey`, `idx_photo_comments_created_at`, `idx_photo_comments_photo_key`, `idx_photo_comments_photo_key_visible` |
| `photo_likes` | `photo_likes_pkey`, `photo_likes_photo_key_session_id_key`, `idx_photo_likes_created_at`, `idx_photo_likes_photo_key` |
| `photos` | `photos_pkey`, `idx_photos_album_sort_order`, `idx_photos_category`, `idx_photos_created_at` |
| `rate_limit_logs` | `rate_limit_logs_pkey`, `unique_ip_action_window`, `idx_rate_limit_logs_cleanup`, `idx_rate_limit_logs_lookup` |
| `site_editorial_feature_history` | `site_editorial_feature_history_pkey`, `idx_site_editorial_feature_history_created_at`, `idx_site_editorial_feature_history_slot_created_at` |
| `site_editorial_features` | `site_editorial_features_pkey`, `site_editorial_features_slot_key`, `idx_site_editorial_features_active_order`, `idx_site_editorial_features_slot` |

## 15. Known gaps and assumptions (Wave 0)

1. **Baseline ≠ production.** The local DB is rebuilt from the frozen migrations. Production was very
   likely repaired out-of-band at least once (the #141 migration itself is evidence). At cutover,
   introspect production read-only (`pg_dump --schema-only`, `pg_policies`, `pg_get_functiondef`) and
   diff against these dumps before migrating. Assumption stated, not verified (no production access in
   Wave 0).
2. **Auth users are not seeded.** `auth.users` is empty after reset; admin screens cannot be rendered
   from `fixtures.sql` alone. Local admin bootstrap is documented in §9. No credentials are committed.
3. **R2 object population is not enumerated.** Media sizes/counts in `contracts/media/` are the local
   `public/` tree; the actual R2 bucket listing requires an owner-provided read-only credential at
   cutover (§8 of the media contract).
4. **Legacy Standard buckets missing.** `guest-photos`/`guest-videos`/`guest-voice` policies exist but
   bucket rows do not (created out-of-band in production). Do not recreate them for the rebuild.
5. **`gen types --local` workaround.** The documented command fails in the shifted-port sandbox
   (§1.3), so `database.types.ts` is produced with the equivalent local `--db-url`. On a host without
   the port conflict, `npx supabase gen types typescript --local --schema public` is the canonical
   command.
6. **`seed.sql` re-adds Unsplash placeholders** after migration 31 deletes older ones; it is demo data
   and must not be treated as content. `fixtures.sql` supersedes it for the rebuild.
7. **No scheduler** exists for `cleanup_old_rate_limits()`; retention of `rate_limit_logs` depends on
   manual runs in the legacy app.
8. **`supabase/schema.sql` is stale** (170 lines / 4 tables). The files here are generated from a real
   reset and are the only trusted baseline.
9. **Docker host shared with another project** (resell-os stack). The sandbox uses shifted ports and a
   distinct project id, so both can run side by side; do not stop the other workspace's containers.
10. **Evidence lives in gitignored `tmp/`** (on this machine only): reset logs, dumps, psql inventory
    output, runtime probes. Re-running §1.3 regenerates it deterministically.
