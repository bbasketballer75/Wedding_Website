# A3 — Data Layer Audit (backend & schema baseline)

Owner: backend-eng · Wave 0 (WP-4) · Generated 2026-11-08 · Branch `rebuild/greenfield`
Frozen oracle: tag `legacy-freeze-2026-11-08`.

**Verdict:** the database layer is reconstructible and now reproducible locally (31/31 migrations,
two byte-identical dumps), but the committed migration history contains **two real defects** (one
repaired, one documented) and the RLS/authorization surface has **seven findings that must be closed
by the rebuild/cutover**. No production system was read or written; no secrets or PII entered any
artifact.

Artifacts delivered with this audit (all under my write scope):

| Path | Content |
|---|---|
| `contracts/schema/schema.sql` | clean-reset `pg_dump --schema public` (DDL + policies + functions + grants) |
| `contracts/schema/storage.sql` | clean-reset `pg_dump --schema storage` |
| `contracts/schema/database.types.ts` | generated Supabase TS types for `public` |
| `contracts/schema/INVENTORY.md` | tables/columns/counts, triggers, functions, realtime, storage, auth model, rate limits, moderation state machines, guest-share tokens, **drift report** |
| `contracts/schema/policies.md` | every RLS policy per table/operation + risk analysis |
| `contracts/schema/rpc.md` | every RPC with args/returns/SECURITY DEFINER + callers |
| `contracts/schema/fixtures.sql` | synthetic, anonymised fixtures sufficient to render every screen |
| `contracts/media/INVENTORY.json` | media buckets/path patterns/local media counts (schema-validated) |
| `contracts/media/CONTRACT.md` | R2/CDN/Storage roles, `getMediaPath` rules, CORS/cache, no-media-loss invariant |

Evidence is cached in gitignored `tmp/` on this machine (`tmp/evidence/`: reset logs, dump files,
raw psql inventory, runtime probes) and is deterministic to regenerate; exact commands are below.

---

## 1. Scope, method, and constraints honoured

**Scope.** Reconstruct the *real* backend from the 31 frozen migrations (not from the stale
`supabase/schema.sql`), publish a rebuild-grade contract of it, prove determinism, inventory the media
origin, and surface data/security risks for the cutover.

**Method.** Local Supabase (CLI 2.117.0, Docker 29.7.2, Postgres 17.6.1.167) in a gitignored sandbox
project with only `project_id` + ports changed (the host already runs a different workspace's Supabase
stack on 54321–54324; those containers were **not** touched). Two full `db reset` cycles, schema dumps
hashed and compared, full psql inventory, runtime probes of the RPC surface, then a static drift pass
over `src/**`.

**Constraints honoured:**

- No production Supabase/Netlify/Cloudflare access of any kind; no `supabase link`/`db push`, no
  service-role key against anything remote. The sandbox reports `linked_project: null`.
- Legacy `supabase/**` was read-only for me; the single exception (`20260624000000` semicolon repair)
  was made by the **Lead** after I reported the defect, with a narrow `check-legacy-freeze.mjs`
  allowlist entry. I changed nothing outside `contracts/schema/**`, `contracts/media/**`,
  `docs/rebuild/audit/A3-data.md`, plus gitignored scratch (`tmp/`).
- No media bytes were copied, encoded, moved, or embedded; only file metadata was measured.
- No production data or PII in any artifact: fixtures use `@fixtures.example` / “Fixture …” identities;
  the baseline demo rows come from the repo's own migrations/seed.
- No `npm install`, no `npm run build`, no git state changes.

---

## 2. Reproducibility evidence (acceptance)

### 2.1 Sandbox (reproducible, no port conflict)

```
tmp/supabase-sandbox/
└── supabase/
    ├── config.toml      # copy of repo config + project_id "theporadas-workbench"
    │                    # + ports shifted: api 54321→55321, db 54334→55334,
    │                    # shadow 54320→55320, studio 54323→55323,
    │                    # inbucket 54324→55324, analytics 54327→55327,
    │                    # edge inspector 8083→18083
    ├── migrations/      # byte-copies of the 31 repo migrations (re-synced after the Lead's repair)
    └── seed.sql         # copy of repo seed
```

`supabase/.temp` is deliberately not copied (it carries the linked remote project ref); with
`--workdir tmp/supabase-sandbox` the CLI reports `linked_project: null`. The full recipe (including the
copy commands) is in `contracts/schema/INVENTORY.md` §1.2.

### 2.2 Commands and results

```powershell
npx supabase --workdir tmp/supabase-sandbox start         # local Docker only
npx supabase db reset --workdir tmp/supabase-sandbox      # reset #1
npx supabase --workdir tmp/supabase-sandbox db dump --local --schema public  -f <abs>\reset1-public.sql
npx supabase --workdir tmp/supabase-sandbox db dump --local --schema storage -f <abs>\reset1-storage.sql
npx supabase db reset --workdir tmp/supabase-sandbox      # reset #2
npx supabase --workdir tmp/supabase-sandbox db dump --local --schema public  -f <abs>\reset2-public.sql
npx supabase --workdir tmp/supabase-sandbox db dump --local --schema storage -f <abs>\reset2-storage.sql
npx supabase gen types typescript --db-url "postgresql://postgres:postgres@127.0.0.1:55334/postgres" --schema public
```

Excerpts (real output):

```
Applying migration 20260624000000_fix_guestbook_rpc_drop_type.sql...
Applying migration 20260915020000_remove_unsplash_placeholder_photos.sql...
Seeding data from supabase/seed.sql...
Restarting containers...
Finished supabase db reset on branch rebuild/greenfield.
```

```
RESET1 elapsed: 41.9s
RESET2 elapsed: 41.4s
public  reset1: A162C56BD506D8AB0391D93584350089829EF6932584FBD315B70843C211F267
public  reset2: A162C56BD506D8AB0391D93584350089829EF6932584FBD315B70843C211F267
public  IDENTICAL: True
storage reset1: 7968E45710A637F3003038A175603664E7F752ABA782D72D497983A4C4E72E82
storage reset2: 7968E45710A637F3003038A175603664E7F752ABA782D72D497983A4C4E72E82
storage IDENTICAL: True
```

- Both dumps are schema-only (0 `COPY`/`INSERT` statements, 0 `\restrict` random tokens), so the
  random UUIDs generated by `seed.sql`'s `gen_random_uuid()` default cannot perturb the hash.
- `supabase_migrations.schema_migrations` contains exactly **31 rows**, versions matching the 31
  filenames (`20240303000000` … `20260915020000`).
- `npx supabase status --workdir tmp/supabase-sandbox` was healthy before capture
  (`DB_URL postgresql://postgres:postgres@127.0.0.1:55334/postgres`, API 55321, Studio 55323).
- One workaround: `gen types --local` fails inside this sandbox with
  `password authentication failed for user "postgres"` (the CLI's helper container cannot auth to the
  shifted-port DB). The equivalent **local-only** `--db-url` invocation above was used; no remote
  endpoint was involved. On a host without the port conflict, `--local` is canonical.

### 2.3 Acceptance checklist

| Criterion | Result |
|---|---|
| 31/31 migrations applied | ✅ twice |
| Two consecutive resets + dumps identical SHA-256 | ✅ public `A162C5…F267`, storage `7968E4…2E82` (77,970 B / 54,213 B) |
| `supabase status` healthy | ✅ captured before stop |
| Schema artifacts detected by `verify-contracts --allow-missing` | ✅ 7/7 `contracts/schema/*` files + `contracts/media/INVENTORY.json` + `CONTRACT.md` |
| All 31 migrations recorded in history | ✅ 31 rows |
| No secrets/PII in artifacts | ✅ schema/policies/functions/grants only; fixtures synthetic |
| `node tools/check-legacy-freeze.mjs` | ✅ “Legacy freeze intact” (the Lead's one documented exception + allowlisted new dirs) |

---

## 3. Migration baseline findings

### 3.1 Defect #1 — repaired migration could never have executed (found & fixed)

The first `supabase start` applied 30 migrations and died on `20260624000000_fix_guestbook_rpc_drop_type.sql`:

```
ERROR: syntax error at or near "CREATE" (SQLSTATE 42601)
At statement: 0
...
DROP FUNCTION IF EXISTS public.get_guestbook_messages_with_comments()
CREATE FUNCTION public.get_guestbook_messages_with_comments()
```

That migration was added by commit `7e8df7c` “chore(db): reconcile missing 20260624000000
fix_guestbook_rpc_drop_type migration (#141)” — reconstructed by hand from the production function
definition and committed without ever being executed. It was missing **four semicolons**: after the
`DROP FUNCTION`, after `$$ LANGUAGE plpgsql`, and after each of the two `GRANT EXECUTE … TO
anon/authenticated` lines. This is a repo defect, not a Docker/port problem: it fails identically on a
fresh local DB and would fail on `db push` to any Postgres.

**Disposition (not done by me):** the Lead applied the minimal syntax-only repair and added a narrow,
documented exception in `tools/check-legacy-freeze.mjs`; a “Workbench note (2026-11-08)” comment
explains it at the top of the migration. No SQL semantics changed, no other migration touched,
migrations never enter the client bundle so the parity oracle is unaffected. Before the repair: **30/31
migrations** applied; after: **31/31**, twice.

### 3.2 Defect #2 — reconstructed RPC family was only half fixed (documented, NOT applied)

The same migration #141 fixed only the **read** RPC. The **write** RPC
`submit_guestbook_message_with_rate_limit` still INSERTs the dropped `type` column → it fails at
runtime. Full analysis in §5 (this is risk register **R17**; Lead decision 2026-11-08: document, do not
add a repair migration in Wave 0).

### 3.3 Production reconciliation is mandatory at cutover

Because #141 was reconstructed from production rather than executed, the local baseline is **not
guaranteed to equal production**. At cutover, before migrating, introspect production **read-only** and
diff:

- `pg_dump --schema-only` (or per-schema) vs `contracts/schema/schema.sql`;
- `pg_policies` vs `contracts/schema/policies.md`;
- `pg_get_functiondef` for every `public` function vs `contracts/schema/rpc.md`;
- `supabase_migrations.schema_migrations` versions vs the 31 local versions;
- row counts per table (content-loss check baseline).

The existing read-only helper `scripts/verify-migration-prod.mjs` already inspects the admin-role
functions on a target DB; extend it to all RPCs/policies/tables for the cutover gate. Any divergence is
a cutover blocker to resolve **in the cutover window**, not in Wave 0.

### 3.4 Migration-history observations

- Ordering is lexicographic: `20260624000000` applies **before** `20260915020000`. `seed.sql` runs
  after all migrations.
- Three migrations are superseded iterations of the like button (`20260315000300/…0400/…0500` →
  `…0600` v2) and two of the album organiser (`v1` → `v2`); all old function versions remain in the DB.
  This is backward-compatible but is noise the rebuild should not carry.
- `20260915020000` removes Unsplash placeholder rows, but `seed.sql` runs afterwards and re-adds 12
  Unsplash placeholders — a demo-data inconsistency the rebuild must not inherit.
- The “missing migration” pattern (#141) proves the repo history is incomplete relative to production;
  squashing the schema at cutover (explicitly allowed by the product contract) is the clean exit.

---

## 4. Schema inventory summary

Full detail in `contracts/schema/INVENTORY.md` (tables/columns/constraints), `policies.md`,
`rpc.md`. Headline numbers from the clean reset:

| Area | Result |
|---|---|
| Public tables | **18** (206 columns); 71 indexes |
| RLS | enabled on **16/18**; **35** public policies + **8** `storage.objects` policies |
| Public functions | **21** (20 SECURITY DEFINER + 1 trigger function); 10 called by `src/**` |
| Triggers | 3 application (`activity_log` fan-out) + 4 storage-platform |
| Realtime | publication `supabase_realtime` → `public.activity_log`, `public.rate_limit_logs`; client channel `activity_feed` on `activity_log` INSERT |
| Storage | **1 bucket** after clean reset: `media-review-artifacts` (private, admin-only via `is_admin()`); legacy guest buckets have policies but no bucket rows |
| Auth | email/password via Supabase Auth; single server-set claim `app_metadata.role = 'admin'` read by `public.is_admin()`; `user_metadata.role` no longer trusted (migration 20260623000100); `auth.users` empty after reset (no credentials committed) |
| Rate limits | `rate_limit_logs` + `check_rate_limit`/`increment_rate_limit` (clock-minute windows) + guestbook wrapper (3/min by default) + inline photo-comment limit (5 per session per 10 min); no cleanup scheduler |
| Moderation states | uploads `pending→approved|rejected` + orthogonal `video_visibility`; claims `pending→approved|rejected`; media-review batch/cluster/face statuses; editorial slots with live schedule window; append-only audit log (10 action strings, **no CHECK**) |
| Guest-share tokens | `guest_share_tokens(guest_email UNIQUE, token UNIQUE)`; `/guest/:token` aggregates approved uploads + guestbook notes + verified claimed photos; tokens never expire/revocable only by row delete |

Most important behaviours to preserve in the rebuild (details in INVENTORY §5–§12):

1. **Guest uploads**: public insert (`pending`) → admin approve → public read; approval trigger adds the
   activity item; publishing to gallery copies URLs into `photos` (no FK/link back to the upload).
2. **Photo engagement**: likes/comments are text-keyed on `photos.id::text` (`photo_key`), not FK'd;
   likes are unique per `(photo_key, session_id)`; comments soft-hide with audit fields.
3. **Albums**: exactly four values enforced by CHECK; ordering is an integer per album maintained by
   the organiser RPC (client never writes order directly).
4. **Editorial slots**: one row per slot (unique), public read only when active and inside
   `[starts_at, ends_at]`; every admin edit mirrored to a history table.
5. **Face review**: batch → cluster → face hierarchy with delete-cascade; private storage artifacts;
   all admin-gated.
6. **Activity feed**: trigger-maintained, deduped only by trigger conditions (no unique on
   `(source_type, source_id)`), realtime INSERT subscription.

---

## 5. Known defect — guestbook submit RPC bypasses the server rate limit (risk R17)

**Status: documented, NOT fixed in Wave 0** (Lead decision 2026-11-08). The local baseline must
describe what the frozen repo ships; the rebuild's data layer (Wave 3) and the cutover own the fix.

### 5.1 Exact failing call and error

```sql
select * from public.submit_guestbook_message_with_rate_limit(
  'Fixture Guest', 'fixture@example.com', 'Synthetic message for local baseline', 'text', null, 3, 1);
```

```
ERROR:  column "type" of relation "guestbook_messages" does not exist
LINE 5:     type,
            ^
QUERY:  INSERT INTO guestbook_messages (
    name, email, content, type, media_url, ip_address, reactions
  ) VALUES (
    p_name, p_email, p_content, p_type, p_media_url, v_ip_address, '{}'::jsonb
  )
CONTEXT:  PL/pgSQL function submit_guestbook_message_with_rate_limit(text,text,text,text,text,integer,integer)
          line 34 at SQL statement
```

(The read RPC is healthy: `select count(*) from public.get_guestbook_messages_with_comments();` → 5.)

### 5.2 Root cause and function excerpt

`20260410001200_drop_guestbook_type_and_anniversary.sql` dropped `guestbook_messages.type`; #141
repaired only `get_guestbook_messages_with_comments()`. The write RPC still has:

```sql
INSERT INTO guestbook_messages (name, email, content, type, media_url, ip_address, reactions)
VALUES (p_name, p_email, p_content, p_type, p_media_url, v_ip_address, '{}'::jsonb)
```

Its signature also still advertises the legacy `p_type text DEFAULT 'text'` parameter (harmless to the
current caller, because it has a default and is omitted).

### 5.3 Blast radius

- Client path: `src/pages/guestbook/useGuestbookComposer.ts:96` calls the RPC first. On error it falls
  back at `:126-133` to a direct PostgREST insert (`from('guestbook_messages').insert([...])`), which is
  allowed by the public INSERT policy (`with check = true`). The user-visible flow still works.
- **The fallback bypasses server-side rate limiting and the server-derived client IP**
  (`ip_address` is left null), so `rate_limit_logs` is never consulted/incremented for real
  submissions and `guestbook_messages.rate_limited`/`ip_address` are not populated. Only the
  client-side localStorage limiter (3 per 60 s) remains — trivially bypassed.
- Moderation metadata benefit lost: the RPC is also the only place that stamps `ip_address` for abuse
  follow-up.
- No e2e or unit test catches it: the fallback path masks the failure, and the frozen e2e suite mocks
  the RPC; `scripts/verify_supabase.js` only checks the *read* RPC.
- `fixtures.sql` deliberately never calls this RPC (it inserts guestbook rows directly, as the fallback
  does), so fixtures do not depend on the defect.

### 5.4 Fix sketch — **NOT APPLIED — Wave 3 / cutover only**

```sql
-- NOT APPLIED. Signature changes (drops p_type) => DROP then CREATE.
drop function if exists public.submit_guestbook_message_with_rate_limit(
  text, text, text, text, text, integer, integer);

create function public.submit_guestbook_message_with_rate_limit(
  p_name text,
  p_email text,
  p_content text,
  p_media_url text default null,
  p_max_requests integer default 3,
  p_window_minutes integer default 1
)
returns table (
  success boolean,
  message_id uuid,
  error_message text,
  rate_limit_remaining integer,
  rate_limit_reset_after integer
)
language plpgsql
security definer
set search_path = public          -- hardening: the current function has no pinned search_path
as $$
declare
  v_ip_address text;
  v_rate_check record;
  v_message_id uuid;
begin
  v_ip_address := coalesce(
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'x-real-ip',
    'unknown'
  );
  select * into v_rate_check
  from public.check_rate_limit(v_ip_address, 'guestbook_submit', p_max_requests, p_window_minutes);
  if not v_rate_check.allowed then
    return query select false, null::uuid,
      format('Rate limit exceeded. Please wait %s seconds before submitting another message.',
             v_rate_check.reset_after_seconds), 0, v_rate_check.reset_after_seconds;
    return;
  end if;
  perform public.increment_rate_limit(v_ip_address, 'guestbook_submit', p_window_minutes);
  insert into public.guestbook_messages (name, email, content, media_url, ip_address, reactions)
  values (p_name, p_email, p_content, p_media_url, v_ip_address, '{}'::jsonb)
  returning id into v_message_id;
  return query select true, v_message_id, null::text,
    v_rate_check.remaining, v_rate_check.reset_after_seconds;
end;
$$;

revoke all on function public.submit_guestbook_message_with_rate_limit(text,text,text,text,integer,integer)
  from public, anon;
grant execute on function public.submit_guestbook_message_with_rate_limit(text,text,text,text,integer,integer)
  to anon, authenticated;
```

### 5.5 Cutover verification (read-only) and follow-ups

1. On production (read-only): `select pg_get_functiondef('public.submit_guestbook_message_with_rate_limit'::regproc);`
   → compare with the baseline above; production may have been repaired out-of-band like #141.
2. Exercise the RPC against a scratch local DB with the fix, asserting `success=true`, a
   `rate_limit_logs` row appears, and the 4th call within a minute returns `success=false`.
3. Rebuild the guestbook submit path as a single tested server route; add an e2e assertion that the
   fallback is never taken (spy on console/error paths) and that `rate_limit_logs` increments.
4. Close R17 when the fix lands with regression evidence.

---

## 6. Security & data findings (RLS / authorization surface)

Ordered by severity; full policy text in `contracts/schema/policies.md`, analysis in §3 there.

| # | Finding | Severity | Evidence | Rebuild action |
|---|---|---|---|---|
| S1 | `activity_log` has RLS **disabled**, 0 policies; Supabase default grants anon ALL on public tables → anon can INSERT/UPDATE/DELETE the feed, not just read it | **High** | `pg_class.relrowsecurity = false`, `pg_policy` empty, default privileges `GRANT ALL ON TABLES TO anon` | enable RLS + `for select using (true)` only; keep realtime working |
| S2 | Public SELECT on `guest_identities` (emails) and `guest_share_tokens` (email↔token) lets anon enumerate every guest-share link | **High** | policies `using (true)`; share token is the only secret for `/guest/:token` | replace with SECURITY DEFINER lookup by token; stop exposing `guest_email` |
| S3 | `guest_uploads`: policies `using (auth.role() = 'authenticated')` allow **any** authenticated user to read all pending uploads (names/emails/media) and update any row/column (self-approve) | Medium | `Allow authenticated read all`, `Allow authenticated update` | use `is_admin()`; add column-scoped update or RPC-only transitions |
| S4 | `guestbook_messages` has **no DELETE policy** but the admin UI deletes directly (`GuestbookModeration.tsx:61,97`) | Medium (functional) | `pg_policies`; src call sites | add `delete_guestbook_message_v1` SECURITY DEFINER with `is_admin()`; verify prod policy (possible schema drift) |
| S5 | `photo_likes` has RLS disabled → direct anon writes bypass `toggle_photo_like_v2` | Medium | same check as S1 | enable RLS, no policies, keep RPC |
| S6 | `moderation_audit_log` actor fields are client-supplied (`actor_email/name`), so any authenticated admin can forge another actor | Low-Medium | `src/lib/supabase/moderation.ts:18-33` | insert via RPC deriving actor from JWT |
| S7 | `anon` retains EXECUTE on admin-gated RPCs (`save_album_organization_*`, `delete_gallery_photos_v1`, `hide/delete_photo_comment_v1`, `get_recent_photo_comments_v1`); bodies enforce `is_admin()`, so safe today but wrong by construction; rate-limit functions are SECURITY DEFINER **without pinned search_path**; audit `action` has no CHECK | Low-Medium | `pg_proc.proacl`, `pg_get_functiondef` | revoke anon, pin `search_path`, constrain audit actions |

Also worth flagging (not RLS): the activity trigger has no idempotency key, so re-approving an upload
creates a second feed item; `photo_comments.photo_key` is a text key without FK to `photos`; and
`guestbook_messages` has no uniqueness on content (the migration/seed demo data even duplicates two
notes). These are shape decisions the rebuild should make deliberately.

No live secret or PII exposure was found in the repo's committed media/contract artifacts; the
service-role key is correctly absent from browser-facing files (`docs/archival/SECURITY.md`).

---

## 7. Drift summary — `src/**` vs the local DB

Full table-by-table map with `file:line` evidence: `contracts/schema/INVENTORY.md` §13.
Method: `rg "\.from\('…'\)"`, `rg "\.rpc\("`, `rg "storage\.from\('…'\)"` over `src/**`, compared with
the clean-reset catalog.

**Tables (22 distinct names referenced):** 17 are DEFINED and used; 1 is DEFINED/INDIRECT
(`photo_likes`, `rate_limit_logs` — only via RPCs); 4 are **MISSING**:

| Missing table | Referenced by | Classification |
|---|---|---|
| `wedding_gallery` | `src/services/galleryService.ts:53,98,184,210,244,271` | dead module (nothing imports it) |
| `gallery_categories` | `src/services/galleryService.ts:127` (+ embedded relation `:57`) | dead module |
| `error_logs` | `src/utils/logger.ts:83` | dormant path (`logger.error` only called from the dead gallery module; `logger.warn` is console-only) |
| `audit_logs` | `src/utils/security.ts:106` | dead module (`utils/security.ts` is never imported) |

**RPCs (10 referenced in src):** all DEFINED except **`submit_guestbook_message_with_rate_limit` =
DEFINED-BROKEN** (§5). Note the read RPC `get_guestbook_messages_with_comments` is defined and healthy
but not called by current src (used by legacy scripts, the e2e mock and the content extractor); the
like v1 and organiser v1 RPCs remain defined but unused.

**Storage buckets (2 referenced in src):** `media-review-artifacts` DEFINED (private); `wedding-gallery`
**MISSING** (dead module only).

**Defined but unused by src:** 10 functions (rate-limit helpers, superseded v1s, service-role admin
tooling, read RPC, trigger fn), `rate_limit_logs`/`photo_likes` indirectly. All explained in
INVENTORY §13.5 — none is a missing feature.

**Conclusion:** zero live screens depend on a missing object. The four missing tables + one missing
bucket belong to dead legacy modules that must be deleted in the rebuild, not ported. The only
functional drift that matters is the broken guestbook submit RPC (R17).

---

## 8. Media contract summary (details: `contracts/media/CONTRACT.md`)

- **Roles:** Cloudflare **R2** bucket `wedding-media` is the origin for all offloaded media; Cloudflare
  **Worker** `media-rewrite` on `media.wedding.theporadas.com` is the CDN/edge (path rewrite, CORS,
  Range/206, immutable cache); **Netlify** serves the SPA + `public/images/**` and hosts the R2 presign
  function; **Supabase Storage** holds only private `media-review-artifacts` (+ legacy guest buckets
  whose rows are absent).
- **Offload rule** (`src/utils/media.ts`): only `/video/`, `/background_audio/`, `/media/` are
  offloaded when `VITE_MEDIA_BASE_URL` is set; `/images/` stays local; DEV uses `/__media_proxy`; path
  segments (e.g. the literal `+` in `Bach+ette`) are never sanitised; absolute URLs pass through.
- **Path patterns:** `/video/**` → `video/**`; `/background_audio/**` → `background_audio/**`;
  `/media/_thumbs/<Album>/Photos/*.webp` → mapped `media/...jpg|.webp`; `/media/**` → `media/**`;
  guest uploads → `guest-uploads/{photos,videos}/<uuid>.<ext>` via 5-minute presigned PUT (MIME
  allowlist, 500 MB cap).
- **Headers:** Worker sends `Cache-Control: public, max-age=31536000, immutable`, `Accept-Ranges:
  bytes`, `ETag`, echo-origin CORS (`Vary: Origin`, allowed-origin list, methods GET/HEAD/OPTIONS,
  exposed `Accept-Ranges/Content-Length/Content-Range/Content-Type/ETag`); `public/_headers` CSP
  must keep `https://media.wedding.theporadas.com` + `https://*.r2.dev` in `connect-src`; PWA caches
  `/media/_thumbs/**` (500 entries/30 d) and `/media/**` (300/30 d) CacheFirst with **status 200 only**.
- **Counts/sizes (measured):** `public/` = **624 files / 3,794,242,006 B**; `public/images` 542 files /
  146,067,823 B (~139 MiB, git-tracked); `public/video` 14 files / 3,104,823,136 B (gitignored);
  `public/background_audio` 22 / 527,649,160 B (~503 MiB, gitignored); `public/media` 22 / 15,477,829 B
  (gitignored); captions 1 / 53 B; icons 12 / 197,473 B; root 11 / 26,532 B. Task reference figures
  (3.6 GB / 139 MB / 2.96 GB / 503 MB) agree within GB-vs-GiB rounding; measured values are
  authoritative.
- **No-media-loss invariant:** every URL in `MEDIA_MANIFEST.json` + every DB URL column
  (`photos.url/thumbnail/download_url`, `guest_uploads.photo_urls/video_urls`,
  `guestbook_messages.media_url`, editorial `source_url`, review artifact paths) must still resolve
  after cutover; originals must still return original bytes; captions keep `text/vtt`+CORS; R2 object
  population preserved (ETag/checksum manifest). Proof plan (read-only HEAD sweep + object listing with
  an owner-provided key) is in the media contract §7.
- **Known gaps:** R2 object population not enumerable in Wave 0 (no production credential, writes
  forbidden); `media-review-artifacts` objects require service role; SW cache population is device-local.

---

## 9. Cutover window — backup / restore / migration notes

The cutover window is already owner-approved; Wave 0 performed **no** production or DNS/Netlify/R2
change. Suggested runbook (all commands on the operator's workstation with credentials injected from a
secret manager, never committed):

### 9.1 Preconditions (T-1 day)

1. Freeze writes: put the site in maintenance mode / pause guest uploads + guestbook (the legacy app has
   no maintenance flag — block the Netlify function + revoke anon INSERT policies, or accept a short
   read-only window).
2. Confirm the legacy deploy commit equals `legacy-freeze-2026-11-08` (A6/A7 check) and record the R2
   object listing + per-object `ETag`/`Content-Length` (read-only) as the media baseline.
3. Record production row counts and per-table checksums (e.g. `md5(string_agg(t::text, '' order by
   id))`) for the content-loss comparison, and a full `pg_dump` (schema + data) with a checksum.

### 9.2 Backup (T-0, before any write)

```bash
# Full logical backup (schema + data), then verify it restores into a scratch DB.
pg_dump "$PROD_DB_URL" --format=custom --no-owner --no-privileges --file=prod-pre-cutover.dump
pg_restore --list prod-pre-cutover.dump | head            # sanity
# Storage: objects are content-addressed by key; copy the R2 listing to a signed manifest.
# Supabase Storage artifacts: `supabase storage cp -r ss:///media-review-artifacts ./backup/` (service key, operator only).
```

Keep the dump + manifest off-repo (encrypted), and keep the legacy Netlify deploy + R2 bucket
**read-only** for one full checkpoint window as the rollback.

### 9.3 Schema migration strategy (choose in Wave 3)

- The rebuild may **squash** the 31-migration history into a clean baseline (explicitly allowed by the
  product contract) instead of replaying the defect-laden history. Recommended:
  1. apply the squashed schema to a scratch DB, then restore the production data into it
     (`pg_restore --data-only` after schema load, or COPY per table in FK order);
  2. reconcile RLS/policies against `contracts/schema/policies.md` + §6 fixes;
  3. re-run the fixtures against it to prove every screen renders.
- If replaying history instead, all 31 migrations must apply (they do, after the #141 repair) and the
  production `schema_migrations` must be reconciled (`supabase migration repair` equivalents for
  out-of-band migrations).
- Fix list to include in the cutover migration: broken guestbook submit RPC (§5), RLS gaps S1–S5,
  anon EXECUTE revokes S7, `check` constraint for audit actions, `search_path` pinning, DELETE RPC for
  guestbook moderation.
- Data transforms: `guestbook_messages.type` (already dropped), `photos.download_url` (must be
  populated for original downloads), `guest_uploads` fingerprints, `app_metadata.role` admins (verify
  promotion survived), `activity_log` can be rebuilt from triggers if desired (it is derived data).

### 9.4 Verification after migration (read-only)

```sql
select count(*) from public.photos;                 -- vs pre-cutover count
select count(*) from public.guestbook_messages;     -- vs pre-cutover
select count(*) from public.guest_uploads where status='approved';
select count(*) from public.guest_share_tokens;
select relname, relrowsecurity from pg_class
  join pg_namespace n on n.oid=relnamespace
 where n.nspname='public' and relkind='r' order by 1;   -- 16/18 true (or 18/18 after fixes)
select proname, prosecdef from pg_proc
  join pg_namespace n on n.oid=pronamespace
 where n.nspname='public' order by 1;                    -- compare with rpc.md
```

Then: media HEAD sweep (`2xx` for every manifest URL, original bytes for `download_url`), auth admin
smoke (`is_admin()` true for the owner), public smoke (`/`, `/film`, `/gallery`, `/guestbook`, `/guest/:token`),
and the rebuild's parity gate.

### 9.5 Rollback

- Before DNS/Netlify switch: redeploy the frozen commit (identical to the parity oracle) and keep
  production DB untouched until the new app has been verified against a restored copy.
- After switch: restore `prod-pre-cutover.dump` into a fresh DB, repoint the old app's env, restore
  the previous Netlify deploy (it is immutable), and re-enable writes. R2 was never mutated, so media
  rollback is a no-op.
- Because the exercise is read-only until 9.3/9.4 succeed, the expected rollback path is "do not
  switch" rather than "restore production".

### 9.6 Restore drill (recommended before the window)

Restore the pre-cutover dump into a scratch Supabase project/database, run §9.4 queries + the media
manifest check, and record wall-clock time (RTO) and any extension/permission gaps. Do this at least
once with the exact operator who will run the cutover.

---

## 10. What is done, what is not, assumptions

**Done (evidence above):** 31/31 migrations reproducible ×2 with identical SHA-256; full schema,
policies, RPC, trigger, realtime, storage, auth and rate-limit inventory; drift report with every
`src/**` table/RPC/bucket reference classified; synthetic fixtures that apply idempotently and cover
every screen's data needs; media origin/CDN contract with measured counts and the no-media-loss
invariant; security findings S1–S7 and the R17 guestbook defect documented with fix sketches; cutover
backup/restore/migration notes.

**Not done / out of scope for Wave 0:**

- No production read (no credentials used); production schema/RLS/RPC diff is a **cutover blocker to be
  executed read-only** (§3.3).
- R2 bucket object population not enumerated (needs an owner-provided read-only credential; media
  counts here are the local `public/` tree).
- No repaired migration for the guestbook submit RPC (deliberate, Lead decision; §5).
- `auth.users` not seeded; admin-screen rendering requires a locally promoted user (INVENTORY §9).
- Worker/CDN deployment config (wrangler) was documented, not changed or deployed.
- Legacy `supabase/schema.sql` (170 lines / 4 tables) was deliberately ignored; it is stale and should
  be deleted/regenerated by the rebuild.

**Assumptions:**

1. The clean-reset local schema is the best available proxy for production; the #141 incident shows
   production may differ, so cutover must diff (stated, not verified).
2. `public/` metadata counts on this checkout are representative; no bytes were copied.
3. The rebuild (greenfield) reads `contracts/**` only, so the legacy dead modules and missing tables
   are not part of the target product.
4. The guestbook fallback path keeps the product usable today, which is why R17 is a security/abuse
   finding rather than a user-visible outage.
5. Risk register R17 (Lead-owned) tracks the guestbook RPC defect; this audit is its evidence base.

---

## 11. Evidence appendix (excerpts)

```
# reset #2 (tail)
Applying migration 20260624000000_fix_guestbook_rpc_drop_type.sql...
Applying migration 20260915020000_remove_unsplash_placeholder_photos.sql...
Seeding data from supabase/seed.sql...
Restarting containers...
Finished supabase db reset on branch rebuild/greenfield.

# dump hashes (gitignored evidence files)
A162C56BD506D8AB0391D93584350089829EF6932584FBD315B70843C211F267  reset1-public.sql / reset2-public.sql
7968E45710A637F3003038A175603664E7F752ABA782D72D497983A4C4E72E82  reset1-storage.sql / reset2-storage.sql

# migration history
select count(*) from supabase_migrations.schema_migrations;  -- 31

# tables / RLS
activity_log|f|f|0|3                 <- RLS disabled (S1)
photo_likes|t? -> relrowsecurity = false (S5)
16/18 public tables have RLS enabled; 35 public policies; 8 storage.objects policies

# runtime probes
select * from public.submit_guestbook_message_with_rate_limit(...);  -> ERROR column "type" ... (R17)
select count(*) from public.get_guestbook_messages_with_comments();  -> 5
select * from public.toggle_photo_like_v2('baseline-probe','probe-session'); -> 1|t, then 0|f
select public.is_admin();  -> f (no JWT)

# fixtures.sql (applied twice; identical counts)
apply1: COMMIT ; apply2: COMMIT
photos 24 | guestbook_messages 8 | guest_uploads 4 | photo_claims 3 | editorial 4 | activity_log 11 | ...

# drift (classification)
MISSING tables: wedding_gallery, gallery_categories, error_logs, audit_logs  (all dead modules)
MISSING bucket: wedding-gallery (dead module)
DEFINED-BROKEN RPC: submit_guestbook_message_with_rate_limit (R17)
```

Reproduction of every number above: `contracts/schema/INVENTORY.md` §1.2–§1.3 (sandbox recipe +
commands) and the raw files in `tmp/evidence/` on this machine.
