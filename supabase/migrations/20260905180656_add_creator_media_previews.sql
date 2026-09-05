alter table public.creator_media
add column if not exists preview_path text;

alter table public.creator_media
drop constraint if exists creator_media_preview_path_owner_check;

alter table public.creator_media
add constraint creator_media_preview_path_owner_check check (
  preview_path is null
  or split_part(preview_path, '/', 1) = user_id::text
);

create unique index if not exists creator_media_preview_path_key
on public.creator_media (preview_path)
where preview_path is not null;
