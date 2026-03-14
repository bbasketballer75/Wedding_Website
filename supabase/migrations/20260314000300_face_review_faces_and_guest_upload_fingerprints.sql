alter table public.guest_uploads
  add column if not exists photo_fingerprints text[] not null default '{}';

alter table public.guest_uploads
  add column if not exists video_fingerprints text[] not null default '{}';

create table if not exists public.media_review_faces (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.media_review_batches(id) on delete cascade,
  face_id text not null,
  cluster_id text,
  source_record_id text,
  source_relative_path text,
  photo_url text,
  thumbnail_url text,
  thumbnail_object_path text,
  x numeric not null default 0,
  y numeric not null default 0,
  box jsonb not null default '{}'::jsonb,
  quality_score numeric,
  review_status text not null default 'pending' check (review_status in ('pending', 'confirmed', 'ignored')),
  confirmed_name text,
  person_key text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique(batch_id, face_id)
);

create index if not exists idx_media_review_faces_batch_status
  on public.media_review_faces(batch_id, review_status, updated_at desc);

create index if not exists idx_media_review_faces_batch_source
  on public.media_review_faces(batch_id, source_record_id);

create index if not exists idx_media_review_faces_batch_person
  on public.media_review_faces(batch_id, person_key);

alter table public.media_review_faces enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'media_review_faces'
      and policyname = 'Admin users manage media review faces'
  ) then
    create policy "Admin users manage media review faces"
      on public.media_review_faces
      using (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin');
  end if;
end
$$;
