create schema if not exists private;

create table if not exists public.creator_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id bigint not null,
  kind text not null check (kind in ('media', 'brand')),
  storage_path text not null,
  original_name text not null,
  media_type text check (media_type in ('image', 'video')),
  category text not null default '',
  framed boolean not null default false,
  instagram text not null default '',
  tiktok text not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  size_bytes bigint not null check (size_bytes >= 0 and size_bytes <= 52428800),
  mime_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_media_user_asset_key unique (user_id, asset_id),
  constraint creator_media_storage_path_key unique (storage_path),
  constraint creator_media_path_owner_check check (
    split_part(storage_path, '/', 1) = user_id::text
  ),
  constraint creator_media_kind_type_check check (
    (kind = 'media' and media_type is not null)
    or (kind = 'brand' and media_type = 'image')
  )
);

alter table public.creator_media enable row level security;

revoke all on table public.creator_media from anon;
grant select, insert, update, delete on table public.creator_media to authenticated;

drop policy if exists "Creators can read their media" on public.creator_media;
create policy "Creators can read their media"
on public.creator_media
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Creators can add their media" on public.creator_media;
create policy "Creators can add their media"
on public.creator_media
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Creators can update their media" on public.creator_media;
create policy "Creators can update their media"
on public.creator_media
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Creators can delete their media" on public.creator_media;
create policy "Creators can delete their media"
on public.creator_media
for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function private.set_creator_media_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_creator_media_updated_at() from public, anon, authenticated;

drop trigger if exists set_creator_media_updated_at on public.creator_media;
create trigger set_creator_media_updated_at
before update on public.creator_media
for each row execute function private.set_creator_media_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creator-media',
  'creator-media',
  false,
  52428800,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Creators can read their storage folder" on storage.objects;
create policy "Creators can read their storage folder"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'creator-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Creators can upload to their storage folder" on storage.objects;
create policy "Creators can upload to their storage folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'creator-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Creators can update their storage folder" on storage.objects;
create policy "Creators can update their storage folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'creator-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'creator-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Creators can delete their storage folder" on storage.objects;
create policy "Creators can delete their storage folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'creator-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
