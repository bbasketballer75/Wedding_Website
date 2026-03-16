alter table public.photos
  add column if not exists album_sort_order integer not null default 0;

create index if not exists idx_photos_album_sort_order
  on public.photos (album, album_sort_order, created_at desc);

insert into public.photos (
  url,
  thumbnail,
  caption,
  album,
  album_sort_order,
  category,
  location,
  date,
  likes,
  photographer,
  is_professional,
  tags,
  faces,
  created_at
)
select
  seed.url,
  seed.thumbnail,
  seed.caption,
  'Engagement',
  seed.album_sort_order,
  'Engagement',
  seed.location,
  seed.date_value,
  0,
  seed.photographer,
  true,
  seed.tags,
  seed.faces,
  seed.created_at
from (
  values
    (
      '/images/engagement/PoradaProposal-29.webp',
      '/images/engagement/PoradaProposal-29.webp',
      'The walk into the surprise',
      1,
      'Proposal spot',
      '2024-10-31T18:00:00Z'::timestamptz,
      'Emma Photography',
      array['engagement', 'proposal', 'arrival']::text[],
      '[{"id":"f1","name":"Jordyn","x":40,"y":35},{"id":"f2","name":"Austin","x":65,"y":40}]'::jsonb,
      '2024-10-31T18:00:00Z'::timestamptz
    ),
    (
      '/images/engagement/PoradaProposal-11.webp',
      '/images/engagement/PoradaProposal-11.webp',
      'A quiet pause before forever',
      2,
      'Proposal spot',
      '2024-10-31T18:05:00Z'::timestamptz,
      'Emma Photography',
      array['engagement', 'portrait', 'jordyn']::text[],
      '[{"id":"f3","name":"Jordyn","x":50,"y":45}]'::jsonb,
      '2024-10-31T18:05:00Z'::timestamptz
    ),
    (
      '/images/engagement/PoradaProposal-150.webp',
      '/images/engagement/PoradaProposal-150.webp',
      'The question already answered in her smile',
      3,
      'Proposal spot',
      '2024-10-31T18:08:00Z'::timestamptz,
      'Emma Photography',
      array['engagement', 'proposal', 'yes']::text[],
      '[{"id":"f4","name":"Austin","x":35,"y":40},{"id":"f5","name":"Jordyn","x":65,"y":40}]'::jsonb,
      '2024-10-31T18:08:00Z'::timestamptz
    ),
    (
      '/images/engagement/PoradaProposal-181.webp',
      '/images/engagement/PoradaProposal-181.webp',
      'Right after the yes',
      4,
      'Proposal spot',
      '2024-10-31T18:10:00Z'::timestamptz,
      'Emma Photography',
      array['engagement', 'celebration', 'couple']::text[],
      '[{"id":"f6","name":"Austin","x":45,"y":45},{"id":"f7","name":"Jordyn","x":55,"y":45}]'::jsonb,
      '2024-10-31T18:10:00Z'::timestamptz
    ),
    (
      '/images/engagement/PoradaProposal-255.webp',
      '/images/engagement/PoradaProposal-255.webp',
      'Calling the people who had to know first',
      5,
      'After the proposal',
      '2024-10-31T18:18:00Z'::timestamptz,
      'Emma Photography',
      array['engagement', 'celebration', 'phone call']::text[],
      '[{"id":"f8","name":"Austin","x":30,"y":50},{"id":"f9","name":"Jordyn","x":70,"y":50}]'::jsonb,
      '2024-10-31T18:18:00Z'::timestamptz
    ),
    (
      '/images/engagement/PoradaProposal-277.webp',
      '/images/engagement/PoradaProposal-277.webp',
      'The just-engaged portraits',
      6,
      'Portraits',
      '2024-10-31T18:22:00Z'::timestamptz,
      'Emma Photography',
      array['engagement', 'portrait', 'romantic']::text[],
      '[{"id":"f10","name":"Austin","x":40,"y":45},{"id":"f11","name":"Jordyn","x":60,"y":45}]'::jsonb,
      '2024-10-31T18:22:00Z'::timestamptz
    ),
    (
      '/images/engagement/PoradaProposal-310.webp',
      '/images/engagement/PoradaProposal-310.webp',
      'A closer look at the ring',
      7,
      'Portraits',
      '2024-10-31T18:26:00Z'::timestamptz,
      'Emma Photography',
      array['engagement', 'ring', 'details']::text[],
      '[{"id":"f12","name":"Austin","x":45,"y":40},{"id":"f13","name":"Jordyn","x":55,"y":40}]'::jsonb,
      '2024-10-31T18:26:00Z'::timestamptz
    ),
    (
      '/images/engagement/PoradaProposal-375.webp',
      '/images/engagement/PoradaProposal-375.webp',
      'The exhale after everything changed',
      8,
      'Portraits',
      '2024-10-31T18:32:00Z'::timestamptz,
      'Emma Photography',
      array['engagement', 'portrait', 'quiet moment']::text[],
      '[{"id":"f14","name":"Jordyn","x":25,"y":50},{"id":"f15","name":"Austin","x":50,"y":45}]'::jsonb,
      '2024-10-31T18:32:00Z'::timestamptz
    )
) as seed(
  url,
  thumbnail,
  caption,
  album_sort_order,
  location,
  date_value,
  photographer,
  tags,
  faces,
  created_at
)
where not exists (
  select 1
  from public.photos existing
  where existing.url = seed.url
);

with ranked as (
  select
    id,
    row_number() over (
      partition by coalesce(album, category, 'Wedding Day')
      order by created_at desc nulls last, id
    ) as next_order
  from public.photos
  where album_sort_order = 0
)
update public.photos photos
set album_sort_order = ranked.next_order
from ranked
where photos.id = ranked.id;

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
  v_role text := coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '');
  v_moved_count integer := 0;
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
