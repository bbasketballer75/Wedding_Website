# Supabase CLI Guide

This repo is set up for both:

- local Docker-based Supabase development
- linked remote management for the live project `rxzbbtghnrvzubqrbhhx`

The supported CLI path for this project is the version in `package.json`, invoked through `npx` or the npm scripts below. Do not rely on an older globally installed `supabase` binary.

## Canonical Commands

```bash
npm run supabase:start
npm run supabase:status
npm run supabase:stop

npm run supabase:migrations
npm run supabase:db:push:dry
npm run supabase:db:push
npm run supabase:db:pull
npm run supabase:types
```

## Local Quickstart

Requirements:

- Docker Desktop running
- Node 20.19+ (the repo already requires this)

Start the local stack:

```bash
npm run supabase:start
```

Check status:

```bash
npm run supabase:status
```

The local services should come up on the standard ports configured in `supabase/config.toml`:

- API: `http://127.0.0.1:54321`
- DB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Studio: `http://127.0.0.1:54323`
- Mailpit: `http://127.0.0.1:54324`

Local auth is configured for the actual Vite frontend:

- `auth.site_url = http://127.0.0.1:5173`
- additional redirects:
  - `http://127.0.0.1:5173`
  - `http://localhost:5173`

Stop the local stack when you are done:

```bash
npm run supabase:stop
```

## Remote Workflow

This repo is linked to:

- project ref: `rxzbbtghnrvzubqrbhhx`
- live backend: Supabase
- canonical frontend: `https://www.theporadas.com`
- large media: Cloudflare R2 / `https://media.wedding.theporadas.com`

Check remote migration history:

```bash
npm run supabase:migrations
```

Current baseline:

- `20240303000000`
- `20240303000001`
- `20240303000002`
- `20240303000003`
- `20260312000100`

Safe push flow:

```bash
npm run supabase:db:push:dry
npm run supabase:db:push
```

If the hosted pooler starts throwing auth circuit-breaker errors during CLI operations, use the password-backed flow instead of repeatedly retrying temp-role login. The current project has already needed this fallback once.

Important rules:

- prefer `--dry-run` before remote pushes
- do not use `--include-all` unless you are intentionally repairing migration history
- keep the linked project as `rxzbbtghnrvzubqrbhhx`

## Type Generation

Generate fresh database types into the repo with:

```bash
npm run supabase:types
```

This uses the linked project and writes:

- `src/types/supabase.generated.ts`

## Verification Checklist

Local:

1. `npm run supabase:start`
2. `npm run supabase:status`
3. confirm Studio opens on `http://127.0.0.1:54323`
4. confirm the frontend can use local Supabase if you point env values there

Remote:

1. `npm run supabase:migrations`
2. `npm run supabase:db:push:dry`
3. `npm run build`
4. `npx tsc --noEmit`

## Notes

- Frontend env files must contain only browser-safe values such as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Do not put `SUPABASE_SERVICE_ROLE_KEY` into frontend env files.
- For live operations, the source of truth is:
  - frontend: Netlify
  - backend: Supabase
  - media: Cloudflare R2
  - public URL: `https://www.theporadas.com`
