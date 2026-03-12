-- ============================================
-- Supabase Database Schema for Wedding Website
-- Run this in the Supabase SQL Editor
-- ============================================

-- ============================================
-- Table: photos
-- Stores professional and approved guest photos
-- ============================================
create table if not exists photos (
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
create policy if not exists "Allow public read access" on photos
  for select using (true);

-- Allow inserts only from authenticated users (for admin)
create policy if not exists "Allow authenticated insert" on photos
  for insert with check (auth.role() = 'authenticated');

-- Create index for faster queries
create index if not exists idx_photos_category on photos(category);
create index if not exists idx_photos_created_at on photos(created_at desc);

-- ============================================
-- Table: guest_uploads
-- Stores guest photo/video uploads pending approval
-- ============================================
create table if not exists guest_uploads (
  id uuid default gen_random_uuid() primary key,
  guest_name text not null,
  guest_email text not null,
  message text,
  photo_urls text[] default '{}',
  video_urls text[] default '{}',
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone default now()
);

alter table guest_uploads enable row level security;

-- Allow public insert (guests can upload)
create policy if not exists "Allow public insert" on guest_uploads
  for insert with check (true);

-- Allow public read of approved uploads only
create policy if not exists "Allow public read approved" on guest_uploads
  for select using (status = 'approved');

-- Allow authenticated users to see all (for admin)
create policy if not exists "Allow authenticated read all" on guest_uploads
  for select using (auth.role() = 'authenticated');

-- Allow authenticated users to update status (for admin approval)
create policy if not exists "Allow authenticated update" on guest_uploads
  for update using (auth.role() = 'authenticated');

create index if not exists idx_guest_uploads_status on guest_uploads(status);
create index if not exists idx_guest_uploads_created_at on guest_uploads(created_at desc);

-- ============================================
-- Table: guestbook_messages
-- Stores guestbook entries
-- ============================================
create table if not exists guestbook_messages (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  content text not null,
  type text default 'text' check (type in ('text', 'voice', 'video')),
  media_url text,
  reactions jsonb default '{}',
  created_at timestamp with time zone default now()
);

alter table guestbook_messages enable row level security;

-- Allow public read
create policy if not exists "Allow public read" on guestbook_messages
  for select using (true);

-- Allow public insert (guests can sign)
create policy if not exists "Allow public insert" on guestbook_messages
  for insert with check (true);

-- Allow authenticated users to update reactions
create policy if not exists "Allow authenticated update" on guestbook_messages
  for update using (auth.role() = 'authenticated');

create index if not exists idx_guestbook_created_at on guestbook_messages(created_at desc);

-- Table: moderation_audit_log
-- Append-only moderation history for guest uploads and guestbook actions
create table if not exists moderation_audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('guest_upload', 'guestbook_message')),
  entity_id uuid not null,
  action text not null,
  actor_user_id uuid,
  actor_email text,
  actor_name text,
  from_status text,
  to_status text,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table moderation_audit_log enable row level security;

create index if not exists idx_moderation_audit_entity_created
  on moderation_audit_log(entity_type, entity_id, created_at desc);
create index if not exists idx_moderation_audit_created_at
  on moderation_audit_log(created_at desc);
create index if not exists idx_moderation_audit_actor_user_id
  on moderation_audit_log(actor_user_id, created_at desc);

create policy if not exists "Allow authenticated read audit log" on moderation_audit_log
  for select to authenticated using (true);

create policy if not exists "Allow authenticated insert audit log" on moderation_audit_log
  for insert to authenticated with check (true);

-- ============================================
-- Storage Buckets Setup
-- Run these after creating buckets in the Storage UI
-- ============================================

-- Storage policies for guest-photos bucket
-- Note: Create the bucket first in the Supabase Dashboard > Storage

create policy if not exists "Allow public uploads to guest-photos"
  on storage.objects for insert
  with check (bucket_id = 'guest-photos');

create policy if not exists "Allow public read from guest-photos"
  on storage.objects for select
  using (bucket_id = 'guest-photos');

create policy if not exists "Allow public uploads to guest-videos"
  on storage.objects for insert
  with check (bucket_id = 'guest-videos');

create policy if not exists "Allow public read from guest-videos"
  on storage.objects for select
  using (bucket_id = 'guest-videos');

create policy if not exists "Allow public uploads to guest-voice"
  on storage.objects for insert
  with check (bucket_id = 'guest-voice');

create policy if not exists "Allow public read from guest-voice"
  on storage.objects for select
  using (bucket_id = 'guest-voice');

-- ============================================
-- Sample Data (Optional - for testing)
-- ============================================

-- Insert sample professional photos
insert into photos (url, thumbnail, caption, category, is_professional, photographer, tags)
values 
  (
    'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200',
    'https://images.unsplash.com/photo-1519741497674-611481863552?w=400',
    'The perfect day',
    'Ceremony',
    true,
    'Professional Photographer',
    array['ceremony', 'couple', 'love']
  ),
  (
    'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=1200',
    'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400',
    'Our first dance',
    'Reception',
    true,
    'Professional Photographer',
    array['dance', 'reception', 'romance']
  )
on conflict do nothing;

-- Insert sample guestbook message
insert into guestbook_messages (name, email, content, type)
values 
  ('Sarah & Mike', 'sarah@example.com', 'Congratulations you two! Wishing you a lifetime of love and happiness. The wedding was absolutely beautiful!', 'text'),
  ('The Johnson Family', 'johnson@example.com', 'Thank you for letting us be part of your special day. May your love continue to grow stronger with each passing year.', 'text')
on conflict do nothing;
