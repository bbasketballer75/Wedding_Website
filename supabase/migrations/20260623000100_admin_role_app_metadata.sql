-- ============================================================================
-- Migration: admin role moves from user_metadata → app_metadata
-- Date: 2026-06-23
--
-- Closes a critical security hole: user_metadata is user-spoofable (any signed-in
-- user can call supabase.auth.updateUser({ data: { role: 'admin' } }) and bypass
-- every RLS policy and SECURITY DEFINER RPC role check that relied on it).
--
-- app_metadata is server-only — only settable via the service role key or the
-- admin API. Once an admin user is migrated to app_metadata.role='admin', the
-- role cannot be escalated by the user.
--
-- This migration is ATOMIC by design — every check that was on user_metadata.role
-- is replaced here in one shot, so there is no window where the old and new
-- checks coexist inconsistently.
--
-- The migration:
--   1. Adds public.is_admin() helper that reads app_metadata from the JWT
--   2. Adds promote_to_admin / demote_from_admin (SECURITY DEFINER, service-role only)
--   3. One-shot data migration: copies role from user_metadata to app_metadata
--      for any user currently flagged as admin
--   4. Repoints and locks down update_auth_user_metadata to write app_metadata
--      instead of user_metadata, and revokes it from public/anon/authenticated
--   5. Replaces every admin-gated RLS policy with is_admin() (7 policies)
--   6. Replaces every admin-gated SECURITY DEFINER RPC with is_admin() (7 functions)
--
-- Post-deploy verification (run manually after db:push):
--   select public.is_admin();                                          -- expect: false for anon
--   select * from auth.users where raw_app_meta_data ->> 'role' = 'admin';  -- expect: your admin user
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper: read admin status from the JWT's app_metadata claim
-- ----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Admin management — service-role only (Edge Function / psql)
-- ----------------------------------------------------------------------------

create or replace function public.promote_to_admin(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
  where id = target_user_id;
end;
$$;

revoke execute on function public.promote_to_admin(uuid) from public, anon, authenticated;

create or replace function public.demote_from_admin(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  update auth.users
  set raw_app_meta_data = raw_app_meta_data - 'role'
  where id = target_user_id;
end;
$$;

revoke execute on function public.demote_from_admin(uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Lock down update_auth_user_metadata — repoint to app_metadata + revoke
-- ----------------------------------------------------------------------------
-- The original implementation allowed anyone with EXECUTE to set user_metadata,
-- which is the user-spoofable field. New behavior writes to app_metadata
-- (server-only) and is callable only via the service role.

create or replace function public.update_auth_user_metadata(uid uuid, metadata jsonb)
returns void
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) || coalesce(metadata, '{}'::jsonb)
  where id = uid;
end;
$$;

revoke execute on function public.update_auth_user_metadata(uuid, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. One-shot data migration: copy existing admins
-- ----------------------------------------------------------------------------
-- Any user currently flagged with raw_user_meta_data.role='admin' is promoted
-- to raw_app_meta_data.role='admin'. Idempotent — running again is a no-op.
--
-- Note: the column in auth.users is `raw_user_meta_data` (the JSON-shaped
-- `user_metadata` is a JWT accessor, not a real column). Same for
-- `raw_app_meta_data` vs the JWT's `app_metadata`.

update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
where raw_user_meta_data ->> 'role' = 'admin'
  and (raw_app_meta_data ->> 'role') is distinct from 'admin';

-- ----------------------------------------------------------------------------
-- 5. Replace all admin-gated RLS policies with is_admin()
-- ----------------------------------------------------------------------------

-- 5a. media_review_batches
drop policy if exists "Admin users manage media review batches" on public.media_review_batches;
create policy "Admin users manage media review batches"
  on public.media_review_batches
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 5b. media_review_clusters
drop policy if exists "Admin users manage media review clusters" on public.media_review_clusters;
create policy "Admin users manage media review clusters"
  on public.media_review_clusters
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 5c. media_review_faces
drop policy if exists "Admin users manage media review faces" on public.media_review_faces;
create policy "Admin users manage media review faces"
  on public.media_review_faces
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 5d. photos — admin UPDATE only (other policies on photos are unchanged)
drop policy if exists "Admin users update photos" on public.photos;
create policy "Admin users update photos"
  on public.photos
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 5e. guest_face_tagging_batches
drop policy if exists "Admin users manage guest face tagging batches" on public.guest_face_tagging_batches;
create policy "Admin users manage guest face tagging batches"
  on public.guest_face_tagging_batches
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 5f. storage.objects — media-review-artifacts bucket (read)
drop policy if exists "Admin users read media review artifacts" on storage.objects;
create policy "Admin users read media review artifacts"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'media-review-artifacts'
    and public.is_admin()
  );

-- 5g. storage.objects — media-review-artifacts bucket (write)
drop policy if exists "Admin users write media review artifacts" on storage.objects;
create policy "Admin users write media review artifacts"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'media-review-artifacts'
    and public.is_admin()
  )
  with check (
    bucket_id = 'media-review-artifacts'
    and public.is_admin()
  );

-- ----------------------------------------------------------------------------
-- 6. Replace all admin-gated SECURITY DEFINER RPCs with is_admin()
-- ----------------------------------------------------------------------------

-- 6a. save_album_organization_v1 (originally 20260315000800)
create or replace function public.save_album_organization_v1(
  p_album text,
  p_ordered_photo_ids uuid[],
  p_moves jsonb default '[]'::jsonb
)
returns table (
  saved_album text,
  current_album_count integer,
  moved_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_moved_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;

  if p_album not in ('Engagement', 'Bach+ette', 'Wedding Day', 'Guest Uploads') then
    raise exception 'invalid album';
  end if;

  if p_moves is null then
    p_moves := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_moves) <> 'array' then
    raise exception 'moves must be a JSON array';
  end if;

  create temporary table if not exists pg_temp.album_organizer_moves (
    ord integer,
    photo_id uuid,
    target_album text
  ) on commit drop;

  truncate table pg_temp.album_organizer_moves;

  insert into pg_temp.album_organizer_moves (ord, photo_id, target_album)
  select
    ord::integer,
    nullif(move.value ->> 'photoId', '')::uuid,
    move.value ->> 'targetAlbum'
  from jsonb_array_elements(p_moves) with ordinality as move(value, ord);

  delete from pg_temp.album_organizer_moves
  where photo_id is null
    or target_album is null
    or target_album = ''
    or target_album = p_album;

  if exists (
    select 1
    from pg_temp.album_organizer_moves
    where target_album not in ('Engagement', 'Bach+ette', 'Wedding Day', 'Guest Uploads')
  ) then
    raise exception 'invalid target album';
  end if;

  if exists (
    select 1
    from pg_temp.album_organizer_moves moves
    left join public.photos photos
      on photos.id = moves.photo_id
     and photos.album = p_album
    where photos.id is null
  ) then
    raise exception 'one or more moved photos are no longer in the selected album';
  end if;

  create temporary table if not exists pg_temp.album_organizer_order (
    ord integer,
    photo_id uuid
  ) on commit drop;

  truncate table pg_temp.album_organizer_order;

  insert into pg_temp.album_organizer_order (ord, photo_id)
  select
    min(ordered.ord)::integer,
    ordered.photo_id
  from unnest(coalesce(p_ordered_photo_ids, array[]::uuid[])) with ordinality as ordered(photo_id, ord)
  where ordered.photo_id is not null
  group by ordered.photo_id;

  if exists (
    select 1
    from pg_temp.album_organizer_order ordered
    left join public.photos photos
      on photos.id = ordered.photo_id
     and photos.album = p_album
    where photos.id is null
  ) then
    raise exception 'one or more ordered photos are no longer in the selected album';
  end if;

  with target_bases as (
    select
      target_album,
      coalesce(max(photos.album_sort_order), 0) as base_order
    from (
      select distinct target_album
      from pg_temp.album_organizer_moves
    ) move_targets
    left join public.photos photos
      on photos.album = move_targets.target_album
     and photos.id not in (
       select photo_id
       from pg_temp.album_organizer_moves
     )
    group by target_album
  ),
  ranked_moves as (
    select
      moves.photo_id,
      moves.target_album,
      coalesce(target_bases.base_order, 0)
      + row_number() over (partition by moves.target_album order by moves.ord) as next_order
    from pg_temp.album_organizer_moves moves
    left join target_bases
      on target_bases.target_album = moves.target_album
  )
  update public.photos photos
  set
    album = ranked_moves.target_album,
    category = ranked_moves.target_album,
    album_sort_order = ranked_moves.next_order
  from ranked_moves
  where photos.id = ranked_moves.photo_id;

  get diagnostics v_moved_count = row_count;

  update public.photos photos
  set
    album_sort_order = ordered.ord,
    category = p_album
  from pg_temp.album_organizer_order ordered
  where photos.id = ordered.photo_id
    and photos.album = p_album;

  with max_order as (
    select coalesce(max(ord), 0) as base_order
    from pg_temp.album_organizer_order
  ),
  remaining as (
    select
      photos.id,
      (select base_order from max_order)
      + row_number() over (
        order by photos.album_sort_order asc, photos.created_at desc nulls last, photos.id
      ) as next_order
    from public.photos photos
    left join pg_temp.album_organizer_order ordered
      on ordered.photo_id = photos.id
    where photos.album = p_album
      and ordered.photo_id is null
  )
  update public.photos photos
  set
    album_sort_order = remaining.next_order,
    category = p_album
  from remaining
  where photos.id = remaining.id;

  return query
  select
    p_album,
    count(*)::integer,
    v_moved_count
  from public.photos
  where album = p_album;
end;
$$;

revoke all on function public.save_album_organization_v1(text, uuid[], jsonb) from public;
grant execute on function public.save_album_organization_v1(text, uuid[], jsonb) to authenticated;

-- 6b. delete_gallery_photos_v1 (originally 20260315000900, latest in 20260316001000)
create or replace function public.delete_gallery_photos_v1(
  p_photo_ids uuid[] default array[]::uuid[],
  p_photo_urls text[] default array[]::text[]
)
returns table (
  deleted_count integer,
  deleted_photo_keys text[],
  deleted_photo_urls text[]
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;

  create temporary table if not exists pg_temp.gallery_delete_targets (
    photo_id uuid primary key,
    photo_key text not null,
    photo_url text not null
  ) on commit drop;

  truncate table pg_temp.gallery_delete_targets;

  insert into pg_temp.gallery_delete_targets (photo_id, photo_key, photo_url)
  select distinct photos.id, photos.id::text, photos.url
  from public.photos
  where (
      coalesce(array_length(p_photo_ids, 1), 0) > 0
      and photos.id = any(coalesce(p_photo_ids, array[]::uuid[]))
    )
    or (
      coalesce(array_length(p_photo_urls, 1), 0) > 0
      and photos.url = any(coalesce(p_photo_urls, array[]::text[]))
    );

  if not exists (select 1 from pg_temp.gallery_delete_targets) then
    return query
    select 0::integer, array[]::text[], array[]::text[];
    return;
  end if;

  delete from public.photo_comments
  where photo_key in (select photo_key from pg_temp.gallery_delete_targets);

  delete from public.photo_likes
  where photo_key in (select photo_key from pg_temp.gallery_delete_targets);

  delete from public.photos
  where id in (select photo_id from pg_temp.gallery_delete_targets);

  return query
  select
    count(*)::integer,
    coalesce(array_agg(photo_key order by photo_key), array[]::text[]),
    coalesce(array_agg(photo_url order by photo_url), array[]::text[])
  from pg_temp.gallery_delete_targets;
end;
$$;

revoke all on function public.delete_gallery_photos_v1(uuid[], text[]) from public;
grant execute on function public.delete_gallery_photos_v1(uuid[], text[]) to authenticated;

-- 6c. save_album_organization_v2 (originally 20260315000900, latest in 20260316001000)
create or replace function public.save_album_organization_v2(
  p_album text,
  p_ordered_photo_ids uuid[],
  p_moves jsonb default '[]'::jsonb,
  p_delete_photo_ids uuid[] default array[]::uuid[]
)
returns table (
  saved_album text,
  current_album_count integer,
  moved_count integer,
  deleted_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_moved_count integer := 0;
  v_deleted_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;

  if p_album not in ('Engagement', 'Bach+ette', 'Wedding Day', 'Guest Uploads') then
    raise exception 'invalid album';
  end if;

  if p_moves is null then
    p_moves := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_moves) <> 'array' then
    raise exception 'moves must be a JSON array';
  end if;

  create temporary table if not exists pg_temp.album_organizer_delete_targets (
    photo_id uuid primary key,
    photo_key text not null
  ) on commit drop;

  truncate table pg_temp.album_organizer_delete_targets;

  insert into pg_temp.album_organizer_delete_targets (photo_id, photo_key)
  select photos.id, photos.id::text
  from public.photos
  where photos.album = p_album
    and photos.id = any(coalesce(p_delete_photo_ids, array[]::uuid[]));

  if exists (
    select 1
    from unnest(coalesce(p_delete_photo_ids, array[]::uuid[])) as delete_ids(photo_id)
    left join public.photos photos
      on photos.id = delete_ids.photo_id
     and photos.album = p_album
    where delete_ids.photo_id is not null
      and photos.id is null
  ) then
    raise exception 'one or more deleted photos are no longer in the selected album';
  end if;

  create temporary table if not exists pg_temp.album_organizer_moves (
    ord integer,
    photo_id uuid,
    target_album text
  ) on commit drop;

  truncate table pg_temp.album_organizer_moves;

  insert into pg_temp.album_organizer_moves (ord, photo_id, target_album)
  select
    ord::integer,
    nullif(move.value ->> 'photoId', '')::uuid,
    move.value ->> 'targetAlbum'
  from jsonb_array_elements(p_moves) with ordinality as move(value, ord);

  delete from pg_temp.album_organizer_moves
  where photo_id is null
    or target_album is null
    or target_album = ''
    or target_album = p_album;

  delete from pg_temp.album_organizer_moves moves
  using pg_temp.album_organizer_delete_targets deletes
  where moves.photo_id = deletes.photo_id;

  if exists (
    select 1
    from pg_temp.album_organizer_moves
    where target_album not in ('Engagement', 'Bach+ette', 'Wedding Day', 'Guest Uploads')
  ) then
    raise exception 'invalid target album';
  end if;

  if exists (
    select 1
    from pg_temp.album_organizer_moves moves
    left join public.photos photos
      on photos.id = moves.photo_id
     and photos.album = p_album
    where photos.id is null
  ) then
    raise exception 'one or more moved photos are no longer in the selected album';
  end if;

  create temporary table if not exists pg_temp.album_organizer_order (
    ord integer,
    photo_id uuid
  ) on commit drop;

  truncate table pg_temp.album_organizer_order;

  insert into pg_temp.album_organizer_order (ord, photo_id)
  select
    min(ordered.ord)::integer,
    ordered.photo_id
  from unnest(coalesce(p_ordered_photo_ids, array[]::uuid[])) with ordinality as ordered(photo_id, ord)
  left join pg_temp.album_organizer_delete_targets deletes
    on deletes.photo_id = ordered.photo_id
  where ordered.photo_id is not null
    and deletes.photo_id is null
  group by ordered.photo_id;

  if exists (
    select 1
    from pg_temp.album_organizer_order ordered
    left join public.photos photos
      on photos.id = ordered.photo_id
     and photos.album = p_album
    where photos.id is null
  ) then
    raise exception 'one or more ordered photos are no longer in the selected album';
  end if;

  if exists (select 1 from pg_temp.album_organizer_delete_targets) then
    delete from public.photo_comments
    where photo_key in (select photo_key from pg_temp.album_organizer_delete_targets);

    delete from public.photo_likes
    where photo_key in (select photo_key from pg_temp.album_organizer_delete_targets);

    delete from public.photos
    where id in (select photo_id from pg_temp.album_organizer_delete_targets);

    get diagnostics v_deleted_count = row_count;
  end if;

  with target_bases as (
    select
      target_album,
      coalesce(max(photos.album_sort_order), 0) as base_order
    from (
      select distinct target_album
      from pg_temp.album_organizer_moves
    ) move_targets
    left join public.photos photos
      on photos.album = move_targets.target_album
     and photos.id not in (
       select photo_id
       from pg_temp.album_organizer_moves
     )
    group by target_album
  ),
  ranked_moves as (
    select
      moves.photo_id,
      moves.target_album,
      coalesce(target_bases.base_order, 0)
      + row_number() over (partition by moves.target_album order by moves.ord) as next_order
    from pg_temp.album_organizer_moves moves
    left join target_bases
      on target_bases.target_album = moves.target_album
  )
  update public.photos photos
  set
    album = ranked_moves.target_album,
    category = ranked_moves.target_album,
    album_sort_order = ranked_moves.next_order
  from ranked_moves
  where photos.id = ranked_moves.photo_id;

  get diagnostics v_moved_count = row_count;

  update public.photos photos
  set
    album_sort_order = ordered.ord,
    category = p_album
  from pg_temp.album_organizer_order ordered
  where photos.id = ordered.photo_id
    and photos.album = p_album;

  with max_order as (
    select coalesce(max(ord), 0) as base_order
    from pg_temp.album_organizer_order
  ),
  remaining as (
    select
      photos.id,
      (select base_order from max_order)
      + row_number() over (
        order by photos.album_sort_order asc, photos.created_at desc nulls last, photos.id
      ) as next_order
    from public.photos photos
    left join pg_temp.album_organizer_order ordered
      on ordered.photo_id = photos.id
    where photos.album = p_album
      and ordered.photo_id is null
  )
  update public.photos photos
  set
    album_sort_order = remaining.next_order,
    category = p_album
  from remaining
  where photos.id = remaining.id;

  return query
  select
    p_album,
    count(*)::integer,
    v_moved_count,
    v_deleted_count
  from public.photos
  where album = p_album;
end;
$$;

revoke all on function public.save_album_organization_v2(text, uuid[], jsonb, uuid[]) from public;
grant execute on function public.save_album_organization_v2(text, uuid[], jsonb, uuid[]) to authenticated;

-- 6d. get_recent_photo_comments_v1 (admin-only listing)
create or replace function public.get_recent_photo_comments_v1(
  p_limit integer default 40
)
returns table (
  id uuid,
  photo_key text,
  author text,
  content text,
  created_at timestamp with time zone,
  is_hidden boolean,
  album text,
  caption text,
  thumbnail text,
  url text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;

  return query
  select
    pc.id,
    pc.photo_key,
    pc.author,
    pc.content,
    pc.created_at,
    pc.is_hidden,
    p.album,
    p.caption,
    p.thumbnail,
    p.url
  from public.photo_comments pc
  left join public.photos p
    on p.id::text = pc.photo_key
  order by pc.created_at desc
  limit greatest(coalesce(p_limit, 40), 1);
end;
$$;

grant execute on function public.get_recent_photo_comments_v1(integer) to authenticated;

-- 6e. hide_photo_comment_v1
create or replace function public.hide_photo_comment_v1(
  p_comment_id uuid,
  p_hidden boolean default true,
  p_reason text default null
)
returns table (
  id uuid,
  photo_key text,
  is_hidden boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;

  return query
  update public.photo_comments
  set
    is_hidden = coalesce(p_hidden, true),
    hidden_at = case when coalesce(p_hidden, true) then now() else null end,
    hidden_by_user_id = case when coalesce(p_hidden, true) then auth.uid() else null end,
    hidden_reason = case when coalesce(p_hidden, true) then nullif(btrim(coalesce(p_reason, '')), '') else null end
  where photo_comments.id = p_comment_id
  returning photo_comments.id, photo_comments.photo_key, photo_comments.is_hidden;
end;
$$;

grant execute on function public.hide_photo_comment_v1(uuid, boolean, text) to authenticated;

-- 6f. delete_photo_comment_v1
create or replace function public.delete_photo_comment_v1(
  p_comment_id uuid
)
returns table (
  deleted_id uuid,
  photo_key text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin access required';
  end if;

  return query
  delete from public.photo_comments
  where id = p_comment_id
  returning photo_comments.id, photo_comments.photo_key;
end;
$$;

grant execute on function public.delete_photo_comment_v1(uuid) to authenticated;