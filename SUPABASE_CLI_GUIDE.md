# Supabase CLI Guide

This project uses Supabase CLI for database management.

## Quick Start

Run the setup script:
```powershell
.\supabase-setup.ps1
```

Or manually execute these commands:

## Commands

### Link to Remote Project
```bash
npx supabase link --project-ref rxzbbtghnrvzubqrbhhx
```

### Push Database Schema
```bash
npx supabase db push
```

### Start Local Development
```bash
npx supabase start
```

### Stop Local Development
```bash
npx supabase stop
```

### View Status
```bash
npx supabase status
```

### Open Supabase Studio (Local)
```bash
npx supabase studio
```

## Database Migrations

Migrations are stored in `supabase/migrations/`:
- `20240303000000_init_schema.sql` - Initial tables and RLS policies
- `20240303000001_storage_buckets.sql` - Storage bucket policies

## Project Structure

```
supabase/
├── config.toml              # Supabase configuration
├── seed.sql                 # Seed data for development
├── migrations/
│   ├── 20240303000000_init_schema.sql
│   └── 20240303000001_storage_buckets.sql
└── .temp/                   # Temporary files
```

## Environment Variables

Your frontend `.env` file should contain only browser-safe values:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
# Optional when media is hosted outside /public
# VITE_MEDIA_BASE_URL=https://your-project.supabase.co/storage/v1/object/public/wedding-media
```

Keep `SUPABASE_SERVICE_ROLE_KEY` in server-only environments such as Edge Functions, CI secrets, or deployment dashboards. Do not store it in frontend env templates.

## First-Time Setup Checklist

- [ ] Run `npx supabase link --project-ref rxzbbtghnrvzubqrbhhx`
- [ ] Run `npx supabase db push`
- [ ] Create storage buckets in Dashboard:
  - `guest-photos` (Public)
  - `guest-videos` (Public)
  - `guest-voice` (Public)
- [ ] Test upload functionality
- [ ] Deploy to production

## Troubleshooting

### "Project not linked"
Run: `npx supabase link --project-ref rxzbbtghnrvzubqrbhhx`

### "Not authenticated"
Run: `npx supabase login`

### Migration fails
Check SQL syntax in migration files, then:
```bash
npx supabase db reset  # Warning: This clears local data!
```
