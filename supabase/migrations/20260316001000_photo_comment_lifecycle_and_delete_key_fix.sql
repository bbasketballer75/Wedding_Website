alter table public.photo_comments
  add column if not exists session_id text,
  add column if not exists is_hidden boolean not null default false,
  add column if not exists hidden_at timestamp with time zone,
  add column if not exists hidden_by_user_id uuid,
  add column if not exists hidden_reason text;

create index if not exists idx_photo_comments_photo_key_visible
  on public.photo_comments(photo_key, is_hidden, created_at desc);

drop policy if exists "Allow public read photo comments" on public.photo_comments;
create policy "Allow public read photo comments" on public.photo_comments
  for select using (coalesce(is_hidden, false) = false);

drop policy if exists "Allow public insert photo comments" on public.photo_comments;

create or replace function public.get_photo_engagement_summary_v1(
  p_photo_keys text[]
)
returns table (
  photo_key text,
  likes_count bigint,
  comments_count bigint,
  hidden_comments_count bigint
)
language sql
security definer
set search_path = public
as $$
  with requested_keys as (
    select unnest(coalesce(p_photo_keys, array[]::text[])) as photo_key
  ),
  like_totals as (
    select
      pl.photo_key,
      count(*)::bigint as likes_count
    from public.photo_likes pl
    where pl.photo_key = any(coalesce(p_photo_keys, array[]::text[]))
    group by pl.photo_key
  ),
  comment_totals as (
    select
      pc.photo_key,
      count(*) filter (where coalesce(pc.is_hidden, false) = false)::bigint as comments_count,
      count(*) filter (where coalesce(pc.is_hidden, false) = true)::bigint as hidden_comments_count
    from public.photo_comments pc
    where pc.photo_key = any(coalesce(p_photo_keys, array[]::text[]))
    group by pc.photo_key
  )
  select
    rk.photo_key,
    coalesce(lt.likes_count, 0)::bigint as likes_count,
    coalesce(ct.comments_count, 0)::bigint as comments_count,
    coalesce(ct.hidden_comments_count, 0)::bigint as hidden_comments_count
  from requested_keys rk
  left join like_totals lt on lt.photo_key = rk.photo_key
  left join comment_totals ct on ct.photo_key = rk.photo_key;
$$;

grant execute on function public.get_photo_engagement_summary_v1(text[]) to anon, authenticated;

create or replace function public.create_photo_comment_v1(
  p_photo_key text,
  p_author text,
  p_content text,
  p_session_id text
)
returns table (
  id uuid,
  photo_key text,
  author text,
  content text,
  created_at timestamp with time zone,
  is_hidden boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author text := btrim(coalesce(p_author, ''));
  v_content text := btrim(coalesce(p_content, ''));
  v_session_id text := btrim(coalesce(p_session_id, ''));
  v_recent_count integer := 0;
begin
  if btrim(coalesce(p_photo_key, '')) = '' then
    raise exception 'photo_key is required';
  end if;

  if v_author = '' then
    raise exception 'author is required';
  end if;

  if char_length(v_author) > 60 then
    raise exception 'author is too long';
  end if;

  if v_content = '' then
    raise exception 'content is required';
  end if;

  if char_length(v_content) > 1000 then
    raise exception 'content is too long';
  end if;

  if v_session_id = '' then
    raise exception 'session_id is required';
  end if;

  select count(*)::integer
  into v_recent_count
  from public.photo_comments
  where session_id = v_session_id
    and created_at >= now() - interval '10 minutes';

  if v_recent_count >= 5 then
    raise exception 'comment rate limit exceeded';
  end if;

  return query
  insert into public.photo_comments (
    photo_key,
    author,
    content,
    session_id,
    is_hidden
  )
  values (
    p_photo_key,
    v_author,
    v_content,
    v_session_id,
    false
  )
  returning
    photo_comments.id,
    photo_comments.photo_key,
    photo_comments.author,
    photo_comments.content,
    photo_comments.created_at,
    photo_comments.is_hidden;
end;
$$;

grant execute on function public.create_photo_comment_v1(text, text, text, text) to anon, authenticated;

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
declare
  v_role text := coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '');
begin
  if v_role <> 'admin' then
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
declare
  v_role text := coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '');
begin
  if v_role <> 'admin' then
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
declare
  v_role text := coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '');
begin
  if v_role <> 'admin' then
    raise exception 'admin access required';
  end if;

  return query
  delete from public.photo_comments
  where id = p_comment_id
  returning photo_comments.id, photo_comments.photo_key;
end;
$$;

grant execute on function public.delete_photo_comment_v1(uuid) to authenticated;

drop function if exists public.delete_gallery_photos_v1(uuid[], text[]);

create function public.delete_gallery_photos_v1(
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
declare
  v_role text := coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '');
begin
  if v_role <> 'admin' then
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
  v_role text := coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '');
  v_moved_count integer := 0;
  v_deleted_count integer := 0;
begin
  if v_role <> 'admin' then
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
