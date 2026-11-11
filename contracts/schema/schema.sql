


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."check_rate_limit"("p_ip_address" "text", "p_action" "text", "p_max_requests" integer DEFAULT 5, "p_window_minutes" integer DEFAULT 1) RETURNS TABLE("allowed" boolean, "remaining" integer, "reset_after_seconds" integer, "current_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_count integer;
  v_window_start timestamp with time zone;
  v_reset_after integer;
BEGIN
  -- Calculate window start
  v_window_start := date_trunc('minute', now()) 
    - interval '1 minute' * (extract(minute from now())::int % p_window_minutes);
  
  -- Get current count for this IP/action/window
  SELECT COALESCE(request_count, 0)
  INTO v_count
  FROM rate_limit_logs
  WHERE ip_address = p_ip_address
    AND action = p_action
    AND window_start = v_window_start
  FOR UPDATE SKIP LOCKED;
  
  -- If no record exists, count is 0
  IF v_count IS NULL THEN
    v_count := 0;
  END IF;
  
  -- Calculate reset time (seconds until next window)
  v_reset_after := (p_window_minutes * 60) - 
    (extract(epoch from (now() - v_window_start))::int % (p_window_minutes * 60));
  
  -- Return rate limit status
  RETURN QUERY SELECT
    v_count < p_max_requests,  -- allowed
    GREATEST(0, p_max_requests - v_count - 1),  -- remaining (minus 1 for current request)
    v_reset_after,  -- reset_after_seconds
    v_count;  -- current_count
END;
$$;


ALTER FUNCTION "public"."check_rate_limit"("p_ip_address" "text", "p_action" "text", "p_max_requests" integer, "p_window_minutes" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_rate_limit"("p_ip_address" "text", "p_action" "text", "p_max_requests" integer, "p_window_minutes" integer) IS 'Checks if a request is within rate limits';



CREATE OR REPLACE FUNCTION "public"."cleanup_old_rate_limits"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM rate_limit_logs
  WHERE window_start < now() - interval '1 hour';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_rate_limits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_photo_comment_v1"("p_photo_key" "text", "p_author" "text", "p_content" "text", "p_session_id" "text") RETURNS TABLE("id" "uuid", "photo_key" "text", "author" "text", "content" "text", "created_at" timestamp with time zone, "is_hidden" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."create_photo_comment_v1"("p_photo_key" "text", "p_author" "text", "p_content" "text", "p_session_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_gallery_photos_v1"("p_photo_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[], "p_photo_urls" "text"[] DEFAULT ARRAY[]::"text"[]) RETURNS TABLE("deleted_count" integer, "deleted_photo_keys" "text"[], "deleted_photo_urls" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."delete_gallery_photos_v1"("p_photo_ids" "uuid"[], "p_photo_urls" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_photo_comment_v1"("p_comment_id" "uuid") RETURNS TABLE("deleted_id" "uuid", "photo_key" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."delete_photo_comment_v1"("p_comment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."demote_from_admin"("target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'auth', 'public'
    AS $$
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  update auth.users
  set raw_app_meta_data = raw_app_meta_data - 'role'
  where id = target_user_id;
end;
$$;


ALTER FUNCTION "public"."demote_from_admin"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_guestbook_messages_with_comments"() RETURNS TABLE("id" "uuid", "name" "text", "email" "text", "content" "text", "media_url" "text", "reactions" "jsonb", "created_at" timestamp with time zone, "comments" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    gm.id,
    gm.name,
    gm.email,
    gm.content,
    gm.media_url,
    gm.reactions,
    gm.created_at,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', gc.id,
          'author', gc.author,
          'content', gc.content,
          'created_at', gc.created_at
        ) ORDER BY gc.created_at
      ) FILTER (WHERE gc.id IS NOT NULL),
      '[]'::jsonb
    ) as comments
  FROM guestbook_messages gm
  LEFT JOIN guestbook_comments gc ON gc.message_id = gm.id
  GROUP BY gm.id, gm.name, gm.email, gm.content, gm.media_url, gm.reactions, gm.created_at
  ORDER BY gm.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_guestbook_messages_with_comments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_photo_engagement_summary_v1"("p_photo_keys" "text"[]) RETURNS TABLE("photo_key" "text", "likes_count" bigint, "comments_count" bigint, "hidden_comments_count" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."get_photo_engagement_summary_v1"("p_photo_keys" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_photo_like_statuses"("p_photo_keys" "text"[], "p_session_id" "text") RETURNS TABLE("photo_key" "text", "likes_count" bigint, "liked" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with requested_keys as (
    select unnest(coalesce(p_photo_keys, array[]::text[])) as photo_key
  ),
  like_totals as (
    select
      pl.photo_key,
      count(*)::bigint as likes_count
    from photo_likes pl
    where pl.photo_key = any(coalesce(p_photo_keys, array[]::text[]))
    group by pl.photo_key
  )
  select
    rk.photo_key,
    coalesce(lt.likes_count, 0)::bigint as likes_count,
    exists(
      select 1
      from photo_likes mine
      where mine.photo_key = rk.photo_key
        and mine.session_id = p_session_id
    ) as liked
  from requested_keys rk
  left join like_totals lt on lt.photo_key = rk.photo_key;
$$;


ALTER FUNCTION "public"."get_photo_like_statuses"("p_photo_keys" "text"[], "p_session_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_recent_photo_comments_v1"("p_limit" integer DEFAULT 40) RETURNS TABLE("id" "uuid", "photo_key" "text", "author" "text", "content" "text", "created_at" timestamp with time zone, "is_hidden" boolean, "album" "text", "caption" "text", "thumbnail" "text", "url" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."get_recent_photo_comments_v1"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hide_photo_comment_v1"("p_comment_id" "uuid", "p_hidden" boolean DEFAULT true, "p_reason" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "photo_key" "text", "is_hidden" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."hide_photo_comment_v1"("p_comment_id" "uuid", "p_hidden" boolean, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_rate_limit"("p_ip_address" "text", "p_action" "text", "p_window_minutes" integer DEFAULT 1) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_window_start timestamp with time zone;
BEGIN
  -- Calculate window start (same logic as check)
  v_window_start := date_trunc('minute', now()) 
    - interval '1 minute' * (extract(minute from now())::int % p_window_minutes);
  
  -- Insert or update the rate limit log
  INSERT INTO rate_limit_logs (ip_address, action, window_start, request_count)
  VALUES (p_ip_address, p_action, v_window_start, 1)
  ON CONFLICT (ip_address, action, window_start)
  DO UPDATE SET 
    request_count = rate_limit_logs.request_count + 1,
    created_at = now();
END;
$$;


ALTER FUNCTION "public"."increment_rate_limit"("p_ip_address" "text", "p_action" "text", "p_window_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."promote_to_admin"("target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'auth', 'public'
    AS $$
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


ALTER FUNCTION "public"."promote_to_admin"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_album_organization_v1"("p_album" "text", "p_ordered_photo_ids" "uuid"[], "p_moves" "jsonb" DEFAULT '[]'::"jsonb") RETURNS TABLE("saved_album" "text", "current_album_count" integer, "moved_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."save_album_organization_v1"("p_album" "text", "p_ordered_photo_ids" "uuid"[], "p_moves" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_album_organization_v2"("p_album" "text", "p_ordered_photo_ids" "uuid"[], "p_moves" "jsonb" DEFAULT '[]'::"jsonb", "p_delete_photo_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[]) RETURNS TABLE("saved_album" "text", "current_album_count" integer, "moved_count" integer, "deleted_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."save_album_organization_v2"("p_album" "text", "p_ordered_photo_ids" "uuid"[], "p_moves" "jsonb", "p_delete_photo_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_guestbook_message_with_rate_limit"("p_name" "text", "p_email" "text", "p_content" "text", "p_type" "text" DEFAULT 'text'::"text", "p_media_url" "text" DEFAULT NULL::"text", "p_max_requests" integer DEFAULT 3, "p_window_minutes" integer DEFAULT 1) RETURNS TABLE("success" boolean, "message_id" "uuid", "error_message" "text", "rate_limit_remaining" integer, "rate_limit_reset_after" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_ip_address text;
  v_rate_check record;
  v_message_id uuid;
BEGIN
  -- Get client IP address
  v_ip_address := coalesce(
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'x-real-ip',
    'unknown'
  );
  
  -- Check rate limit
  SELECT * INTO v_rate_check
  FROM check_rate_limit(v_ip_address, 'guestbook_submit', p_max_requests, p_window_minutes);
  
  -- If rate limited, return error
  IF NOT v_rate_check.allowed THEN
    RETURN QUERY SELECT
      false,
      null::uuid,
      format('Rate limit exceeded. Please wait %s seconds before submitting another message.', 
             v_rate_check.reset_after_seconds),
      0,
      v_rate_check.reset_after_seconds;
    RETURN;
  END IF;
  
  -- Increment rate limit counter
  PERFORM increment_rate_limit(v_ip_address, 'guestbook_submit', p_window_minutes);
  
  -- Insert the message
  INSERT INTO guestbook_messages (
    name,
    email,
    content,
    type,
    media_url,
    ip_address,
    reactions
  ) VALUES (
    p_name,
    p_email,
    p_content,
    p_type,
    p_media_url,
    v_ip_address,
    '{}'::jsonb
  )
  RETURNING id INTO v_message_id;
  
  -- Return success
  RETURN QUERY SELECT
    true,
    v_message_id,
    null::text,
    v_rate_check.remaining,
    v_rate_check.reset_after_seconds;
END;
$$;


ALTER FUNCTION "public"."submit_guestbook_message_with_rate_limit"("p_name" "text", "p_email" "text", "p_content" "text", "p_type" "text", "p_media_url" "text", "p_max_requests" integer, "p_window_minutes" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."submit_guestbook_message_with_rate_limit"("p_name" "text", "p_email" "text", "p_content" "text", "p_type" "text", "p_media_url" "text", "p_max_requests" integer, "p_window_minutes" integer) IS 'Submits guestbook message with rate limiting enforcement';



CREATE OR REPLACE FUNCTION "public"."toggle_photo_like"("p_photo_key" "text", "p_session_id" "text") RETURNS TABLE("photo_key" "text", "likes_count" bigint, "liked" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  already_liked boolean;
  result_likes_count bigint;
  result_liked boolean;
begin
  if p_photo_key is null or btrim(p_photo_key) = '' then
    raise exception 'photo_key is required';
  end if;

  if p_session_id is null or btrim(p_session_id) = '' then
    raise exception 'session_id is required';
  end if;

  select exists(
    select 1
    from photo_likes existing_like
    where existing_like.photo_key = p_photo_key
      and existing_like.session_id = p_session_id
  )
  into already_liked;

  if already_liked then
    delete from photo_likes like_to_delete
    where like_to_delete.photo_key = p_photo_key
      and like_to_delete.session_id = p_session_id;
  else
    insert into photo_likes (photo_key, session_id)
    values (p_photo_key, p_session_id)
    on conflict (photo_key, session_id) do nothing;
  end if;

  select
    count(*)::bigint,
    exists(
      select 1
      from photo_likes my_like
      where my_like.photo_key = p_photo_key
        and my_like.session_id = p_session_id
    )
  into result_likes_count, result_liked
  from photo_likes liked_rows
  where liked_rows.photo_key = p_photo_key;

  return query select p_photo_key, result_likes_count, result_liked;
end;
$$;


ALTER FUNCTION "public"."toggle_photo_like"("p_photo_key" "text", "p_session_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_photo_like_v2"("p_photo_key" "text", "p_session_id" "text") RETURNS TABLE("result_photo_key" "text", "result_likes_count" bigint, "result_liked" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  already_liked boolean;
  likes_total bigint;
  liked_now boolean;
begin
  if p_photo_key is null or btrim(p_photo_key) = '' then
    raise exception 'photo_key is required';
  end if;

  if p_session_id is null or btrim(p_session_id) = '' then
    raise exception 'session_id is required';
  end if;

  select exists(
    select 1
    from photo_likes existing_like
    where existing_like.photo_key = p_photo_key
      and existing_like.session_id = p_session_id
  )
  into already_liked;

  if already_liked then
    delete from photo_likes like_to_delete
    where like_to_delete.photo_key = p_photo_key
      and like_to_delete.session_id = p_session_id;
  else
    insert into photo_likes (photo_key, session_id)
    values (p_photo_key, p_session_id)
    on conflict (photo_key, session_id) do nothing;
  end if;

  select
    count(*)::bigint,
    exists(
      select 1
      from photo_likes my_like
      where my_like.photo_key = p_photo_key
        and my_like.session_id = p_session_id
    )
  into likes_total, liked_now
  from photo_likes liked_rows
  where liked_rows.photo_key = p_photo_key;

  return query select p_photo_key, likes_total, liked_now;
end;
$$;


ALTER FUNCTION "public"."toggle_photo_like_v2"("p_photo_key" "text", "p_session_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_activity_log_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Handle guest_uploads: only fire when status = 'approved'
  IF TG_TABLE_NAME = 'guest_uploads' THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO activity_log (type, source_id, source_type, display_name, thumbnail_url)
      VALUES ('photo_upload', NEW.id, 'guest_uploads', NEW.guest_name, NEW.photo_urls[1]);
    END IF;

  -- Handle guestbook_messages: fire on every insert
  ELSIF TG_TABLE_NAME = 'guestbook_messages' THEN
    INSERT INTO activity_log (type, source_id, source_type, display_name, thumbnail_url, content_preview)
    VALUES ('guestbook_entry', NEW.id, 'guestbook_messages', NEW.name, NEW.media_url, LEFT(NEW.content, 100));

  -- Handle site_editorial_features: only fire when is_active = true
  ELSIF TG_TABLE_NAME = 'site_editorial_features' THEN
    IF NEW.is_active = true THEN
      INSERT INTO activity_log (type, source_id, source_type, display_name, thumbnail_url)
      VALUES ('featured_moment', NEW.id, 'site_editorial_features', NEW.title, NEW.source_url);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_activity_log_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_auth_user_metadata"("uid" "uuid", "metadata" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'auth', 'public'
    AS $$
begin
  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) || coalesce(metadata, '{}'::jsonb)
  where id = uid;
end;
$$;


ALTER FUNCTION "public"."update_auth_user_metadata"("uid" "uuid", "metadata" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "source_id" "text" NOT NULL,
    "source_type" "text" NOT NULL,
    "display_name" "text",
    "thumbnail_url" "text",
    "content_preview" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "activity_log_source_type_check" CHECK (("source_type" = ANY (ARRAY['guest_uploads'::"text", 'guestbook_messages'::"text", 'site_editorial_features'::"text"]))),
    CONSTRAINT "activity_log_type_check" CHECK (("type" = ANY (ARRAY['photo_upload'::"text", 'guestbook_entry'::"text", 'featured_moment'::"text"])))
);


ALTER TABLE "public"."activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guest_face_tagging_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "status" "text" DEFAULT 'prepared'::"text" NOT NULL,
    "exportable_upload_count" integer DEFAULT 0 NOT NULL,
    "exportable_photo_count" integer DEFAULT 0 NOT NULL,
    "synced_photo_count" integer DEFAULT 0 NOT NULL,
    "skipped_photo_count" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by_user_id" "uuid",
    "created_by_email" "text",
    "synced_by_user_id" "uuid",
    "synced_by_email" "text",
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "guest_face_tagging_batches_status_check" CHECK (("status" = ANY (ARRAY['prepared'::"text", 'synced'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."guest_face_tagging_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guest_identities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "session_id" "text",
    "display_name" "text" NOT NULL,
    "is_verified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."guest_identities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guest_share_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guest_email" "text" NOT NULL,
    "token" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."guest_share_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guest_uploads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guest_name" "text" NOT NULL,
    "guest_email" "text" NOT NULL,
    "message" "text",
    "photo_urls" "text"[] DEFAULT '{}'::"text"[],
    "video_urls" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "video_visibility" "text" DEFAULT 'archive_only'::"text" NOT NULL,
    "memory_trail" "text",
    "editorial_title" "text",
    "editorial_summary" "text",
    "featured_rank" integer,
    "photo_fingerprints" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "video_fingerprints" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "rejection_reason" "text",
    CONSTRAINT "guest_uploads_memory_trail_check" CHECK ((("memory_trail" IS NULL) OR ("memory_trail" = ANY (ARRAY['ceremony'::"text", 'family'::"text", 'dance-floor'::"text", 'engagement-season'::"text", 'bach-ette'::"text"])))),
    CONSTRAINT "guest_uploads_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "guest_uploads_video_visibility_check" CHECK (("video_visibility" = ANY (ARRAY['archive_only'::"text", 'guest_highlights'::"text", 'featured'::"text"])))
);


ALTER TABLE "public"."guest_uploads" OWNER TO "postgres";


COMMENT ON COLUMN "public"."guest_uploads"."rejection_reason" IS 'Optional reason shown to guest when upload is rejected';



CREATE TABLE IF NOT EXISTS "public"."guestbook_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "author" "text" DEFAULT 'Guest'::"text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."guestbook_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guestbook_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "content" "text" NOT NULL,
    "media_url" "text",
    "reactions" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "ip_address" "text",
    "rate_limited" boolean DEFAULT false
);


ALTER TABLE "public"."guestbook_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_review_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "source_root" "text",
    "working_root" "text",
    "artifact_bucket" "text" DEFAULT 'media-review-artifacts'::"text" NOT NULL,
    "artifact_prefix" "text" NOT NULL,
    "artifact_paths" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "notes" "text",
    "cluster_count" integer DEFAULT 0 NOT NULL,
    "detection_count" integer DEFAULT 0 NOT NULL,
    "pushed_by_user_id" "uuid",
    "pushed_by_email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "media_review_batches_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_review'::"text", 'approved'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."media_review_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_review_clusters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "cluster_id" "text" NOT NULL,
    "review_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "confirmed_name" "text",
    "merge_into_cluster_id" "text",
    "split_requested" boolean DEFAULT false NOT NULL,
    "split_notes" "text",
    "sample_thumbnail_path" "text",
    "member_count" integer DEFAULT 0 NOT NULL,
    "average_quality_score" numeric,
    "source_record_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "members" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "media_review_clusters_review_status_check" CHECK (("review_status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'ignored'::"text", 'merged'::"text", 'split_requested'::"text"])))
);


ALTER TABLE "public"."media_review_clusters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_review_faces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "face_id" "text" NOT NULL,
    "cluster_id" "text",
    "source_record_id" "text",
    "source_relative_path" "text",
    "photo_url" "text",
    "thumbnail_url" "text",
    "thumbnail_object_path" "text",
    "x" numeric DEFAULT 0 NOT NULL,
    "y" numeric DEFAULT 0 NOT NULL,
    "box" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "quality_score" numeric,
    "review_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "confirmed_name" "text",
    "person_key" "text",
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "media_review_faces_review_status_check" CHECK (("review_status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'ignored'::"text"])))
);


ALTER TABLE "public"."media_review_faces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."moderation_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "actor_user_id" "uuid",
    "actor_email" "text",
    "actor_name" "text",
    "from_status" "text",
    "to_status" "text",
    "summary" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "moderation_audit_log_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['guest_upload'::"text", 'guestbook_message'::"text", 'photo_claim'::"text"])))
);


ALTER TABLE "public"."moderation_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."photo_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guest_identity_id" "uuid" NOT NULL,
    "photo_id" "uuid",
    "face_id" "uuid",
    "claim_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "photo_claims_claim_type_check" CHECK (("claim_type" = ANY (ARRAY['upload'::"text", 'face'::"text"]))),
    CONSTRAINT "photo_claims_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."photo_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."photo_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "photo_key" "text" NOT NULL,
    "author" "text" DEFAULT 'Guest'::"text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "session_id" "text",
    "is_hidden" boolean DEFAULT false NOT NULL,
    "hidden_at" timestamp with time zone,
    "hidden_by_user_id" "uuid",
    "hidden_reason" "text",
    CONSTRAINT "photo_comments_content_check" CHECK ((("char_length"("btrim"("content")) >= 1) AND ("char_length"("btrim"("content")) <= 1000)))
);


ALTER TABLE "public"."photo_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."photo_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "photo_key" "text" NOT NULL,
    "session_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."photo_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "url" "text" NOT NULL,
    "thumbnail" "text" NOT NULL,
    "caption" "text",
    "category" "text" DEFAULT 'Uncategorized'::"text",
    "location" "text",
    "date" timestamp with time zone DEFAULT "now"(),
    "likes" integer DEFAULT 0,
    "photographer" "text",
    "is_professional" boolean DEFAULT false,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "faces" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "album" "text",
    "album_sort_order" integer DEFAULT 0 NOT NULL,
    "download_url" "text",
    CONSTRAINT "photos_album_check" CHECK ((("album" IS NULL) OR ("album" = ANY (ARRAY['Engagement'::"text", 'Bach+ette'::"text", 'Wedding Day'::"text", 'Guest Uploads'::"text"]))))
);


ALTER TABLE "public"."photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ip_address" "text" NOT NULL,
    "action" "text" NOT NULL,
    "request_count" integer DEFAULT 1,
    "window_start" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rate_limit_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."rate_limit_logs" IS 'Tracks API request rates per IP for rate limiting';



CREATE TABLE IF NOT EXISTS "public"."site_editorial_feature_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slot" "text" NOT NULL,
    "feature_id" "uuid",
    "actor_user_id" "uuid",
    "actor_email" "text",
    "actor_name" "text",
    "change_summary" "text" NOT NULL,
    "previous_feature" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "next_feature" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "site_editorial_feature_history_slot_check" CHECK (("slot" = ANY (ARRAY['home_newest_standout_upload'::"text", 'home_featured_guestbook_note'::"text", 'home_moment_of_the_week'::"text", 'film_featured_guest_video'::"text"])))
);


ALTER TABLE "public"."site_editorial_feature_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_editorial_features" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slot" "text" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text",
    "trail" "text",
    "source_type" "text" NOT NULL,
    "source_id" "text",
    "source_label" "text",
    "source_url" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_by_user_id" "uuid",
    "updated_by_email" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "memory_trail" "text",
    "badge_label" "text",
    "cta_label" "text",
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    CONSTRAINT "site_editorial_features_memory_trail_check" CHECK ((("memory_trail" IS NULL) OR ("memory_trail" = ANY (ARRAY['ceremony'::"text", 'family'::"text", 'dance-floor'::"text", 'engagement-season'::"text", 'bach-ette'::"text"])))),
    CONSTRAINT "site_editorial_features_schedule_window_check" CHECK ((("starts_at" IS NULL) OR ("ends_at" IS NULL) OR ("starts_at" <= "ends_at"))),
    CONSTRAINT "site_editorial_features_slot_check" CHECK (("slot" = ANY (ARRAY['home_newest_standout_upload'::"text", 'home_featured_guestbook_note'::"text", 'home_moment_of_the_week'::"text", 'film_featured_guest_video'::"text"]))),
    CONSTRAINT "site_editorial_features_source_type_check" CHECK (("source_type" = ANY (ARRAY['guest_upload'::"text", 'guestbook_message'::"text", 'film_chapter'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."site_editorial_features" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guest_face_tagging_batches"
    ADD CONSTRAINT "guest_face_tagging_batches_batch_key_key" UNIQUE ("batch_key");



ALTER TABLE ONLY "public"."guest_face_tagging_batches"
    ADD CONSTRAINT "guest_face_tagging_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guest_identities"
    ADD CONSTRAINT "guest_identities_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."guest_identities"
    ADD CONSTRAINT "guest_identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guest_share_tokens"
    ADD CONSTRAINT "guest_share_tokens_guest_email_key" UNIQUE ("guest_email");



ALTER TABLE ONLY "public"."guest_share_tokens"
    ADD CONSTRAINT "guest_share_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guest_share_tokens"
    ADD CONSTRAINT "guest_share_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."guest_uploads"
    ADD CONSTRAINT "guest_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guestbook_comments"
    ADD CONSTRAINT "guestbook_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guestbook_messages"
    ADD CONSTRAINT "guestbook_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_review_batches"
    ADD CONSTRAINT "media_review_batches_batch_key_key" UNIQUE ("batch_key");



ALTER TABLE ONLY "public"."media_review_batches"
    ADD CONSTRAINT "media_review_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_review_clusters"
    ADD CONSTRAINT "media_review_clusters_batch_id_cluster_id_key" UNIQUE ("batch_id", "cluster_id");



ALTER TABLE ONLY "public"."media_review_clusters"
    ADD CONSTRAINT "media_review_clusters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_review_faces"
    ADD CONSTRAINT "media_review_faces_batch_id_face_id_key" UNIQUE ("batch_id", "face_id");



ALTER TABLE ONLY "public"."media_review_faces"
    ADD CONSTRAINT "media_review_faces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."moderation_audit_log"
    ADD CONSTRAINT "moderation_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."photo_claims"
    ADD CONSTRAINT "photo_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."photo_comments"
    ADD CONSTRAINT "photo_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."photo_likes"
    ADD CONSTRAINT "photo_likes_photo_key_session_id_key" UNIQUE ("photo_key", "session_id");



ALTER TABLE ONLY "public"."photo_likes"
    ADD CONSTRAINT "photo_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."photos"
    ADD CONSTRAINT "photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_limit_logs"
    ADD CONSTRAINT "rate_limit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_editorial_feature_history"
    ADD CONSTRAINT "site_editorial_feature_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_editorial_features"
    ADD CONSTRAINT "site_editorial_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_editorial_features"
    ADD CONSTRAINT "site_editorial_features_slot_key" UNIQUE ("slot");



ALTER TABLE ONLY "public"."photo_claims"
    ADD CONSTRAINT "unique_identity_face" UNIQUE ("guest_identity_id", "face_id");



ALTER TABLE ONLY "public"."photo_claims"
    ADD CONSTRAINT "unique_identity_photo" UNIQUE ("guest_identity_id", "photo_id");



ALTER TABLE ONLY "public"."rate_limit_logs"
    ADD CONSTRAINT "unique_ip_action_window" UNIQUE ("ip_address", "action", "window_start");



CREATE INDEX "idx_activity_log_created_at" ON "public"."activity_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_guest_face_tagging_batches_status" ON "public"."guest_face_tagging_batches" USING "btree" ("status", "updated_at" DESC);



CREATE INDEX "idx_guest_face_tagging_batches_updated_at" ON "public"."guest_face_tagging_batches" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_guest_identities_email" ON "public"."guest_identities" USING "btree" ("email");



CREATE INDEX "idx_guest_share_tokens_email" ON "public"."guest_share_tokens" USING "btree" ("guest_email");



CREATE INDEX "idx_guest_share_tokens_token" ON "public"."guest_share_tokens" USING "btree" ("token");



CREATE INDEX "idx_guest_uploads_created_at" ON "public"."guest_uploads" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_guest_uploads_memory_trail_created_at" ON "public"."guest_uploads" USING "btree" ("memory_trail", "created_at" DESC);



CREATE INDEX "idx_guest_uploads_status" ON "public"."guest_uploads" USING "btree" ("status");



CREATE INDEX "idx_guest_uploads_video_visibility_created_at" ON "public"."guest_uploads" USING "btree" ("video_visibility", "created_at" DESC);



CREATE INDEX "idx_guestbook_comments_created_at" ON "public"."guestbook_comments" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_guestbook_comments_message_id" ON "public"."guestbook_comments" USING "btree" ("message_id");



CREATE INDEX "idx_guestbook_created_at" ON "public"."guestbook_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_guestbook_messages_ip" ON "public"."guestbook_messages" USING "btree" ("ip_address") WHERE ("ip_address" IS NOT NULL);



CREATE INDEX "idx_media_review_batches_status_updated_at" ON "public"."media_review_batches" USING "btree" ("status", "updated_at" DESC);



CREATE INDEX "idx_media_review_clusters_batch_status" ON "public"."media_review_clusters" USING "btree" ("batch_id", "review_status", "updated_at" DESC);



CREATE INDEX "idx_media_review_clusters_confirmed_name" ON "public"."media_review_clusters" USING "btree" ("confirmed_name");



CREATE INDEX "idx_media_review_faces_batch_person" ON "public"."media_review_faces" USING "btree" ("batch_id", "person_key");



CREATE INDEX "idx_media_review_faces_batch_source" ON "public"."media_review_faces" USING "btree" ("batch_id", "source_record_id");



CREATE INDEX "idx_media_review_faces_batch_status" ON "public"."media_review_faces" USING "btree" ("batch_id", "review_status", "updated_at" DESC);



CREATE INDEX "idx_photo_claims_face_id" ON "public"."photo_claims" USING "btree" ("face_id");



CREATE INDEX "idx_photo_claims_guest_identity" ON "public"."photo_claims" USING "btree" ("guest_identity_id");



CREATE INDEX "idx_photo_claims_photo_id" ON "public"."photo_claims" USING "btree" ("photo_id");



CREATE INDEX "idx_photo_claims_status" ON "public"."photo_claims" USING "btree" ("status");



CREATE INDEX "idx_photo_comments_created_at" ON "public"."photo_comments" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_photo_comments_photo_key" ON "public"."photo_comments" USING "btree" ("photo_key");



CREATE INDEX "idx_photo_comments_photo_key_visible" ON "public"."photo_comments" USING "btree" ("photo_key", "is_hidden", "created_at" DESC);



CREATE INDEX "idx_photo_likes_created_at" ON "public"."photo_likes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_photo_likes_photo_key" ON "public"."photo_likes" USING "btree" ("photo_key");



CREATE INDEX "idx_photos_album_sort_order" ON "public"."photos" USING "btree" ("album", "album_sort_order", "created_at" DESC);



CREATE INDEX "idx_photos_category" ON "public"."photos" USING "btree" ("category");



CREATE INDEX "idx_photos_created_at" ON "public"."photos" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_rate_limit_logs_cleanup" ON "public"."rate_limit_logs" USING "btree" ("window_start" DESC);



CREATE INDEX "idx_rate_limit_logs_lookup" ON "public"."rate_limit_logs" USING "btree" ("ip_address", "action", "window_start");



CREATE INDEX "idx_site_editorial_feature_history_created_at" ON "public"."site_editorial_feature_history" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_site_editorial_feature_history_slot_created_at" ON "public"."site_editorial_feature_history" USING "btree" ("slot", "created_at" DESC);



CREATE INDEX "idx_site_editorial_features_active_order" ON "public"."site_editorial_features" USING "btree" ("is_active", "display_order", "updated_at" DESC);



CREATE INDEX "idx_site_editorial_features_slot" ON "public"."site_editorial_features" USING "btree" ("slot");



CREATE INDEX "moderation_audit_log_actor_created_idx" ON "public"."moderation_audit_log" USING "btree" ("actor_user_id", "created_at" DESC);



CREATE INDEX "moderation_audit_log_created_at_idx" ON "public"."moderation_audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "moderation_audit_log_entity_created_idx" ON "public"."moderation_audit_log" USING "btree" ("entity_type", "entity_id", "created_at" DESC);



CREATE OR REPLACE TRIGGER "guest_uploads_after_approve" AFTER UPDATE ON "public"."guest_uploads" FOR EACH ROW WHEN ((("new"."status" = 'approved'::"text") AND ("old"."status" IS DISTINCT FROM 'approved'::"text"))) EXECUTE FUNCTION "public"."trigger_activity_log_insert"();



CREATE OR REPLACE TRIGGER "guestbook_messages_after_insert" AFTER INSERT ON "public"."guestbook_messages" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_activity_log_insert"();



CREATE OR REPLACE TRIGGER "site_editorial_features_after_insert" AFTER INSERT ON "public"."site_editorial_features" FOR EACH ROW WHEN (("new"."is_active" = true)) EXECUTE FUNCTION "public"."trigger_activity_log_insert"();



ALTER TABLE ONLY "public"."guestbook_comments"
    ADD CONSTRAINT "guestbook_comments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."guestbook_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_review_clusters"
    ADD CONSTRAINT "media_review_clusters_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."media_review_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_review_faces"
    ADD CONSTRAINT "media_review_faces_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."media_review_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."photo_claims"
    ADD CONSTRAINT "photo_claims_face_id_fkey" FOREIGN KEY ("face_id") REFERENCES "public"."media_review_faces"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."photo_claims"
    ADD CONSTRAINT "photo_claims_guest_identity_id_fkey" FOREIGN KEY ("guest_identity_id") REFERENCES "public"."guest_identities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."photo_claims"
    ADD CONSTRAINT "photo_claims_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE CASCADE;



CREATE POLICY "Admin users manage guest face tagging batches" ON "public"."guest_face_tagging_batches" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin users manage media review batches" ON "public"."media_review_batches" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin users manage media review clusters" ON "public"."media_review_clusters" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin users manage media review faces" ON "public"."media_review_faces" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin users update photos" ON "public"."photos" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow admin full access on guest_identities" ON "public"."guest_identities" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow admin full access on guest_share_tokens" ON "public"."guest_share_tokens" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow admin full access on photo_claims" ON "public"."photo_claims" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated insert" ON "public"."photos" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated read all" ON "public"."guest_uploads" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated update" ON "public"."guest_uploads" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated update" ON "public"."guestbook_messages" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow public insert" ON "public"."guest_uploads" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert" ON "public"."guestbook_messages" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert comments" ON "public"."guestbook_comments" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert on guest_identities" ON "public"."guest_identities" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert on guest_share_tokens" ON "public"."guest_share_tokens" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert on photo_claims" ON "public"."photo_claims" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public read" ON "public"."guestbook_messages" FOR SELECT USING (true);



CREATE POLICY "Allow public read access" ON "public"."photos" FOR SELECT USING (true);



CREATE POLICY "Allow public read approved" ON "public"."guest_uploads" FOR SELECT USING (("status" = 'approved'::"text"));



CREATE POLICY "Allow public read comments" ON "public"."guestbook_comments" FOR SELECT USING (true);



CREATE POLICY "Allow public read on guest_identities" ON "public"."guest_identities" FOR SELECT USING (true);



CREATE POLICY "Allow public read on guest_share_tokens" ON "public"."guest_share_tokens" FOR SELECT USING (true);



CREATE POLICY "Allow public read on photo_claims" ON "public"."photo_claims" FOR SELECT USING (true);



CREATE POLICY "Allow public read photo comments" ON "public"."photo_comments" FOR SELECT USING ((COALESCE("is_hidden", false) = false));



CREATE POLICY "Authenticated users can insert editorial feature history" ON "public"."site_editorial_feature_history" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert editorial features" ON "public"."site_editorial_features" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert moderation audit log" ON "public"."moderation_audit_log" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can read editorial feature history" ON "public"."site_editorial_feature_history" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read editorial features" ON "public"."site_editorial_features" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read moderation audit log" ON "public"."moderation_audit_log" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can update editorial features" ON "public"."site_editorial_features" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Public users can read active editorial features" ON "public"."site_editorial_features" FOR SELECT TO "anon" USING ((("is_active" = true) AND (("starts_at" IS NULL) OR ("starts_at" <= "now"())) AND (("ends_at" IS NULL) OR ("ends_at" >= "now"()))));



CREATE POLICY "Service role only" ON "public"."rate_limit_logs" USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."guest_face_tagging_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."guest_identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."guest_share_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."guest_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."guestbook_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."guestbook_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media_review_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media_review_clusters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media_review_faces" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."moderation_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."photo_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."photo_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."photo_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_limit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_editorial_feature_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_editorial_features" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_ip_address" "text", "p_action" "text", "p_max_requests" integer, "p_window_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_ip_address" "text", "p_action" "text", "p_max_requests" integer, "p_window_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_ip_address" "text", "p_action" "text", "p_max_requests" integer, "p_window_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_rate_limits"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_rate_limits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_rate_limits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_photo_comment_v1"("p_photo_key" "text", "p_author" "text", "p_content" "text", "p_session_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_photo_comment_v1"("p_photo_key" "text", "p_author" "text", "p_content" "text", "p_session_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_photo_comment_v1"("p_photo_key" "text", "p_author" "text", "p_content" "text", "p_session_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_gallery_photos_v1"("p_photo_ids" "uuid"[], "p_photo_urls" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_gallery_photos_v1"("p_photo_ids" "uuid"[], "p_photo_urls" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."delete_gallery_photos_v1"("p_photo_ids" "uuid"[], "p_photo_urls" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_gallery_photos_v1"("p_photo_ids" "uuid"[], "p_photo_urls" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_photo_comment_v1"("p_comment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_photo_comment_v1"("p_comment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_photo_comment_v1"("p_comment_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."demote_from_admin"("target_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."demote_from_admin"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_guestbook_messages_with_comments"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_guestbook_messages_with_comments"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_guestbook_messages_with_comments"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_photo_engagement_summary_v1"("p_photo_keys" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_photo_engagement_summary_v1"("p_photo_keys" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_photo_engagement_summary_v1"("p_photo_keys" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_photo_like_statuses"("p_photo_keys" "text"[], "p_session_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_photo_like_statuses"("p_photo_keys" "text"[], "p_session_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_photo_like_statuses"("p_photo_keys" "text"[], "p_session_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_recent_photo_comments_v1"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_recent_photo_comments_v1"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_recent_photo_comments_v1"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."hide_photo_comment_v1"("p_comment_id" "uuid", "p_hidden" boolean, "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hide_photo_comment_v1"("p_comment_id" "uuid", "p_hidden" boolean, "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hide_photo_comment_v1"("p_comment_id" "uuid", "p_hidden" boolean, "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_rate_limit"("p_ip_address" "text", "p_action" "text", "p_window_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_rate_limit"("p_ip_address" "text", "p_action" "text", "p_window_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_rate_limit"("p_ip_address" "text", "p_action" "text", "p_window_minutes" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."promote_to_admin"("target_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."promote_to_admin"("target_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_album_organization_v1"("p_album" "text", "p_ordered_photo_ids" "uuid"[], "p_moves" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_album_organization_v1"("p_album" "text", "p_ordered_photo_ids" "uuid"[], "p_moves" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."save_album_organization_v1"("p_album" "text", "p_ordered_photo_ids" "uuid"[], "p_moves" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_album_organization_v1"("p_album" "text", "p_ordered_photo_ids" "uuid"[], "p_moves" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_album_organization_v2"("p_album" "text", "p_ordered_photo_ids" "uuid"[], "p_moves" "jsonb", "p_delete_photo_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_album_organization_v2"("p_album" "text", "p_ordered_photo_ids" "uuid"[], "p_moves" "jsonb", "p_delete_photo_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."save_album_organization_v2"("p_album" "text", "p_ordered_photo_ids" "uuid"[], "p_moves" "jsonb", "p_delete_photo_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_album_organization_v2"("p_album" "text", "p_ordered_photo_ids" "uuid"[], "p_moves" "jsonb", "p_delete_photo_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_guestbook_message_with_rate_limit"("p_name" "text", "p_email" "text", "p_content" "text", "p_type" "text", "p_media_url" "text", "p_max_requests" integer, "p_window_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."submit_guestbook_message_with_rate_limit"("p_name" "text", "p_email" "text", "p_content" "text", "p_type" "text", "p_media_url" "text", "p_max_requests" integer, "p_window_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_guestbook_message_with_rate_limit"("p_name" "text", "p_email" "text", "p_content" "text", "p_type" "text", "p_media_url" "text", "p_max_requests" integer, "p_window_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_photo_like"("p_photo_key" "text", "p_session_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_photo_like"("p_photo_key" "text", "p_session_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_photo_like"("p_photo_key" "text", "p_session_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_photo_like_v2"("p_photo_key" "text", "p_session_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_photo_like_v2"("p_photo_key" "text", "p_session_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_photo_like_v2"("p_photo_key" "text", "p_session_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_activity_log_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_activity_log_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_activity_log_insert"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_auth_user_metadata"("uid" "uuid", "metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_auth_user_metadata"("uid" "uuid", "metadata" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."activity_log" TO "anon";
GRANT ALL ON TABLE "public"."activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."guest_face_tagging_batches" TO "anon";
GRANT ALL ON TABLE "public"."guest_face_tagging_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."guest_face_tagging_batches" TO "service_role";



GRANT ALL ON TABLE "public"."guest_identities" TO "anon";
GRANT ALL ON TABLE "public"."guest_identities" TO "authenticated";
GRANT ALL ON TABLE "public"."guest_identities" TO "service_role";



GRANT ALL ON TABLE "public"."guest_share_tokens" TO "anon";
GRANT ALL ON TABLE "public"."guest_share_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."guest_share_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."guest_uploads" TO "anon";
GRANT ALL ON TABLE "public"."guest_uploads" TO "authenticated";
GRANT ALL ON TABLE "public"."guest_uploads" TO "service_role";



GRANT ALL ON TABLE "public"."guestbook_comments" TO "anon";
GRANT ALL ON TABLE "public"."guestbook_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."guestbook_comments" TO "service_role";



GRANT ALL ON TABLE "public"."guestbook_messages" TO "anon";
GRANT ALL ON TABLE "public"."guestbook_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."guestbook_messages" TO "service_role";



GRANT ALL ON TABLE "public"."media_review_batches" TO "anon";
GRANT ALL ON TABLE "public"."media_review_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."media_review_batches" TO "service_role";



GRANT ALL ON TABLE "public"."media_review_clusters" TO "anon";
GRANT ALL ON TABLE "public"."media_review_clusters" TO "authenticated";
GRANT ALL ON TABLE "public"."media_review_clusters" TO "service_role";



GRANT ALL ON TABLE "public"."media_review_faces" TO "anon";
GRANT ALL ON TABLE "public"."media_review_faces" TO "authenticated";
GRANT ALL ON TABLE "public"."media_review_faces" TO "service_role";



GRANT ALL ON TABLE "public"."moderation_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."moderation_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."moderation_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."photo_claims" TO "anon";
GRANT ALL ON TABLE "public"."photo_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."photo_claims" TO "service_role";



GRANT ALL ON TABLE "public"."photo_comments" TO "anon";
GRANT ALL ON TABLE "public"."photo_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."photo_comments" TO "service_role";



GRANT ALL ON TABLE "public"."photo_likes" TO "anon";
GRANT ALL ON TABLE "public"."photo_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."photo_likes" TO "service_role";



GRANT ALL ON TABLE "public"."photos" TO "anon";
GRANT ALL ON TABLE "public"."photos" TO "authenticated";
GRANT ALL ON TABLE "public"."photos" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limit_logs" TO "anon";
GRANT ALL ON TABLE "public"."rate_limit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."site_editorial_feature_history" TO "anon";
GRANT ALL ON TABLE "public"."site_editorial_feature_history" TO "authenticated";
GRANT ALL ON TABLE "public"."site_editorial_feature_history" TO "service_role";



GRANT ALL ON TABLE "public"."site_editorial_features" TO "anon";
GRANT ALL ON TABLE "public"."site_editorial_features" TO "authenticated";
GRANT ALL ON TABLE "public"."site_editorial_features" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







