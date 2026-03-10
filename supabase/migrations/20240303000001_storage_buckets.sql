-- ============================================
-- Storage Buckets Setup
-- Run this after creating buckets in the Storage UI
-- or use supabase cli to create them
-- ============================================

-- Storage policies for guest-photos bucket
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
