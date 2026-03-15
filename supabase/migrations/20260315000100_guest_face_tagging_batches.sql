create table if not exists public.guest_face_tagging_batches (
  id uuid primary key default gen_random_uuid(),
  batch_key text not null unique,
  label text not null,
  status text not null default 'prepared' check (status in ('prepared', 'synced', 'failed')),
  exportable_upload_count integer not null default 0,
  exportable_photo_count integer not null default 0,
  synced_photo_count integer not null default 0,
  skipped_photo_count integer not null default 0,
  last_error text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid,
  created_by_email text,
  synced_by_user_id uuid,
  synced_by_email text,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_guest_face_tagging_batches_updated_at
  on public.guest_face_tagging_batches(updated_at desc);

create index if not exists idx_guest_face_tagging_batches_status
  on public.guest_face_tagging_batches(status, updated_at desc);

alter table public.guest_face_tagging_batches enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'guest_face_tagging_batches'
      and policyname = 'Admin users manage guest face tagging batches'
  ) then
    create policy "Admin users manage guest face tagging batches"
      on public.guest_face_tagging_batches
      for all
      using (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin');
  end if;
end
$$;
