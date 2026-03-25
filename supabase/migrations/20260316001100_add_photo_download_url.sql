alter table public.photos
add column if not exists download_url text;

update public.photos
set download_url = coalesce(download_url, url)
where download_url is null;
