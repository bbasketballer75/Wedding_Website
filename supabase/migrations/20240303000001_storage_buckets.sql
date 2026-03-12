-- ============================================
-- Storage Buckets Setup
-- Run this after creating buckets in the Storage UI
-- or use supabase cli to create them
-- ============================================

-- Storage policies for guest-photos bucket
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow public uploads to guest-photos'
  ) then
    create policy "Allow public uploads to guest-photos"
      on storage.objects for insert
      with check (bucket_id = 'guest-photos');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow public read from guest-photos'
  ) then
    create policy "Allow public read from guest-photos"
      on storage.objects for select
      using (bucket_id = 'guest-photos');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow public uploads to guest-videos'
  ) then
    create policy "Allow public uploads to guest-videos"
      on storage.objects for insert
      with check (bucket_id = 'guest-videos');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow public read from guest-videos'
  ) then
    create policy "Allow public read from guest-videos"
      on storage.objects for select
      using (bucket_id = 'guest-videos');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow public uploads to guest-voice'
  ) then
    create policy "Allow public uploads to guest-voice"
      on storage.objects for insert
      with check (bucket_id = 'guest-voice');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Allow public read from guest-voice'
  ) then
    create policy "Allow public read from guest-voice"
      on storage.objects for select
      using (bucket_id = 'guest-voice');
  end if;
end
$$;
