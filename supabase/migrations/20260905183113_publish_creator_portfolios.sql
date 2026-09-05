alter table public.creator_portfolios
drop constraint if exists creator_portfolios_slug_check;

alter table public.creator_portfolios
add constraint creator_portfolios_slug_check check (
  slug is null or (
    char_length(slug) between 3 and 80
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and slug not in ('crear', 'cuenta', 'api', 'auth', 'login', 'admin')
  )
);

create or replace function private.slug_is_available(requested_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    requested_slug is not null
    and char_length(requested_slug) between 3 and 80
    and requested_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and requested_slug not in ('crear', 'cuenta', 'api', 'auth', 'login', 'admin')
    and not exists (
      select 1
      from public.creator_portfolios as portfolio
      where lower(portfolio.slug) = lower(requested_slug)
        and portfolio.status = 'published'
        and portfolio.user_id <> (select auth.uid())
    );
$$;

create or replace function public.is_portfolio_slug_available(requested_slug text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.slug_is_available(requested_slug);
$$;

create or replace function private.get_published_portfolio_data(requested_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'slug', portfolio.slug,
    'updated_at', portfolio.updated_at,
    'content', portfolio.content - array['password', 'notifyViews'],
    'media', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'asset_id', media.asset_id,
          'kind', media.kind,
          'storage_path', media.storage_path,
          'preview_path', media.preview_path,
          'original_name', media.original_name,
          'media_type', media.media_type,
          'category', media.category,
          'framed', media.framed,
          'instagram', media.instagram,
          'tiktok', media.tiktok,
          'sort_order', media.sort_order
        ) order by media.sort_order, media.asset_id
      )
      from public.creator_media as media
      where media.user_id = portfolio.user_id
    ), '[]'::jsonb)
  )
  from public.creator_portfolios as portfolio
  where portfolio.status = 'published'
    and lower(portfolio.slug) = lower(requested_slug)
    and coalesce(portfolio.content ->> 'visibility', 'public') = 'public'
    and requested_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  limit 1;
$$;

create or replace function public.get_published_portfolio(requested_slug text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_published_portfolio_data(requested_slug);
$$;

create or replace function private.is_public_creator_asset(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.creator_media as media
    join public.creator_portfolios as portfolio
      on portfolio.user_id = media.user_id
    where (media.storage_path = object_name or media.preview_path = object_name)
      and portfolio.status = 'published'
      and coalesce(portfolio.content ->> 'visibility', 'public') = 'public'
  );
$$;

revoke all on function private.slug_is_available(text) from public, anon, authenticated;
revoke all on function private.get_published_portfolio_data(text) from public, anon, authenticated;
revoke all on function private.is_public_creator_asset(text) from public, anon, authenticated;
revoke all on function public.is_portfolio_slug_available(text) from public, anon, authenticated;
revoke all on function public.get_published_portfolio(text) from public, anon, authenticated;

grant usage on schema private to anon, authenticated;
grant execute on function private.slug_is_available(text) to authenticated;
grant execute on function private.get_published_portfolio_data(text) to anon, authenticated;
grant execute on function private.is_public_creator_asset(text) to anon, authenticated;
grant execute on function public.is_portfolio_slug_available(text) to authenticated;
grant execute on function public.get_published_portfolio(text) to anon, authenticated;

drop policy if exists "Published portfolio assets are readable" on storage.objects;
create policy "Published portfolio assets are readable"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'creator-media'
  and private.is_public_creator_asset(name)
);
