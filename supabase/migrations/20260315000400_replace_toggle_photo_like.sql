create or replace function toggle_photo_like(
  p_photo_key text,
  p_session_id text
)
returns table (
  photo_key text,
  likes_count bigint,
  liked boolean
)
language sql
security definer
set search_path = public
as $$
  with existing as (
    select 1
    from photo_likes existing_like
    where existing_like.photo_key = p_photo_key
      and existing_like.session_id = p_session_id
  ),
  deleted as (
    delete from photo_likes like_to_delete
    where exists (select 1 from existing)
      and like_to_delete.photo_key = p_photo_key
      and like_to_delete.session_id = p_session_id
    returning 1
  ),
  inserted as (
    insert into photo_likes (photo_key, session_id)
    select p_photo_key, p_session_id
    where not exists (select 1 from existing)
    on conflict (photo_key, session_id) do nothing
    returning 1
  )
  select
    requested.photo_key,
    count(current_likes.id)::bigint as likes_count,
    exists(
      select 1
      from photo_likes my_like
      where my_like.photo_key = requested.photo_key
        and my_like.session_id = p_session_id
    ) as liked
  from (select p_photo_key as photo_key) requested
  left join photo_likes current_likes on current_likes.photo_key = requested.photo_key
  group by requested.photo_key;
$$;

grant execute on function toggle_photo_like(text, text) to anon, authenticated;
