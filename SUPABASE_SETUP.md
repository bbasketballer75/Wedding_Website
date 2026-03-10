# 🗄️ Supabase Setup Guide

## What is Supabase?
Supabase is an open-source Firebase alternative that provides:
- **PostgreSQL Database** - For storing photos, messages, guest data
- **Storage** - For guest-uploaded photos/videos
- **Authentication** - Optional: for private gallery access
- **Real-time** - Live updates when guests upload content

---

## Step 1: Create Supabase Project

### 1.1 Sign Up
1. Go to [supabase.com](https://supabase.com)
2. Sign up with GitHub or email
3. Click "New Project"

### 1.2 Project Settings
```
Organization: Your name
Project Name: austin-jordyn-wedding
Database Password: [generate strong password]
Region: Choose closest to your users (e.g., us-east-1)
```

### 1.3 Wait for Database Setup
- Takes 2-3 minutes
- You will get:
  - Project URL: `https://xxxxx.supabase.co`
  - API Key (anon/public): `eyJ...`
  - Service Role Key (secret): `eyJ...`

---

## Step 2: Create Database Tables

### Table 1: photos
```sql
create table photos (
  id uuid default gen_random_uuid() primary key,
  url text not null,
  thumbnail text not null,
  caption text,
  category text default 'Uncategorized',
  location text,
  date timestamp with time zone default now(),
  likes integer default 0,
  photographer text,
  is_professional boolean default false,
  tags text[] default '{}',
  faces jsonb default '[]',
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table photos enable row level security;

-- Allow public read access
create policy "Allow public read access" on photos
  for select using (true);
```

### Table 2: guest_uploads
```sql
create table guest_uploads (
  id uuid default gen_random_uuid() primary key,
  guest_name text not null,
  guest_email text not null,
  message text,
  photo_urls text[] default '{}',
  video_urls text[] default '{}',
  status text default 'pending', -- pending, approved, rejected
  created_at timestamp with time zone default now()
);

alter table guest_uploads enable row level security;

create policy "Allow public insert" on guest_uploads
  for insert with check (true);

create policy "Allow public read approved" on guest_uploads
  for select using (status = 'approved');
```

### Table 3: guestbook_messages
```sql
create table guestbook_messages (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  content text not null,
  type text default 'text', -- text, voice, video
  media_url text,
  reactions jsonb default '{}',
  created_at timestamp with time zone default now()
);

alter table guestbook_messages enable row level security;

create policy "Allow public read" on guestbook_messages
  for select using (true);

create policy "Allow public insert" on guestbook_messages
  for insert with check (true);
```

---

## Step 3: Set Up Storage

### 3.1 Create Buckets
1. Go to Storage in Supabase Dashboard
2. Create bucket: `guest-photos`
3. Create bucket: `guest-videos`
4. Create bucket: `guest-voice-messages`

### 3.2 Set Storage Policies
For each bucket, add these policies:

```sql
-- Allow public uploads
create policy "Allow public uploads" on storage.objects
  for insert with check (bucket_id in ('guest-photos', 'guest-videos', 'guest-voice-messages'));

-- Allow public read
create policy "Allow public read" on storage.objects
  for select using (bucket_id in ('guest-photos', 'guest-videos', 'guest-voice-messages'));
```

---

## Step 4: Environment Variables

Create `.env` file in project root with browser-safe values only:

```bash
# Supabase client configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional: public CDN / Supabase Storage base for large media
# VITE_MEDIA_BASE_URL=https://your-project.supabase.co/storage/v1/object/public/wedding-media
```

If you use a service role key for Edge Functions or other server-only automation, keep it in the server runtime only. Do not place `SUPABASE_SERVICE_ROLE_KEY` in frontend env files.

---

## Step 5: Update Code

### 5.1 Install Supabase Client
```bash
npm install @supabase/supabase-js
```

### 5.2 Create Supabase Client
Create `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)
```

### 5.3 Update Upload Component
Replace mock upload with Supabase storage upload:

```typescript
// In Upload.tsx
import { supabase } from '@/lib/supabase'

const uploadFile = async (file: File) => {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random()}.${fileExt}`
  
  const { data, error } = await supabase.storage
    .from('guest-photos')
    .upload(fileName, file)
    
  if (error) throw error
  
  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('guest-photos')
    .getPublicUrl(fileName)
    
  return publicUrl
}
```

---

## Step 6: Test Upload

1. Run development server: `npm run dev`
2. Go to Upload page
3. Try uploading a photo
4. Check Supabase Storage bucket for the file
5. Check Supabase Database for the record

---

## Step 7: Production Considerations

### 7.1 Storage Limits (Free Tier)
- 1GB database
- 1GB storage
- 2GB bandwidth/month
- 500MB egress/day

### 7.2 If You Need More
- Pro plan: $25/month
- 8GB database
- 100GB storage
- 250GB bandwidth

### 7.3 Security
- Keep Service Role Key secret (server-side only)
- Use Row Level Security (RLS) policies
- Enable email confirmations for uploads (optional)

---

## Quick Reference

### Database Connection String
```
postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres
```

### API Endpoint
```
https://xxxxx.supabase.co/rest/v1/photos
```

### Useful SQL Commands
```sql
-- View all photos
select * from photos order by created_at desc;

-- View pending uploads
select * from guest_uploads where status = 'pending';

-- Approve an upload
update guest_uploads set status = 'approved' where id = 'uuid';

-- Count uploads by status
select status, count(*) from guest_uploads group by status;
```

---

**Current repo state:** the shipping app already uses Supabase for gallery, uploads, guestbook, and moderation flows. Use this guide to provision or reconnect a project, not to add Supabase from scratch.
