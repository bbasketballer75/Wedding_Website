create table if not exists public.moderation_audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('guest_upload', 'guestbook_message')),
  entity_id uuid not null,
  action text not null,
  actor_user_id uuid null,
  actor_email text null,
  actor_name text null,
  from_status text null,
  to_status text null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists moderation_audit_log_entity_created_idx
  on public.moderation_audit_log (entity_type, entity_id, created_at desc);

create index if not exists moderation_audit_log_created_at_idx
  on public.moderation_audit_log (created_at desc);

create index if not exists moderation_audit_log_actor_created_idx
  on public.moderation_audit_log (actor_user_id, created_at desc);

alter table public.moderation_audit_log enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'moderation_audit_log'
      and policyname = 'Authenticated users can read moderation audit log'
  ) then
    create policy "Authenticated users can read moderation audit log"
      on public.moderation_audit_log
      for select
      to authenticated
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'moderation_audit_log'
      and policyname = 'Authenticated users can insert moderation audit log'
  ) then
    create policy "Authenticated users can insert moderation audit log"
      on public.moderation_audit_log
      for insert
      to authenticated
      with check (true);
  end if;
end
$$;
