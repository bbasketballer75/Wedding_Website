-- ============================================
-- Initial Schema Migration
-- Wedding Website Database Setup
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
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'photos'
      and policyname = 'Allow public read access'
  ) then
    create policy "Allow public read access" on photos
      for select using (true);
  end if;
end
$$;

-- Allow inserts only from authenticated users (for admin)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'photos'
      and policyname = 'Allow authenticated insert'
  ) then
    create policy "Allow authenticated insert" on photos
      for insert with check (auth.role() = 'authenticated');
  end if;
end
$$;

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
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guest_uploads'
      and policyname = 'Allow public insert'
  ) then
    create policy "Allow public insert" on guest_uploads
      for insert with check (true);
  end if;
end
$$;

-- Allow public read of approved uploads only
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guest_uploads'
      and policyname = 'Allow public read approved'
  ) then
    create policy "Allow public read approved" on guest_uploads
      for select using (status = 'approved');
  end if;
end
$$;

-- Allow authenticated users to see all (for admin)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guest_uploads'
      and policyname = 'Allow authenticated read all'
  ) then
    create policy "Allow authenticated read all" on guest_uploads
      for select using (auth.role() = 'authenticated');
  end if;
end
$$;

-- Allow authenticated users to update status (for admin approval)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guest_uploads'
      and policyname = 'Allow authenticated update'
  ) then
    create policy "Allow authenticated update" on guest_uploads
      for update using (auth.role() = 'authenticated');
  end if;
end
$$;

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
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guestbook_messages'
      and policyname = 'Allow public read'
  ) then
    create policy "Allow public read" on guestbook_messages
      for select using (true);
  end if;
end
$$;

-- Allow public insert (guests can sign)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guestbook_messages'
      and policyname = 'Allow public insert'
  ) then
    create policy "Allow public insert" on guestbook_messages
      for insert with check (true);
  end if;
end
$$;

-- Allow authenticated users to update reactions
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guestbook_messages'
      and policyname = 'Allow authenticated update'
  ) then
    create policy "Allow authenticated update" on guestbook_messages
      for update using (auth.role() = 'authenticated');
  end if;
end
$$;

create index if not exists idx_guestbook_created_at on guestbook_messages(created_at desc);

-- ============================================
-- Sample Data for Testing
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
