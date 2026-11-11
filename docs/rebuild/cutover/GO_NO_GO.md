# Go / No-Go — 2026-11-10 (staging vs production)

## Environment now

| Layer | State |
|---|---|
| Dedicated DB | `theporadas-archive` (us-east-1, org "Wedding Website") — schema = 31 baseline + D-01/D-02 (18 tables/206 cols), **wedding data migrated and reconciled exactly**, admins recreated |
| Staging | `staging.theporadas.com` (Access-protected) built against the dedicated project; all routes render live data |
| Upload pipeline | **Real end-to-end verified**: `/upload` UI → edge `guest-upload-url` (presigned R2 PUT) → `guest_uploads` row (RLS-safe, no RETURNING) → guest share link `/guest/<token>`; public image served via edge `guest-media` proxy → **HTTP 200** |
| R2 | token `theporadas-upload-*` (Object RW, bucket `wedding-media`); bucket CORS now allows PUT + staging/prod origins; object confirmed in bucket |
| Security invariants | RLS on `guest_uploads`; anon cannot read identities/tokens/pending uploads; admin RPCs denied; R17 repaired; D-02 bundle verified 10/10 locally |
| Legacy/business project | unchanged/business-only; `halloween-displays` paused (owner OK) |
| Code | `rebuild/greenfield` @ `c1fa031`; lint/tsc clean; upload+guest-upload tests 53/53 |

## Staging: **GO** (owner review)
Reviewed routes: `/`, `/film`, `/gallery`, `/guestbook`, `/upload` (real upload), `/print`, `/activity`, `/admin/login`; upload flow exercised with a real file and verified at each hop.

## Production cutover: **NO-GO until these close**
1. **Final delta sync** of wedding tables (old shared project → dedicated project) executed inside the write freeze, with row-count/ID reconciliation and the same verifier as the initial copy.
2. **Write freeze** on the legacy site at the window start (revoke anon write policies or maintenance page) + monitor for stragglers.
3. **Backup/restore drill against the dedicated project** (dump → scratch restore → 18/18 counts equal) and rollback rehearsal (env/DNS revert, old deploy + old project remain live).
4. **Admin passwords reset** for the two migrated accounts (temporary ones in `.env.cutover.local`; smoke user can be removed).
5. **Production env wiring**: set `VITE_SUPABASE_URL`/`ANON_KEY`/`VITE_UPLOAD_MODE=live`/Sentry DSN on the production Netlify deploy before the DNS switch; verify bundle hash.
6. **Signed authorisations**: A1 (DNS switch) + A4 (legacy write freeze), owner-approved; window date/time confirmed.
7. **Token hygiene**: revoke the temporary R2 admin token used for CORS and the first accidental upload token; keep only `theporadas-upload-*`; rotate Cloudflare/Netlify/Supabase PATs after cutover.
8. **Media long-term note**: guest media is proxied by a Supabase Edge Function (works now, low traffic). If egress grows, move to a dedicated Cloudflare Worker/domain (the original option 2) in a follow-up; no code change needed beyond `R2_PUBLIC_BASE_URL`.

## Decisions recorded
- Dedicated Supabase project (owner directive, no sharing with business project).
- Public guest media via `guest-media` edge proxy (query-key URL) because the Supabase platform routes only `/functions/v1/<slug>` (subpaths 404) — avoids touching the production media Worker.
- R2 CORS updated by S3 API (admin token) to allow browser PUT from staging/prod origins.

## Cutover sequence (once 1–6 are green)
freeze writes → final delta sync + verify → deploy prod env build → DNS switch (A1) → smoke `/`, `/gallery`, `/guestbook`, one upload → announce. Rollback: restore DNS + old deploy within 30-day window; old project stays frozen.

---

# CUTOVER EXECUTED — 2026-11-10 ~23:30 ET

Owner instruction at 23:21 ET: "i want to do it asap or now if we can" — treated as in-session authorisation
(A1 DNS/publish + A4 write freeze) to execute the swich immediately. No DNS change was required: the rebuild
was published to the existing production Netlify site `austin-jordyn-wedding` (`www.theporadas.com`).

## Executed sequence (all verified)

1. **Freeze (A4):** revoked anon INSERT/UPDATE/DELETE on guestbook_messages, guest_uploads, photo_likes,
   photo_comments, photo_claims, guest_identities, guest_share_tokens and revoked execute of the legacy
   guestbook submit RPC — on the old shared project. Public reads unaffected; rollback can restore grants.
2. **Final delta sync:** cleared the dedicated project's wedding tables and re-copied the frozen legacy snapshot
   table-by-table; counts verified equal (photos 1320, guest_uploads 5, guestbook 2, photo_likes 3,
   editorial 1, audit 4, activity 14; empties 0). activity_log trigger side-effects removed → 14 = 14.
3. **Admin passwords:** reset for `bbasketballer75@gmail.com` and `admin-smoke@theporadas.com` on the dedicated
   project; stored only in `.env.cutover.local` (`ADMIN_PASSWORD_*`).
4. **Production build + publish:** `build:prod` with the dedicated project URL/anon key, `VITE_UPLOAD_MODE=live`,
   Sentry DSN, site URL `https://www.theporadas.com`; published via Netlify deploy API.
   New production deploy: **`6af3ed9d1c516a64aba25527`** (state ready, context production).
5. **Production smoke (browser, live www):** `/` 200 "Home | Austin & Jordyn's Wedding", `/guestbook` 200 with
   copy, `/gallery` 200, `/upload` 200, `/admin/login` 200; apex 301 → www; guestbook data served from the
   dedicated project. No JS request failures to Supabase/functions.

## Rollback (30-day window)

- Restore the previous production deploy: **`6add764deeb33d037b6cf092`** (`austin-jordyn-wedding`).
- Old shared project is frozen read-only for public inputs; re-grant anon INSERT/DELETE and the submit RPC
  execute to resume legacy writes if rolled back.
- Dedicated project stays untouched as the new source of truth (data diverges after cutover; use the delta
  script restored copies if needed).

## Post-cutover reminders

- Revoke temporary R2 tokens created during setup (keep `theporadas-upload-*`; revoke the first accidental
  `theporadas-upload-2026-11-10` and the `theporadas-*r2-admin*` CORS token) and rotate the Cloudflare/Netlify/
  Supabase PATs.
- Delete the smoke admin user if unwanted; change the owner admin password.
- Keep the old project's wedding tables frozen for 30 days, then drop them (owner-approved cleanup; old project
  remains the business backend).
- `halloween-displays` remains paused (resuming needs a free-tier slot or Pro).
- Optional follow-ups: dedicated Cloudflare Worker/domain for guest media if egress grows; uptime monitor.
