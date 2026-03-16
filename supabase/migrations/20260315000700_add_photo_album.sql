alter table public.photos
  add column if not exists album text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'photos_album_check'
      and conrelid = 'public.photos'::regclass
  ) then
    alter table public.photos
      add constraint photos_album_check
      check (
        album is null
        or album in ('Engagement', 'Bach+ette', 'Wedding Day', 'Guest Uploads')
      );
  end if;
end $$;

update public.photos
set album = case
  when category in ('Engagement', 'Bach+ette', 'Wedding Day', 'Guest Uploads') then category
  else album
end
where album is null;
