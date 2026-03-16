create or replace function toggle_photo_like(
  p_photo_key text,
  p_session_id text
)
returns table (
  photo_key text,
  likes_count bigint,
  liked boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  already_liked boolean;
begin
  if p_photo_key is null or btrim(p_photo_key) = '' then
    raise exception 'photo_key is required';
  end if;

  if p_session_id is null or btrim(p_session_id) = '' then
    raise exception 'session_id is required';
  end if;

  select exists(
    select 1
    from photo_likes
    where photo_likes.photo_key = p_photo_key
      and photo_likes.session_id = p_session_id
  )
  into already_liked;

  if already_liked then
    delete from photo_likes
    where photo_likes.photo_key = p_photo_key
      and photo_likes.session_id = p_session_id;
  else
    insert into photo_likes (photo_key, session_id)
    values (p_photo_key, p_session_id)
    on conflict (photo_key, session_id) do nothing;
  end if;

  return query
  select
    p_photo_key as photo_key,
    count(*)::bigint as likes_count,
    exists(
      select 1
      from photo_likes current_like
      where current_like.photo_key = p_photo_key
        and current_like.session_id = p_session_id
    ) as liked
  from photo_likes liked_rows
  where liked_rows.photo_key = p_photo_key;
end;
$$;

grant execute on function toggle_photo_like(text, text) to anon, authenticated;
