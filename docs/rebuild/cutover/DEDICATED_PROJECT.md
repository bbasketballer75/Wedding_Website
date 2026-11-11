# Dedicated Supabase project — migration record (2026-11-10)

Owner decision: the wedding archive must **not** share the business Supabase project. The shared project
(`wedding_website_v3` / `zaczcyzvavetgfuucljf`) had picked up a dormant print-shop schema (customers/orders/
vendors…) and out-of-band RLS drift; the wedding app moves to a dedicated project.

## New project

| Field | Value |
|---|---|
| Name | `theporadas-archive` |
| Ref | `faurvrckvatfcswsyobc` |
| Organization | "Wedding Website" (`ptpkzbyfczrwpluqkfbu`) |
| Region | `us-east-1` |
| Plan | Free |
| API URL | `https://faurvrckvatfcswsyobc.supabase.co` |
| Created | 2026-11-10 |

Keys and DB password are stored in the gitignored `.env.cutover.local` only.

## What was done (all verified)

1. **Paused `halloween-displays`** (owner-approved) to free the free-tier active-project slot; its data is
   retained, project resumable later (needs a slot again or Pro).
2. **Created** `theporadas-archive` in the previously empty "Wedding Website" organization.
3. **Applied the full schema**: all **31 frozen baseline migrations**, then the two owner-approved cutover
   migrations (D-01 R17 repair + D-02 RLS bundle) via the Management API. Result: **18 tables / 206 columns**,
   5 cutover RPCs present, R17 repaired.
4. **Security invariants verified on the new project**: `guest_uploads` RLS on; anon cannot read
   `guest_identities`/`guest_share_tokens`; anon cannot insert activity/guestbook rows; guest RPCs work;
   admin RPCs rejected for anon.
5. **Data migration** from the old shared project (read-only on the old side), table-by-table, FK-safe, then a
   **reconciliation pass** removing the demo/seed rows that the frozen migrations insert:
   photos 1320, guest_uploads 5, guestbook 2, photo_likes 3, editorial features 1, audit 4, activity 14,
   claims/identities/tokens/comments 0 — **new == old for every wedding table**.
6. **Auth admins** migrated to the new project: `bbasketballer75@gmail.com` and
   `admin-smoke@theporadas.com`, both with `app_metadata.role = admin`, temporary passwords in
   `.env.cutover.local` (owner must reset via Supabase dashboard before/at cutover).
7. **Staging repointed and redeployed**: the staging bundle was rebuilt with
   `VITE_SUPABASE_URL=https://faurvrckvatfcswsyobc.supabase.co` + the new anon key and deployed to
   `theporadas-staging`; all routes render and read live data from the dedicated project (verified on the
   deploy URL: /, /guestbook, /gallery, /film, /upload, /print, /activity, /admin/login).

The local Docker Supabase + `staging-db.theporadas.com` tunnel remains available as an offline mirror/dev
sandbox but is **no longer the staging database** — staging now uses the dedicated cloud project.

## Revised cutover shape (simpler than the in-place plan)

Old plan: migrate the shared project in place, RLS bundle in the window. New plan:

1. **Window**: freeze writes on the legacy site (old shared project), then take a **final delta snapshot** of
   the wedding tables from the old project and re-apply to the new project (idempotent upsert by id + delete
   of rows removed since the initial copy).
2. Switch the rebuild's Netlify production env to the new project keys and DNS to the new deploy.
3. **No DDL runs on the business project.** Its wedding tables stay frozen (read-only) for the 30-day rollback
   window, then are dropped as owner-approved cleanup (old project remains the print-shop/business backend).
4. Old Netlify deploy + old project remain untouched for rollback; legacy admin auth continues to work there.

## Open items

- Owner: decide when/whether to **resume `halloween-displays`** (needs a free-tier slot or Pro; the wedding
  project is now the second active one).
- Owner: reset the migrated admin passwords (Supabase dashboard → Authentication → Users) and remove the
  smoke-test user if unwanted.
- `/upload` still needs the real R2 presign + RETURNING-safe insert wiring (tracked blocker).
- At cutover: final delta sync script + verification, then DNS switch (A1) and old-project write freeze (A4).

## Evidence artifacts

- `tmp/staging/phase0-prod.json`, `phase0-detail.json`, `phase0-diff2.json` (phase-0 snapshots, local-only).
- Data copy/reconcile scripts under `tmp/` (local-only; documented above).
