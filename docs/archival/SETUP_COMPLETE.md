# ✅ Supabase Setup Complete with CLI!

## Frontend Environment Baseline

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
# Optional when offloading large media assets
# VITE_MEDIA_BASE_URL=https://your-project.supabase.co/storage/v1/object/public/wedding-media
```

Server-only secrets such as `SUPABASE_SERVICE_ROLE_KEY` belong in deployment or function environments only.

## Supabase CLI Installed

Run the setup script:

```powershell
.\supabase-setup.ps1
```

## Quick Commands

| Command                                                | Description               |
| ------------------------------------------------------ | ------------------------- |
| `npx supabase link --project-ref rxzbbtghnrvzubqrbhhx` | Link to remote project    |
| `npx supabase db push`                                 | Push schema to production |
| `npx supabase start`                                   | Start local development   |
| `npx supabase status`                                  | Check status              |

## Project Structure

```
supabase/
├── config.toml                    # Project config (rxzbbtghnrvzubqrbhhx)
├── seed.sql                       # Sample data
├── migrations/
│   ├── 20240303000000_init_schema.sql      # Tables & RLS
│   └── 20240303000001_storage_buckets.sql  # Storage policies
└── .temp/
```

## Database Schema

### Tables Created:

- `photos` - Gallery photos with metadata
- `guest_uploads` - Pending guest uploads
- `guestbook_messages` - Guestbook entries

### Storage Buckets (create in Dashboard):

- `guest-photos` - Guest photo uploads
- `guest-videos` - Guest video uploads
- `guest-voice` - Voice messages

## Next Steps

### 1. Link & Push (One-time)

```powershell
# Link to your project
npx supabase link --project-ref rxzbbtghnrvzubqrbhhx

# Push schema to production
npx supabase db push
```

### 2. Create Storage Buckets

Go to https://rxzbbtghnrvzubqrbhhx.supabase.co:

- Storage → New Bucket → `guest-photos` (Public)
- Storage → New Bucket → `guest-videos` (Public)
- Storage → New Bucket → `guest-voice` (Public)

### 3. Test Locally

```bash
npm run dev
```

### 4. Deploy

```bash
npm run build
vercel --prod
```

## Verification Snapshot

- `npm run lint` passes with warnings only
- `npx tsc --noEmit` passes
- `npm run test:run` passes
- `npm run test:e2e` passes
- `npm run build` passes

---

**Current repo state:** the shipping site is Supabase-backed and verified locally. The remaining deployment work is environment setup, domain/hosting, and optional media offload via `VITE_MEDIA_BASE_URL`.
