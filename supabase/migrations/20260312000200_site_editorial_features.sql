create table if not exists public.site_editorial_features (
  id uuid primary key default gen_random_uuid(),
  slot text not null unique check (
    slot in (
      'home_newest_standout_upload',
      'home_featured_guestbook_note',
      'home_moment_of_the_week',
      'film_featured_guest_video'
    )
  ),
  title text not null,
  summary text,
  trail text,
  source_type text not null check (
    source_type in (
      'guest_upload',
      'guestbook_message',
      'film_chapter',
      'custom'
    )
  ),
  source_id text,
  source_label text,
  source_url text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  updated_by_user_id uuid,
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_site_editorial_features_slot
  on public.site_editorial_features(slot);

create index if not exists idx_site_editorial_features_active_order
  on public.site_editorial_features(is_active, display_order, updated_at desc);

alter table public.site_editorial_features enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_editorial_features'
      and policyname = 'Authenticated users can read editorial features'
  ) then
    create policy "Authenticated users can read editorial features"
      on public.site_editorial_features
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_editorial_features'
      and policyname = 'Authenticated users can insert editorial features'
  ) then
    create policy "Authenticated users can insert editorial features"
      on public.site_editorial_features
      for insert
      to authenticated
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'site_editorial_features'
      and policyname = 'Authenticated users can update editorial features'
  ) then
    create policy "Authenticated users can update editorial features"
      on public.site_editorial_features
      for update
      to authenticated
      using (true)
      with check (true);
  end if;
end
$$;
