create or replace function toggle_photo_like_v2(
  p_photo_key text,
  p_session_id text
)
returns table (
  result_photo_key text,
  result_likes_count bigint,
  result_liked boolean
)
language plpgsql
security definer
set search_path = public
as $$
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

grant execute on function toggle_photo_like_v2(text, text) to anon, authenticated;
