# Phase-0 production reconciliation + staging findings (2026-11-10)

Method: Supabase Management API (`POST /v1/projects/<ref>/database/query`, `read_only: true`) against the
production project **`wedding_website_v3` / `zaczcyzvavetgfuucljf`**; schema baseline = the frozen migration
chain restored from the local drill dump. Artifacts: `tmp/staging/phase0-prod.json`,
`phase0-diff2.json`, `phase0-detail.json`. No production writes were made.

## 1. Production facts

| Item | Production | Frozen baseline | Status |
|---|---|---|---|
| Recorded migrations | 31 | 31 | matches |
| Tables | 24 | 18 | **6 extra tables** |
| Columns | 265 | 206 | +59 (all belong to the 6 extra tables) |
| Policies | 40 | 35 | net +5 (drift, see §2) |
| Functions | 22 | 21 | +1 (`update_updated_at()`, used by extra tables) |
| R17 guestbook submit RPC | **broken** (INSERT still references dropped `type`) | broken | repair required |
| photos rows | 1,320 | seed | data |
| guest_uploads / guestbook | 5 / 2 | seed | data |
| claims / identities / share tokens | 0 | — | none yet |

## 2. Findings that change the cutover plan

### F1 — Production Supabase project is co-tenanted with a print-shop app (High, owner decision)
Six extra tables — `customers`, `orders`, `order_files`, `order_proofs`, `order_activity`, `vendors` — plus
`update_updated_at()` live in the same project/database as the wedding app. All six currently have **0 rows**,
RLS enabled and a permissive `Allow all` policy, and **anon has no table grants** (so they are not publicly
readable today). They are outside the wedding cutover scope but must not be ignored:
- decide: leave them, move the wedding app to a dedicated project, or drop them after owner confirmation;
- the cutover migrations never touch these tables;
- the audit/rollback documentation should name them as co-tenant objects.

### F2 — Wedding RLS drift vs the frozen chain (High, migration updated)
Production differs from the frozen baseline: `guest_uploads` has **RLS disabled** while still carrying
policies (and a `moderation_admin_all` policy from an out-of-band change), and `photos` has RLS disabled with
different policy names. Consequences:
- enabling RLS on `guest_uploads` (needed for S3) **breaks the upload INSERT with `returning`** because
  RETURNING requires a SELECT policy the anon uploader does not have;
- the public insert / approved-read policies had been renamed/dropped in production.

The D-02 migration was updated accordingly:
1. `alter table public.guest_uploads enable row level security;`
2. explicit idempotent `Public insert guest uploads` (INSERT, anon+authenticated, `with check (true)`)
   and `Public read approved guest uploads` (SELECT, `using status='approved'`).

**Remaining app-side requirement (blocker for `/upload`):** the public upload data path must insert without
`Prefer: return=representation` (generate the row id client-side or return the id via a SECURITY DEFINER RPC),
otherwise PostgREST's RETURNING trips the SELECT policy after RLS is enabled.

### F3 — `/upload` is still a stub in the rebuild (High)
`rebuild/src/features/upload/UploadPage.tsx` falls back to `createStubUploadApi()` — it simulates R2
presign/upload and the `guest_uploads` insert (and thus the share-token RPC). The static form matches parity,
but a real submission would not persist anything. Wiring the real R2 presign + insert path (and making it
RETURNING-safe per F2) is required before launch.

### F4 — R17 is broken in production too (Medium, repair already shipped)
`pg_get_functiondef` shows the production submit RPC still inserts the dropped `type` column (the earlier
regex "repaired" verdict was a POSIX-`\b` false negative). The D-01 forward migration repairs it; local
post-cutover contract suite is green.

### F5 — Staging environment (built and protected)
- Netlify site `theporadas-staging` → **https://staging.theporadas.com** (custom domain + TLS).
- Cloudflare Access app "The Poradas Staging": destination `staging.theporadas.com`, Allow policy for
  `bbasketballer75@gmail.com` (one-time PIN); production `www` verified unaffected.
- Staging database: local Supabase (D-01/D-02 applied, 10/10 applier invariants) exposed at
  **https://staging-db.theporadas.com** through a dedicated named Cloudflare tunnel; CORS verified.
- Deployed bundle baked with `VITE_SUPABASE_URL=https://staging-db.theporadas.com`; home/guestbook verified
  rendering live local data before protection was enabled.

## 3. Phase-0 checklist status

| Item | Status |
|---|---|
| Migration count/history | ✅ 31, matches frozen chain |
| Schema object diff | ⚠️ 6 co-tenant tables (+59 columns) — owner decision |
| Policy diff | ⚠️ wedding drift documented; migration updated (guest_uploads) |
| R17 function | ❌ broken in prod → cutover migration repairs |
| Row counts | ✅ captured (photos 1320, uploads 5, messages 2, claims 0) |
| R2 inventory | ⏳ needs an R2 S3 access key (object listing) |
| Backup + restore drill on real dump | ⏳ window item (local drill passed) |
| Rollback rehearsal on staging | ⏳ pending |

## 4. Immediate next actions

1. Fix the upload stub + RETURNING-safe insert (F2/F3) and re-test `/upload` on staging.
2. Add the Access service token (or use the owner's session) for automated staging QA of all routes.
3. Decide F1 (co-tenant tables) and F2 photos RLS treatment; record in the cutover decisions.
4. R2 S3 key → inventory; real backup/restore drill.
5. Window + A1–A8 authorisation.
