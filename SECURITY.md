# Security Guidelines

## Frontend Environment Rules

Browser-exposed env files for this project should contain only public values:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
# Optional:
# VITE_MEDIA_BASE_URL=https://your-project.supabase.co/storage/v1/object/public/wedding-media
# VITE_SITE_URL=https://austinandjordyn.com
```

Do not place `SUPABASE_SERVICE_ROLE_KEY` in `.env.example`, frontend setup docs, client code, or browser builds.

## Service Role Key Policy

`SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security and must stay server-side only. Valid locations:

- Supabase Edge Function secrets
- Netlify / Vercel / CI environment dashboards
- Local server-only tooling that never ships to the browser

Invalid locations:

- `src/`
- frontend `.env` files
- committed setup snippets intended for browser apps

## Safe Client Pattern

```ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

## Current Repo Status

- Frontend env templates have been cleaned to remove service-role examples.
- The shipping app uses the anon key client path.
- Media offload is controlled through `VITE_MEDIA_BASE_URL`, which is safe to expose when it points at public storage/CDN assets.

## Follow-Up Review Items

- Keep verifying Row Level Security policies for guest uploads, guestbook content, and admin moderation tables.
- If server-side automation is added later, store service-role credentials only in server runtimes and deployment secrets.
- Review npm audit output for the remaining `vite-plugin-pwa` / `workbox-build` advisory chain before a public production launch.
