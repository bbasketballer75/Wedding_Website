# `src/shared/data` — typed Supabase data layer (Wave 3)

The rebuild's only bridge to Supabase. Replaces the legacy `src/lib/supabase.ts` barrel. Nothing in
here imports the frozen legacy app; the frozen query surface was re-implemented against
`contracts/schema/database.types.ts` and `contracts/schema/INVENTORY.md`/`rpc.md`.

## Modules

| Module              | Owns                                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `database.types.ts` | GENERATED copy of `contracts/schema/database.types.ts` (never edit; see sync below)                                                          |
| `schema.ts`         | derived helpers over `Database`: `TableRow`, `TableInsert`, `TableUpdate`, `RpcReturns`, `RpcRow`, JSON readers                              |
| `client.ts`         | the single typed client (`createClient<Database>`), frozen auth/realtime options, lazy env boundary via `@/app/env#readEnv`                  |
| `errors.ts`         | one `DataError` shape + `toDataError`/`unwrapResult` normalization (raw PostgREST errors never reach UI)                                     |
| `media.ts`          | frozen media URL semantics (`getMediaPath`/`getAbsoluteUrl`/`getAbsoluteMediaUrl`) as a pure factory                                         |
| `auth.ts`           | session bootstrap, `isAdminUser`, sign-in/out/refresh, `subscribeToAuthChanges`, `useAuth`                                                   |
| `photos.ts`         | paged gallery reads, by-album/by-url/with-faces/top reads, engagement RPCs, comments, album organiser RPCs                                   |
| `guestbook.ts`      | feed with replies, print read, submit RPC + documented fallback, reactions, replies, admin delete                                            |
| `guestUploads.ts`   | approved/pending/by-status reads, status-by-email, film highlights, publish-to-album, moderation transitions                                 |
| `editorial.ts`      | four slots, live-window filter, history, upsert                                                                                              |
| `claims.ts`         | claim queues, identity find-or-create, claim submit/approve/reject, share tokens, `/guest/:token` aggregation                                |
| `activity.ts`       | feed reads + realtime INSERT subscription (`activity_feed`)                                                                                  |
| `moderation.ts`     | audit log record/timeline + admin dashboard counters                                                                                         |
| `mediaReview.ts`    | batches/clusters/faces/tagging batches, known-people autocomplete, signed artifact URLs                                                      |
| `queryKeys.ts`      | every TanStack Query key + `invalidationGroups`                                                                                              |
| `hooks.ts`          | read hooks for Waves 4–6 (home, gallery, film, guest photos, guest share, activity, admin reads)                                             |
| `test-support/`     | TEST-ONLY helpers (mock client, fixture loader, query wrapper). Never imported by app code, so they are excluded from the production bundle. |

## Generated types — keep in sync

`database.types.ts` is a generated copy; `sync-schema-types.mjs` owns it:

```bash
cd rebuild
node scripts/sync-schema-types.mjs          # regenerate the copy
node scripts/sync-schema-types.mjs --check  # CI gate: exit 1 when out of date
```

The script adds the generated-file header, formats with the app's Prettier config, sanity-checks the
baseline (`export type Database` must exist) and never edits the contracts artifact. The Lead wires
`npm run sync:types` / `npm run check:types` in W3-3 (`package.json` is outside this wave's scope).
Never hand-edit `database.types.ts`; the check runs in CI.

## Required environment

Only public browser values (no service-role key — enforced by convention and reviewed in every wave):

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — required; read through `@/app/env#readEnv` on first
  client use (fail fast, readable error).
- `VITE_SITE_URL` — canonical origin for `getAbsoluteUrl` (defaults to production in `env.ts`).
- `VITE_MEDIA_BASE_URL` — optional offline/CDN switch; only `/video/`, `/background_audio/` and
  `/media/` are offloaded.

## Local Supabase contract test (optional, never CI)

The RLS/RPC contract test hits a **local** Supabase sandbox only and skips cleanly when the sandbox
env is absent, so `npm run test:run` stays fully mocked/offline:

```bash
# 1. sandbox up (Wave 0 recipe: docs/rebuild/audit/A3-data.md §1 / contracts/schema/INVENTORY.md §1)
cd .. && npx supabase --workdir tmp/supabase-sandbox start && cd rebuild

# 2. point the test at the sandbox REST API + anon key (values printed by `supabase status -o env`)
export VITE_SUPABASE_URL=http://127.0.0.1:55321
export VITE_SUPABASE_ANON_KEY=<ANON_KEY from status>
export SUPABASE_CONTRACT_TEST=1

# 3. run only the contract file
npx vitest run src/shared/data/contract.test.ts
```

Fixture/unit tests never touch the network: they inject a mock `TypedSupabaseClient` built from
`contracts/fixtures/*` shapes.

## Known constraints handed to later waves

1. **`exactOptionalPropertyTypes` is still off** in `rebuild/tsconfig.json` (outside this wave's write
   scope). The data layer is written to be compatible (optional fields are conditionally spread), so
   the Lead can flip it in W3-3 without touching these modules.
2. Generated `Relationships: []` means nested PostgREST embeds are not inferred by supabase-js, so
   nested payloads are parsed defensively into view models (`parsePhotoClaim`, `parseGuestbookMessage`,
   `resolveGuestContributions`). If the contracts baseline later regenerates with relationship
   metadata, the parsers can be tightened.
3. **R17** (guestbook submit RPC broken in the baseline): `submitGuestbookMessage` keeps the frozen
   RPC-then-direct-insert behaviour and reports `viaFallback: true`. Repair belongs to Wave 3/cutover
   (`contracts/schema/rpc.md` §3).
4. **Baseline RLS gaps** (A3 §6) are not fixed here: `activity_log`/`photo_likes` have RLS off, public
   read on `guest_share_tokens` makes tokens enumerable, and guestbook DELETE is denied by policy while
   the admin UI deletes directly. The rebuild's cutover migration owns the fixes; the data layer is
   written so the corrected policy set needs no client change (all writes go through the same calls).
