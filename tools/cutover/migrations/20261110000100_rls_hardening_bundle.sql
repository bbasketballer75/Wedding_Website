-- ============================================
-- Cutover migration 002 (D-02 / A3 §6): RLS hardening bundle S1–S7
-- ============================================
--
-- OWNER-APPROVED BEHAVIOUR CHANGES (see docs/rebuild/DATA_CUTOVER.md §7 D-02):
--   S1 activity_log ......... enable RLS + public SELECT only; trigger stays the
--                             only writer (SECURITY DEFINER, pinned search_path).
--   S2 guest identities ..... drop public SELECT on guest_identities and
--                             guest_share_tokens; the guest surfaces move to
--                             SECURITY DEFINER RPCs that return only safe fields:
--                               get_guest_contributions(token)
--                               resolve_guest_identity(email, name, session)
--                               get_or_create_share_token(email, upload_id)
--   S3 guest_uploads ........ "any authenticated" read/update replaced with
--                             is_admin() policies; public insert + approved read
--                             are preserved.
--   S4 guestbook delete ..... admin delete moves to
--                             delete_guestbook_messages_v1(uuid[]) with is_admin()
--                             and is audited by the caller; direct DELETE revoked.
--   S5 photo_likes .......... enable RLS with no policies (RPC-only writes).
--   S6 moderation audit ..... inserts move to insert_moderation_audit_v1(...),
--                             which derives the actor from the JWT; direct INSERT
--                             revoked; `action` constrained (NOT VALID so the
--                             cutover never fails on historical rows).
--   S7 admin RPC surface .... revoke anon EXECUTE on admin-gated RPCs and the
--                             rate-limit helpers; pin search_path on the
--                             SECURITY DEFINER functions that lacked it.
--
-- SAFETY: additive/replacement only. No table, column or row is deleted. All
-- statements are idempotent (DROP POLICY IF EXISTS / CREATE OR REPLACE /
-- GRANT/REVOKE are repeatable).
-- ============================================

begin;

-- ---------------------------------------------------------------------------
-- S1 — activity_log: RLS on, public read only, trigger remains the only writer
-- ---------------------------------------------------------------------------
alter table public.activity_log enable row level security;

drop policy if exists "Allow public read on activity_log" on public.activity_log;
drop policy if exists "Activity feed public read" on public.activity_log;
create policy "Activity feed public read"
  on public.activity_log
  for select
  to anon, authenticated
  using (true);

-- No INSERT/UPDATE/DELETE policies: PostgREST writes are refused. The activity
-- trigger (below) is the sanctioned writer and runs as the function owner.
revoke insert, update, delete, truncate on public.activity_log from anon, authenticated;

-- The trigger inserts into activity_log from guest/anonymous sessions; it must
-- run as its (bypass-RLS) owner and must not be hijacked through search_path.
alter function public.trigger_activity_log_insert() security definer;
alter function public.trigger_activity_log_insert() set search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- S2 — guest_identities / guest_share_tokens: no public table read
-- ---------------------------------------------------------------------------
drop policy if exists "Allow public read on guest_identities" on public.guest_identities;
drop policy if exists "Allow public insert on guest_identities" on public.guest_identities;
drop policy if exists "Allow admin full access on guest_identities" on public.guest_identities;

drop policy if exists "Admin manage guest identities" on public.guest_identities;
create policy "Admin manage guest identities"
  on public.guest_identities
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke select, insert, update, delete on public.guest_identities from anon;
revoke delete on public.guest_identities from authenticated;

drop policy if exists "Allow public read on guest_share_tokens" on public.guest_share_tokens;
drop policy if exists "Allow public insert on guest_share_tokens" on public.guest_share_tokens;
drop policy if exists "Allow admin full access on guest_share_tokens" on public.guest_share_tokens;

drop policy if exists "Admin manage guest share tokens" on public.guest_share_tokens;
create policy "Admin manage guest share tokens"
  on public.guest_share_tokens
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke select, insert, update, delete on public.guest_share_tokens from anon;
revoke delete on public.guest_share_tokens from authenticated;

-- Guest-share aggregate: the only public read path for token-addressed data.
create or replace function public.get_guest_contributions(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_email text;
  v_identity jsonb;
BEGIN
  if p_token is null or btrim(p_token) = '' then
    return null;
  end if;

  select t.guest_email into v_email
  from public.guest_share_tokens t
  where t.token = p_token
  limit 1;

  if v_email is null then
    return null;
  end if;

  select jsonb_build_object(
    'id', gi.id,
    'display_name', gi.display_name,
    'photo_claims', coalesce((
      select jsonb_agg(
               jsonb_build_object('status', pc.status, 'photos', to_jsonb(ph))
               order by pc.created_at desc
             )
      from public.photo_claims pc
      left join public.photos ph on ph.id = pc.photo_id
      where pc.guest_identity_id = gi.id
        and pc.status = 'approved'
    ), '[]'::jsonb)
  )
  into v_identity
  from public.guest_identities gi
  where gi.email = v_email
  limit 1;

  return jsonb_build_object(
    'token', jsonb_build_object('token', p_token, 'guest_email', v_email),
    'identity', v_identity,
    'uploads', coalesce((
      select jsonb_agg(to_jsonb(u) order by u.created_at desc nulls last)
      from public.guest_uploads u
      where u.guest_email = v_email
        and u.status = 'approved'
    ), '[]'::jsonb),
    'guestbook', coalesce((
      select jsonb_agg(to_jsonb(g) order by g.created_at desc nulls last)
      from public.guestbook_messages g
      where g.email = v_email
    ), '[]'::jsonb)
  );
END;
$$;

comment on function public.get_guest_contributions(text) is
  'Token-addressed guest showcase aggregate (safe fields only; replaces public table reads).';
grant execute on function public.get_guest_contributions(text) to anon, authenticated;

-- Claim wizard identity resolution: find-or-create without exposing the table.
create or replace function public.resolve_guest_identity(
  p_email text,
  p_display_name text,
  p_session_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := btrim(coalesce(p_display_name, ''));
  v_row public.guest_identities%rowtype;
BEGIN
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'a valid email is required' using errcode = '22023';
  end if;
  if v_name = '' then
    raise exception 'a display name is required' using errcode = '22023';
  end if;

  select * into v_row from public.guest_identities where email = v_email limit 1;

  if v_row.id is null then
    begin
      insert into public.guest_identities (email, display_name, session_id, is_verified)
      values (v_email, v_name, p_session_id, false)
      returning * into v_row;
    exception when unique_violation then
      select * into v_row from public.guest_identities where email = v_email limit 1;
    end;
  elsif not v_row.is_verified then
    update public.guest_identities
       set display_name = v_name,
           session_id = p_session_id
     where id = v_row.id
     returning * into v_row;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'email', v_row.email,
    'display_name', v_row.display_name,
    'session_id', v_row.session_id,
    'is_verified', v_row.is_verified,
    'created_at', v_row.created_at
  );
END;
$$;

comment on function public.resolve_guest_identity(text, text, text) is
  'Find-or-create a guest identity for the claim wizard without public table reads.';
grant execute on function public.resolve_guest_identity(text, text, text) to anon, authenticated;

-- Share-token issuance: only the owner of the just-created (unguessable) upload
-- row can fetch/derive the token, so email alone is not enough to enumerate.
create or replace function public.get_or_create_share_token(
  p_email text,
  p_upload_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_owner text;
  v_token text;
BEGIN
  if p_upload_id is null or v_email = '' then
    return null;
  end if;

  select lower(u.guest_email) into v_owner
  from public.guest_uploads u
  where u.id = p_upload_id
  limit 1;

  if v_owner is null or v_owner <> v_email then
    return null;
  end if;

  select t.token into v_token
  from public.guest_share_tokens t
  where t.guest_email = v_email
  limit 1;

  if v_token is null then
    insert into public.guest_share_tokens (guest_email, token)
    values (v_email, gen_random_uuid()::text)
    returning token into v_token;
  end if;

  return v_token;
END;
$$;

comment on function public.get_or_create_share_token(text, uuid) is
  'Issue/read a guest share token only for the uploader of a known upload row.';
grant execute on function public.get_or_create_share_token(text, uuid) to anon, authenticated;

-- Public claim writes stay, but only as pending claims of a valid kind; anon can
-- no longer pre-approve its own claim. Admin transitions use is_admin().
drop policy if exists "Allow admin full access on photo_claims" on public.photo_claims;
drop policy if exists "Allow public insert on photo_claims" on public.photo_claims;

drop policy if exists "Admin manage photo claims" on public.photo_claims;
create policy "Admin manage photo claims"
  on public.photo_claims
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Public submit pending photo claims" on public.photo_claims;
create policy "Public submit pending photo claims"
  on public.photo_claims
  for insert
  to anon, authenticated
  with check (status = 'pending' and claim_type in ('upload', 'face'));

-- ---------------------------------------------------------------------------
-- S3 — guest_uploads: admin-only reads/updates, public insert + approved read
-- ---------------------------------------------------------------------------
drop policy if exists "Allow authenticated read all" on public.guest_uploads;
drop policy if exists "Allow authenticated update" on public.guest_uploads;

drop policy if exists "Admin read all guest uploads" on public.guest_uploads;
create policy "Admin read all guest uploads"
  on public.guest_uploads
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admin update guest uploads" on public.guest_uploads;
create policy "Admin update guest uploads"
  on public.guest_uploads
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Public insert + "approved" read policies from the frozen baseline are kept.

-- ---------------------------------------------------------------------------
-- S4 — guestbook_messages: admin delete via RPC; admin update via is_admin()
-- ---------------------------------------------------------------------------
drop policy if exists "Allow authenticated update" on public.guestbook_messages;

drop policy if exists "Admin update guestbook messages" on public.guestbook_messages;
create policy "Admin update guestbook messages"
  on public.guestbook_messages
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Guests submit through the repaired, rate-limited RPC only.
drop policy if exists "Allow public insert" on public.guestbook_messages;
revoke insert, delete on public.guestbook_messages from anon, authenticated;

create or replace function public.delete_guestbook_messages_v1(p_message_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
BEGIN
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_message_ids is null or array_length(p_message_ids, 1) is null then
    return 0;
  end if;

  delete from public.guestbook_messages
  where id = any(p_message_ids);

  get diagnostics v_deleted = row_count;
  return v_deleted;
END;
$$;

comment on function public.delete_guestbook_messages_v1(uuid[]) is
  'Admin-only guestbook deletion (S4); direct DELETE is revoked.';
revoke all on function public.delete_guestbook_messages_v1(uuid[]) from public, anon;
grant execute on function public.delete_guestbook_messages_v1(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- S5 — photo_likes: RLS on, RPC-only writes (no policies)
-- ---------------------------------------------------------------------------
alter table public.photo_likes enable row level security;
revoke select, insert, update, delete on public.photo_likes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- S6 — moderation_audit_log: JWT-derived actor via RPC, direct inserts revoked
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users can insert moderation audit log" on public.moderation_audit_log;
drop policy if exists "Authenticated users can read moderation audit log" on public.moderation_audit_log;

drop policy if exists "Admin read moderation audit log" on public.moderation_audit_log;
create policy "Admin read moderation audit log"
  on public.moderation_audit_log
  for select
  to authenticated
  using (public.is_admin());

revoke insert, update, delete on public.moderation_audit_log from anon, authenticated;

create or replace function public.insert_moderation_audit_v1(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_summary text,
  p_metadata jsonb default '{}'::jsonb,
  p_from_status text default null,
  p_to_status text default null
)
returns public.moderation_audit_log
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_claims jsonb := coalesce(auth.jwt() -> 'claims', auth.jwt());
  v_actor_id uuid := nullif(v_claims ->> 'sub', '')::uuid;
  v_actor_email text := v_claims ->> 'email';
  v_actor_name text := coalesce(
    nullif(v_claims -> 'user_metadata' ->> 'display_name', ''),
    nullif(v_claims -> 'user_metadata' ->> 'name', ''),
    v_actor_email
  );
  v_row public.moderation_audit_log%rowtype;
BEGIN
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_action not in (
    'upload_moved_to_pending',
    'upload_approved_unpublished',
    'upload_approved_published',
    'upload_removed_from_gallery',
    'upload_rejected',
    'upload_bulk_rejected',
    'guestbook_message_deleted',
    'guestbook_bulk_deleted',
    'claim_approved',
    'claim_rejected'
  ) then
    raise exception 'unknown moderation action: %', p_action using errcode = '22023';
  end if;

  insert into public.moderation_audit_log (
    entity_type, entity_id, action, actor_user_id, actor_email, actor_name,
    from_status, to_status, summary, metadata
  ) values (
    p_entity_type, p_entity_id, p_action, v_actor_id, v_actor_email, v_actor_name,
    p_from_status, p_to_status, p_summary, coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_row;

  return v_row;
END;
$$;

comment on function public.insert_moderation_audit_v1(
  text, uuid, text, text, jsonb, text, text
) is 'Admin-only audit append; actor is derived from the JWT (S6).';
revoke all on function public.insert_moderation_audit_v1(text, uuid, text, text, jsonb, text, text) from public, anon;
grant execute on function public.insert_moderation_audit_v1(text, uuid, text, text, jsonb, text, text) to authenticated;

-- Historical rows may predate the app union; NOT VALID enforces new writes only.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.moderation_audit_log'::regclass
      and conname = 'moderation_audit_log_action_check'
  ) then
    alter table public.moderation_audit_log
      add constraint moderation_audit_log_action_check check (
        action in (
          'upload_moved_to_pending',
          'upload_approved_unpublished',
          'upload_approved_published',
          'upload_removed_from_gallery',
          'upload_rejected',
          'upload_bulk_rejected',
          'guestbook_message_deleted',
          'guestbook_bulk_deleted',
          'claim_approved',
          'claim_rejected'
        )
      ) not valid;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- S7 — admin RPC surface + rate-limit helpers + pinned search_path
-- ---------------------------------------------------------------------------
revoke execute on function public.save_album_organization_v1(text, uuid[], jsonb) from public, anon;
revoke execute on function public.save_album_organization_v2(text, uuid[], jsonb, uuid[]) from public, anon;
revoke execute on function public.delete_gallery_photos_v1(uuid[], text[]) from public, anon;
revoke execute on function public.hide_photo_comment_v1(uuid, boolean, text) from public, anon;
revoke execute on function public.delete_photo_comment_v1(uuid) from public, anon;
revoke execute on function public.get_recent_photo_comments_v1(integer) from public, anon;

-- Rate-limit helpers are implementation details of the SECURITY DEFINER
-- wrappers; direct anon calls only let clients probe/poison the logs.
revoke execute on function public.check_rate_limit(text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.increment_rate_limit(text, text, integer) from public, anon, authenticated;
revoke execute on function public.cleanup_old_rate_limits() from public, anon, authenticated;

alter function public.check_rate_limit(text, text, integer, integer) set search_path = public, pg_temp;
alter function public.increment_rate_limit(text, text, integer) set search_path = public, pg_temp;
alter function public.cleanup_old_rate_limits() set search_path = public, pg_temp;

commit;
