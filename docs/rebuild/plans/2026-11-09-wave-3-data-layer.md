# Wave 3 Plan — Typed data layer, auth, media paths

> Status: in progress. Owner: Lead. Branch: `rebuild/greenfield`. Predecessor: Wave 2.
> Runs in parallel with Wave 2 (disjoint scopes: `shared/data/**` vs `shared/ui/**`).

## Goal

Replace the legacy `src/lib/supabase.ts` barrel with one typed, testable data layer inside the new
app, built against `contracts/schema/database.types.ts` and the frozen app's actual query surface
(recorded in A4 §3 and contracts/features.json). No new UI in this wave.

## Exit criteria

1. `rebuild/src/shared/data/` owns: the single Supabase client (typed with `Database`), a generated
   types copy synced from `contracts/schema/database.types.ts` by a documented script, domain
   modules (photos, photo engagement, guestbook, guest uploads, editorial, claims, activity,
   moderation), media URL helpers (`getMediaPath` equivalent), error normalization, and query keys.
2. TanStack Query hooks exist for the read paths the content pages need (home editorial/photos/
   guestbook, gallery photos + engagement, film guest uploads, guest photos) with typed results.
3. Auth: session bootstrap + admin role from `app_metadata.role`, mirroring legacy
   `authStore`/`AuthProvider` semantics (no UI).
4. Tests: unit tests with contract fixtures (`contracts/fixtures/*`) for parsing/mapping; a local
   Supabase contract test (bypassing RLS only for setup) is documented and runnable via
   `npm run test:contract` when the sandbox is up — not required in CI.
5. Gates green; no UI change; 404 parity unaffected.

## Work packages

| ID | Owner | Deliverable |
|---|---|---|
| W3-1 | data-eng | client + types sync + domain modules + media helper + auth + query hooks |
| W3-2 | data-eng | unit/contract tests with fixtures |
| W3-3 | Lead | dependency install, CI wiring, integration review |

## Rules

- No service-role key anywhere in the client.
- Types come from the generated `Database` type; no hand-written row interfaces where a generated
  type exists.
- The legacy barrel/`src/**` stays read-only; this layer deliberately re-implements the query
  surface rather than importing legacy modules.
