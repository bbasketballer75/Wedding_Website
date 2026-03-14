create table if not exists public.media_review_batches (
  id uuid default gen_random_uuid() primary key,
  batch_key text not null unique,
  label text not null,
  status text not null default 'pending' check (status in ('pending', 'in_review', 'approved', 'archived')),
  source_root text,
  working_root text,
  artifact_bucket text not null default 'media-review-artifacts',
  artifact_prefix text not null,
  artifact_paths jsonb not null default '{}'::jsonb,
  notes text,
  cluster_count integer not null default 0,
  detection_count integer not null default 0,
  pushed_by_user_id uuid,
  pushed_by_email text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_media_review_batches_status_updated_at
  on public.media_review_batches(status, updated_at desc);

create table if not exists public.media_review_clusters (
  id uuid default gen_random_uuid() primary key,
  batch_id uuid not null references public.media_review_batches(id) on delete cascade,
  cluster_id text not null,
  review_status text not null default 'pending' check (review_status in ('pending', 'confirmed', 'ignored', 'merged', 'split_requested')),
  confirmed_name text,
  merge_into_cluster_id text,
  split_requested boolean not null default false,
  split_notes text,
  sample_thumbnail_path text,
  member_count integer not null default 0,
  average_quality_score numeric,
  source_record_ids text[] not null default '{}',
  members jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique(batch_id, cluster_id)
);

create index if not exists idx_media_review_clusters_batch_status
  on public.media_review_clusters(batch_id, review_status, updated_at desc);

create index if not exists idx_media_review_clusters_confirmed_name
  on public.media_review_clusters(confirmed_name);

alter table public.media_review_batches enable row level security;
alter table public.media_review_clusters enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'media_review_batches'
      and policyname = 'Admin users manage media review batches'
  ) then
    create policy "Admin users manage media review batches"
      on public.media_review_batches
      for all
      using (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'media_review_clusters'
      and policyname = 'Admin users manage media review clusters'
  ) then
    create policy "Admin users manage media review clusters"
      on public.media_review_clusters
      for all
      using (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin');
  end if;
end
$$;

insert into storage.buckets (id, name, public)
select 'media-review-artifacts', 'media-review-artifacts', false
where not exists (
  select 1 from storage.buckets where id = 'media-review-artifacts'
);

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Admin users read media review artifacts'
  ) then
    create policy "Admin users read media review artifacts"
      on storage.objects
      for select
      using (
        bucket_id = 'media-review-artifacts'
        and coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin'
      );
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
      and policyname = 'Admin users write media review artifacts'
  ) then
    create policy "Admin users write media review artifacts"
      on storage.objects
      for all
      using (
        bucket_id = 'media-review-artifacts'
        and coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin'
      )
      with check (
        bucket_id = 'media-review-artifacts'
        and coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin'
      );
  end if;
end
$$;
