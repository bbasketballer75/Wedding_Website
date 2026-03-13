alter table public.site_editorial_features
  add column if not exists memory_trail text check (
    memory_trail is null
    or memory_trail in ('ceremony', 'family', 'dance-floor', 'engagement-season', 'bach-ette')
  ),
  add column if not exists badge_label text,
  add column if not exists cta_label text,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add constraint site_editorial_features_schedule_window_check check (
    starts_at is null or ends_at is null or starts_at <= ends_at
  );

create table if not exists public.site_editorial_feature_history (
  id uuid primary key default gen_random_uuid(),
  slot text not null check (
    slot in (
      'home_newest_standout_upload',
      'home_featured_guestbook_note',
      'home_moment_of_the_week',
      'film_featured_guest_video'
    )
  ),
  feature_id uuid,
  actor_user_id uuid,
  actor_email text,
  actor_name text,
  change_summary text not null,
  previous_feature jsonb not null default '{}'::jsonb,
  next_feature jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_site_editorial_feature_history_slot_created_at
  on public.site_editorial_feature_history(slot, created_at desc);

create index if not exists idx_site_editorial_feature_history_created_at
  on public.site_editorial_feature_history(created_at desc);

alter table public.site_editorial_feature_history enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_editorial_feature_history'
      and policyname = 'Authenticated users can read editorial feature history'
  ) then
    create policy "Authenticated users can read editorial feature history"
      on public.site_editorial_feature_history
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_editorial_feature_history'
      and policyname = 'Authenticated users can insert editorial feature history'
  ) then
    create policy "Authenticated users can insert editorial feature history"
      on public.site_editorial_feature_history
      for insert
      to authenticated
      with check (true);
  end if;
end
$$;

alter table public.guest_uploads
  add column if not exists video_visibility text not null default 'archive_only' check (
    video_visibility in ('archive_only', 'guest_highlights', 'featured')
  ),
  add column if not exists memory_trail text check (
    memory_trail is null
    or memory_trail in ('ceremony', 'family', 'dance-floor', 'engagement-season', 'bach-ette')
  ),
  add column if not exists editorial_title text,
  add column if not exists editorial_summary text,
  add column if not exists featured_rank integer;

create index if not exists idx_guest_uploads_video_visibility_created_at
  on public.guest_uploads(video_visibility, created_at desc);

create index if not exists idx_guest_uploads_memory_trail_created_at
  on public.guest_uploads(memory_trail, created_at desc);

drop policy if exists "Public users can read active editorial features" on public.site_editorial_features;

create policy "Public users can read active editorial features"
  on public.site_editorial_features
  for select
  to anon
  using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );
