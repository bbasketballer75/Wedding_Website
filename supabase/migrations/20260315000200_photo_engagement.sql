-- ============================================
-- Photo Engagement
-- Real likes and comments for gallery images
-- ============================================

create table if not exists photo_likes (
  id uuid default gen_random_uuid() primary key,
  photo_key text not null,
  session_id text not null,
  created_at timestamp with time zone default now(),
  unique (photo_key, session_id)
);

alter table photo_likes enable row level security;

create index if not exists idx_photo_likes_photo_key on photo_likes(photo_key);
create index if not exists idx_photo_likes_created_at on photo_likes(created_at desc);

create table if not exists photo_comments (
  id uuid default gen_random_uuid() primary key,
  photo_key text not null,
  author text not null default 'Guest',
  content text not null check (char_length(btrim(content)) between 1 and 1000),
  created_at timestamp with time zone default now()
);

alter table photo_comments enable row level security;

create index if not exists idx_photo_comments_photo_key on photo_comments(photo_key);
create index if not exists idx_photo_comments_created_at on photo_comments(created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'photo_comments'
      and policyname = 'Allow public read photo comments'
  ) then
    create policy "Allow public read photo comments" on photo_comments
      for select using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'photo_comments'
      and policyname = 'Allow public insert photo comments'
  ) then
    create policy "Allow public insert photo comments" on photo_comments
      for insert with check (true);
  end if;
end
$$;

create or replace function get_photo_like_statuses(
  p_photo_keys text[],
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
    where photo_key = p_photo_key
      and session_id = p_session_id
  )
  into already_liked;

  if already_liked then
    delete from photo_likes
    where photo_key = p_photo_key
      and session_id = p_session_id;
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

grant execute on function get_photo_like_statuses(text[], text) to anon, authenticated;
grant execute on function toggle_photo_like(text, text) to anon, authenticated;
